"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const data = require("../data/adhkar.json");
const bot = require("../shared/adhkar.cjs");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const source = fs.readFileSync(path.join(root, "src/app.html"), "utf8");
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
scripts.forEach(code => new vm.Script(code));
const embedded = {};
vm.runInNewContext(scripts.find(code => code.includes("window.ADHKAR_DATA =")), { window: embedded });
assert.deepEqual(JSON.parse(JSON.stringify(embedded.ADHKAR_DATA)), data);
assert(source.includes("<!-- ADHKAR_DATA -->"));
assert(!source.includes("Крепость мусульманина"));
assert.equal(new Set(data.items.map(i => i.n)).size, data.items.length);
for (let number = 5; number <= 20; number++) {
  assert(data.items.some(i => i.sourceNumber.split("–").map(Number).includes(number)), "Missing book item " + number);
}
const morning = bot.adhkarItems("m");
const evening = bot.adhkarItems("e");
assert(morning.some(i => i.sourceNumber === "10"));
assert(!evening.some(i => i.sourceNumber === "10"));
assert(evening.some(i => i.sourceNumber === "6"));
assert(!morning.some(i => i.sourceNumber === "6"));
for (const items of [morning, evening]) {
  assert.equal(items.find(i => i.sourceNumber === "15").count, 3);
  assert.equal(items.find(i => i.sourceNumber === "16").count, 3);
  assert.equal(items.find(i => i.sourceNumber === "17").count, 100);
  assert.equal(items.find(i => i.sourceNumber === "12").count, 4);
}
// Exercise the website's actual counter functions across both periods.
const functions = ["adhCount", "setAdhCount"].map(name => {
  const match = source.match(new RegExp("  function " + name + "\\([\\s\\S]*?\\n  \\}"));
  assert(match, name);
  return match[0];
}).join("\n");
const state = {
  ADHKAR: data, adhCounts: {m:{},e:{},daily:{}}, adhPeriod: "m",
  saveAdhCounts() {}, renderAdhProgress() {},
};
vm.createContext(state);
vm.runInContext(functions, state);
const card = {classList:{toggle(){}}};
const button = {classList:{toggle(){}}};
const daily = data.items.find(i => i.daily);
state.setAdhCount(daily.n, 1, card, button, {}, daily.count);
assert.equal(state.adhCount("e", daily.n), 1);
state.adhPeriod = "e";
state.setAdhCount(daily.n, 2, card, button, {}, daily.count);
assert.equal(state.adhCount("m", daily.n), 2);
state.setAdhCount(1, 1, card, button, {}, 1);
assert.equal(state.adhCount("m", 1), 0);
assert.equal(state.adhCount("e", 1), 1);
console.log("PASS: book coverage, morning/evening classification, repetition counts, shared daily counter, embedded data, JavaScript syntax");
