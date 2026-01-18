import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'Missing url parameter' });
    }

    try {
        // Validate that 'url' is a string before passing to URL constructor
        const urlString = Array.isArray(url) ? url[0] : url;
        const targetUrl = new URL(urlString);

        // Security: Only allow YouTube domains
        if (!targetUrl.hostname.endsWith('youtube.com') && !targetUrl.hostname.endsWith('youtu.be')) {
            return res.status(403).json({ error: 'Only YouTube URLs are allowed' });
        }

        const response = await fetch(urlString, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
            }
        });

        const text = await response.text();

        // Return the content
        res.setHeader('Content-Type', 'text/plain');
        res.status(200).send(text);

    } catch (error) {
        console.error('Proxy Error:', error);
        res.status(500).json({ error: error.message });
    }
}
