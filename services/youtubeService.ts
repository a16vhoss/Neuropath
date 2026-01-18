
/**
 * YoutubeService.ts
 * 
 * Extracts transcripts from YouTube videos using the local dev proxy 
 * to bypass CORS.
 * 
 * Note: This relies on the '/youtube-proxy' configuration in vite.config.ts
 */

export const getYoutubeTranscript = async (url: string): Promise<string> => {
    try {
        const videoId = extractVideoID(url);
        if (!videoId) throw new Error('ID de video inválido');

        // 1. Fetch Video Page via Proxy
        const response = await fetch(`/youtube-proxy/watch?v=${videoId}`);
        const html = await response.text();

        // 2. Extract Captions JSON
        // Look for "captionTracks" inside the ytInitialPlayerResponse
        const captionMatch = html.match(/"captionTracks":\s*(\[.*?\])/);

        if (!captionMatch) {
            // Check if it's because of "Sign in" or bot check
            if (html.includes('consent.youtube.com') || html.includes('Sign in to confirm')) {
                throw new Error('YouTube bloqueó la solicitud (Bot check). Intenta con otro video o pega el texto manualmente.');
            }
            throw new Error('No se encontraron subtítulos para este video (o no están disponibles públicamente).');
        }

        const captionTracks = JSON.parse(captionMatch[1]);

        // Prioritize Spanish, then English, then whatever
        // Sort/Find logic
        const track = captionTracks.find((t: any) => t.languageCode === 'es')
            || captionTracks.find((t: any) => t.languageCode === 'en')
            || captionTracks[0];

        if (!track) throw new Error('No hay tracks de subtítulos utilizables.');

        // 3. Fetch the transcript XML/JSON
        // The baseUrl is usually an absolute URL like https://www.youtube.com/api/timedtext?...
        // We need to route it through our proxy
        let transcriptUrl = track.baseUrl;

        // Replace domain with proxy
        // Handles: https://www.youtube.com/api/timedtext... -> /youtube-proxy/api/timedtext...
        transcriptUrl = transcriptUrl.replace(/https:\/\/(www\.)?youtube\.com/, '/youtube-proxy');

        const transcriptResponse = await fetch(transcriptUrl);
        const transcriptXml = await transcriptResponse.text();

        // 4. Parse XML to Text
        // Simple regex or DOMParser
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(transcriptXml, "text/xml");
        const texts = xmlDoc.getElementsByTagName('text');

        let fullText = '';
        for (let i = 0; i < texts.length; i++) {
            fullText += texts[i].textContent + ' ';
        }

        // Decode HTML entities if needed (browser handle textContent usually does it)
        // Clean up
        fullText = fullText.replace(/\s+/g, ' ').trim();

        return fullText;

    } catch (error) {
        console.error('Youtube Transcript Error:', error);
        throw error;
    }
};

const extractVideoID = (url: string): string | null => {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : null;
};
