
/**
 * YoutubeService.ts
 * 
 * Extracts transcripts from YouTube videos using the local dev proxy 
 * to bypass CORS.
 * 
 * Note: This relies on the '/youtube-proxy' configuration in vite.config.ts
 */

// Helper to route requests through the correct proxy
const fetchViaProxy = async (targetUrl: string) => {
    // In Production (Vercel), use the serverless API function
    // We check !import.meta.env.DEV to be safe (Prod build = true usually)
    // Actually, looking at the previous screenshot, it's a Vercel deployment.
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
    // Convert https://www.youtube.com/xyz -> /youtube-proxy/xyz
    let localUrl = targetUrl;
    if (targetUrl.includes('youtube.com')) {
        localUrl = targetUrl.replace(/https:\/\/(www\.)?youtube\.com/, '/youtube-proxy');
    }
    return fetch(localUrl);
};

export const getYoutubeTranscript = async (url: string): Promise<string> => {
    try {
        const videoId = extractVideoID(url);
        if (!videoId) throw new Error('ID de video inválido');

        // 1. Fetch Video Page
        const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const response = await fetchViaProxy(watchUrl);
        const html = await response.text();

        // 2. Extract Captions JSON
        // Strategy 1: classical "captionTracks"
        let captionMatch = html.match(/"captionTracks":\s*(\[.*?\])/);

        // Strategy 2: Look for ytInitialPlayerResponse variable directly
        if (!captionMatch) {
            const playerResponseMatch = html.match(/var\s+ytInitialPlayerResponse\s*=\s*(\{.+?\});/);
            if (playerResponseMatch) {
                try {
                    const playerResponse = JSON.parse(playerResponseMatch[1]);
                    const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
                    if (tracks) {
                        // Create a fake match object to reuse logic below
                        captionMatch = [null, JSON.stringify(tracks)];
                    }
                } catch (e) {
                    console.warn('Failed to parse ytInitialPlayerResponse:', e);
                }
            }
        }

        if (!captionMatch) {
            // Debugging: Log part of HTML to see what we got (Consent page? Bot check?)
            console.error('YouTube HTML Preview (first 500 chars):', html.substring(0, 500));
            console.error('YouTube HTML Preview (includes "captionTracks"?):', html.includes('captionTracks'));

            if (html.includes('consent.youtube.com') || html.includes('Sign in to confirm')) {
                throw new Error('YouTube bloqueó la solicitud (Bot check). Intenta con otro video o pega el texto manualmente.');
            }
            throw new Error('No se encontraron subtítulos (la estructura de la página puede haber cambiado).');
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
        // We route it through our proxy helper

        const transcriptResponse = await fetchViaProxy(track.baseUrl);
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
