// Відкрити один раз у браузері: реєструє webhook бота на цей сайт.
import { createHash } from 'node:crypto';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SECRET = createHash('sha256').update(String(TOKEN)).digest('hex').slice(0, 40);

export default async (req) => {
  const origin = new URL(req.url).origin;
  const webhookUrl = `${origin}/.netlify/functions/tg-webhook`;
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: SECRET,
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: true,
    }),
  }).then((x) => x.json()).catch((e) => ({ ok: false, description: e.message }));

  await fetch(`https://api.telegram.org/bot${TOKEN}/setMyCommands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commands: [{ command: 'start', description: 'Підключитись' }, { command: 'master', description: 'Хто зараз майстер' }] }),
  }).catch(() => {});

  const html = `<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;padding:24px;font-size:18px">
  ${r.ok ? '✅ Webhook підключено.' : '❌ Помилка: ' + (r.description || 'невідома')}<br><br>
  <small>${webhookUrl}</small></body>`;
  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
};
