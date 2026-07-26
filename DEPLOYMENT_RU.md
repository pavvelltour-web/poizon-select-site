# Публикация отдельного сайта SELECT

Этот каталог самодостаточен: его можно вынести в отдельный Git-репозиторий и
развернуть как обычную статику.

## Проверка и demo

```bash
npm ci --ignore-scripts
npm run check
npm run build
npm run preview
```

Demo-сборка попадает в `dist/`. Она предназначена для закрытого показа.

## Production

Публичная сборка обязана использовать release-gate:

```bash
npm run verify:release
npm run build:production
```

Каталог содержит 60 локальных проектных визуальных ориентиров. Они не являются
официальными фото производителя. Provenance, хэши и права записаны в
`public/catalog/sources.json`; release-gate проходит для всех 60 файлов.
Точный SKU, цвет, размер, наличие и цену всё равно нужно подтверждать перед
заказом.

Настройки static host:

- install: `npm ci --ignore-scripts`;
- build: `npm run build:production`;
- output/publish directory: `dist`;
- допустимая переменная: `VITE_BOT_USERNAME=YourBuyerBot`.

`BOT_TOKEN`, CRM credentials, database URL и любые серверные секреты сайту не
нужны и не должны попадать в `VITE_*`.

## Самый быстрый deploy через GitHub Pages

После выделения `site/` в отдельный репозиторий:

1. GitHub → **Settings → Pages → Source: GitHub Actions**.
2. GitHub → **Settings → Secrets and variables → Actions → Variables**.
3. Добавить публичную переменную `VITE_BOT_USERNAME=YourBuyerBot`.
4. Отправить проверенный commit в `main`.
5. Workflow `.github/workflows/deploy-pages.yml` сам выполнит тесты,
   production release-gate и публикацию.

`BOT_TOKEN` в GitHub Pages не добавляется: токен нужен только серверному
процессу бота.

Разделение текущего монорепозитория через `git subtree` описано в
`docs/GIT_AND_DEPLOY_RU.md` основного проекта.
