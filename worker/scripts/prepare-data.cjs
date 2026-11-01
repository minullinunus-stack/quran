"use strict";

/**
 * Готовит данные бота для загрузки в Cloudflare KV.
 *
 * Читает data/quran.js, data/hadiths.js, data/tafsir.js (формат window.XXX = {...}),
 * раскладывает их по ключам и пишет worker/.data-kv/kv.json в формате
 * `wrangler kv bulk put`.
 *
 * Запуск:  npm run prepare-data
 */

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..", "..");
const DATA_DIR = path.join(ROOT, "data");
const OUT_DIR = path.join(__dirname, "..", ".data-kv");
const OUT_FILE = path.join(OUT_DIR, "kv.json");

function loadWindowVar(fileName, varName) {
  const fullPath = path.join(DATA_DIR, fileName);
  if (!fs.existsSync(fullPath)) {
    throw new Error("Не найден файл данных: " + fullPath);
  }

  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(fullPath, "utf8"), sandbox, {
    timeout: 30000,
    filename: fullPath,
  });

  const value = sandbox.window[varName];
  if (!value) throw new Error("В " + fileName + " нет переменной " + varName);
  return value;
}

const quran = loadWindowVar("quran.js", "QURAN_DATA");
const hadiths = loadWindowVar("hadiths.js", "HADITHS_DATA");
const tafsir = loadWindowVar("tafsir.js", "TAFSIR_DATA");

const entries = [];

function add(key, value) {
  entries.push({ key, value: JSON.stringify(value) });
}

const surahMeta = quran.surahs.map((surah) => ({
  n: surah.n,
  ar: surah.ar,
  ru: surah.ru,
  meaning: surah.meaning,
  rev: surah.rev,
  count: surah.ay.length,
}));

add("meta", {
  bism: quran.bism,
  tafsirName: tafsir.name,
  tafsirNote: tafsir.note,
  totalHadiths: hadiths.length,
  totalSurahs: quran.surahs.length,
  surahs: surahMeta,
});

for (const surah of quran.surahs) {
  add("s:" + surah.n, {
    n: surah.n,
    ru: surah.ru,
    meaning: surah.meaning,
    rev: surah.rev,
    ay: surah.ay,
  });
}

for (let i = 0; i < tafsir.chapters.length; i++) {
  add("t:" + (i + 1), tafsir.chapters[i]);
}

add("h:list", hadiths.map((h) => ({ n: h.n, title: h.title })));

for (const hadith of hadiths) {
  add("h:" + hadith.n, { n: hadith.n, title: hadith.title, ru: hadith.ru, ar: hadith.ar });
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify(entries), "utf8");

const bytes = entries.reduce((sum, item) => sum + Buffer.byteLength(item.value, "utf8"), 0);
const maxKey = entries.reduce((max, item) => Math.max(max, item.value.length), 0);

console.log("📚 Сур: " + quran.surahs.length);
console.log("🕌 Хадисов: " + hadiths.length);
console.log("💡 Глав тафсира: " + tafsir.chapters.length);
console.log("🔑 Ключей: " + entries.length);
console.log("📦 Объём значений: " + (bytes / 1048576).toFixed(2) + " МБ");
console.log("📏 Самое большое значение: " + (maxKey / 1024).toFixed(0) + " КБ (лимит KV — 25 МБ)");
console.log("📄 Файл для загрузки: " + OUT_FILE);
