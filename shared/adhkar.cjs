"use strict";

// The same texts and morning/evening classification as the website.
const data = require("../data/adhkar.json");
const escape = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function adhkarItems(period) {
  if (period !== "m" && period !== "e") return [];
  return data.items.filter((item) => period === "m" ? item.type !== 2 : item.type !== 1);
}

function adhkarView(period, index = 0) {
  const items = adhkarItems(period);
  if (!Number.isSafeInteger(index) || index < 0 || index >= items.length) return null;
  const item = items[index];
  const title = period === "m" ? "🌅 Утренние поминания" : "🌇 Вечерние поминания";
  const button = (text, callback_data) => ({ text, callback_data });
  return {
    text: "<b>" + title + "</b>\n<i>" + (index + 1) + " из " + items.length + " · Повторить: " + item.count + (item.daily ? " в течение дня" : "") + "</i>\n\n" +
      "<b>" + escape(item.title) + "</b>\n\n" + escape(item.ar) + "\n\n<b>Перевод:</b>\n" + escape(item.ru) +
      "\n\n<i>В книге: № " + escape(item.sourceNumber) + ", с. " + item.page + "." + (item.note ? " " + escape(item.note) : "") + "</i>" +
      "\n\n<i>" + escape(data.note) + "</i>",
    keyboard: { inline_keyboard: [
      [button("⬅️", index > 0 ? "z:" + period + ":" + (index - 1) : "noop"),
        button((index + 1) + " / " + items.length, "noop"),
        button("➡️", index + 1 < items.length ? "z:" + period + ":" + (index + 1) : "noop")],
      [button("🌅 Утро", "z:m:0"), button("🌇 Вечер", "z:e:0")],
      [{ text: "📖 Источник: открыть книгу", url: data.sourceUrl + "#page=" + item.page }],
      [button("🏠 Главное меню", "menu")],
    ] },
  };
}

module.exports = { adhkarItems, adhkarView };
