import type { VercelRequest, VercelResponse } from '@vercel/node';
import { YoutubeTranscript } from 'youtube-transcript';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { videoId } = req.query;

    if (!videoId) {
        return res.status(400).json({ error: 'Missing videoId parameter' });
    }

    const id = Array.isArray(videoId) ? videoId[0] : videoId;

    try {
        console.log('Iniciando extracción robusta para:', id);

        // MÉTODO 1: Intento de Scraping Directo (JSON3 format)
        try {
            const videoUrl = `https://www.youtube.com/watch?v=${id}`;
            const response = await fetch(videoUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
                }
            });
            const html = await response.text();
            
            const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
            if (playerResponseMatch) {
                const playerResponse = JSON.parse(playerResponseMatch[1]);
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
                            return res.status(200).json({ success: true, transcript });
                        }
                    }
                }
            }
        } catch (e: any) {
            console.warn('Método 1 falló:', e.message);
        }

        // MÉTODO 2: Fallback a la librería youtube-transcript
        try {
            const transcriptItems = await YoutubeTranscript.fetchTranscript(id);
            const transcript = transcriptItems
                .map((item: any) => item.text)
                .join(' ')
                .replace(/\s+/g, ' ')
                .trim();
            
            if (transcript) {
                return res.status(200).json({ success: true, transcript });
            }
        } catch (e: any) {
            console.error('Método 2 falló:', e.message);
        }

        throw new Error('No se pudieron extraer subtítulos para este video');

    } catch (error: any) {
        console.error('Transcript Error:', error.message);
        let userMessage = error.message || 'No se pudo obtener la transcripción';
        
        if (error.message?.includes('Transcript is disabled')) userMessage = 'Los subtítulos están deshabilitados';
        else if (error.message?.includes('No transcript')) userMessage = 'El video no tiene subtítulos';
        
        res.status(500).json({ success: false, error: userMessage });
    }
}
