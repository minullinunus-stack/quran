"use strict";

/**
 * Умный запуск бота для тех, кто не хочет вводить команды:
 * проверяет .env, при необходимости открывает его в Блокноте,
 * ставит зависимости и запускает src/index.js.
 */

const fs = require("node:fs");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const ENV_PATH = path.join(ROOT, ".env");
const EXAMPLE_PATH = path.join(ROOT, ".env.example");
const IS_WIN = process.platform === "win32";

const TEMPLATE =
  "# 1) Вставьте токен бота от @BotFather после знака \"=\"\n" +
  "BOT_TOKEN=\n\n" +
  "# 2) Вставьте ваш Telegram ID от @userinfobot\n" +
  "OWNER_ID=\n";

function openInEditor(file) {
  if (process.env.HATAM_NO_OPEN) return;
  try {
    if (IS_WIN) {
      spawnSync("notepad.exe", [file], { stdio: "ignore" });
    } else if (process.platform === "darwin") {
      spawnSync("open", ["-e", file], { stdio: "ignore" });
    } else {
      spawnSync("xdg-open", [file], { stdio: "ignore" });
    }
  } catch {
    console.log("Откройте файл вручную: " + file);
  }
}

function readEnvValue(name) {
  let raw = "";
  try {
    raw = fs.readFileSync(ENV_PATH, "utf8").replace(/^\uFEFF/, "");
  } catch {
    return "";
  }
  // Важно: только горизонтальные пробелы, иначе \s* «перепрыгнет» на следующую строку.
  const match = raw.match(new RegExp("^[ \\t]*" + name + "[ \\t]*=[ \\t]*(.*)$", "m"));
  if (!match) return "";
  return match[1].trim().replace(/^["']|["']$/g, "");
}

function ensureEnvFile() {
  if (fs.existsSync(ENV_PATH)) return;

  let content = TEMPLATE;
  try {
    content = fs.readFileSync(EXAMPLE_PATH, "utf8");
  } catch {
    // останется TEMPLATE
  }

  fs.writeFileSync(ENV_PATH, content, "utf8");
  console.log("📝 Создал файл .env рядом с ботом.");
}

function ensureDependencies() {
  const modules = path.join(ROOT, "node_modules", "telegraf");
  if (fs.existsSync(modules)) return true;

  console.log("📦 Устанавливаю зависимости (около минуты)...\n");
  const npm = IS_WIN ? "npm.cmd" : "npm";
  const result = spawnSync(npm, ["install", "--no-audit", "--no-fund"], {
    cwd: ROOT,
    stdio: "inherit",
    shell: IS_WIN,
  });

  if (result.status !== 0) {
    console.error("\n❌ Не удалось установить зависимости. Проверьте интернет и место на диске.");
    return false;
  }
  return true;
}

function runBot() {
  const child = spawn(process.execPath, [path.join(ROOT, "src", "index.js")], {
    cwd: ROOT,
    stdio: "inherit",
  });

  child.on("exit", (code) => {
    process.exit(code == null ? 0 : code);
  });
}

function hasToken() {
  const token = readEnvValue("BOT_TOKEN");
  return Boolean(token) && !/ExampleTokenReplaceMe/i.test(token);
}

function askForToken() {
  console.log(
    "⚠️  В файле .env ещё нет токена бота.\n\n" +
      "Что делать:\n" +
      "  1. Откройте в Telegram @BotFather → /newbot → придумайте имя и username.\n" +
      "  2. BotFather пришлёт строку вида 123456789:AAH... — это токен.\n" +
      "  3. Вставьте её в .env после BOT_TOKEN= (без пробелов и кавычек).\n" +
      "  4. Узнайте свой ID у @userinfobot и вставьте после OWNER_ID=.\n" +
      "  5. Сохраните файл: Ctrl+S. Затем закройте Блокнот — бот запустится сам.\n\n" +
      "Открываю .env в Блокноте…\n"
  );

  openInEditor(ENV_PATH);

  if (!hasToken()) {
    console.log(
      "\n⚠️  Токен в .env так и не появился.\n" +
        "Проверьте, что вставили строку после BOT_TOKEN= и нажали Ctrl+S.\n" +
        "Если Блокнот не открылся — откройте файл .env в папке bot вручную.\n"
    );
    process.exit(1);
  }

  console.log("\n✅ Токен найден.\n");
}

function main() {
  console.log("🌙 Хатм — Telegram-бот\n");

  ensureEnvFile();

  if (!hasToken()) {
    askForToken();
  }

  const token = readEnvValue("BOT_TOKEN");
  const owner = readEnvValue("OWNER_ID");

  if (!/^\d{5,}:[A-Za-z0-9_-]{30,}$/.test(token)) {
    console.log(
      "⚠️  Токен выглядит необычно — возможно, скопирован не полностью.\n" +
        "    Правильный вид: 123456789:AAH-длинный_набор_букв_и_цифр\n\n"
    );
  }

  if (!owner) {
    console.log("ℹ️  OWNER_ID не задан — команды /stats и /broadcast будут отключены.\n");
  }

  if (!ensureDependencies()) process.exit(1);

  console.log("🚀 Запускаю бота. Это окно должно оставаться открытым.\n");
  runBot();
}

main();
