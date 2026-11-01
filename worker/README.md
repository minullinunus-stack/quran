# Бот «Хатм» на Cloudflare Workers

Версия бота для работы 24/7: Telegram присылает обновления по **вебхуку** на Cloudflare Worker,
поэтому компьютер можно выключать — бот продолжает отвечать.

- Воркер: https://hatam-bot.hatam-bot-worker.workers.dev
- Вебхук: `https://hatam-bot.hatam-bot-worker.workers.dev/telegram`
- KV: `HATM_KV` (`c7eb3798e05e42b3a40a7d29bab135a2`)

```
Telegram ──webhook──▶ Cloudflare Worker ──▶ Cloudflare KV (данные, пользователи)
                            │
                            └──▶ api.telegram.org (ответы)
```

## Что где хранится

| Что | Где |
| --- | --- |
| Токен бота, `OWNER_ID`, секрет вебхука | **секреты Cloudflare** (`wrangler secret put`) |
| Коран, тафсир, хадисы | Cloudflare KV, ключи `s:*`, `t:*`, `h:*`, `meta` |
| Пользователи и статистика | Cloudflare KV, ключи `users`, `stats` |

В коде и в git нет ни токена, ни `OWNER_ID`.

## Первый деплой (по шагам)

Нужен аккаунт Cloudflare (бесплатного плана достаточно) и Node.js.

```powershell
cd D:\projects\hatam\worker
npm install
npx wrangler login          # откроется браузер — войдите и нажмите Allow
```

1. Создать хранилище KV и вставить выданный `id` в `wrangler.jsonc`:

```powershell
npx wrangler kv namespace create HATM_KV
```

2. Подготовить и загрузить данные (272 ключа, ~11 МБ):

```powershell
npm run prepare-data
npx wrangler kv bulk put .data-kv/kv.json --namespace-id=<ID_ИЗ_ШАГА_1> --remote
```

3. Положить секреты (значения вводятся в консоли, в файлы не попадают):

```powershell
npx wrangler secret put BOT_TOKEN       # токен от @BotFather
npx wrangler secret put OWNER_ID        # ваш Telegram id
npx wrangler secret put WEBHOOK_SECRET  # любая длинная случайная строка
```

4. Задеплоить:

```powershell
npx wrangler deploy
```

Wrangler напечатает адрес вида `https://hatam-bot.<аккаунт>.workers.dev`.

5. Привязать вебхук (токен и секрет берутся из `bot/.env`, если заданы там):

```powershell
$env:WEBHOOK_SECRET = "та же строка, что в секрете"
node scripts/set-webhook.mjs https://hatam-bot.<аккаунт>.workers.dev/telegram
```

6. Проверить:

```powershell
curl https://hatam-bot.<аккаунт>.workers.dev
```

Должен вернуться JSON `{"ok":true,...,"bot":{"username":"hatam_quran_bot",...}}`.
После этого откройте бота в Telegram и отправьте `/start`.

## Важно: старый бот должен быть выключен

Пока на компьютере запущен `bot/start.bat` (long polling), Telegram не сможет
работать через вебхук — команды будет забирать локальный процесс. Закройте его
и больше не запускайте, если хотите, чтобы бот жил в облаке.

## Обновление бота

```powershell
cd D:\projects\hatam\worker
npx wrangler deploy
```

Если менялись данные (Коран, тафсир, хадисы):

```powershell
npm run prepare-data
npx wrangler kv bulk put .data-kv/kv.json --namespace-id=<ID> --remote
```

## Полезные команды

| Команда | Что делает |
| --- | --- |
| `npx wrangler tail` | живой лог воркера (ошибки, запросы) |
| `node scripts/test-local.mjs` | 22 проверки логики без Cloudflare (мок KV и Telegram) |
| `npx wrangler dev` | локальный запуск на `http://localhost:8787` (нужен `.dev.vars`) |
| `npx wrangler secret list` | список секретов (значения не показываются) |

## Ограничения бесплатного плана

- 100 000 запросов в день — для личного бота с запасом;
- 1 ГБ в KV — данные занимают ~11 МБ;
- 1 000 записей в KV в день — пишем только при новом пользователе и раз в несколько
  секунд статистику, так что лимит не мешает;
- 50 подзапросов на один запрос — `/broadcast` надёжно доставит примерно 45
  сообщениям за раз. Если пользователей станет больше, рассылку нужно разбивать
  на части (например, через Cloudflare Queues).

## Структура

```
worker/
├── src/
│   ├── index.js      — HTTP-роутер, обработка сообщений и кнопок
│   ├── ui.js         — тексты и клавиатуры (порт bot/src/ui.js)
│   ├── data.js       — чтение KV с кэшем в памяти
│   ├── telegram.js   — клиент Bot API на fetch
│   └── format.js     — экранирование, нарезка длинных текстов
├── scripts/
│   ├── prepare-data.cjs  — data/*.js → .data-kv/kv.json
│   ├── set-webhook.mjs   — привязка вебхука
│   └── test-local.mjs    — локальные проверки
├── wrangler.jsonc
└── package.json
```

## Если что-то не работает

| Симптом | Причина и решение |
| --- | --- |
| Бот молчит, `curl` возвращает `ok:true` | Вебхук не привязан: выполните шаг 5 |
| `404` от Telegram в `getWebhookInfo` | Неверный адрес воркера — проверьте `.../telegram` |
| Бот отвечает дважды / `409 Conflict` | Запущен локальный `start.bat` — закройте его |
| `KV пуст: сначала выполните npm run prepare-data` | Данные не загружены в KV (шаг 2) |
| Ошибки в логах | `npx wrangler tail` покажет стек |
