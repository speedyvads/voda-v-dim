// Заявка з сайту → Telegram адміну з кнопками «Передати майстру» / «Взяв сам».
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN = process.env.TELEGRAM_ADMIN_CHAT_ID;

const tg = (method, payload) =>
  fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then((r) => r.json());

const kyivTime = () =>
  new Intl.DateTimeFormat('uk-UA', {
    timeZone: 'Europe/Kyiv', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date());

const clean = (s, max = 300) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, max);

export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }
  let data;
  try { data = await req.json(); } catch { return new Response(JSON.stringify({ error: 'Bad JSON' }), { status: 400 }); }

  // Honeypot — боту відповідаємо «ок», але нічого не шлемо
  if (clean(data.website)) return new Response(JSON.stringify({ success: true }), { status: 200 });

  const phone = clean(data.phone, 20);
  if (!/^\+?\d{9,15}$/.test(phone)) {
    return new Response(JSON.stringify({ error: 'Bad phone' }), { status: 400 });
  }

  const place = clean(data.place, 60);        // населений пункт, який показали на сайті (укр.)
  const locality = clean(data.locality, 60);  // те, що ввів клієнт
  const district = clean(data.district, 40);
  const message = clean(data.message, 500);
  const geoSource = data.geo_source === 'auto' ? 'авто' : data.geo_source === 'manual' ? 'вибрав сам' : '—';
  const geoCity = clean(data.geo_city, 40);
  const serverCity = context.geo?.city ? `${context.geo.city}` : '';

  const where = [locality || place, district && `${district} р-н`].filter(Boolean).join(' · ') || 'не вказано';

  const lines = [
    '🆕 Заявка з сайту',
    `📞 ${phone}`,
    `📍 ${where}`,
    `🧭 Гео: ${geoSource}${geoCity ? ` (${geoCity})` : ''}${serverCity && serverCity !== geoCity ? ` · IP: ${serverCity}` : ''}`,
    message && `💬 ${message}`,
    `🕒 ${kyivTime()}`,
  ].filter(Boolean);

  try {
    const res = await tg('sendMessage', {
      chat_id: ADMIN,
      text: lines.join('\n'),
      reply_markup: {
        inline_keyboard: [[
          { text: '📤 Передати майстру', callback_data: 'fwd' },
          { text: '👤 Взяв сам', callback_data: 'mine' },
        ]],
      },
    });
    if (!res.ok) {
      console.error('Telegram error:', res);
      return new Response(JSON.stringify({ error: 'Telegram failed' }), { status: 502 });
    }
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e) {
    console.error('Error:', e.message);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};
