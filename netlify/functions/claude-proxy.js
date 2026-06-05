// Fühlkraft Finanzplaner · Netlify Function · claude-proxy.js
// Löst das CORS-Problem: Browser → diese Function → Anthropic API
// Deploy: netlify/functions/claude-proxy.js im GitHub-Repo

exports.handler = async (event) => {
  // Nur POST erlaubt
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Ungültige Anfrage' }) };
  }

  const { apiKey, imageData, mediaType } = body;

  if (!apiKey || !imageData || !mediaType) {
    return { statusCode: 400, body: JSON.stringify({ error: 'API-Key, Bild oder Medientyp fehlt' }) };
  }

  // Sicherheitscheck: nur Anthropic-Keys erlaubt
  if (!apiKey.startsWith('sk-ant-')) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Ungültiger API-Key' }) };
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: imageData }
            },
            {
              type: 'text',
              text: 'Analysiere diesen Beleg auf Deutsch. Antworte NUR in JSON (kein Markdown, keine Erklärung): {"positionen":[{"name":"...","betrag":12.50,"kategorie":"..."}],"gesamt":99.99}. Kategorien: Pferde/Tiere, Haus, Lebensmittel, Handy/Internet, Geschäftlich, Kleidung, Gesundheit, Sonstiges.'
            }
          ]
        }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: data.error?.message || 'Anthropic API Fehler' })
      };
    }

    // JSON aus der Antwort extrahieren
    const text = data.content?.map(c => c.text || '').join('').replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(text);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed)
    };

  } catch (err) {
    console.error('claude-proxy Fehler:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Serverfehler: ' + err.message })
    };
  }
};
