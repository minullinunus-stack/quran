"use strict";
const ui = require("./src/ui");
const data = require("./src/data");

const patterns = [
  [/^menu$/, "menu"], [/^help$/, "help"], [/^noop$/, "noop"],
  [/^q:\d+$/, "q"], [/^s:\d+$/, "s"], [/^a:\d+:\d+$/, "a"],
  [/^g:\d+:\d+$/, "g"], [/^h:\d+$/, "h"], [/^d:\d+(?::\d+)?$/, "d"],
  [/^z:[me]:\d+$/, "z"],
  [/^t:\d+:\d+$/, "t"],
];

let buttons = 0;
const bad = [];
const unknown = new Set();
const tooLong = [];

function walk(view, label) {
  if (!view) { bad.push("нет вида: " + label); return; }
  const kb = view.keyboard.reply_markup.inline_keyboard;
  for (const row of kb) {
    for (const btn of row) {
      buttons++;
      const cb = btn.callback_data;
      if (!cb) { bad.push("нет callback_data: " + label + " / " + btn.text); continue; }
      if (Buffer.byteLength(cb, "utf8") > 64) tooLong.push(label + " -> " + cb);
      if (!patterns.some(([re]) => re.test(cb))) unknown.add(cb + " (" + label + ")");
    }
  }
  if (view.text.length > 4096) bad.push("длинный текст: " + label + " = " + view.text.length);
}

walk({ text: ui.menuText("Тест"), keyboard: ui.menuKeyboard() }, "menu");
walk({ text: ui.helpText(), keyboard: ui.helpKeyboard() }, "help");

for (let p = 0; p < Math.ceil(114 / ui.SURAHS_PER_PAGE); p++) walk(ui.surahList(p), "surahList " + p);

for (const s of data.surahs) {
  walk(ui.ayahView(s.n, 1), "ayah " + s.n + ":1");
  walk(ui.ayahView(s.n, s.ay.length), "ayah " + s.n + ":" + s.ay.length);
  const gridPages = Math.ceil(s.ay.length / ui.AYAHS_PER_GRID_PAGE);
  walk(ui.ayahGrid(s.n, 0), "grid " + s.n + ":0");
  walk(ui.ayahGrid(s.n, gridPages - 1), "grid " + s.n + ":" + (gridPages - 1));
  if (!s.ay.length) bad.push("пустая сура " + s.n);
}

for (let p = 0; p < Math.ceil(42 / ui.HADITHS_PER_PAGE); p++) walk(ui.hadithList(p), "hadithList " + p);
for (const h of data.hadiths) {
  const first = ui.hadithView(h.n, 0);
  for (let part = 0; part < (first ? first.parts : 0); part++) walk(ui.hadithView(h.n, part), "hadith " + h.n + ":" + part);
}

for (const period of ["m", "e"]) {
  const items = require("../shared/adhkar.cjs").adhkarItems(period);
  items.forEach((item, index) => walk(ui.adhkarView(period, index), "adhkar " + period + ":" + index));
}

console.log("кнопок проверено:", buttons);
console.log("частей у хадисов > 1:", data.hadiths.filter((h) => ui.hadithView(h.n).parts > 1).map((h) => h.n).join(", ") || "нет");
console.log("неизвестные callback:", unknown.size ? [...unknown] : "нет");
console.log("callback > 64 байт:", tooLong.length ? tooLong : "нет");
console.log("ошибки:", bad.length ? bad : "нет");
process.exitCode = bad.length || unknown.size || tooLong.length ? 1 : 0;
