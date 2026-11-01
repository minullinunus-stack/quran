/**
 * Привязка вебхука Telegram к Cloudflare Worker.
 *
 * Использование:
 *   node scripts/set-webhook.mjs https://hatam-bot.<account>.workers.dev/telegram
 *
 * Токен берётся из переменной окружения BOT_TOKEN (или из ../bot/.env),
 * секрет — из WEBHOOK_SECRET.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

function fromBotEnv(name) {
  try {
    const raw = fs.readFileSync(path.join(here, "..", "..", "bot", ".env"), "utf8").replace(/^\uFEFF/, "");
    const match = raw.match(new RegExp("^[ \\t]*" + name + "[ \\t]*=[ \\t]*(.*)$", "m"));
    return match ? match[1].trim() : "";
  } catch {
    return "";
  }
}

const url = process.argv[2];
if (!url || !/^https:\/\//.test(url)) {
  console.error("Укажите адрес воркера: node scripts/set-webhook.mjs https://<worker>.workers.dev/telegram");
  process.exit(1);
}

const token = process.env.BOT_TOKEN || fromBotEnv("BOT_TOKEN");
const secret = process.env.WEBHOOK_SECRET || fromBotEnv("WEBHOOK_SECRET");

if (!token) {
  console.error("Не найден BOT_TOKEN (переменная окружения или bot/.env)");
  process.exit(1);
}

if (!secret) {
  console.error("Не найден WEBHOOK_SECRET — задайте его в секретах воркера и в окружении");
  process.exit(1);
}

const api = "https://api.telegram.org/bot" + token;

async function call(method, payload) {
  const response = await fetch(api + "/" + method, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  return response.json();
}

const set = await call("setWebhook", {
  url,
  secret_token: secret,
  drop_pending_updates: true,
  allowed_updates: ["message", "callback_query"],
});

if (!set.ok) {
  console.error("❌ Не удалось установить вебхук:", set.description);
  process.exit(1);
}

const info = await call("getWebhookInfo", {});
console.log("✅ Вебхук установлен:", url);
console.log("ℹ️  Информация:", JSON.stringify(info.result, null, 2));
