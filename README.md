# [Dead Hub](https://dead-hub.vercel.app/)

Фан-сайт сообщества для игры **Deadlock** (Valve) — справочник по героям, каталог предметов, сравнение, тир-лист и генератор случайного билда. Данные загружаются с [deadlock-api.com](https://deadlock-api.com).

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
| `/hero/:id` | Детальная страница героя: статы, способности, апгрейды |
| `/items` | Каталог предметов, сгруппированных по тирам |
| `/build` | Генератор случайного билда (герой + 12 предметов) |
| `/tierlist` | Drag-and-drop тир-лист с сохранением в localStorage |
| `/compare` | Сравнение до 3 героев по статам и способностям |

## Структура проекта

```
├── api/
│   ├── ping.js              # Health-check: GET /api/ping
│   └── proxy.js             # Edge Function — CORS-прокси к deadlock-api.com
├── src/
│   ├── api/
│   │   ├── config.js        # Режим API (direct / vercel / backend)
│   │   ├── heroApi.js       # Запросы и нормализация данных героев
│   │   ├── itemApi.js       # Запросы предметов
│   │   ├── httpClient.js    # fetch + кеш в localStorage
│   │   └── index.js         # Реэкспорт
│   ├── components/
│   │   ├── hero/HeroCard.jsx
│   │   ├── layout/
│   │   │   ├── Layout.jsx   # Обёртка с навигацией
│   │   │   └── Nav.jsx
│   │   └── ui/
│   │       ├── ItemCard.jsx
│   │       └── SkeletonGrid.jsx
│   ├── hooks/
│   │   ├── useHeroes.js         # Список героев + фильтры
│   │   ├── useHeroDetail.js     # Детали героя
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
│   │   └── ComparePage.jsx
│   ├── services/
│   │   └── heroService.js   # Фильтрация, сортировка, форматирование
│   ├── store/
│   │   ├── heroStore.js     # Герои, фильтры, язык
│   │   ├── tierStore.js     # Тир-лист (persist)
│   │   └── compareStore.js  # Выбранные герои (persist)
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
