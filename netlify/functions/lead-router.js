exports.handler = async (event) => {
    console.log('Function called:', event.httpMethod);
    
    // CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
    };

    // Handle OPTIONS
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // Only POST
    if (event.httpMethod !== 'POST') {
        return { 
            statusCode: 405, 
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Parse body
        const data = JSON.parse(event.body);
        console.log('Received data:', data);

        // Get env vars
        const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
        const CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;
        
        console.log('Token exists:', !!TOKEN);
        console.log('Chat ID:', CHAT_ID);

        // Simple message
        const message = `Нова заявка:\nТел: ${data.phone}\nРайон: ${data.district}`;

        // Send to Telegram
        const url = `https://api.telegram.org/bot${TOKEN}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text: message
            })
        });

        console.log('Telegram response status:', response.status);
        const result = await response.text();
        console.log('Telegram response:', result);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true })
        };

    } catch (error) {
        console.error('Error:', error.message);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};