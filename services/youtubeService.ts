
/**
 * YoutubeService.ts
 * 
 * Extracts transcripts from YouTube videos using multiple strategies.
 */

// Helper to route requests through the correct proxy
const fetchViaProxy = async (targetUrl: string) => {
    if (import.meta.env.PROD) {
        const proxyUrl = `/api/youtube-proxy?url=${encodeURIComponent(targetUrl)}`;
        const res = await fetch(proxyUrl);
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Proxy error (${res.status}): ${err}`);
        }
        return res;
    }

    // In Development (Vite), use local proxy from vite.config.ts
    let localUrl = targetUrl;
    if (targetUrl.includes('youtube.com')) {
        localUrl = targetUrl.replace(/https:\/\/(www\.)?youtube\.com/, '/youtube-proxy');
    }
    return fetch(localUrl);
};

export const getYoutubeTranscript = async (url: string): Promise<string> => {
    const videoId = extractVideoID(url);
    if (!videoId) throw new Error('ID de video inválido');

    // Strategy 1: Try fetching transcript directly from timedtext API
    // This is the most reliable method as it doesn't require parsing HTML
    try {
        const transcript = await fetchTranscriptDirect(videoId);
        if (transcript && transcript.length > 50) {
            return transcript;
        }
    } catch (e) {
        console.warn('Direct transcript fetch failed:', e);
    }

    // Strategy 2: Try via YouTube page parsing
    try {
        const transcript = await fetchTranscriptViaPage(videoId);
        if (transcript && transcript.length > 50) {
            return transcript;
        }
    } catch (e) {
        console.warn('Page-based transcript fetch failed:', e);
    }

    // If all strategies fail
    throw new Error('No se pudo obtener la transcripción. El video puede no tener subtítulos disponibles o YouTube bloqueó la solicitud.');
};

// Strategy 1: Direct timedtext API
async function fetchTranscriptDirect(videoId: string): Promise<string> {
    // Try common language codes
    const languages = ['es', 'en', 'es-419', 'en-US'];

    for (const lang of languages) {
        try {
            // This URL format sometimes works for auto-generated captions
            const timedTextUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=srv3`;
            const response = await fetchViaProxy(timedTextUrl);
            const xml = await response.text();

            if (xml && xml.includes('<text')) {
                return parseTranscriptXml(xml);
            }
        } catch (e) {
            // Continue to next language
        }
    }

    throw new Error('No transcript available via direct API');
}

// Strategy 2: Parse from YouTube watch page
async function fetchTranscriptViaPage(videoId: string): Promise<string> {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const response = await fetchViaProxy(watchUrl);
    const html = await response.text();

    // Try multiple patterns to find caption tracks
    let captionTracks = null;

    // Pattern 1: Direct captionTracks in page
    const pattern1 = /"captionTracks":\s*(\[.*?\])/;
    const match1 = html.match(pattern1);
    if (match1) {
        try {
            captionTracks = JSON.parse(match1[1]);
        } catch (e) { }
    }

    // Pattern 2: ytInitialPlayerResponse
    if (!captionTracks) {
        const pattern2 = /ytInitialPlayerResponse\s*=\s*(\{.+?\});/;
        const match2 = html.match(pattern2);
        if (match2) {
            try {
                const playerResponse = JSON.parse(match2[1]);
                captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
            } catch (e) { }
        }
    }

    // Pattern 3: Look in embedded JSON
    if (!captionTracks) {
        const pattern3 = /\\"captionTracks\\":\s*(\[.*?\])/;
        const match3 = html.match(pattern3);
        if (match3) {
            try {
                // Unescape the JSON
                const unescaped = match3[1].replace(/\\"/g, '"');
                captionTracks = JSON.parse(unescaped);
            } catch (e) { }
        }
    }

    if (!captionTracks || captionTracks.length === 0) {
        console.error('No caption tracks found. HTML preview:', html.substring(0, 1000));
        throw new Error('No se encontraron subtítulos en la página');
    }

    // Prioritize Spanish, then English
    const track = captionTracks.find((t: any) => t.languageCode === 'es')
        || captionTracks.find((t: any) => t.languageCode === 'en')
        || captionTracks.find((t: any) => t.languageCode?.startsWith('es'))
        || captionTracks.find((t: any) => t.languageCode?.startsWith('en'))
        || captionTracks[0];

    if (!track?.baseUrl) {
        throw new Error('No se encontró URL de subtítulos');
    }

    const transcriptResponse = await fetchViaProxy(track.baseUrl);
    const transcriptXml = await transcriptResponse.text();

    return parseTranscriptXml(transcriptXml);
}

// Parse transcript XML to plain text
function parseTranscriptXml(xml: string): string {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xml, "text/xml");
    const texts = xmlDoc.getElementsByTagName('text');

    let fullText = '';
    for (let i = 0; i < texts.length; i++) {
        let text = texts[i].textContent || '';
        // Decode HTML entities
        text = text.replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");
        fullText += text + ' ';
    }

    return fullText.replace(/\s+/g, ' ').trim();
}

const extractVideoID = (url: string): string | null => {
    // Handle various YouTube URL formats
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
        /^([a-zA-Z0-9_-]{11})$/ // Just the ID
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }

    // Fallback to original regex
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7]?.length === 11) ? match[7] : null;
};
