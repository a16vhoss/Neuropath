import type { VercelRequest, VercelResponse } from '@vercel/node';
import { YoutubeTranscript } from 'youtube-transcript';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { videoId } = req.query;

    if (!videoId) {
        return res.status(400).json({ error: 'Missing videoId parameter' });
    }

    const id = Array.isArray(videoId) ? videoId[0] : videoId;
    console.log(`[YouTubeProxy] Processing: ${id}`);

    let videoTitle = '';
    let videoDescription = '';
    let transcript = '';

    try {
        // Step 1: Extract Metadata & Transcript link from YouTube HTML
        try {
            const watchUrl = `https://www.youtube.com/watch?v=${id}`;
            const response = await fetch(watchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
                    'Cache-Control': 'no-cache'
                }
            });
            const html = await response.text();

            // Extract Title from HTML tag as primary backup
            const titleMatch = html.match(/<title>(.*?)<\/title>/);
            if (titleMatch) videoTitle = titleMatch[1].replace(' - YouTube', '');

            // Extract ytInitialPlayerResponse JSON
            const playerResponseMatch = html.match(/(?:var\s+|window\[['"]ytInitialPlayerResponse['"]\]\s*=\s*|ytInitialPlayerResponse\s*=\s*)({.+?});/s);

            if (playerResponseMatch) {
                const playerResponse = JSON.parse(playerResponseMatch[1]);
                videoTitle = playerResponse?.videoDetails?.title || videoTitle;
                videoDescription = playerResponse?.videoDetails?.shortDescription || '';

                // Attempt to fetch transcript directly if tracks are visible
                const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
                if (captionTracks.length > 0) {
                    const track = captionTracks.find((t: any) => t.languageCode?.startsWith('es')) ||
                        captionTracks.find((t: any) => t.languageCode?.startsWith('en')) ||
                        captionTracks[0];

                    if (track?.baseUrl) {
                        const transcriptRes = await fetch(track.baseUrl + '&fmt=json3');
                        if (transcriptRes.ok) {
                            const tsData = await transcriptRes.json();
                            transcript = tsData.events
                                ?.filter((e: any) => e.segs)
                                .map((e: any) => e.segs.map((s: any) => s.utf8).join(''))
                                .join(' ')
                                .replace(/\s+/g, ' ')
                                .trim();
                        }
                    }
                }
            }
        } catch (scrapeErr: any) {
            console.warn('[YouTubeProxy] Scraping failed:', scrapeErr.message);
        }

        // Step 2: Fallback to Library if transcript is still missing
        if (!transcript) {
            try {
                console.log('[YouTubeProxy] Falling back to youtube-transcript library');
                const items = await YoutubeTranscript.fetchTranscript(id);
                transcript = items.map(i => i.text).join(' ').replace(/\s+/g, ' ').trim();
            } catch (libErr: any) {
                console.error('[YouTubeProxy] Library failed:', libErr.message);
            }
        }

        // Step 3: Respond with what we have
        if (transcript || videoTitle || videoDescription) {
            return res.status(200).json({
                success: true,
                transcript: transcript || '',
                title: videoTitle || 'Video de YouTube',
                description: videoDescription || '',
                isMetadataOnly: !transcript && (!!videoTitle || !!videoDescription)
            });
        }

        throw new Error('No se pudo extraer contenido del video (Privado o bloqueado)');

    } catch (error: any) {
        console.error('[YouTubeProxy] Logic Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
}
