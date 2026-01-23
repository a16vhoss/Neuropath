import type { VercelRequest, VercelResponse } from '@vercel/node';
import { YoutubeTranscript } from 'youtube-transcript';

// In production, set this in Vercel Environment Variables as YOUTUBE_API_KEY
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || 'AIzaSyCHeNTXiq_u9JfwEYVBZbGTks6XHOkVPh4';

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
    let isMetadataOnly = false;

    try {
        // LAYER 0: YouTube Data API v3 (Official & 100% Reliable for Metadata)
        try {
            console.log('[YouTubeProxy] Attempting YouTube Data API v3...');
            const apiRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?id=${id}&key=${YOUTUBE_API_KEY}&part=snippet`);

            if (apiRes.ok) {
                const data = await apiRes.json();
                if (data.items && data.items.length > 0) {
                    const snippet = data.items[0].snippet;
                    videoTitle = snippet.title || '';
                    videoDescription = snippet.description || '';
                    console.log('[YouTubeProxy] API v3 Metadata Extracted Success');
                }
            } else {
                console.warn('[YouTubeProxy] API v3 failed with status:', apiRes.status);
            }
        } catch (apiErr) {
            console.warn('[YouTubeProxy] API v3 Exception:', apiErr);
        }

        // LAYER 1: OEmbed (Fallback for Title only)
        if (!videoTitle) {
            try {
                const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`;
                const oembedRes = await fetch(oembedUrl);
                if (oembedRes.ok) {
                    const oembedData = await oembedRes.json();
                    videoTitle = oembedData.title || '';
                }
            } catch (e) {
                console.warn('[YouTubeProxy] OEmbed fallback failed');
            }
        }

        // LAYER 2: Scraping for Transcript link (and metadata fallback)
        try {
            const watchUrl = `https://www.youtube.com/watch?v=${id}`;
            const response = await fetch(watchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
                }
            });
            const html = await response.text();

            // Extract player response for transcript links
            const playerResponseMatch = html.match(/(?:var\s+|window\[['"]ytInitialPlayerResponse['"]\]\s*=\s*|ytInitialPlayerResponse\s*=\s*)({.+?});/s);

            if (playerResponseMatch) {
                const playerResponse = JSON.parse(playerResponseMatch[1]);

                // Final Metadata fallback
                if (!videoTitle) videoTitle = playerResponse?.videoDetails?.title || '';
                if (!videoDescription) videoDescription = playerResponse?.videoDetails?.shortDescription || '';

                // Capture tracks
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
        } catch (scrapeErr) {
            console.warn('[YouTubeProxy] Scrape failed');
        }

        // LAYER 3: Library Fallback for transcript
        if (!transcript) {
            try {
                const items = await YoutubeTranscript.fetchTranscript(id);
                transcript = items.map(i => i.text).join(' ').replace(/\s+/g, ' ').trim();
            } catch (libErr) {
                console.warn('[YouTubeProxy] Library failed');
            }
        }

        // Final result evaluation
        isMetadataOnly = !transcript;

        if (!transcript && !videoTitle) {
            throw new Error('No se pudo extraer información del video. Youtube ha bloqueado el acceso.');
        }

        return res.status(200).json({
            success: true,
            transcript: transcript || '',
            title: videoTitle || 'Video de YouTube',
            description: videoDescription || '',
            isMetadataOnly
        });

    } catch (error: any) {
        console.error('[YouTubeProxy] Final Error:', error.message);
        res.status(500).json({ success: false, error: 'Youtube está bloqueando el acceso. Prueba de nuevo en unos momentos.' });
    }
}
