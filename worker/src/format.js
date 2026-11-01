export const TELEGRAM_LIMIT = 4096;
export const SAFE_LIMIT = 3900;

export function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Режет длинный текст на части не длиннее limit, стараясь рвать по строкам. */
export function splitText(text, limit = SAFE_LIMIT) {
  const source = String(text == null ? "" : text);
  if (source.length <= limit) return [source];

  const chunks = [];
  let current = "";

  for (const line of source.split("\n")) {
    const candidate = current ? current + "\n" + line : line;

    if (candidate.length <= limit) {
      current = candidate;
      continue;
    }

    if (current) {
      chunks.push(current);
      current = "";
    }

    let rest = line;
    while (rest.length > limit) {
      let cut = rest.lastIndexOf(" ", limit);
      if (cut < limit * 0.6) cut = limit;
      chunks.push(rest.slice(0, cut));
      rest = rest.slice(cut).trimStart();
    }
    current = rest;
  }

  if (current) chunks.push(current);
  return chunks;
}

export function truncate(text, limit) {
  const source = String(text == null ? "" : text).trim();
  if (source.length <= limit) return source;

  let cut = source.lastIndexOf(" ", limit);
  if (cut < limit * 0.6) cut = limit;
  return source.slice(0, cut).trimEnd() + "…";
}

export function plural(count, one, few, many) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
