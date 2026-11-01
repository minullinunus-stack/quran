// Доступ к данным бота в Cloudflare KV с кэшем в памяти изолята.
//
// Ключи:
//   meta            — оглавление: список сур, число хадисов, название тафсира
//   s:<номер>       — сура: { n, ay: [[арабский, перевод], ...] }
//   t:<номер>       — тафсир суры: [текст|null, ...]
//   h:list          — список хадисов: [{ n, title }, ...]
//   h:<номер>       — хадис: { n, title, ru, ar }
//   users           — массив id пользователей
//   stats           — счётчики просмотров

const TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 300;
const cache = new Map();

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (hit.expires < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return hit.value;
}

function cacheSet(key, value) {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { value, expires: Date.now() + TTL_MS });
}

export async function kvJson(env, key) {
  const cached = cacheGet(key);
  if (cached !== undefined) return cached;

  const value = await env.HATM_KV.get(key, "json");
  cacheSet(key, value);
  return value;
}

export async function loadMeta(env) {
  const meta = await kvJson(env, "meta");
  if (!meta || !Array.isArray(meta.surahs)) {
    throw new Error("KV пуст: сначала выполните `npm run prepare-data` и загрузите данные");
  }
  return meta;
}

export function loadSurah(env, n) {
  return kvJson(env, "s:" + n);
}

export async function loadTafsirChapter(env, n) {
  const chapter = await kvJson(env, "t:" + n);
  return Array.isArray(chapter) ? chapter : [];
}

export async function tafsirText(env, surahNumber, ayahNumber) {
  const chapter = await loadTafsirChapter(env, surahNumber);
  return chapter[ayahNumber - 1] || "";
}

export function loadHadith(env, n) {
  return kvJson(env, "h:" + n);
}

export async function loadHadithList(env) {
  const list = await kvJson(env, "h:list");
  return Array.isArray(list) ? list : [];
}

/* ─────────── Пользователи ─────────── */

export async function getUsers(env) {
  const users = await kvJson(env, "users");
  return Array.isArray(users) ? users : [];
}

export async function trackUser(env, id) {
  const users = await getUsers(env);
  if (users.includes(id)) return false;

  users.push(id);
  cacheSet("users", users);
  await env.HATM_KV.put("users", JSON.stringify(users));
  return true;
}

/* ─────────── Статистика ─────────── */

const pending = { ayahViews: 0, hadithViews: 0 };
let flushScheduled = false;

export function bumpStat(env, field, ctx) {
  pending[field] = (pending[field] || 0) + 1;

  if (flushScheduled) return;
  flushScheduled = true;

  const task = (async () => {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const delta = { ayahViews: pending.ayahViews, hadithViews: pending.hadithViews };
    pending.ayahViews = 0;
    pending.hadithViews = 0;
    flushScheduled = false;

    if (!delta.ayahViews && !delta.hadithViews) return;

    const stats = (await kvJson(env, "stats")) || {};
    stats.ayahViews = (stats.ayahViews || 0) + delta.ayahViews;
    stats.hadithViews = (stats.hadithViews || 0) + delta.hadithViews;
    if (!stats.startedAt) stats.startedAt = Date.now();

    cacheSet("stats", stats);
    await env.HATM_KV.put("stats", JSON.stringify(stats));
  })().catch((error) => {
    flushScheduled = false;
    console.error("Не удалось сохранить статистику:", error);
  });

  if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(task);
}

export async function getStats(env) {
  const stats = (await kvJson(env, "stats")) || {};
  return {
    ayahViews: stats.ayahViews || 0,
    hadithViews: stats.hadithViews || 0,
    startedAt: stats.startedAt || Date.now(),
  };
}
