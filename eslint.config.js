import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'

// Линтер ловит ошибки, а не спорит о стиле: форматирование в проекте не навязывается.
export default [
  { ignores: ['dist/**', 'coverage/**', '.claude/**', 'node_modules/**'] },

  js.configs.recommended,

  // Сам сайт: браузерный код на React
  {
    files: ['src/**/*.{js,jsx}'],
    plugins: { react, 'react-hooks': reactHooks },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat['jsx-runtime'].rules,
      'react/prop-types': 'off', // типы описаны в JSDoc (src/types), prop-types в проекте не используются
      'react/no-unescaped-entities': 'off',
      // HTML из API и Steam выводят RichHtml и TooltipHtml (белые списки в services/sanitize.js): вставлять его как есть нельзя
      'react/no-danger': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-unused-vars': ['warn', { args: 'after-used', argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },

  // Node: скрипты сборки, функции Vercel, конфиги и тесты
  {
    files: ['scripts/**/*.{js,mjs}', 'api/**/*.js', 'tests/**/*.js', '*.config.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.node },
    rules: {
      'no-unused-vars': ['warn', { args: 'after-used', argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
]
