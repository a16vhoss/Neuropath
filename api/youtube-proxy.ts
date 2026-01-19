import type { VercelRequest, VercelResponse } from '@vercel/node';

// Version 5 - Using YouTube's internal API approach

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { videoId } = req.query;

    if (!videoId) {
        return res.status(400).json({ error: 'Missing videoId parameter' });
    }

    const id = Array.isArray(videoId) ? videoId[0] : videoId;

    try {
        const transcript = await getTranscript(id);
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

async function getTranscript(videoId: string): Promise<string> {
    // Step 1: Fetch the video page to get initial data
    const videoPageResponse = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: {
            'User-Agent': USER_AGENT,
            'Accept-Language': 'en-US,en;q=0.9',
        }
    });

    const videoPageHtml = await videoPageResponse.text();

    // Step 2: Extract the initial player response which contains caption info
    const ytInitialPlayerResponseMatch = videoPageHtml.match(
        /ytInitialPlayerResponse\s*=\s*({.+?})\s*;(?:\s*var\s|<\/script)/
    );

    if (!ytInitialPlayerResponseMatch) {
        // Try alternate pattern
        const altMatch = videoPageHtml.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
        if (!altMatch) {
            throw new Error('No se pudo obtener la información del video');
        }
    }

    const playerResponseJson = ytInitialPlayerResponseMatch
        ? ytInitialPlayerResponseMatch[1]
        : videoPageHtml.match(/ytInitialPlayerResponse\s*=\s*({.+?});/)?.[1];

    if (!playerResponseJson) {
        throw new Error('No se pudo parsear la respuesta del video');
    }

    let playerResponse: any;
    try {
        playerResponse = JSON.parse(playerResponseJson);
    } catch (e) {
        throw new Error('Error al parsear datos del video');
    }

    // Check for playability
    const playabilityStatus = playerResponse.playabilityStatus;
    if (playabilityStatus?.status !== 'OK') {
        throw new Error(`Video no disponible: ${playabilityStatus?.reason || 'desconocido'}`);
    }

    // Step 3: Get caption tracks
    const captions = playerResponse.captions;
    if (!captions || !captions.playerCaptionsTracklistRenderer) {
        throw new Error('Este video no tiene subtítulos disponibles');
    }

    const captionTracks = captions.playerCaptionsTracklistRenderer.captionTracks;
    if (!captionTracks || captionTracks.length === 0) {
        throw new Error('No hay pistas de subtítulos disponibles');
    }

    // Step 4: Select best caption track (prefer Spanish, then English)
    let selectedTrack = captionTracks.find((t: any) => t.languageCode === 'es');
    if (!selectedTrack) {
        selectedTrack = captionTracks.find((t: any) => t.languageCode === 'en');
    }
    if (!selectedTrack) {
        selectedTrack = captionTracks.find((t: any) => t.languageCode?.startsWith('es'));
    }
    if (!selectedTrack) {
        selectedTrack = captionTracks.find((t: any) => t.languageCode?.startsWith('en'));
    }
    if (!selectedTrack) {
        selectedTrack = captionTracks[0];
    }

    if (!selectedTrack?.baseUrl) {
        throw new Error('No se encontró URL de subtítulos');
    }

    // Step 5: Fetch the actual transcript
    const transcriptUrl = selectedTrack.baseUrl;
    const transcriptResponse = await fetch(transcriptUrl, {
        headers: {
            'User-Agent': USER_AGENT,
        }
    });

    const transcriptXml = await transcriptResponse.text();

    // Step 6: Parse XML to plain text
    return parseTranscriptXml(transcriptXml);
}

function parseTranscriptXml(xml: string): string {
    // Extract all text content from <text> tags
    const textMatches = [...xml.matchAll(/<text[^>]*>([^<]*)<\/text>/g)];

    if (textMatches.length === 0) {
        throw new Error('No se encontró contenido en los subtítulos');
    }

    let fullText = '';
    for (const match of textMatches) {
        let text = match[1];
        // Decode HTML entities
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
