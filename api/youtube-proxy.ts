import type { VercelRequest, VercelResponse } from '@vercel/node';
import { YoutubeTranscript } from 'youtube-transcript';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { videoId } = req.query;

    if (!videoId) {
        return res.status(400).json({ error: 'Missing videoId parameter' });
    }

    const id = Array.isArray(videoId) ? videoId[0] : videoId;
    console.log(`[YouTubeProxy] Processing video: ${id}`);

    try {
        // MÉTODO 1: Scraping Directo
        let videoTitle = '';
        let videoDescription = '';

        try {
            const videoUrl = `https://www.youtube.com/watch?v=${id}`;
            const response = await fetch(videoUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
                    'Cache-Control': 'no-cache'
                }
            });
            const html = await response.text();

            // Backup Title from HTML
            const titleMatch = html.match(/<title>(.*?)<\/title>/);
            if (titleMatch) videoTitle = titleMatch[1].replace(' - YouTube', '');

            // Robust playerResponse regex
            const playerResponseMatch = html.match(/(?:var\s+|window\[['"]ytInitialPlayerResponse['"]\]\s*=\s*|ytInitialPlayerResponse\s*=\s*)({.+?});/s);

            if (playerResponseMatch) {
                const jsonStr = playerResponseMatch[1];
                const playerResponse = JSON.parse(jsonStr);

                videoTitle = playerResponse?.videoDetails?.title || videoTitle;
                videoDescription = playerResponse?.videoDetails?.shortDescription || '';

                const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];

                if (captionTracks.length > 0) {
                    const track = captionTracks.find((t: any) => t.languageCode?.startsWith('es')) ||
                        captionTracks.find((t: any) => t.languageCode?.startsWith('en')) ||
                        captionTracks[0];

                    if (track && track.baseUrl) {
                        const transcriptRes = await fetch(track.baseUrl + '&fmt=json3');
                        const transcriptData = await transcriptRes.json();

                        const transcript = transcriptData.events
                            .filter((e: any) => e.segs)
                            .map((e: any) => e.segs.map((s: any) => s.utf8).join(''))
                            .join(' ')
                            .replace(/\s+/g, ' ')
                            .trim();

                        if (transcript) {
                            console.log(`[YouTubeProxy] Success via Method 1 (Transcript)`);
                            return res.status(200).json({
                                success: true,
                                transcript,
                                title: videoTitle,
                                description: videoDescription
                            });
                        }
                    }
                }
            }
        } catch (e: any) {
            console.warn('[YouTubeProxy] Method 1 failed:', e.message);
        }

        // MÉTODO 2: youtube-transcript library
        try {
            console.log('[YouTubeProxy] Trying Method 2...');
            const transcriptItems = await YoutubeTranscript.fetchTranscript(id);
            const transcript = transcriptItems
                .map((item: any) => item.text)
                .join(' ')
                .replace(/\s+/g, ' ')
                .trim();

            if (transcript) {
                console.log(`[YouTubeProxy] Success via Method 2 (Transcript)`);
                return res.status(200).json({
                    success: true,
                    transcript,
                    title: videoTitle,
                    description: videoDescription
                });
            }
        } catch (e: any) {
            console.error('[YouTubeProxy] Method 2 failed:', e.message);
        }

        // MÉTODO 3: Fallback Final - Metadatos
        if (videoTitle || videoDescription) {
            console.log('[YouTubeProxy] Fallback to metadata only');
            return res.status(200).json({
                success: true,
                isMetadataFallback: true,
                title: videoTitle || 'Video de YouTube',
                description: videoDescription || 'Sin descripción',
                transcript: `Título: ${videoTitle}\n\nDescripción: ${videoDescription}`
            });
        }

        throw new Error('Contenido no disponible (subtítulos y metadatos bloqueados)');

    } catch (error: any) {
        console.error('[YouTubeProxy] Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
}
