import type { VercelRequest, VercelResponse } from '@vercel/node';
import { YoutubeTranscript } from 'youtube-transcript';

// Version 7 - Using youtube-transcript npm package

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { videoId } = req.query;

    if (!videoId) {
        return res.status(400).json({ error: 'Missing videoId parameter' });
    }

    const id = Array.isArray(videoId) ? videoId[0] : videoId;

    try {
        console.log('Fetching transcript for video:', id);

        // Try to fetch WITHOUT language preference first (let YouTube give the default/auto-generated)
        // This is usually more reliable than forcing a specific code
        let transcriptItems;
        
        try {
            transcriptItems = await YoutubeTranscript.fetchTranscript(id);
            console.log('Fetched default transcript');
        } catch (e: any) {
            console.log('Default fetch failed, trying Spanish variants...');
            try {
                // Try common Spanish variants if default fails
                transcriptItems = await YoutubeTranscript.fetchTranscript(id, { lang: 'es' });
            } catch (e2) {
                console.log('Spanish failed, trying English...');
                transcriptItems = await YoutubeTranscript.fetchTranscript(id, { lang: 'en' });
            }
        }

        if (!transcriptItems || transcriptItems.length === 0) {
            throw new Error('No se encontraron subtítulos');
        }

        // Combine all transcript text
        const fullText = transcriptItems
            .map((item: any) => item.text)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

        console.log('Transcript length:', fullText.length);

        res.setHeader('Content-Type', 'application/json');
        res.status(200).json({ success: true, transcript: fullText });
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
