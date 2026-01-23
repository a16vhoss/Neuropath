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
        // Step 1: Attempt to get metadata (Title/Description) - Lightweight
        try {
            const metaUrl = `https://www.youtube.com/watch?v=${id}`;
            const metaRes = await fetch(metaUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
                }
            });
            const html = await metaRes.text();

            // Basic regex for title and description
            const titleMatch = html.match(/<title>(.*?)<\/title>/);
            if (titleMatch) videoTitle = titleMatch[1].replace(' - YouTube', '');

            // Try to get description and other details from ytInitialPlayerResponse
            const playerMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
            if (playerMatch) {
                const data = JSON.parse(playerMatch[1]);
                videoTitle = data?.videoDetails?.title || videoTitle;
                videoDescription = data?.videoDetails?.shortDescription || '';

                // If we found the transcript link in the data, we can try to fetch it directly
                const captionTracks = data.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
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
        } catch (metaErr) {
            console.warn('[YouTubeProxy] Metadata/Direct Scrape failed:', metaErr);
        }

        // Step 2: If transcript is still empty, try the Library (this is what worked "2 days ago")
        if (!transcript) {
            try {
                console.log('[YouTubeProxy] Falling back to youtube-transcript library');
                const items = await YoutubeTranscript.fetchTranscript(id);
                transcript = items.map(i => i.text).join(' ').replace(/\s+/g, ' ').trim();
            } catch (libErr) {
                console.error('[YouTubeProxy] Library also failed:', libErr);
            }
        }

        // Step 3: Final response
        if (transcript) {
            return res.status(200).json({
                success: true,
                transcript,
                title: videoTitle || 'Video de YouTube',
                description: videoDescription || 'Contenido de YouTube'
            });
        }

        // Step 4: Fallback to metadata-only if no transcript
        if (videoTitle || videoDescription) {
            return res.status(200).json({
                success: true,
                isMetadataFallback: true,
                title: videoTitle || 'Video de YouTube',
                description: videoDescription || 'Sin descripción detallada',
                transcript: `Título: ${videoTitle}\n\nDescripción: ${videoDescription}`
            });
        }

        throw new Error('No se pudo extraer el contenido del video. El video puede ser privado, tener subtítulos desactivados o YouTube ha bloqueado la conexión.');

    } catch (err: any) {
        console.error('[YouTubeProxy] Final Error:', err.message);
        return res.status(500).json({ success: false, error: err.message });
    }
}
