"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

/**
 * Загружает данные из файлов data/*.js (формат `window.XXX = {...};`).
 * По умолчанию берёт папку data в корне проекта, можно переопределить через DATA_DIR.
 */
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, "..", "..", "data");

function loadWindowVar(fileName, varName) {
  const fullPath = path.join(DATA_DIR, fileName);

  if (!fs.existsSync(fullPath)) {
    throw new Error(
      "Не найден файл данных: " + fullPath + "\n" +
      "Запускайте бота из папки bot/ или укажите DATA_DIR в .env"
    );
  }

  const code = fs.readFileSync(fullPath, "utf8");
  const sandbox = { window: {} };

  vm.runInNewContext(code, sandbox, { timeout: 20000, filename: fullPath });

  const value = sandbox.window[varName];
  if (!value) {
    throw new Error("В файле " + fileName + " нет переменной " + varName);
  }
  return value;
}

const quran = loadWindowVar("quran.js", "QURAN_DATA");
const hadiths = loadWindowVar("hadiths.js", "HADITHS_DATA");

let tafsir = null;
try {
  tafsir = loadWindowVar("tafsir.js", "TAFSIR_DATA");
} catch (error) {
  console.warn("⚠️  Тафсир не загружен: " + error.message);
}

const surahs = quran.surahs;

function getSurah(n) {
  return surahs[n - 1] || null;
}

function getAyah(surahNumber, ayahNumber) {
  const surah = getSurah(surahNumber);
  if (!surah) return null;
  return surah.ay[ayahNumber - 1] || null;
}

function getTafsir(surahNumber, ayahNumber) {
  if (!tafsir || !Array.isArray(tafsir.chapters)) return "";
  const chapter = tafsir.chapters[surahNumber - 1];
  if (!chapter) return "";
  return chapter[ayahNumber - 1] || "";
}

const tafsirName = tafsir ? tafsir.name : "Тафсир";
const tafsirNote = tafsir ? tafsir.note : "";

const tafsirAyahCount = tafsir
  ? tafsir.chapters.reduce(
      (sum, chapter) => sum + chapter.filter((text) => Boolean(text)).length,
      0
    )
  : 0;

module.exports = {
  bism: quran.bism,
  surahs,
  hadiths,
  tafsirName,
  tafsirNote,
  tafsirAyahCount,
  getSurah,
  getAyah,
  getTafsir,
  DATA_DIR,
};
