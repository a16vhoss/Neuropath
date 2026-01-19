import type { VercelRequest, VercelResponse } from '@vercel/node';

// Version 6 - Using YouTube Data API v3

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { videoId } = req.query;

    if (!videoId) {
        return res.status(400).json({ error: 'Missing videoId parameter' });
    }

    if (!YOUTUBE_API_KEY) {
        return res.status(500).json({ error: 'YouTube API key not configured' });
    }

    const id = Array.isArray(videoId) ? videoId[0] : videoId;

    try {
        const transcript = await getTranscriptWithAPI(id);
        res.setHeader('Content-Type', 'application/json');
        res.status(200).json({ success: true, transcript });
    } catch (error: any) {
        console.error('Transcript Error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get transcript'
        });
    }
}

async function getTranscriptWithAPI(videoId: string): Promise<string> {
    // Step 1: Get video info using YouTube Data API to verify it exists
    const videoInfoUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${YOUTUBE_API_KEY}`;

    const videoResponse = await fetch(videoInfoUrl);
    const videoData = await videoResponse.json();

    if (!videoData.items || videoData.items.length === 0) {
        throw new Error('Video no encontrado');
    }

    const videoTitle = videoData.items[0].snippet?.title;
    console.log('Processing video:', videoTitle);

    // Step 2: Get captions list using YouTube Data API
    const captionsUrl = `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${YOUTUBE_API_KEY}`;

    const captionsResponse = await fetch(captionsUrl);
    const captionsData = await captionsResponse.json();

    // Check if captions are available
    if (captionsData.error) {
        console.log('Captions API error:', captionsData.error);
        // Fall back to timedtext approach
        return await getTranscriptViaTimedText(videoId);
    }

    if (!captionsData.items || captionsData.items.length === 0) {
        // No captions via API, try the timedtext fallback
        return await getTranscriptViaTimedText(videoId);
    }

    // Step 3: Find best caption track (prefer Spanish, then English)
    let selectedCaption = captionsData.items.find((c: any) =>
        c.snippet.language === 'es' || c.snippet.language === 'es-419'
    );
    if (!selectedCaption) {
        selectedCaption = captionsData.items.find((c: any) =>
            c.snippet.language === 'en' || c.snippet.language === 'en-US'
        );
    }
    if (!selectedCaption) {
        selectedCaption = captionsData.items[0];
    }

    const language = selectedCaption.snippet.language;
    console.log('Found caption track:', language);

    // Step 4: Try to get the transcript via timedtext (the captions.download requires OAuth)
    return await getTranscriptViaTimedText(videoId, language);
}

async function getTranscriptViaTimedText(videoId: string, preferredLang?: string): Promise<string> {
    // Try different language codes
    const languages = preferredLang
        ? [preferredLang, 'es', 'en', 'es-419', 'en-US']
        : ['es', 'en', 'es-419', 'en-US', 'es-MX'];

    // Remove duplicates
    const uniqueLangs = [...new Set(languages)];

    for (const lang of uniqueLangs) {
        try {
            // Try regular captions
            let url = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=srv3`;
            let response = await fetch(url);
            let xml = await response.text();

            if (xml && xml.includes('<text')) {
                console.log('Found transcript via timedtext for:', lang);
                return parseTranscriptXml(xml);
            }

            // Try auto-generated captions
            url = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&kind=asr&fmt=srv3`;
            response = await fetch(url);
            xml = await response.text();

            if (xml && xml.includes('<text')) {
                console.log('Found auto-generated transcript for:', lang);
                return parseTranscriptXml(xml);
            }
        } catch (e) {
            console.log('Failed for lang:', lang, e);
        }
    }

    throw new Error('No se encontraron subtítulos disponibles para este video. Asegúrate de que el video tenga subtítulos habilitados.');
}

function parseTranscriptXml(xml: string): string {
    const textMatches = [...xml.matchAll(/<text[^>]*>([^<]*)<\/text>/g)];

    if (textMatches.length === 0) {
        throw new Error('No se encontró contenido en los subtítulos');
    }

    let fullText = '';
    for (const match of textMatches) {
        let text = match[1];
        text = decodeHtmlEntities(text);
        fullText += text + ' ';
    }

    return fullText.replace(/\s+/g, ' ').trim();
}

function decodeHtmlEntities(text: string): string {
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
}
