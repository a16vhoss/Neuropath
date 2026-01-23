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

        let transcriptItems = null;
        let errorLog = '';
        
        // METHOD 1: Fast Library
        try {
            transcriptItems = await YoutubeTranscript.fetchTranscript(id);
            console.log('Method 1 (Library) Success');
        } catch (e: any) {
            errorLog += `Lib error: ${e.message}. `;
            
            // METHOD 2: Manual Scraping Fallback
            try {
                console.log('Method 1 failed, trying Method 2 (Manual Scraper)...');
                const videoUrl = `https://www.youtube.com/watch?v=${id}`;
                const response = await fetch(videoUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
                    }
                });
                const html = await response.text();
                
                // Extract caption tracks from YouTube's internal JSON
                const captionsMatch = html.match(/"captionTracks":\s*(\[.*?\])/);
                if (captionsMatch) {
                    const tracks = JSON.parse(captionsMatch[1]);
                    // Prioritize Spanish, then English, then anything else
                    const track = tracks.find((t: any) => t.languageCode === 'es') || 
                                  tracks.find((t: any) => t.languageCode?.startsWith('es')) ||
                                  tracks.find((t: any) => t.languageCode === 'en') || 
                                  tracks[0];
                    
                    if (track && track.baseUrl) {
                        const transcriptRes = await fetch(track.baseUrl);
                        const xml = await transcriptRes.text();
                        // Simple XML to Text parsing
                        const textContent = xml
                            .replace(/<text.*?>/g, '')
                            .replace(/<\/text>/g, ' ')
                            .replace(/&amp;/g, '&')
                            .replace(/&quot;/g, '"')
                            .replace(/&#39;/g, "'")
                            .replace(/<[^>]*>?/gm, '');
                        
                        if (textContent.trim()) {
                            return res.status(200).json({ 
                                success: true, 
                                transcript: textContent.trim().replace(/\s+/g, ' ') 
                            });
                        }
                    }
                }
            } catch (e2: any) {
                errorLog += `Scraper error: ${e2.message}. `;
            }
        }

        if (!transcriptItems || transcriptItems.length === 0) {
            console.error('All transcript methods failed for ID:', id, errorLog);
            throw new Error('No se encontraron subtítulos (Incluso tras 3 intentos)');
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
