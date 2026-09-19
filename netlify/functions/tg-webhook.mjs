// Telegram webhook: призначення майстра і пересилання заявок йому.
// Майстер зберігається як закріплене повідомлення в чаті адміна (без бази даних).
import { createHash } from 'node:crypto';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN = String(process.env.TELEGRAM_ADMIN_CHAT_ID || '');
const SECRET = createHash('sha256').update(String(TOKEN)).digest('hex').slice(0, 40);

const tg = (method, payload) =>
  fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then((r) => r.json()).catch((e) => ({ ok: false, description: e.message }));

const kyivTime = () =>
  new Intl.DateTimeFormat('uk-UA', {
    timeZone: 'Europe/Kyiv', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date());

const displayName = (u = {}) =>
  [u.first_name, u.last_name].filter(Boolean).join(' ') + (u.username ? ` (@${u.username})` : '');

async function getMaster() {
  // 1) закріплене повідомлення адміна
  const chat = await tg('getChat', { chat_id: ADMIN });
  const text = chat?.result?.pinned_message?.text || '';
  const m = text.match(/MASTER_ID:(-?\d+)/);
  if (m) {
    const name = (text.match(/Майстер:\s*(.+)/) || [])[1] || 'майстер';
    return { id: m[1], name: name.trim() };
  }
  // 2) запасний варіант — змінна оточення
  for (const key of ['TELEGRAM_MASTER_CHAT_ID', 'TELEGRAM_MASTER_YURIY_CHAT_ID']) {
    const v = process.env[key];
    if (v && /^-?\d+$/.test(v)) return { id: v, name: 'майстер (з налаштувань)' };
  }
  return null;
}

async function setMaster(id, name) {
  const sent = await tg('sendMessage', {
    chat_id: ADMIN,
    text: `👷 Майстер: ${name}\nMASTER_ID:${id}\n\nНе відкріплюй це повідомлення — по ньому бот знає, кому пересилати заявки.`,
  });
  if (!sent.ok) return false;
  await tg('unpinAllChatMessages', { chat_id: ADMIN });
  await tg('pinChatMessage', { chat_id: ADMIN, message_id: sent.result.message_id, disable_notification: true });
  return true;
}

async function handleMessage(msg) {
  const chatId = String(msg.chat.id);
  const text = (msg.text || '').trim();
  const from = msg.from || {};

  if (text.startsWith('/start')) {
    if (chatId === ADMIN) {
      const master = await getMaster();
      await tg('sendMessage', {
        chat_id: ADMIN,
        text: `✅ Це адмін-чат. Заявки з сайту приходять сюди.\n👷 Майстер: ${master ? master.name : 'не призначений — нехай він натисне Start у цьому боті'}`,
      });
      return;
    }
    await tg('sendMessage', {
      chat_id: chatId,
      text: 'Вітаю! Ви підключаєтесь як майстер по колонках на воду. Очікуйте підтвердження — після нього сюди приходитимуть заявки (телефон і населений пункт).',
    });
    await tg('sendMessage', {
      chat_id: ADMIN,
      text: `👤 Натиснув Start: ${displayName(from)}\nID: ${from.id}`,
      reply_markup: { inline_keyboard: [[{ text: '👷 Зробити майстром', callback_data: `setm:${from.id}` }]] },
    });
    return;
  }

  if (chatId === ADMIN) {
    if (text.startsWith('/master')) {
      const master = await getMaster();
      await tg('sendMessage', { chat_id: ADMIN, text: master ? `👷 Майстер: ${master.name}\nID: ${master.id}` : '👷 Майстер не призначений.' });
    }
    return;
  }

  // Повідомлення від майстра — дублюємо адміну
  const master = await getMaster();
  if (master && String(master.id) === chatId && text) {
    await tg('sendMessage', { chat_id: ADMIN, text: `💬 Майстер: ${text}` });
  }
}

async function handleCallback(cq) {
  const fromId = String(cq.from?.id || '');
  const data = cq.data || '';
  const msg = cq.message;

  if (fromId !== ADMIN) {
    await tg('answerCallbackQuery', { callback_query_id: cq.id, text: 'Немає доступу' });
    return;
  }

  if (data.startsWith('setm:')) {
    const id = data.slice(5);
    const name = (msg?.text?.match(/Start:\s*(.+)/) || [])[1]?.trim() || `ID ${id}`;
    const ok = await setMaster(id, name);
    await tg('answerCallbackQuery', { callback_query_id: cq.id, text: ok ? 'Майстра призначено' : 'Помилка' });
    if (ok) {
      await tg('editMessageText', { chat_id: ADMIN, message_id: msg.message_id, text: `${msg.text}\n\n✅ Призначено майстром · ${kyivTime()}` });
      await tg('sendMessage', { chat_id: id, text: '✅ Вас підключено як майстра. Сюди приходитимуть заявки: телефон клієнта і населений пункт.' });
    }
    return;
  }

  if (data === 'fwd') {
    const master = await getMaster();
    if (!master) {
      await tg('answerCallbackQuery', {
        callback_query_id: cq.id, show_alert: true,
        text: 'Майстер не призначений. Нехай натисне Start у цьому боті — тобі прийде кнопка «Зробити майстром».',
      });
      return;
    }
    const sent = await tg('sendMessage', { chat_id: master.id, text: msg.text });
    if (!sent.ok) {
      await tg('answerCallbackQuery', { callback_query_id: cq.id, show_alert: true, text: `Не вдалося надіслати: ${sent.description || 'помилка'}` });
      return;
    }
    await tg('answerCallbackQuery', { callback_query_id: cq.id, text: 'Передано майстру' });
    await tg('editMessageText', { chat_id: ADMIN, message_id: msg.message_id, text: `${msg.text}\n\n📤 Передано майстру (${master.name}) · ${kyivTime()}` });
    return;
  }

  if (data === 'mine') {
    await tg('answerCallbackQuery', { callback_query_id: cq.id, text: 'Ок' });
    await tg('editMessageText', { chat_id: ADMIN, message_id: msg.message_id, text: `${msg.text}\n\n👤 Взяв сам · ${kyivTime()}` });
    return;
  }

  await tg('answerCallbackQuery', { callback_query_id: cq.id });
}

export default async (req) => {
  if (req.method !== 'POST') return new Response('ok', { status: 200 });
  if (req.headers.get('x-telegram-bot-api-secret-token') !== SECRET) {
    return new Response('forbidden', { status: 403 });
  }
  let update;
  try { update = await req.json(); } catch { return new Response('bad json', { status: 200 }); }
  try {
    if (update.message) await handleMessage(update.message);
    else if (update.callback_query) await handleCallback(update.callback_query);
  } catch (e) {
    console.error('webhook error:', e.message);
  }
  return new Response('ok', { status: 200 }); // Telegram чекає 200 завжди
};
