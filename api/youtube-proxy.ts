import type { VercelRequest, VercelResponse } from '@vercel/node';
import { YoutubeTranscript } from 'youtube-transcript';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { videoId } = req.query;

    if (!videoId) {
        return res.status(400).json({ error: 'Missing videoId parameter' });
    }

    const id = Array.isArray(videoId) ? videoId[0] : videoId;

    try {
        console.log('Fetching transcript for video:', id);

        // This is the stable logic from Jan 18th (Commit 1063118)
        const transcriptItems = await YoutubeTranscript.fetchTranscript(id, {
            lang: 'es', // Try Spanish first
        }).catch(async () => {
            console.log('Spanish not found, trying English...');
            return YoutubeTranscript.fetchTranscript(id, {
                lang: 'en',
            });
        }).catch(async () => {
            console.log('English not found, trying auto...');
            return YoutubeTranscript.fetchTranscript(id);
        });

        if (!transcriptItems || transcriptItems.length === 0) {
            throw new Error('No se encontraron subtítulos');
        }

        // Combine all transcript text
        const transcript = transcriptItems
            .map((item: any) => item.text)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

        console.log('Transcript length:', transcript.length);

        // Return compatibility object for current frontend
        res.setHeader('Content-Type', 'application/json');
        res.status(200).json({
            success: true,
            transcript,
            title: 'Video de YouTube',
            description: 'Contenido extraído'
        });
    } catch (error: any) {
        console.error('Transcript Error:', error.message);

        let userMessage = 'No se pudo obtener la transcripción';

        if (error.message?.includes('Transcript is disabled')) {
            userMessage = 'Los subtítulos están deshabilitados para este video';
        } else if (error.message?.includes('No transcript')) {
            userMessage = 'Este video no tiene subtítulos disponibles';
        } else if (error.message?.includes('Video unavailable')) {
            userMessage = 'El video no está disponible o es privado';
        }

        res.status(500).json({
            success: false,
            error: userMessage
        });
    }
}
