const API_BASE = "https://api.telegram.org";

/**
 * Вызов метода Telegram Bot API.
 * Ошибку возвращает с полями description и error_code — как telegraf.
 */
export async function call(env, method, payload = {}) {
  const response = await fetch(API_BASE + "/bot" + env.BOT_TOKEN + "/" + method, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!data || !data.ok) {
    const description = (data && data.description) || "Telegram API: " + method + " — HTTP " + response.status;
    const error = new Error(description);
    error.description = description;
    error.error_code = data && data.error_code;
    throw error;
  }

  return data.result;
}

export function sendMessage(env, chatId, text, extra = {}) {
  return call(env, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...extra,
  });
}

export function editMessageText(env, chatId, messageId, text, extra = {}) {
  return call(env, "editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...extra,
  });
}

export function answerCallbackQuery(env, id, extra = {}) {
  return call(env, "answerCallbackQuery", { callback_query_id: id, ...extra });
}

export async function getMe(env) {
  return call(env, "getMe");
}

export async function setWebhook(env, url, secretToken) {
  return call(env, "setWebhook", {
    url,
    secret_token: secretToken,
    drop_pending_updates: true,
    allowed_updates: ["message", "callback_query"],
  });
}

export async function deleteWebhook(env) {
  return call(env, "deleteWebhook", { drop_pending_updates: false });
}
