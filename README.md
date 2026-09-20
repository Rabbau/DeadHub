# [Dead Hub](https://dead-hub.vercel.app/)

Фан-сайт сообщества для игры **Deadlock** (Valve) — справочник по героям, каталог предметов, матчапы (контрпики и синергии), профили игроков, лидерборд, сравнение, тир-лист и генератор случайного билда. Данные загружаются с [deadlock-api.com](https://deadlock-api.com).

## Технологии

| | |
|---|---|
| **Фреймворк** | React 18 + Vite 6 |
| **Роутинг** | React Router v6 |
| **Состояние** | Zustand 5 (persist для тир-листа и сравнения) |
| **Стили** | CSS (`index.css`) + clsx |
| **Деплой** | Vercel (Edge Functions + CDN) |
| **Планы** | React frontend + FastAPI backend (см. [CHECKLIST.md](./CHECKLIST.md)) |

## Страницы

| Маршрут | Описание |
|---|---|
| `/` | Список героев с поиском, фильтром по роли и сортировкой |
| `/hero/:id` | Детальная страница героя: статы, матчапы, популярные билды, способности |
| `/meta` | Мета-дашборд: топ героев по винрейту и пикрейту |
| `/matchups` | Матчапы: кто кого контрит и с кем герои играют лучше (списки по герою и тепловая карта 38×38) |
| `/items`, `/items/:id` | Каталог предметов, сгруппированных по тирам; статистика предмета |
| `/build` | Генератор случайного билда (герой + 12 предметов) |
| `/tierlist` | Drag-and-drop тир-лист с сохранением в localStorage |
| `/compare` | Сравнение до 3 героев по статам и способностям |
| `/leaderboard` | Лидерборд по 5 регионам, общий и по конкретному герою |
| `/players`, `/player/:id` | Поиск игрока (ник, Account ID, SteamID64) и его профиль: ранг, герои, история матчей |

## Фильтры статистики

Период (7 / 14 / 30 / 90 дней) и диапазон рангов (от Initiate до Eternus) — общие для всего сайта: панель `StatsFilters` есть на главной, мете, матчапах, страницах героя и предмета. Выбор хранится в `localStorage` (`dlhub_filters`).

Статистика героев берётся из `GET /v1/analytics/hero-stats` — **одним запросом на всех героев**. Винрейт — доля побед героя, пикрейт — доля героя среди всех пиков выборки (сумма по героям 100%). Под панелью показан размер выборки: при узких фильтрах (высокие ранги, короткий период) цифры «шумят», и сайт об этом предупреждает.

Начало периода округляется до суток (UTC), чтобы адрес запроса не менялся каждую секунду — иначе не работал бы ни кеш браузера, ни CDN.

## Структура проекта

```
├── api/
│   ├── ping.js              # Health-check: GET /api/ping
│   └── proxy.js             # Edge Function — CORS-прокси к deadlock-api.com
├── src/
│   ├── api/
│   │   ├── config.js        # Режим API (direct / vercel / backend)
│   │   ├── heroApi.js       # Герои: assets + hero-stats, нормализация
│   │   ├── itemApi.js       # Запросы предметов
│   │   ├── analyticsApi.js  # Статистика предметов и сборок
│   │   ├── matchupApi.js    # Матрицы контрпиков и синергий
│   │   ├── playerApi.js     # Поиск игроков, профиль, история матчей
│   │   ├── leaderboardApi.js# Лидерборды по регионам
│   │   ├── ranksApi.js      # Названия и бейджи рангов
│   │   ├── httpClient.js    # fetch + кеш в localStorage (TTL, transform, дедупликация)
│   │   └── index.js         # Реэкспорт
│   ├── components/
│   │   ├── hero/             # HeroCard, HeroIcon
│   │   ├── matchups/         # MatchupPanel, MatchupMatrix, HeroMatchups
│   │   ├── layout/
│   │   │   ├── Layout.jsx   # Обёртка с навигацией
│   │   │   └── Nav.jsx
│   │   └── ui/
│   │       ├── ItemCard.jsx
│   │       ├── SkeletonGrid.jsx
│   │       ├── StatsFilters.jsx  # Период + диапазон рангов
│   │       ├── RankBadge.jsx
│   │       └── Avatar.jsx
│   ├── hooks/
│   │   ├── useHeroes.js         # Список героев + фильтры
│   │   ├── useHeroDetail.js     # Детали героя
│   │   ├── useMatchups.js       # Матрицы матчапов
│   │   ├── usePlayers.js        # Поиск и профиль игрока
│   │   ├── useLeaderboard.js    # Лидерборд региона
│   │   ├── useRanks.js          # Названия рангов
│   │   ├── useRandomBuild.js    # Генератор билда
│   │   ├── useCompareHeroes.js  # Хук для сравнения
│   │   └── useTranslation.js    # Локализация
│   ├── i18n/
│   │   ├── index.js
│   │   └── locales/
│   │       ├── en.js
│   │       └── ru.js
│   ├── pages/
│   │   ├── HomePage.jsx
│   │   ├── HeroPage.jsx
│   │   ├── ItemsPage.jsx
│   │   ├── BuildPage.jsx
│   │   ├── TierListPage.jsx
│   │   ├── ComparePage.jsx
│   │   ├── MatchupsPage.jsx
│   │   ├── LeaderboardPage.jsx
│   │   ├── PlayersPage.jsx
│   │   └── PlayerPage.jsx
│   ├── services/
│   │   ├── heroService.js      # Фильтрация, сортировка, форматирование
│   │   ├── statsFilters.js     # Период/ранг → query-параметры API
│   │   ├── matchupService.js   # Индексы матриц, рейтинги, цвет ячеек
│   │   ├── playerService.js    # SteamID64 → Account ID, агрегаты игрока
│   │   ├── rankService.js      # Бейджи рангов
│   │   └── format.js           # Числа и даты с учётом языка
│   ├── store/
│   │   ├── heroStore.js     # Герои, фильтры статистики, язык
│   │   ├── tierStore.js     # Тир-лист (persist)
│   │   ├── compareStore.js  # Выбранные герои (persist)
│   │   └── playerStore.js   # Недавно открытые профили (persist)
│   └── types/
│       └── index.js         # JSDoc-типы
├── CHECKLIST.md             # Чек-лист задач и планов
├── index.html
├── vite.config.js
├── vercel.json
└── package.json
```

## Запуск

### Требования

- Node.js 18+

### Установка

```bash
git clone <repo-url>
cd deadlocker
npm install
```

### Переменные окружения

Скопируй `.env.example` в `.env`:

```bash
cp .env.example .env
```

Доступные режимы API (`VITE_API_MODE`):

| Режим | Описание |
|---|---|
| `direct` | Прямые запросы к `deadlock-api.com` (подходит для GitHub Pages) |
| `vercel` | Запросы через `/api` (Vercel rewrites / Edge Function) |
| `backend` | Собственный FastAPI-бэкенд (`VITE_BACKEND_URL`) |

### Dev-сервер

```bash
npm run dev
```

Vite проксирует `/api/*` → `https://api.deadlock-api.com`, CORS в локальной разработке не мешает.

### Сборка и деплой

```bash
npm run build    # сборка в dist/
npm run preview  # локальный предпросмотр сборки
```

Для деплоя на **Vercel**: подключи репозиторий — `vercel.json` уже настроен.

## CORS-прокси (api/proxy.js)

Edge Function поддерживает два апстрима:

```
/api/proxy.js?path=assets/...    → https://assets.deadlock-api.com/...
/api/proxy.js?path=analytics/... → https://api.deadlock-api.com/...
```

Ответы кэшируются на Vercel CDN (`Cache-Control: s-maxage=3600`).

## Локализация

Сайт поддерживает **русский** и **английский**. Переводы в `src/i18n/locales/`. Для нового языка — добавь файл локали и зарегистрируй его в `src/i18n/index.js`.

## Архитектура и планы

Сейчас проект — SPA, которая ходит напрямую (или через прокси) в публичный Deadlock API. Логика нормализации данных живёт во фронте (`heroApi.js`, `heroService.js`).

В будущем планируется переход на **React + FastAPI**:

- фронт остаётся тонким клиентом;
- бэкенд агрегирует запросы, кеширует данные, отдаёт готовые DTO;
- переключение через `VITE_API_MODE=backend` (заготовка уже есть в `config.js`).

Подробный чек-лист задач, идеи по функционалу и план миграции — в [CHECKLIST.md](./CHECKLIST.md).
