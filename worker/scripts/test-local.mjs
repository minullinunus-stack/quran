/**
 * Локальная проверка воркера без Cloudflare:
 * подменяет KV и Telegram API, прогоняет основные сценарии.
 *
 * Запуск: node scripts/test-local.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const kvFile = path.join(here, "..", ".data-kv", "kv.json");

if (!fs.existsSync(kvFile)) {
  console.error("Нет .data-kv/kv.json — сначала выполните npm run prepare-data");
  process.exit(1);
}

const kv = new Map();
for (const item of JSON.parse(fs.readFileSync(kvFile, "utf8"))) {
  kv.set(item.key, item.value);
}

const env = {
  BOT_TOKEN: "123456:TEST",
  OWNER_ID: "42",
  WEBHOOK_SECRET: "secret",
  HATM_KV: {
    async get(key, type) {
      const raw = kv.get(key);
      if (raw == null) return null;
      return type === "json" ? JSON.parse(raw) : raw;
    },
    async put(key, value) {
      kv.set(key, String(value));
    },
  },
};

const calls = [];

globalThis.fetch = async (url, init) => {
  const method = String(url).split("/").pop();
  const payload = init && init.body ? JSON.parse(init.body) : {};
  calls.push({ method, payload });

  if (method === "getMe") {
    return Response.json({ ok: true, result: { id: 1, is_bot: true, username: "test_bot", first_name: "Test" } });
  }

  return Response.json({ ok: true, result: { message_id: 100 + calls.length } });
};

const worker = (await import("../src/index.js")).default;

function lastCall(method) {
  for (let i = calls.length - 1; i >= 0; i--) {
    if (calls[i].method === method) return calls[i].payload;
  }
  return null;
}

async function sendUpdate(update) {
  calls.length = 0;
  const request = new Request("https://bot.example/telegram", {
    method: "POST",
    headers: { "content-type": "application/json", "X-Telegram-Bot-Api-Secret-Token": "secret" },
    body: JSON.stringify(update),
  });

  const pending = [];
  const response = await worker.fetch(request, env, {
    waitUntil: (promise) => pending.push(promise),
    passThroughOnException: () => {},
  });

  await Promise.allSettled(pending);
  await new Promise((resolve) => setTimeout(resolve, 50));

  return { status: response.status, body: await response.text() };
}

function message(text, from = { id: 42, first_name: "Ренат", is_bot: false }) {
  return {
    update_id: Math.floor(Math.random() * 1e9),
    message: {
      message_id: 1,
      from,
      chat: { id: from.id, type: "private" },
      date: Math.floor(Date.now() / 1000),
      text,
    },
  };
}

function callback(data, from = { id: 42, first_name: "Ренат", is_bot: false }) {
  return {
    update_id: Math.floor(Math.random() * 1e9),
    callback_query: {
      id: "cb" + Math.random().toString(36).slice(2),
      from,
      message: {
        message_id: 7,
        from: { id: 1, is_bot: true, username: "test_bot", first_name: "Test" },
        chat: { id: from.id, type: "private" },
        date: Math.floor(Date.now() / 1000),
        text: "old",
      },
      chat_instance: "1",
      data,
    },
  };
}

const results = [];

function check(name, condition, details) {
  results.push({ name, ok: Boolean(condition), details });
}

/* 1. /start */
let res = await sendUpdate(message("/start"));
let sent = lastCall("sendMessage");
check("/start отвечает", res.status === 200 && sent, res.status);
check("приветствие «Ассаляму алейкум»", sent && sent.text.includes("Ассаляму алейкум, Ренат"));
check("нет «Я — Хатм»", sent && !sent.text.includes("Я — Хатм"));
check("есть кнопки меню", sent && sent.reply_markup.inline_keyboard.length >= 2);

/* 2. Список сур */
await sendUpdate(callback("q:0"));
let edited = lastCall("editMessageText");
check("список сур", edited && edited.text.includes("Страница 1 из 10"), edited && edited.text.slice(0, 40));
check("кнопок сур 12", edited && edited.reply_markup.inline_keyboard.length >= 5);

/* 3. Сура → аят 1 */
await sendUpdate(callback("s:1"));
edited = lastCall("editMessageText");
check("аят 1:1", edited && edited.text.includes("Сура 1."), edited && edited.text.slice(0, 40));

/* 4. Длинный тафсир (2:255) */
await sendUpdate(callback("a:2:255"));
edited = lastCall("editMessageText");
const len = edited ? edited.text.length : 0;
check("аят 2:255 не длиннее 4096", len > 0 && len <= 4096, len);
const hasTafsirButton = edited && JSON.stringify(edited.reply_markup).includes("t:2:255");
check("кнопка «Тафсир полностью»", hasTafsirButton);

/* 5. Полный тафсир */
await sendUpdate(callback("t:2:255"));
const tafsirMessages = calls.filter((c) => c.method === "sendMessage");
check("тафсир отправлен частями", tafsirMessages.length >= 1, tafsirMessages.length);
check(
  "части тафсира в лимите",
  tafsirMessages.every((c) => c.payload.text.length <= 4096)
);

/* 6. Сетка аятов */
await sendUpdate(callback("g:2:0"));
edited = lastCall("editMessageText");
check("сетка аятов", edited && edited.text.includes("Выберите аят"));

/* 7. Хадисы */
await sendUpdate(callback("h:0"));
edited = lastCall("editMessageText");
check("список хадисов", edited && edited.text.includes("40 хадисов"));

await sendUpdate(callback("d:2"));
edited = lastCall("editMessageText");
check("хадис 2 с частями", edited && edited.text.includes("Часть 1 из"), edited && edited.text.length);

await sendUpdate(callback("d:2:1"));
edited = lastCall("editMessageText");
check("хадис 2, часть 2", edited && edited.text.includes("Часть 2 из"));

/* 8. Помощь и меню */
await sendUpdate(callback("help"));
edited = lastCall("editMessageText");
check("справка", edited && edited.text.includes("Как пользоваться"));

/* 9. /stats владельцем */
await sendUpdate(message("/stats"));
sent = lastCall("sendMessage");
check("/stats для владельца", sent && sent.text.includes("Статистика"));

await sendUpdate(message("/stats", { id: 5, first_name: "Гость", is_bot: false }));
sent = lastCall("sendMessage");
check("/stats чужому запрещена", sent && sent.text.includes("только владельцу"));

/* 10. /broadcast */
await sendUpdate(message("/broadcast Тестовое сообщение"));
sent = lastCall("sendMessage");
check("/broadcast отчитался", sent && sent.text.includes("Отправлено"), sent && sent.text);

/* 11. Обычный текст */
await sendUpdate(message("привет"));
sent = lastCall("sendMessage");
check("текст → меню", sent && sent.text.includes("лучше понимаю кнопки"));

/* 12. Секрет вебхука */
const bad = await worker.fetch(
  new Request("https://bot.example/telegram", {
    method: "POST",
    headers: { "content-type": "application/json", "X-Telegram-Bot-Api-Secret-Token": "wrong" },
    body: JSON.stringify(message("/start")),
  }),
  env,
  { waitUntil: () => {} }
);
check("чужой секрет → 403", bad.status === 403, bad.status);

/* 13. Health */
const health = await worker.fetch(new Request("https://bot.example/"), env, { waitUntil: () => {} });
const healthBody = await health.json();
check("health отвечает", health.status === 200 && healthBody.ok === true, healthBody);

/* Итог */
let failed = 0;
for (const item of results) {
  if (!item.ok) failed++;
  console.log((item.ok ? "✅" : "❌") + " " + item.name + (item.details !== undefined ? "  [" + item.details + "]" : ""));
}

console.log("\n" + (failed ? "❌ Провалено: " + failed : "✅ Все проверки пройдены") + " (" + results.length + ")");
process.exit(failed ? 1 : 0);
