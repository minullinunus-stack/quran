"use strict";

const path = require("node:path");
const fs = require("node:fs");

require("dotenv").config({
  path: path.join(__dirname, "..", ".env"),
  quiet: true,
});

const { Telegraf } = require("telegraf");
const data = require("./data");
const ui = require("./ui");
const { escapeHtml, splitText, TELEGRAM_LIMIT } = require("./format");

const CHECK_MODE = process.argv.includes("--check");
const BOT_TOKEN = process.env.BOT_TOKEN || "";
const OWNER_IDS = (process.env.OWNER_ID || "")
  .split(/[,\s]+/)
  .map((value) => value.trim())
  .filter(Boolean);

/* ═══════════ Проверка данных без запуска бота ═══════════ */

function runCheck() {
  console.log("📚 Сур: " + data.surahs.length);
  console.log("🕌 Хадисов: " + data.hadiths.length);
  console.log(
    "💡 Тафсир: " + data.tafsirName + " — " + data.tafsirAyahCount + " аятов с толкованием"
  );
  console.log("📂 Данные: " + data.DATA_DIR);

  let ayahCount = 0;
  let maxAyah = 0;
  let tooLong = 0;
  let shortened = 0;
  let missing = 0;

  for (const surah of data.surahs) {
    for (let i = 1; i <= surah.ay.length; i++) {
      const view = ui.ayahView(surah.n, i);
      if (!view) {
        missing++;
        continue;
      }
      ayahCount++;
      maxAyah = Math.max(maxAyah, view.text.length);
      if (view.text.length > TELEGRAM_LIMIT) tooLong++;
      if (view.text.includes("Толкование сокращено") || view.text.includes("большое")) shortened++;
    }
  }

  let maxHadith = 0;
  for (const hadith of data.hadiths) {
    const first = ui.hadithView(hadith.n, 0);
    if (!first) {
      console.log("❌ Не строится хадис " + hadith.n);
      process.exitCode = 1;
      continue;
    }
    for (let part = 0; part < first.parts; part++) {
      const view = ui.hadithView(hadith.n, part);
      maxHadith = Math.max(maxHadith, view.text.length);
      if (view.text.length > TELEGRAM_LIMIT) {
        console.log("❌ Хадис " + hadith.n + ", часть " + (part + 1) + " длиннее лимита Telegram");
        process.exitCode = 1;
      }
    }
  }

  console.log("📖 Аятов собрано: " + ayahCount + ", без вида: " + missing);
  console.log("📏 Самое длинное сообщение с аятом: " + maxAyah + " символов");
  console.log("✂️  Аятов с сокращённым тафсиром: " + shortened);
  console.log("📏 Самое длинное сообщение с хадисом: " + maxHadith + " символов");

  if (tooLong > 0) {
    console.log("❌ " + tooLong + " сообщений длиннее " + TELEGRAM_LIMIT + " символов");
    process.exitCode = 1;
  }

  const sample = ui.ayahView(1, 1);
  console.log("\n──── Пример сообщения (сура 1, аят 1) ────\n");
  console.log(sample.text.slice(0, 700));

  const hadith = ui.hadithView(1);
  console.log("\n──── Пример сообщения (хадис 1) ────\n");
  console.log(hadith.text.slice(0, 500));

  console.log(
    "\n" + (process.exitCode ? "❌ Есть проблемы — смотрите выше." : "✅ Проверка пройдена, можно запускать бота.")
  );
}

if (CHECK_MODE) {
  runCheck();
  process.exit(process.exitCode || 0);
}

/* ═══════════ Настройки и хранилище ═══════════ */

if (!BOT_TOKEN || /ExampleTokenReplaceMe/i.test(BOT_TOKEN)) {
  console.error(
    "❌ Не задан BOT_TOKEN.\n" +
      "Скопируйте bot/.env.example в bot/.env и вставьте токен от @BotFather."
  );
  process.exit(1);
}

const STORAGE_PATH = path.join(__dirname, "..", "storage.json");

const store = {
  users: [],
  stats: { ayahViews: 0, hadithViews: 0, startedAt: Date.now() },
};

try {
  const saved = JSON.parse(fs.readFileSync(STORAGE_PATH, "utf8"));
  if (Array.isArray(saved.users)) store.users = saved.users;
  if (saved.stats) Object.assign(store.stats, saved.stats);
} catch {
  // Первый запуск — файла ещё нет.
}

let saveTimer = null;

function saveStore() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.writeFileSync(STORAGE_PATH, JSON.stringify(store), "utf8");
    } catch (error) {
      console.error("Не удалось сохранить storage.json:", error.message);
    }
  }, 700);
}

function trackUser(id) {
  if (!store.users.includes(id)) {
    store.users.push(id);
    saveStore();
  }
}

function isOwner(ctx) {
  return OWNER_IDS.includes(String(ctx.from && ctx.from.id));
}

/* ═══════════ Бот ═══════════ */

const bot = new Telegraf(BOT_TOKEN);

bot.use(async (ctx, next) => {
  if (ctx.from && !ctx.from.is_bot) trackUser(ctx.from.id);
  return next();
});

async function show(ctx, view) {
  await ctx.answerCbQuery().catch(() => {});

  if (!view) {
    await ctx.reply("Не удалось найти этот материал 🤔");
    return;
  }

  const options = {
    parse_mode: "HTML",
    reply_markup: view.keyboard.reply_markup,
    disable_web_page_preview: true,
  };

  try {
    await ctx.editMessageText(view.text, options);
  } catch (error) {
    const description = (error && error.description) || String(error);
    if (description.includes("message is not modified")) return;
    await ctx.reply(view.text, options);
  }
}

/* ── Команды ── */

bot.start(async (ctx) => {
  const name = ctx.from.first_name || "";
  await ctx.reply(ui.menuText(name), {
    parse_mode: "HTML",
    ...ui.menuKeyboard(),
  });
});

bot.help(async (ctx) => {
  await ctx.reply(ui.helpText(), {
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...ui.helpKeyboard(),
  });
});

bot.command("stats", async (ctx) => {
  if (!isOwner(ctx)) {
    await ctx.reply("Эта команда доступна только владельцу бота 🙂");
    return;
  }

  const hours = Math.floor((Date.now() - store.stats.startedAt) / 3600000);
  await ctx.reply(
    "📊 <b>Статистика бота</b>\n\n" +
      "👥 Пользователей: <b>" + store.users.length + "</b>\n" +
      "📖 Просмотров аятов: <b>" + store.stats.ayahViews + "</b>\n" +
      "🕌 Просмотров хадисов: <b>" + store.stats.hadithViews + "</b>\n" +
      "⏱ Работает: <b>" + hours + " ч</b>",
    { parse_mode: "HTML" }
  );
});

bot.command("broadcast", async (ctx) => {
  if (!isOwner(ctx)) {
    await ctx.reply("Эта команда доступна только владельцу бота 🙂");
    return;
  }

  const text = ctx.message.text.replace(/^\/broadcast(@\w+)?\s*/i, "").trim();
  if (!text) {
    await ctx.reply("Напишите так: <code>/broadcast Текст сообщения</code>", {
      parse_mode: "HTML",
    });
    return;
  }

  let sent = 0;
  let failed = 0;

  for (const id of store.users) {
    try {
      await ctx.telegram.sendMessage(id, text);
      sent++;
    } catch {
      failed++;
    }
    await new Promise((resolve) => setTimeout(resolve, 45));
  }

  await ctx.reply("📤 Отправлено: " + sent + ", не доставлено: " + failed);
});

/* ── Кнопки ── */

bot.action("menu", async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  const text = ui.menuText(ctx.from.first_name || "");
  const options = { parse_mode: "HTML", ...ui.menuKeyboard() };
  try {
    await ctx.editMessageText(text, options);
  } catch {
    await ctx.reply(text, options);
  }
});

bot.action("help", async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  const text = ui.helpText();
  const options = {
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...ui.helpKeyboard(),
  };
  try {
    await ctx.editMessageText(text, options);
  } catch {
    await ctx.reply(text, options);
  }
});

bot.action("noop", async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
});

bot.action(/^q:(\d+)$/, async (ctx) => {
  await show(ctx, ui.surahList(Number(ctx.match[1])));
});

bot.action(/^s:(\d+)$/, async (ctx) => {
  const surahNumber = Number(ctx.match[1]);
  const view = ui.ayahView(surahNumber, 1);
  if (view) store.stats.ayahViews++;
  saveStore();
  await show(ctx, view);
});

bot.action(/^a:(\d+):(\d+)$/, async (ctx) => {
  const surahNumber = Number(ctx.match[1]);
  const ayahNumber = Number(ctx.match[2]);
  const view = ui.ayahView(surahNumber, ayahNumber);
  if (view) {
    store.stats.ayahViews++;
    saveStore();
  }
  await show(ctx, view);
});

bot.action(/^g:(\d+):(\d+)$/, async (ctx) => {
  await show(ctx, ui.ayahGrid(Number(ctx.match[1]), Number(ctx.match[2])));
});

bot.action(/^h:(\d+)$/, async (ctx) => {
  await show(ctx, ui.hadithList(Number(ctx.match[1])));
});

bot.action(/^d:(\d+)(?::(\d+))?$/, async (ctx) => {
  const hadithNumber = Number(ctx.match[1]);
  const part = ctx.match[2] ? Number(ctx.match[2]) : 0;
  const view = ui.hadithView(hadithNumber, part);
  if (view) {
    store.stats.hadithViews++;
    saveStore();
  }
  await show(ctx, view);
});

bot.action(/^t:(\d+):(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});

  const surahNumber = Number(ctx.match[1]);
  const ayahNumber = Number(ctx.match[2]);
  const tafsirText = data.getTafsir(surahNumber, ayahNumber);
  const surah = data.getSurah(surahNumber);

  if (!tafsirText) {
    await ctx.reply("К этому аяту толкование не приводится 🙂");
    return;
  }

  const header =
    "💡 <b>Тафсир · сура " + surahNumber + ". " + escapeHtml(surah.ru) +
    ", аят " + ayahNumber + "</b>\n\n";

  const chunks = splitText(tafsirText);

  for (let i = 0; i < chunks.length; i++) {
    let body = (i === 0 ? header : "") + escapeHtml(chunks[i]);
    if (chunks.length > 1) {
      body += "\n\n<i>(" + (i + 1) + " из " + chunks.length + ")</i>";
    }
    await ctx.reply(body, { parse_mode: "HTML", disable_web_page_preview: true });
  }
});

/* ── Всё остальное ── */

bot.on("text", async (ctx) => {
  await ctx.reply(
    "Я лучше понимаю кнопки 🙂\nВот главное меню — выберите раздел:",
    { parse_mode: "HTML", ...ui.menuKeyboard() }
  );
});

bot.catch((error, ctx) => {
  console.error("Ошибка при обработке " + (ctx && ctx.updateType) + ":", error);
});

/* ── Запуск ── */

bot.telegram
  .getMe()
  .then((me) => {
    console.log("🤖 Бот: @" + me.username + " (" + me.first_name + ")");
    console.log("👥 Пользователей в базе: " + store.users.length);
    if (!OWNER_IDS.length) {
      console.log("⚠️  OWNER_ID не задан — команды /stats и /broadcast отключены.");
    }
    return bot.launch({ dropPendingUpdates: true });
  })
  .then(() => {
    console.log("✅ Бот запущен. Нажмите Ctrl+C, чтобы остановить.");
  })
  .catch((error) => {
    const message = String((error && error.message) || error);
    const code = error && error.response && error.response.error_code;

    console.error("❌ Не удалось запустить бота:", message);

    if (code === 401 || message.includes("401")) {
      console.error(
        "\nПодсказка: Telegram не принял токен.\n" +
          "  • проверьте, что в bot/.env строка BOT_TOKEN= скопирована целиком;\n" +
          "  • если токен отозван — получите новый у @BotFather (/revoke)."
      );
    } else if (code === 409 || message.includes("409")) {
      console.error(
        "\nПодсказка: этот бот уже запущен в другом окне или на другом компьютере.\n" +
          "  Остановите лишний экземпляр и запустите снова."
      );
    } else if (/ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET/.test(message)) {
      console.error(
        "\nПодсказка: нет связи с api.telegram.org.\n" +
          "  Проверьте интернет. Если Telegram открывается только через VPN —\n" +
          "  включите VPN и запустите бота снова."
      );
    }

    process.exit(1);
  });

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
