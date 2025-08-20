
exports.handler = async (event) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers: corsHeaders, body: 'OK' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers: corsHeaders, body: 'Method Not Allowed' };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const { phone, district, locality, message } = body;

        if (!phone || !district) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Phone and district required' })
            };
        }

        const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
        const CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;

        if (!BOT_TOKEN || !CHAT_ID) {
            console.error('Missing Telegram credentials');
            return {
                statusCode: 500,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Server configuration error' })
            };
        }

        const text = `💧 НОВА ЗАЯВКА

📞 Телефон: ${phone}
📍 Район: ${district}
🏘️ Населений пункт: ${locality || '-'}
💬 Повідомлення: ${message || '-'}
🕒 Час: ${new Date().toLocaleString('uk-UA')}`;

        const response = await fetch(
            `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: CHAT_ID,
                    text: text
                })
            }
        );

        const data = await response.json();
        
        if (!response.ok) {
            console.error('Telegram error:', data);
            throw new Error('Telegram error');
        }

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ ok: true, message: 'Заявка відправлена' })
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Server error', details: error.message })
        };
    }
};