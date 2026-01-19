import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { videoId } = req.query;

    if (!videoId) {
        return res.status(400).json({ error: 'Missing videoId parameter' });
    }

    const id = Array.isArray(videoId) ? videoId[0] : videoId;

    try {
        // Use the undocumented YouTube transcript endpoint
        // This endpoint is more reliable for server-side requests
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
    // Step 1: Get the video page to extract the innertube API key and other data
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;

    const pageResponse = await fetch(watchUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
    });

    const html = await pageResponse.text();

    // Extract serializedShareEntity for the transcript request
    const serializedShareEntityMatch = html.match(/"serializedShareEntity":"([^"]+)"/);

    // Try to find caption tracks in the page
    let captionTracks: any[] = [];

    // Pattern 1: Direct captionTracks
    const captionMatch = html.match(/"captionTracks":(\[.*?\])/s);
    if (captionMatch) {
        try {
            captionTracks = JSON.parse(captionMatch[1]);
        } catch (e) {
            console.log('Failed to parse captionTracks pattern 1');
        }
    }

    // Pattern 2: ytInitialPlayerResponse
    if (!captionTracks.length) {
        const playerMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});/s);
        if (playerMatch) {
            try {
                const playerResponse = JSON.parse(playerMatch[1]);
                captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
            } catch (e) {
                console.log('Failed to parse ytInitialPlayerResponse');
            }
        }
    }

    // Pattern 3: Escaped JSON (in script tags)
    if (!captionTracks.length) {
        const escapedMatch = html.match(/\\"captionTracks\\":(\[.*?\])/s);
        if (escapedMatch) {
            try {
                const unescaped = escapedMatch[1]
                    .replace(/\\"/g, '"')
                    .replace(/\\\\/g, '\\');
                captionTracks = JSON.parse(unescaped);
            } catch (e) {
                console.log('Failed to parse escaped captionTracks');
            }
        }
    }

    // If we found caption tracks, fetch the transcript
    if (captionTracks.length > 0) {
        // Prioritize Spanish, then English
        const track = captionTracks.find((t: any) => t.languageCode === 'es')
            || captionTracks.find((t: any) => t.languageCode === 'en')
            || captionTracks.find((t: any) => t.languageCode?.startsWith('es'))
            || captionTracks.find((t: any) => t.languageCode?.startsWith('en'))
            || captionTracks[0];

        if (track?.baseUrl) {
            const transcriptResponse = await fetch(track.baseUrl);
            const xml = await transcriptResponse.text();
            return parseTranscriptXml(xml);
        }
    }

    // Fallback: Try direct timedtext API with different language codes
    const languages = ['es', 'en', 'es-419', 'en-US', 'es-MX'];
    for (const lang of languages) {
        try {
            const timedTextUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=srv3`;
            const response = await fetch(timedTextUrl);
            const xml = await response.text();

            if (xml && xml.includes('<text')) {
                return parseTranscriptXml(xml);
            }
        } catch (e) {
            // Continue to next language
        }
    }

    // Try auto-generated captions
    for (const lang of ['es', 'en']) {
        try {
            const timedTextUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&kind=asr&fmt=srv3`;
            const response = await fetch(timedTextUrl);
            const xml = await response.text();

            if (xml && xml.includes('<text')) {
                return parseTranscriptXml(xml);
            }
        } catch (e) {
            // Continue
        }
    }

    throw new Error('No se encontraron subtítulos disponibles para este video');
}

function parseTranscriptXml(xml: string): string {
    // Simple regex-based parsing since we're in Node.js environment
    const textMatches = xml.matchAll(/<text[^>]*>([^<]*)<\/text>/g);

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
            .replace(/&nbsp;/g, ' ')
            .replace(/\\n/g, ' ');
        fullText += text + ' ';
    }

    return fullText.replace(/\s+/g, ' ').trim();
}
