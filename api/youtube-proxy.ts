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
    let isMetadataOnly = false;

    try {
        // LAYER 1: Attempt to get Title via OEmbed (Official, hardest to block)
        try {
            const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`;
            const oembedRes = await fetch(oembedUrl);
            if (oembedRes.ok) {
                const oembedData = await oembedRes.json();
                videoTitle = oembedData.title || '';
                console.log('[YouTubeProxy] OEmbed Title found:', videoTitle);
            }
        } catch (e) {
            console.warn('[YouTubeProxy] OEmbed failed');
        }

        // LAYER 2: Scraping for Description and Transcript link
        try {
            const watchUrl = `https://www.youtube.com/watch?v=${id}`;
            const response = await fetch(watchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
                }
            });
            const html = await response.text();

            if (!videoTitle) {
                const titleMatch = html.match(/<title>(.*?)<\/title>/);
                if (titleMatch) videoTitle = titleMatch[1].replace(' - YouTube', '');
            }

            const playerResponseMatch = html.match(/(?:var\s+|window\[['"]ytInitialPlayerResponse['"]\]\s*=\s*|ytInitialPlayerResponse\s*=\s*)({.+?});/s);

            if (playerResponseMatch) {
                const playerResponse = JSON.parse(playerResponseMatch[1]);
                videoTitle = playerResponse?.videoDetails?.title || videoTitle;
                videoDescription = playerResponse?.videoDetails?.shortDescription || '';

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

        // Check if we have enough to proceed
        if (!transcript && !videoTitle && !videoDescription) {
            throw new Error('Todo el contenido de YouTube está bloqueado para esta sesión.');
        }

        isMetadataOnly = !transcript;

        return res.status(200).json({
            success: true,
            transcript: transcript || '',
            title: videoTitle || 'Video de YouTube',
            description: videoDescription || '',
            isMetadataOnly
        });

    } catch (error: any) {
        console.error('[YouTubeProxy] Fatal Error:', error.message);
        res.status(500).json({ success: false, error: 'YouTube ha bloqueado el acceso. Prueba con otro video o inténtalo más tarde.' });
    }
}
