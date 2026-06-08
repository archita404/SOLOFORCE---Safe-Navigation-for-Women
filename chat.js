/* ════════════════════════════════════════════════════════════
   SoloForce — Netlify Serverless Function
   File: netlify/functions/chat.js

   This runs on Netlify's servers (not the user's browser),
   so the API key is kept secret and CORS is handled safely.

   Setup:
   1. Deploy to Netlify
   2. Go to Site Settings → Environment Variables
   3. Add: ANTHROPIC_API_KEY = sk-ant-your-key-here
   4. That's it — the AI chat will work automatically.
════════════════════════════════════════════════════════════ */

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // CORS headers — allow your Netlify domain
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    const { messages, context } = JSON.parse(event.body);

    // Validate
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'No messages provided' }) };
    }

    // API key from Netlify environment variable (never exposed to browser)
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 503, headers,
        body: JSON.stringify({ error: 'API key not configured. Add ANTHROPIC_API_KEY in Netlify environment variables.' })
      };
    }

    // Build system prompt with context
    const systemPrompt = `You are SafeGuide, a warm and practical AI safety companion for women navigating alone, embedded in SoloForce — a women's safety navigation app.

Your role: Help users stay safe with route advice, personal safety tips, emergency protocols, self-defence basics, and emotional support.

Current app context:
- Time mode: ${context?.isNight ? 'Night (higher risk — be extra cautious in advice)' : 'Day'}
- User has geolocation: ${context?.hasLocation ? 'Yes' : 'No'}

Guidelines:
- Be warm, concise, and non-alarmist
- Give practical, actionable advice
- Always mention relevant emergency numbers (1091 Women Helpline, 100 Police, 102 Ambulance) when relevant
- Reference SoloForce app features (Safe Walk Timer, SOS button, green routes) when applicable
- Use light formatting (bullet points, bold for key info) but keep responses focused
- Never make the user feel judged or paranoid — validate their concerns
- If they seem to be in immediate danger, prioritise emergency numbers above all else
- Keep responses under 200 words unless a detailed answer is clearly needed`;

    // Call Anthropic API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', // Fast + cheap for chat
        max_tokens: 400,
        system: systemPrompt,
        messages: messages.slice(-10), // Keep last 10 turns for context window efficiency
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic API error:', err);
      return { statusCode: response.status, headers, body: JSON.stringify({ error: 'API request failed' }) };
    }

    const data = await response.json();
    const reply = data.content?.map(c => c.text || '').join('') || "I'm here to help — please try again.";

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ reply }),
    };

  } catch (err) {
    console.error('Function error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal error', message: err.message }),
    };
  }
};
