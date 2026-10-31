"use strict";

const { Markup } = require("telegraf");
const data = require("./data");
const { escapeHtml, truncate, SAFE_LIMIT } = require("./format");

const SURAHS_PER_PAGE = 12;
const AYAHS_PER_GRID_PAGE = 24;
const HADITHS_PER_PAGE = 6;

const TOTAL_SURAHS = data.surahs.length;
const TOTAL_HADITHS = data.hadiths.length;

/* ─────────── Главное меню ─────────── */

function menuText(name) {
  const hello = name ? ", " + escapeHtml(name) : "";
  return (
    "🌙 <b>Ассаляму алейкум" + hello + "!</b>\n\n" +
    "📖 <b>Коран</b> — все 114 сур: арабский текст, перевод на русский и тафсир.\n" +
    "🕌 <b>Хадисы</b> — 40 хадисов имама ан-Навави с переводом.\n\n" +
    "Выберите раздел 👇"
  );
}

function menuKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("📖 Коран", "q:0"),
      Markup.button.callback("🕌 Хадисы", "h:0"),
    ],
    [Markup.button.callback("ℹ️ Помощь", "help")],
  ]);
}

/* ─────────── Список сур ─────────── */

function surahsPageCount() {
  return Math.ceil(TOTAL_SURAHS / SURAHS_PER_PAGE);
}

function surahList(page) {
  const total = surahsPageCount();
  const current = Math.min(Math.max(page, 0), total - 1);
  const from = current * SURAHS_PER_PAGE;
  const slice = data.surahs.slice(from, from + SURAHS_PER_PAGE);

  const rows = [];
  for (let i = 0; i < slice.length; i += 3) {
    rows.push(
      slice.slice(i, i + 3).map((surah) =>
        Markup.button.callback(
          surah.n + ". " + truncate(surah.ru, 28),
          "s:" + surah.n
        )
      )
    );
  }

  const nav = [];
  if (current > 0) nav.push(Markup.button.callback("⬅️", "q:" + (current - 1)));
  nav.push(Markup.button.callback((current + 1) + " / " + total, "noop"));
  if (current < total - 1) nav.push(Markup.button.callback("➡️", "q:" + (current + 1)));
  rows.push(nav);
  rows.push([Markup.button.callback("🏠 Главное меню", "menu")]);

  const text =
    "📖 <b>Коран</b>\n\n" +
    "Выберите суру — покажу аяты с переводом Э. Кулиева и тафсиром.\n\n" +
    "<i>Страница " + (current + 1) + " из " + total + " · всего " + TOTAL_SURAHS + " сур</i>";

  return { text, keyboard: Markup.inlineKeyboard(rows) };
}

/* ─────────── Аят ─────────── */

function ayahText(surahNumber, ayahNumber) {
  const surah = data.getSurah(surahNumber);
  if (!surah) return null;

  const pair = data.getAyah(surahNumber, ayahNumber);
  if (!pair) return null;

  const total = surah.ay.length;
  const tafsirText = data.getTafsir(surahNumber, ayahNumber);

  const head =
    "📖 <b>Сура " + surah.n + ". " + escapeHtml(surah.ru) + "</b>\n" +
    "<i>" + escapeHtml(surah.meaning) + " · " + escapeHtml(surah.rev) +
    " · аят " + ayahNumber + " из " + total + "</i>";

  const bism =
    ayahNumber === 1 && surahNumber !== 1 && surahNumber !== 9
      ? "\n\n<i>" + escapeHtml(data.bism) + "</i>"
      : "";

  const ayahBlock =
    "\n\n<b>﴿ " + escapeHtml(pair[0]) + " ﴾</b>\n\n" +
    "<b>Перевод Э. Кулиева:</b>\n" + escapeHtml(pair[1]);

  const tafsirHead = "\n\n<b>💡 " + escapeHtml(data.tafsirName) + ":</b>\n";
  const base = head + bism + ayahBlock + tafsirHead;

  let text;
  let truncatedTafsir = false;

  if (!tafsirText) {
    text = base + "<i>К этому аяту толкование не приводится.</i>";
  } else {
    text = base + escapeHtml(tafsirText);

    if (text.length > SAFE_LIMIT) {
      const note = "\n\n<i>… Толкование сокращено — полностью по кнопке ниже.</i>";
      let room = SAFE_LIMIT - base.length - note.length - 40;
      let cut = truncate(tafsirText, Math.max(room, 0));

      text = base + escapeHtml(cut) + note;

      while (text.length > SAFE_LIMIT && cut.length > 120) {
        room = Math.floor(room * 0.85);
        cut = truncate(tafsirText, Math.max(room, 0));
        text = base + escapeHtml(cut) + note;
      }

      truncatedTafsir = true;

      if (text.length > SAFE_LIMIT) {
        text =
          head + bism + ayahBlock +
          "\n\n<i>💡 Толкование к этому аяту большое — откройте его кнопкой ниже.</i>";
      }
    }
  }

  return { text, truncatedTafsir, total, surah, pair };
}

function ayahView(surahNumber, ayahNumber) {
  const built = ayahText(surahNumber, ayahNumber);
  if (!built) return null;

  const rows = [];
  const prev = ayahNumber > 1 ? "a:" + surahNumber + ":" + (ayahNumber - 1) : "noop";
  const next = ayahNumber < built.total ? "a:" + surahNumber + ":" + (ayahNumber + 1) : "noop";

  rows.push([
    Markup.button.callback("⬅️", prev),
    Markup.button.callback(ayahNumber + " / " + built.total, "noop"),
    Markup.button.callback("➡️", next),
  ]);

  if (built.truncatedTafsir) {
    rows.push([
      Markup.button.callback("💡 Тафсир полностью", "t:" + surahNumber + ":" + ayahNumber),
    ]);
  }

  rows.push([
    Markup.button.callback("📋 Все аяты", "g:" + surahNumber + ":0"),
    Markup.button.callback("🏠 Меню", "menu"),
  ]);

  return { text: built.text, keyboard: Markup.inlineKeyboard(rows) };
}

/* ─────────── Сетка аятов ─────────── */

function ayahGridPageCount(surahNumber) {
  const surah = data.getSurah(surahNumber);
  if (!surah) return 0;
  return Math.ceil(surah.ay.length / AYAHS_PER_GRID_PAGE);
}

function ayahGrid(surahNumber, page) {
  const surah = data.getSurah(surahNumber);
  if (!surah) return null;

  const totalPages = ayahGridPageCount(surahNumber);
  const current = Math.min(Math.max(page, 0), totalPages - 1);
  const from = current * AYAHS_PER_GRID_PAGE + 1;
  const to = Math.min(from + AYAHS_PER_GRID_PAGE - 1, surah.ay.length);

  const rows = [];
  for (let i = from; i <= to; i += 6) {
    const row = [];
    for (let n = i; n <= Math.min(i + 5, to); n++) {
      row.push(Markup.button.callback(String(n), "a:" + surahNumber + ":" + n));
    }
    rows.push(row);
  }

  const nav = [];
  if (current > 0) nav.push(Markup.button.callback("⬅️", "g:" + surahNumber + ":" + (current - 1)));
  nav.push(Markup.button.callback((current + 1) + " / " + totalPages, "noop"));
  if (current < totalPages - 1) nav.push(Markup.button.callback("➡️", "g:" + surahNumber + ":" + (current + 1)));
  rows.push(nav);

  rows.push([
    Markup.button.callback("▶️ Читать с аята " + from, "a:" + surahNumber + ":" + from),
    Markup.button.callback("🏠 Меню", "menu"),
  ]);

  const text =
    "📖 <b>Сура " + surah.n + ". " + escapeHtml(surah.ru) + "</b>\n" +
    "<i>" + escapeHtml(surah.meaning) + " · " + escapeHtml(surah.rev) + "</i>\n\n" +
    "Выберите аят: <b>" + from + "–" + to + "</b> из " + surah.ay.length + ".";

  return { text, keyboard: Markup.inlineKeyboard(rows) };
}

/* ─────────── Хадисы ─────────── */

function hadithsPageCount() {
  return Math.ceil(TOTAL_HADITHS / HADITHS_PER_PAGE);
}

function hadithList(page) {
  const total = hadithsPageCount();
  const current = Math.min(Math.max(page, 0), total - 1);
  const from = current * HADITHS_PER_PAGE;
  const slice = data.hadiths.slice(from, from + HADITHS_PER_PAGE);

  const rows = slice.map((hadith) => [
    Markup.button.callback(
      hadith.n + ". " + truncate(hadith.title, 48),
      "d:" + hadith.n
    ),
  ]);

  const nav = [];
  if (current > 0) nav.push(Markup.button.callback("⬅️", "h:" + (current - 1)));
  nav.push(Markup.button.callback((current + 1) + " / " + total, "noop"));
  if (current < total - 1) nav.push(Markup.button.callback("➡️", "h:" + (current + 1)));
  rows.push(nav);
  rows.push([Markup.button.callback("🏠 Главное меню", "menu")]);

  const text =
    "🕌 <b>40 хадисов имама ан-Навави</b>\n\n" +
    "Сборник «аль-Арбаун ан-Нававия»: " + TOTAL_HADITHS +
    " хадиса с арабским текстом и переводом.\n\n" +
    "<i>Страница " + (current + 1) + " из " + total + "</i>";

  return { text, keyboard: Markup.inlineKeyboard(rows) };
}

/**
 * Некоторые хадисы не влезают в лимит Telegram (4096 символов),
 * поэтому делим перевод на части. Разрезаем по словам, учитывая
 * длину HTML после экранирования.
 */
function hadithParts(hadith) {
  const header =
    "🕌 <b>Хадис " + hadith.n + " из " + TOTAL_HADITHS + "</b>\n" +
    "<i>" + escapeHtml(hadith.title) + "</i>\n\n" +
    "<b>﴿ " + escapeHtml(hadith.ar) + " ﴾</b>\n\n";

  const firstPrefix = header + "<b>Перевод Абдуллы Нирши:</b>\n";
  const nextPrefix = "<b>Перевод Абдуллы Нирши (продолжение):</b>\n\n";

  const budget = SAFE_LIMIT - 80;
  const parts = [];
  let rest = String(hadith.ru || "");
  let prefix = firstPrefix;

  while (rest.length > 0) {
    if (prefix.length + escapeHtml(rest).length <= budget) {
      parts.push(prefix + escapeHtml(rest));
      break;
    }

    let low = 1;
    let high = rest.length;
    let best = 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (prefix.length + escapeHtml(rest.slice(0, mid)).length <= budget) {
        best = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    let cut = best;
    const space = rest.lastIndexOf(" ", cut);
    if (space > cut * 0.6) cut = space;

    parts.push(prefix + escapeHtml(rest.slice(0, cut).trimEnd()));
    rest = rest.slice(cut).trimStart();
    prefix = nextPrefix;
  }

  return parts;
}

function hadithView(hadithNumber, part = 0) {
  const hadith = data.hadiths.find((item) => item.n === hadithNumber);
  if (!hadith) return null;

  const parts = hadithParts(hadith);
  const index = Math.min(Math.max(part, 0), parts.length - 1);

  let text = parts[index];
  if (parts.length > 1) {
    text += "\n\n<i>Часть " + (index + 1) + " из " + parts.length + "</i>";
  }

  const rows = [];

  if (parts.length > 1) {
    rows.push([
      Markup.button.callback(
        "⬅️",
        index > 0 ? "d:" + hadith.n + ":" + (index - 1) : "noop"
      ),
      Markup.button.callback("Часть " + (index + 1) + " / " + parts.length, "noop"),
      Markup.button.callback(
        "➡️",
        index < parts.length - 1 ? "d:" + hadith.n + ":" + (index + 1) : "noop"
      ),
    ]);
  }

  rows.push([
    Markup.button.callback(
      "⬅️",
      hadithNumber > 1 ? "d:" + (hadithNumber - 1) : "noop"
    ),
    Markup.button.callback(hadith.n + " / " + TOTAL_HADITHS, "noop"),
    Markup.button.callback(
      "➡️",
      hadithNumber < TOTAL_HADITHS ? "d:" + (hadithNumber + 1) : "noop"
    ),
  ]);
  rows.push([
    Markup.button.callback("📋 Список", "h:" + Math.floor((hadith.n - 1) / HADITHS_PER_PAGE)),
    Markup.button.callback("🏠 Меню", "menu"),
  ]);

  return { text, keyboard: Markup.inlineKeyboard(rows), parts: parts.length, index };
}

/* ─────────── Помощь ─────────── */

function helpText() {
  return (
    "ℹ️ <b>Как пользоваться ботом</b>\n\n" +
    "📖 <b>Коран</b>\n" +
    "Все 114 сур. Внутри суры листайте аяты кнопками ⬅️ ➡️ или откройте «📋 Все аяты», " +
    "чтобы перейти к нужному номеру.\n\n" +
    "💡 <b>Тафсир</b>\n" +
    "Под каждым аятом — толкование на русском. Если оно длинное, бот покажет начало " +
    "и кнопку «Тафсир полностью».\n\n" +
    "🕌 <b>Хадисы</b>\n" +
    "40 хадисов имама ан-Навави: арабский текст и перевод. Листайте кнопками ⬅️ ➡️.\n\n" +
    "<b>Команды:</b>\n" +
    "/start — главное меню\n" +
    "/help — эта справка\n\n" +
    "<i>Текст Корана: Quran Uthmani, перевод Э. Кулиева.\n" +
    "Тафсир: " + escapeHtml(data.tafsirName) + " (" + escapeHtml(data.tafsirNote) + ").\n" +
    "Хадисы: перевод Абдуллы Нирши.</i>"
  );
}

function helpKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("📖 Коран", "q:0"),
      Markup.button.callback("🕌 Хадисы", "h:0"),
    ],
    [Markup.button.callback("🏠 Главное меню", "menu")],
  ]);
}

module.exports = {
  TOTAL_SURAHS,
  TOTAL_HADITHS,
  SURAHS_PER_PAGE,
  AYAHS_PER_GRID_PAGE,
  HADITHS_PER_PAGE,
  menuText,
  menuKeyboard,
  surahList,
  ayahView,
  ayahText,
  ayahGrid,
  hadithList,
  hadithView,
  helpText,
  helpKeyboard,
};
