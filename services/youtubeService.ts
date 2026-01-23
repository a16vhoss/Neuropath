
/**
 * YoutubeService.ts
 * 
 * Extracts transcripts from YouTube videos.
 * Uses serverless API in production for better reliability.
 */

export interface YoutubeContent {
    success: boolean;
    transcript: string;
    title: string;
    description: string;
    isMetadataOnly?: boolean;
}

export const getYoutubeTranscript = async (url: string): Promise<YoutubeContent> => {
    const videoId = extractVideoID(url);
    if (!videoId) throw new Error('ID de video inválido');

    // In Production: Use the serverless API
    if (import.meta.env.PROD) {
        try {
            const response = await fetch(`/api/youtube-proxy?videoId=${videoId}`);
            const data = await response.json();

            if (data.success) {
                return data; // Returns { success, transcript, title, description, isMetadataOnly }
            } else {
                throw new Error(data.error || 'No se pudo obtener el contenido del video');
            }
        } catch (error: any) {
            console.error('YouTube API Error:', error);
            throw new Error(error.message || 'Error al conectar con el servidor de YouTube');
        }
    }

    // In Development: Use the Vite proxy
    try {
        const transcript = await fetchTranscriptViaDev(videoId);
        return {
            success: true,
            transcript,
            title: 'Video de YouTube (Dev)',
            description: ''
        };
    } catch (error: any) {
        console.error('Dev transcript error:', error);
        throw new Error(error.message || 'No se pudo obtener la transcripción');
    }
};

// Development mode: Use Vite proxy
async function fetchTranscriptViaDev(videoId: string): Promise<string> {
    // Try direct timedtext API first
    const languages = ['es', 'en', 'es-419', 'en-US'];

    for (const lang of languages) {
        try {
            const timedTextUrl = `/youtube-proxy/api/timedtext?v=${videoId}&lang=${lang}&fmt=srv3`;
            const response = await fetch(timedTextUrl);
            const xml = await response.text();

            if (xml && xml.includes('<text')) {
                return parseTranscriptXml(xml);
            }
        } catch (e) {
            // Continue to next language
        }
    }

    // Try fetching the watch page
    const watchUrl = `/youtube-proxy/watch?v=${videoId}`;
    const response = await fetch(watchUrl);
    const html = await response.text();

    // Look for caption tracks
    let captionTracks: any[] = [];

    const captionMatch = html.match(/"captionTracks":(\[.*?\])/s);
    if (captionMatch) {
        try {
            captionTracks = JSON.parse(captionMatch[1]);
        } catch (e) { }
    }

    if (!captionMatch) {
        const playerMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});/s);
        if (playerMatch) {
            try {
                const playerResponse = JSON.parse(playerMatch[1]);
                captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
            } catch (e) { }
        }
    }

    if (captionTracks.length > 0) {
        const track = captionTracks.find((t: any) => t.languageCode === 'es')
            || captionTracks.find((t: any) => t.languageCode === 'en')
            || captionTracks[0];

        if (track?.baseUrl) {
            let transcriptUrl = track.baseUrl.replace(/https:\/\/(www\.)?youtube\.com/, '/youtube-proxy');
            const transcriptResponse = await fetch(transcriptUrl);
            const xml = await transcriptResponse.text();
            return parseTranscriptXml(xml);
        }
    }

    throw new Error('No se encontraron subtítulos disponibles');
}

function parseTranscriptXml(xml: string): string {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xml, "text/xml");
    const texts = xmlDoc.getElementsByTagName('text');

    let fullText = '';
    for (let i = 0; i < texts.length; i++) {
        let text = texts[i].textContent || '';
        text = text
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");
        fullText += text + ' ';
    }

    return fullText.replace(/\s+/g, ' ').trim();
}

const extractVideoID = (url: string): string | null => {
    if (!url) return null;

    // Handle various YouTube URL formats (watch, youtu.be, embed, v, shorts, live)
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
        /[?&]v=([a-zA-Z0-9_-]{11})/,
        /^([a-zA-Z0-9_-]{11})$/ // Just the ID
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) return match[1];
    }

    return null;
};
