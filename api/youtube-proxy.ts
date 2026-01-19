import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { videoId } = req.query;

    if (!videoId) {
        return res.status(400).json({ error: 'Missing videoId parameter' });
    }

    const id = Array.isArray(videoId) ? videoId[0] : videoId;

    try {
        const transcript = await fetchYouTubeTranscript(id);
        res.setHeader('Content-Type', 'application/json');
        res.status(200).json({ success: true, transcript });
    } catch (error: any) {
        console.error('Transcript Error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get transcript'
        });
    }
}

async function fetchYouTubeTranscript(videoId: string): Promise<string> {
    // Step 1: Get the video page
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;

    console.log('Fetching YouTube page:', watchUrl);

    const pageResponse = await fetch(watchUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
    });

    if (!pageResponse.ok) {
        throw new Error(`YouTube returned status ${pageResponse.status}`);
    }

    const html = await pageResponse.text();
    console.log('Received HTML length:', html.length);
    console.log('HTML contains captionTracks:', html.includes('captionTracks'));

    // Try to find caption tracks
    let captionTracks: any[] = [];

    // Pattern 1: Look for captionTracks in the page (without /s flag for compatibility)
    const captionMatch = html.match(/"captionTracks":\s*(\[[^\]]+\])/);
    if (captionMatch) {
        try {
            captionTracks = JSON.parse(captionMatch[1]);
            console.log('Found captionTracks via pattern 1:', captionTracks.length);
        } catch (e) {
            console.log('Failed to parse captionTracks pattern 1:', e);
        }
    }

    // Pattern 2: Look for ytInitialPlayerResponse
    if (!captionTracks.length) {
        // Match just the captions part to avoid parsing huge JSON
        const captionsMatch = html.match(/"captions":\s*\{"playerCaptionsTracklistRenderer":\s*\{"captionTracks":\s*(\[[^\]]+\])/);
        if (captionsMatch) {
            try {
                captionTracks = JSON.parse(captionsMatch[1]);
                console.log('Found captionTracks via pattern 2:', captionTracks.length);
            } catch (e) {
                console.log('Failed to parse captionTracks pattern 2:', e);
            }
        }
    }

    // If we found caption tracks, fetch the transcript
    if (captionTracks.length > 0) {
        const track = captionTracks.find((t: any) => t.languageCode === 'en')
            || captionTracks.find((t: any) => t.languageCode === 'es')
            || captionTracks[0];

        if (track?.baseUrl) {
            console.log('Fetching transcript from:', track.baseUrl);
            const transcriptResponse = await fetch(track.baseUrl);
            const xml = await transcriptResponse.text();
            console.log('Transcript XML length:', xml.length);
            return parseTranscriptXml(xml);
        }
    }

    // Fallback: Try direct timedtext API
    console.log('Trying timedtext API fallback...');
    const languages = ['en', 'es', 'en-US', 'es-419'];

    for (const lang of languages) {
        try {
            const timedTextUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=srv3`;
            console.log('Trying timedtext URL:', timedTextUrl);
            const response = await fetch(timedTextUrl);
            const xml = await response.text();

            if (xml && xml.includes('<text')) {
                console.log('Found transcript via timedtext API for lang:', lang);
                return parseTranscriptXml(xml);
            }
        } catch (e) {
            console.log('timedtext failed for lang:', lang, e);
        }
    }

    // Try auto-generated captions
    for (const lang of ['en', 'es']) {
        try {
            const timedTextUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&kind=asr&fmt=srv3`;
            const response = await fetch(timedTextUrl);
            const xml = await response.text();

            if (xml && xml.includes('<text')) {
                console.log('Found auto-generated transcript for lang:', lang);
                return parseTranscriptXml(xml);
            }
        } catch (e) {
            // Continue
        }
    }

    throw new Error('No se encontraron subtítulos disponibles para este video');
}

function parseTranscriptXml(xml: string): string {
    const textMatches = [...xml.matchAll(/<text[^>]*>([^<]*)<\/text>/g)];

    if (textMatches.length === 0) {
        throw new Error('No text elements found in transcript XML');
    }

    let fullText = '';
    for (const match of textMatches) {
        let text = match[1];
        // Decode HTML entities
        text = text
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/g, ' ');
        fullText += text + ' ';
    }

    return fullText.replace(/\s+/g, ' ').trim();
}
