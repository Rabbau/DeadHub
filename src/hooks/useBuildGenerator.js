import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fetchAllItems, fetchHeroItemStats } from '../api/index.js';
import { isAvailableItem } from '../services/itemService.js';
import {
  buildFromEntry,
  buildSearch,
  dailySeed,
  dayKey,
  historyEntry,
  makeBuild,
  normalizeOptions,
  parseBuildSearch,
  pickHero,
  randomSeed,
  usefulItemIds,
} from '../services/buildService.js';
import { useBuildStore } from '../store/buildStore.js';

const NO_STATS = { heroId: null, set: null, status: 'idle' };

function initialState(search, today) {
  const parsed = parseBuildSearch(new URLSearchParams(search));
  return { draft: parsed.options, roll: { options: parsed.options, seed: parsed.seed ?? today, pins: parsed.pins } };
}

/**
 * Случайный билд: настройки в панели, отображаемый билд, закрепление предметов, броски, история и адрес.
 *
 * Состояний три. `draft` — то, что выставлено в панели (на билд не влияет, пока не нажали «Сгенерировать»);
 * `roll` — из чего собран показанный билд (настройки, зерно, закреплённые на момент броска предметы): он же пишется в
 * адрес, так что ссылка воспроизводит билд; `pinned` — что закреплено сейчас (закрепление не пересобирает билд,
 * оно действует на следующий бросок). Билд — производная от `roll`, справочника предметов и (если включён фильтр
 * «нужное герою») статистики предметов героя.
 *
 * @param {{ heroes: any[], language: string }} input heroes — доступные игрокам герои
 */
export function useBuildGenerator({ heroes, language }) {
  const { search } = useLocation();
  const navigate = useNavigate();
  const history = useBuildStore((state) => state.history);
  const record = useBuildStore((state) => state.record);
  const day = useMemo(() => dayKey(), []);
  const today = useMemo(() => dailySeed(day), [day]);

  const [initial] = useState(() => initialState(search, today));
  const [draft, setDraft] = useState(initial.draft);
  const [roll, setRoll] = useState(initial.roll);
  const [pinned, setPinned] = useState(() => new Set(initial.roll.pins));
  const [fixed, setFixed] = useState(null); // запись истории, показанная как есть (предметы по id, без пересборки по зерну)
  const [notice, setNotice] = useState(null);
  const [items, setItems] = useState({ status: 'loading', list: [] });
  const [attempt, setAttempt] = useState(0);
  const [stats, setStats] = useState(NO_STATS);
  const pendingRecord = useRef(false);
  const urlRef = useRef(search);

  // ── Справочник предметов (кеш на 6 часов) ───────────────────────
  useEffect(() => {
    let cancelled = false;
    setItems((prev) => ({ ...prev, status: 'loading' }));
    fetchAllItems(language)
      .then((all) => { if (!cancelled) setItems({ status: 'ready', list: all.filter(isAvailableItem) }); })
      .catch(() => { if (!cancelled) setItems({ status: 'error', list: [] }); });
    return () => { cancelled = true; };
  }, [language, attempt]);

  // ── Герой и статистика его предметов ────────────────────────────
  const hero = useMemo(
    () => (fixed ? heroes.find((candidate) => candidate.id === fixed.heroId) ?? null : pickHero(heroes, roll.options, roll.seed)),
    [heroes, roll, fixed],
  );
  const heroId = hero?.id ?? null;
  const wantStats = heroId !== null && roll.options.useful && !fixed;

  useEffect(() => {
    if (!wantStats) return undefined;
    let cancelled = false;
    setStats((prev) => (prev.heroId === heroId ? prev : { heroId, set: null, status: 'loading' }));
    // Статистика не пришла — билд собирается без фильтра, страница скажет об этом
    fetchHeroItemStats(heroId)
      .then((rows) => { if (!cancelled) setStats({ heroId, set: usefulItemIds(rows), status: 'ready' }); })
      .catch(() => { if (!cancelled) setStats({ heroId, set: null, status: 'ready' }); });
    return () => { cancelled = true; };
  }, [wantStats, heroId]);

  const statsReady = !wantStats || (stats.heroId === heroId && stats.status === 'ready');

  // ── Билд ────────────────────────────────────────────────────────
  const result = useMemo(() => {
    if (items.status !== 'ready') return null;
    if (fixed) return buildFromEntry(fixed, items.list, heroes) ?? { error: 'noItems' };
    if (!hero || !statsReady) return null;
    return makeBuild({
      hero,
      items: items.list,
      options: roll.options,
      seed: roll.seed,
      pins: roll.pins,
      useful: stats.heroId === heroId ? stats.set : null,
    });
  }, [items, fixed, hero, heroId, heroes, roll, statsReady, stats]);

  const build = result && !result.error ? result : null;
  let error = null;
  if (items.status === 'error') error = 'itemsFailed';
  else if (items.status === 'ready' && heroes.length === 0) error = 'noHeroes';
  else if (result?.error) error = result.error;

  // Каждый бросок, сделанный посетителем, попадает в историю (показ билда дня и открытие ссылки — нет)
  useEffect(() => {
    if (!build || !pendingRecord.current) return;
    pendingRecord.current = false;
    record(historyEntry(build, { pins: roll.pins }));
  }, [build, roll.pins, record]);

  // ── Действия ────────────────────────────────────────────────────
  /** Меняет настройки в панели: объект с изменениями или функция от текущих настроек (нужна, когда новое зависит от старого). */
  const updateDraft = useCallback((patch) => {
    setNotice(null);
    setDraft((prev) => ({ ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) }));
  }, []);

  /** Новый билд с нуля: новое зерно, герой выбирается заново (если «любой»), закрепления снимаются. */
  const generate = useCallback(() => {
    if (!draft.slots.length) {
      setNotice('noSlots');
      return;
    }
    setNotice(null);
    pendingRecord.current = true;
    setFixed(null);
    setPinned(new Set());
    setRoll({ options: normalizeOptions(draft), seed: randomSeed(), pins: [] });
  }, [draft]);

  /** Бросок остального: герой и закреплённые предметы остаются, прочее выбирается заново. */
  const reroll = useCallback(() => {
    if (!build) return;
    pendingRecord.current = true;
    setFixed(null);
    setRoll({ options: { ...build.options, heroId: build.hero.id }, seed: randomSeed(), pins: [...pinned] });
  }, [build, pinned]);

  const togglePin = useCallback((id) => {
    setPinned((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /** Показывает бросок из истории и возвращает его настройки в панель. */
  const restore = useCallback((entry) => {
    setNotice(null);
    setFixed(entry);
    setDraft({ ...entry.options, heroId: entry.heroId });
    setRoll({ options: { ...entry.options, heroId: entry.heroId }, seed: entry.seed, pins: entry.pins });
    setPinned(new Set(entry.pins));
  }, []);

  // ── Адрес ───────────────────────────────────────────────────────
  const currentSearch = useMemo(
    () => buildSearch({ options: roll.options, seed: roll.seed, pins: roll.pins }, today),
    [roll, today],
  );

  // Состояние → адрес (заменой: щелчки по «Сгенерировать» не засоряют историю браузера)
  useEffect(() => {
    if (currentSearch === urlRef.current) return;
    urlRef.current = currentSearch;
    navigate({ search: currentSearch }, { replace: true });
  }, [currentSearch, navigate]);

  // Адрес → состояние: адрес поменяли снаружи (ссылка в меню на /build, «назад») — страница следует за ним
  useEffect(() => {
    if (search === urlRef.current) return;
    urlRef.current = search;
    const parsed = parseBuildSearch(new URLSearchParams(search));
    setFixed(null);
    setNotice(null);
    setDraft(parsed.options);
    setRoll({ options: parsed.options, seed: parsed.seed ?? today, pins: parsed.pins });
    setPinned(new Set(parsed.pins));
  }, [search, today]);

  // Клавиша R — новый билд (по коду клавиши, чтобы работала и в русской раскладке); в полях ввода не мешает
  useEffect(() => {
    const onKey = (event) => {
      if (event.code !== 'KeyR' || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName))) return;
      event.preventDefault();
      generate();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [generate]);

  // Ссылка для «Поделиться» всегда с зерном: билд дня завтра будет другим, а ссылка должна вести на этот
  const shareUrl = useMemo(
    () => `${window.location.origin}/build${buildSearch({ options: roll.options, seed: roll.seed, pins: roll.pins }, null)}`,
    [roll],
  );

  return {
    day,
    items,
    hero,
    build,
    error,
    notice,
    pending: !build && !error && (items.status === 'loading' || heroes.length > 0),
    draft,
    updateDraft,
    pinned,
    history,
    generate,
    reroll,
    togglePin,
    restore,
    shareUrl,
    retry: () => setAttempt((value) => value + 1),
    usefulMissing: Boolean(build && build.options.useful && !build.usefulApplied && !fixed),
  };
}
