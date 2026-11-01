import * as ui from "./ui.js";
import * as store from "./data.js";
import { escapeHtml, splitText } from "./format.js";
import {
  answerCallbackQuery,
  editMessageText,
  getMe,
  sendMessage,
} from "./telegram.js";

const BOT_NAME = "Хатм";

function ownerIds(env) {
  return String(env.OWNER_ID || "")
    .split(/[,\s]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function isOwner(env, from) {
  return Boolean(from) && ownerIds(env).includes(String(from.id));
}

function options(view) {
  return { reply_markup: view.keyboard };
}

async function send(env, chatId, text, extra) {
  return sendMessage(env, chatId, text, extra);
}

async function show(env, cq, view) {
  if (!view) {
    await send(env, cq.message.chat.id, "Не удалось найти этот материал 🤔");
    return;
  }

  try {
    await editMessageText(env, cq.message.chat.id, cq.message.message_id, view.text, options(view));
  } catch (error) {
    const description = String((error && error.description) || error);
    if (description.includes("message is not modified")) return;
    await send(env, cq.message.chat.id, view.text, options(view));
  }
}

/* ─────────── Сообщения ─────────── */

async function handleMessage(message, env, ctx) {
  const from = message.from;
  if (!from || from.is_bot) return;

  const chatId = message.chat.id;
  const text = String(message.text || "");
  const commandMatch = /^\/([a-zA-Z0-9_]+)(@\w+)?/.exec(text.trim());
  const command = commandMatch ? commandMatch[1].toLowerCase() : "";

  if (command === "start") {
    await send(env, chatId, ui.menuText(from.first_name || ""), { reply_markup: ui.menuKeyboard() });
    return;
  }

  if (command === "help") {
    const meta = await store.loadMeta(env);
    await send(env, chatId, ui.helpText(meta), { reply_markup: ui.helpKeyboard() });
    return;
  }

  if (command === "stats") {
    if (!isOwner(env, from)) {
      await send(env, chatId, "Эта команда доступна только владельцу бота 🙂");
      return;
    }

    const [users, stats] = await Promise.all([store.getUsers(env), store.getStats(env)]);
    const hours = Math.floor((Date.now() - stats.startedAt) / 3600000);

    await send(
      env,
      chatId,
      "📊 <b>Статистика бота</b>\n\n" +
        "👥 Пользователей: <b>" + users.length + "</b>\n" +
        "📖 Просмотров аятов: <b>" + stats.ayahViews + "</b>\n" +
        "🕌 Просмотров хадисов: <b>" + stats.hadithViews + "</b>\n" +
        "⏱ Работает: <b>" + hours + " ч</b>\n\n" +
        "<i>Бот работает на Cloudflare Workers — 24/7.</i>"
    );
    return;
  }

  if (command === "broadcast") {
    if (!isOwner(env, from)) {
      await send(env, chatId, "Эта команда доступна только владельцу бота 🙂");
      return;
    }

    const body = text.replace(/^\/broadcast(@\w+)?\s*/i, "").trim();
    if (!body) {
      await send(env, chatId, "Напишите так: <code>/broadcast Текст сообщения</code>");
      return;
    }

    const users = await store.getUsers(env);
    let sent = 0;
    let failed = 0;

    for (const id of users) {
      try {
        await sendMessage(env, id, body);
        sent++;
      } catch {
        failed++;
      }
      await new Promise((resolve) => setTimeout(resolve, 40));
    }

    await send(env, chatId, "📤 Отправлено: " + sent + ", не доставлено: " + failed);
    return;
  }

  await send(
    env,
    chatId,
    "Я лучше понимаю кнопки 🙂\nВот главное меню — выберите раздел:",
    { reply_markup: ui.menuKeyboard() }
  );
}

/* ─────────── Кнопки ─────────── */

async function handleCallback(cq, env, ctx) {
  const data = String(cq.data || "");
  const chatId = cq.message && cq.message.chat ? cq.message.chat.id : null;

  await answerCallbackQuery(env, cq.id).catch(() => {});

  if (!chatId) return;

  const meta = await store.loadMeta(env);

  if (data === "menu") {
    await show(env, cq, { text: ui.menuText(cq.from.first_name || ""), keyboard: ui.menuKeyboard() });
    return;
  }

  if (data === "help") {
    await show(env, cq, { text: ui.helpText(meta), keyboard: ui.helpKeyboard() });
    return;
  }

  if (data === "noop") return;

  let match = /^q:(\d+)$/.exec(data);
  if (match) {
    await show(env, cq, ui.surahList(meta, Number(match[1])));
    return;
  }

  match = /^s:(\d+)$/.exec(data);
  if (match) {
    const surahNumber = Number(match[1]);
    const [surah, tafsir] = await Promise.all([
      store.loadSurah(env, surahNumber),
      store.tafsirText(env, surahNumber, 1),
    ]);
    const view = ui.ayahView({ meta, surah, tafsir }, 1);
    if (view) store.bumpStat(env, "ayahViews", ctx);
    await show(env, cq, view);
    return;
  }

  match = /^a:(\d+):(\d+)$/.exec(data);
  if (match) {
    const surahNumber = Number(match[1]);
    const ayahNumber = Number(match[2]);
    const [surah, tafsir] = await Promise.all([
      store.loadSurah(env, surahNumber),
      store.tafsirText(env, surahNumber, ayahNumber),
    ]);
    const view = ui.ayahView({ meta, surah, tafsir }, ayahNumber);
    if (view) store.bumpStat(env, "ayahViews", ctx);
    await show(env, cq, view);
    return;
  }

  match = /^g:(\d+):(\d+)$/.exec(data);
  if (match) {
    const surah = await store.loadSurah(env, Number(match[1]));
    await show(env, cq, ui.ayahGrid(surah, Number(match[2])));
    return;
  }

  match = /^h:(\d+)$/.exec(data);
  if (match) {
    const list = await store.loadHadithList(env);
    await show(env, cq, ui.hadithList(list, meta.totalHadiths, Number(match[1])));
    return;
  }

  match = /^d:(\d+)(?::(\d+))?$/.exec(data);
  if (match) {
    const hadithNumber = Number(match[1]);
    const part = match[2] ? Number(match[2]) : 0;
    const hadith = await store.loadHadith(env, hadithNumber);
    const view = ui.hadithView(hadith, meta.totalHadiths, part);
    if (view) store.bumpStat(env, "hadithViews", ctx);
    await show(env, cq, view);
    return;
  }

  match = /^t:(\d+):(\d+)$/.exec(data);
  if (match) {
    const surahNumber = Number(match[1]);
    const ayahNumber = Number(match[2]);
    const [tafsir, surah] = await Promise.all([
      store.tafsirText(env, surahNumber, ayahNumber),
      store.loadSurah(env, surahNumber),
    ]);

    if (!tafsir) {
      await send(env, chatId, "К этому аяту толкование не приводится 🙂");
      return;
    }

    const header =
      "💡 <b>Тафсир · сура " + surahNumber + ". " + escapeHtml(surah ? surah.ru : "") +
      ", аят " + ayahNumber + "</b>\n\n";

    const chunks = splitText(tafsir);
    for (let i = 0; i < chunks.length; i++) {
      let body = (i === 0 ? header : "") + escapeHtml(chunks[i]);
      if (chunks.length > 1) {
        body += "\n\n<i>(" + (i + 1) + " из " + chunks.length + ")</i>";
      }
      await send(env, chatId, body);
    }
    return;
  }

  await send(env, chatId, "Кнопка устарела — откройте меню заново 🙂", ui.menuKeyboard());
}

/* ─────────── HTTP ─────────── */

async function handleUpdate(update, env, ctx) {
  try {
    if (update.callback_query) {
      await handleCallback(update.callback_query, env, ctx);
      return;
    }

    if (update.message) {
      await store.trackUser(env, update.message.from.id);
      await handleMessage(update.message, env, ctx);
    }
  } catch (error) {
    console.error("Ошибка обработки обновления:", error && (error.stack || error.message || error));
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "GET") {
      let bot = null;
      try {
        const me = await getMe(env);
        bot = { username: me.username, name: me.first_name };
      } catch (error) {
        return json({ ok: false, bot: BOT_NAME, error: String(error.message || error) }, 503);
      }
      return json({ ok: true, service: "hatam-bot", bot, webhook: "/telegram" });
    }

    if (request.method !== "POST" || url.pathname !== "/telegram") {
      return new Response("Not found", { status: 404 });
    }

    if (env.WEBHOOK_SECRET) {
      const secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
      if (secret !== env.WEBHOOK_SECRET) {
        return new Response("Forbidden", { status: 403 });
      }
    }

    let update;
    try {
      update = await request.json();
    } catch {
      return new Response("Bad request", { status: 400 });
    }

    ctx.waitUntil(handleUpdate(update, env, ctx));
    return new Response("ok");
  },
};
