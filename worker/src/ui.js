import { escapeHtml, truncate, SAFE_LIMIT } from "./format.js";

export const SURAHS_PER_PAGE = 12;
export const AYAHS_PER_GRID_PAGE = 24;
export const HADITHS_PER_PAGE = 6;

function keyboard(rows) {
  return { inline_keyboard: rows };
}

function button(text, callbackData) {
  return { text, callback_data: callbackData };
}

/* ─────────── Главное меню ─────────── */

export function menuText(name) {
  const hello = name ? ", " + escapeHtml(name) : "";
  return (
    "🌙 <b>Ассаляму алейкум" + hello + "!</b>\n\n" +
    "📖 <b>Коран</b> — все 114 сур: арабский текст, перевод на русский и тафсир.\n" +
    "🕌 <b>Хадисы</b> — 40 хадисов имама ан-Навави с переводом.\n\n" +
    "Выберите раздел 👇"
  );
}

export function menuKeyboard() {
  return keyboard([
    [button("📖 Коран", "q:0"), button("🕌 Хадисы", "h:0")],
    [button("ℹ️ Помощь", "help")],
  ]);
}

/* ─────────── Список сур ─────────── */

export function surahList(meta, page) {
  const totalSurahs = meta.surahs.length;
  const total = Math.ceil(totalSurahs / SURAHS_PER_PAGE);
  const current = Math.min(Math.max(page, 0), total - 1);
  const from = current * SURAHS_PER_PAGE;
  const slice = meta.surahs.slice(from, from + SURAHS_PER_PAGE);

  const rows = [];
  for (let i = 0; i < slice.length; i += 3) {
    rows.push(
      slice
        .slice(i, i + 3)
        .map((surah) => button(surah.n + ". " + truncate(surah.ru, 28), "s:" + surah.n))
    );
  }

  const nav = [];
  if (current > 0) nav.push(button("⬅️", "q:" + (current - 1)));
  nav.push(button(current + 1 + " / " + total, "noop"));
  if (current < total - 1) nav.push(button("➡️", "q:" + (current + 1)));
  rows.push(nav);
  rows.push([button("🏠 Главное меню", "menu")]);

  const text =
    "📖 <b>Коран</b>\n\n" +
    "Выберите суру — покажу аяты с переводом Э. Кулиева и тафсиром.\n\n" +
    "<i>Страница " + (current + 1) + " из " + total + " · всего " + totalSurahs + " сур</i>";

  return { text, keyboard: keyboard(rows) };
}

/* ─────────── Аят ─────────── */

/**
 * @param {{meta: object, surah: {n:number, ay: any[], ru:string, meaning:string, rev:string}, tafsir: string}} input
 */
export function ayahView(input, ayahNumber) {
  const { meta, surah, tafsir } = input;
  if (!surah) return null;

  const pair = surah.ay[ayahNumber - 1];
  if (!pair) return null;

  const total = surah.ay.length;

  const head =
    "📖 <b>Сура " + surah.n + ". " + escapeHtml(surah.ru) + "</b>\n" +
    "<i>" + escapeHtml(surah.meaning) + " · " + escapeHtml(surah.rev) +
    " · аят " + ayahNumber + " из " + total + "</i>";

  const bism =
    ayahNumber === 1 && surah.n !== 1 && surah.n !== 9
      ? "\n\n<i>" + escapeHtml(meta.bism) + "</i>"
      : "";

  const ayahBlock =
    "\n\n<b>﴿ " + escapeHtml(pair[0]) + " ﴾</b>\n\n" +
    "<b>Перевод Э. Кулиева:</b>\n" + escapeHtml(pair[1]);

  const tafsirHead = "\n\n<b>💡 " + escapeHtml(meta.tafsirName) + ":</b>\n";
  const base = head + bism + ayahBlock + tafsirHead;

  let text;
  let truncatedTafsir = false;

  if (!tafsir) {
    text = base + "<i>К этому аяту толкование не приводится.</i>";
  } else {
    text = base + escapeHtml(tafsir);

    if (text.length > SAFE_LIMIT) {
      const note = "\n\n<i>… Толкование сокращено — полностью по кнопке ниже.</i>";
      let room = SAFE_LIMIT - base.length - note.length - 40;
      let cut = truncate(tafsir, Math.max(room, 0));

      text = base + escapeHtml(cut) + note;

      while (text.length > SAFE_LIMIT && cut.length > 120) {
        room = Math.floor(room * 0.85);
        cut = truncate(tafsir, Math.max(room, 0));
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

  const rows = [];
  const prev = ayahNumber > 1 ? "a:" + surah.n + ":" + (ayahNumber - 1) : "noop";
  const next = ayahNumber < total ? "a:" + surah.n + ":" + (ayahNumber + 1) : "noop";

  rows.push([button("⬅️", prev), button(ayahNumber + " / " + total, "noop"), button("➡️", next)]);

  if (truncatedTafsir) {
    rows.push([button("💡 Тафсир полностью", "t:" + surah.n + ":" + ayahNumber)]);
  }

  rows.push([button("📋 Все аяты", "g:" + surah.n + ":0"), button("🏠 Меню", "menu")]);

  return { text, keyboard: keyboard(rows), truncatedTafsir };
}

/* ─────────── Сетка аятов ─────────── */

export function ayahGrid(surah, page) {
  if (!surah) return null;

  const totalPages = Math.ceil(surah.ay.length / AYAHS_PER_GRID_PAGE);
  const current = Math.min(Math.max(page, 0), totalPages - 1);
  const from = current * AYAHS_PER_GRID_PAGE + 1;
  const to = Math.min(from + AYAHS_PER_GRID_PAGE - 1, surah.ay.length);

  const rows = [];
  for (let i = from; i <= to; i += 6) {
    const row = [];
    for (let n = i; n <= Math.min(i + 5, to); n++) {
      row.push(button(String(n), "a:" + surah.n + ":" + n));
    }
    rows.push(row);
  }

  const nav = [];
  if (current > 0) nav.push(button("⬅️", "g:" + surah.n + ":" + (current - 1)));
  nav.push(button(current + 1 + " / " + totalPages, "noop"));
  if (current < totalPages - 1) nav.push(button("➡️", "g:" + surah.n + ":" + (current + 1)));
  rows.push(nav);

  rows.push([
    button("▶️ Читать с аята " + from, "a:" + surah.n + ":" + from),
    button("🏠 Меню", "menu"),
  ]);

  const text =
    "📖 <b>Сура " + surah.n + ". " + escapeHtml(surah.ru) + "</b>\n" +
    "<i>" + escapeHtml(surah.meaning) + " · " + escapeHtml(surah.rev) + "</i>\n\n" +
    "Выберите аят: <b>" + from + "–" + to + "</b> из " + surah.ay.length + ".";

  return { text, keyboard: keyboard(rows) };
}

/* ─────────── Хадисы ─────────── */

export function hadithList(hadiths, totalHadiths, page) {
  const total = Math.ceil(totalHadiths / HADITHS_PER_PAGE);
  const current = Math.min(Math.max(page, 0), total - 1);
  const from = current * HADITHS_PER_PAGE;
  const slice = hadiths.slice(from, from + HADITHS_PER_PAGE);

  const rows = slice.map((hadith) => [button(hadith.n + ". " + truncate(hadith.title, 48), "d:" + hadith.n)]);

  const nav = [];
  if (current > 0) nav.push(button("⬅️", "h:" + (current - 1)));
  nav.push(button(current + 1 + " / " + total, "noop"));
  if (current < total - 1) nav.push(button("➡️", "h:" + (current + 1)));
  rows.push(nav);
  rows.push([button("🏠 Главное меню", "menu")]);

  const text =
    "🕌 <b>40 хадисов имама ан-Навави</b>\n\n" +
    "Сборник «аль-Арбаун ан-Нававия»: " + totalHadiths +
    " хадиса с арабским текстом и переводом.\n\n" +
    "<i>Страница " + (current + 1) + " из " + total + "</i>";

  return { text, keyboard: keyboard(rows) };
}

/** Делит длинный хадис на части, влезающие в лимит Telegram. */
export function hadithParts(hadith, totalHadiths) {
  const header =
    "🕌 <b>Хадис " + hadith.n + " из " + totalHadiths + "</b>\n" +
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

export function hadithView(hadith, totalHadiths, part = 0) {
  if (!hadith) return null;

  const parts = hadithParts(hadith, totalHadiths);
  const index = Math.min(Math.max(part, 0), parts.length - 1);

  let text = parts[index];
  if (parts.length > 1) {
    text += "\n\n<i>Часть " + (index + 1) + " из " + parts.length + "</i>";
  }

  const rows = [];

  if (parts.length > 1) {
    rows.push([
      button("⬅️", index > 0 ? "d:" + hadith.n + ":" + (index - 1) : "noop"),
      button("Часть " + (index + 1) + " / " + parts.length, "noop"),
      button("➡️", index < parts.length - 1 ? "d:" + hadith.n + ":" + (index + 1) : "noop"),
    ]);
  }

  rows.push([
    button("⬅️", hadith.n > 1 ? "d:" + (hadith.n - 1) : "noop"),
    button(hadith.n + " / " + totalHadiths, "noop"),
    button("➡️", hadith.n < totalHadiths ? "d:" + (hadith.n + 1) : "noop"),
  ]);
  rows.push([
    button("📋 Список", "h:" + Math.floor((hadith.n - 1) / HADITHS_PER_PAGE)),
    button("🏠 Меню", "menu"),
  ]);

  return { text, keyboard: keyboard(rows), parts: parts.length, index };
}

/* ─────────── Помощь ─────────── */

export function helpText(meta) {
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
    "Тафсир: " + escapeHtml(meta.tafsirName) + " (" + escapeHtml(meta.tafsirNote) + ").\n" +
    "Хадисы: перевод Абдуллы Нирши.</i>"
  );
}

export function helpKeyboard() {
  return keyboard([
    [button("📖 Коран", "q:0"), button("🕌 Хадисы", "h:0")],
    [button("🏠 Главное меню", "menu")],
  ]);
}
