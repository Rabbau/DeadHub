# [Dead Hub](https://dead-hub.vercel.app/)

Фан-сайт сообщества для игры **Deadlock** (Valve) — справочник по героям, каталог предметов и генератор случайного билда. Данные загружаются с [deadlock-api.com](https://deadlock-api.com).

## Технологии

| | |
|---|---|
| **Фреймворк** | React 18 + Vite 6 |
| **Роутинг** | React Router v6 |
| **Состояние** | Zustand 5 |
| **Стили** | CSS (index.css) + clsx |
| **Деплой** | Vercel (Edge Functions) |

## Структура проекта

```
├── api/
│   ├── ping.js          # Health-check: GET /api/ping
│   └── proxy.js         # Edge Function — CORS-прокси к deadlock-api.com
├── public/
│   └── favicon.png
├── src/
│   ├── api/
│   │   ├── config.js        # Режим API (direct / vercel / backend)
│   │   ├── heroApi.js       # Запросы героев
│   │   ├── itemApi.js       # Запросы предметов
│   │   ├── httpClient.js    # Обёртка над fetch
│   │   └── index.js         # Реэкспорт
│   ├── components/
│   │   ├── hero/HeroCard.jsx
│   │   ├── layout/
│   │   │   ├── Layout.jsx   # Обёртка с навигацией
│   │   │   └── Nav.jsx
│   │   └── ui/ItemCard.jsx
│   ├── hooks/
│   │   ├── useHeroes.js         # Список всех героев
│   │   ├── useHeroDetail.js     # Детали конкретного героя
│   │   ├── useRandomBuild.js    # Генератор случайного билда
│   │   └── useTranslation.js    # Хук локализации
│   ├── i18n/
│   │   └── locales/
│   │       ├── en.js
│   │       └── ru.js
│   ├── pages/
│   │   ├── HomePage.jsx     # Список героев
│   │   ├── HeroPage.jsx     # Детали героя
│   │   ├── ItemsPage.jsx    # Каталог предметов
│   │   └── BuildPage.jsx    # Генератор билда
│   ├── services/
│   │   └── heroService.js   # Бизнес-логика поверх API
│   ├── store/
│   │   └── heroStore.js     # Zustand-стор
│   └── types/
│       └── index.js         # JSDoc-типы
├── index.html
├── vite.config.js
├── vercel.json
└── package.json
```

## Страницы

| Маршрут | Описание |
|---|---|
| `/` | Список всех героев |
| `/hero/:id` | Детальная страница героя |
| `/items` | Каталог предметов |
| `/build` | Генератор случайного билда |

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
| `vercel` | Запросы через Edge Function `/api/proxy.js` (устраняет CORS) |
| `backend` | Собственный Python-бэкенд (раскомментировать в `.env`) |

### Запуск dev-сервера

```bash
npm run dev
```

Vite автоматически проксирует `/api/*` → `https://api.deadlock-api.com`, так что CORS в локальной разработке не мешает.

### Сборка и деплой

```bash
npm run build    # сборка в dist/
npm run preview  # локальный предпросмотр сборки
```

Для деплоя на **Vercel**: достаточно подключить репозиторий — `vercel.json` уже настроен. Edge Function в `api/proxy.js` подхватывается автоматически.

## CORS-прокси (api/proxy.js)

Edge Function поддерживает два апстрима:

```
/api/proxy.js?path=assets/...    → https://assets.deadlock-api.com/...
/api/proxy.js?path=analytics/... → https://api.deadlock-api.com/...
```

Ответы кэшируются на Vercel CDN (`Cache-Control: s-maxage=3600`).

## Локализация

Сайт поддерживает **русский** и **английский** языки. Переводы в `src/i18n/locales/`. Для добавления нового языка — добавь файл локали и зарегистрируй его в `src/i18n/index.js`.
