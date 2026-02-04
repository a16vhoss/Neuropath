import type { VercelRequest, VercelResponse } from '@vercel/node';
import { YoutubeTranscript } from 'youtube-transcript';

// In production, set this in Vercel Environment Variables as YOUTUBE_API_KEY
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || 'AIzaSyCHeNTXiq_u9JfwEYVBZbGTks6XHOkVPh4';

export interface YouTubeResult {
    success: boolean;
    data?: {
        transcript: AnnotatedTranscript[]; // Structured transcript
        fullTranscriptText: string;
        title: string;
        description: string;
        metadata: {
            duration?: string;
            viewCount?: string;
            tags?: string[];
            channelTitle?: string;
            publishedAt?: string;
        };
        comments?: string[]; // "Collective Wisdom"
        chapters?: { time: string; title: string }[];
        isMetadataOnly: boolean;
    };
    error?: string;
}

export interface AnnotatedTranscript {
    offset: number;
    duration: number;
    text: string;
    formattedTime?: string; // [MM:SS]
}

const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    if (h > 0) {
        return `[${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}]`;
    }
    return `[${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}]`;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { videoId } = req.query;

    if (!videoId) {
        return res.status(400).json({ error: 'Missing videoId parameter' });
    }

    // Handle array or string videoId
    const id = Array.isArray(videoId) ? videoId[0] : videoId;
    console.log(`[YouTubeProxy] Processing: ${id}`);

    let videoData: any = {
        title: '',
        description: '',
        metadata: {}
    };
    let transcriptItems: AnnotatedTranscript[] = [];
    let comments: string[] = [];
    let isMetadataOnly = false;

    try {
        // LAYER 0: YouTube Data API v3 (Metadata + Comments)
        try {
            // ... (Metadata extraction logic remains same, skipping for brevity in this replacement if possible, but replace needs context)
            // Re-implementing snippet fetching for safety as I'm replacing a large block
            console.log('[YouTubeProxy] Attempting YouTube Data API v3...');
            const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?id=${id}&key=${YOUTUBE_API_KEY}&part=snippet,contentDetails,statistics`;
            const apiRes = await fetch(detailsUrl);

            if (apiRes.ok) {
                const data = await apiRes.json();
                if (data.items && data.items.length > 0) {
                    const item = data.items[0];
                    const snippet = item.snippet;

                    videoData.title = snippet.title;
                    videoData.description = snippet.description;
                    videoData.metadata = {
                        channelTitle: snippet.channelTitle,
                        publishedAt: snippet.publishedAt,
                        tags: snippet.tags || [],
                        duration: item.contentDetails?.duration,
                        viewCount: item.statistics?.viewCount
                    };
                    console.log('[YouTubeProxy] API v3 Metadata Extracted Success');
                }
            }

            // 2. Get Top Comments
            const commentsUrl = `https://www.googleapis.com/youtube/v3/commentThreads?videoId=${id}&key=${YOUTUBE_API_KEY}&part=snippet&order=relevance&maxResults=5`;
            const commentsRes = await fetch(commentsUrl);
            if (commentsRes.ok) {
                const cData = await commentsRes.json();
                comments = cData.items?.map((item: any) => {
                    const snippet = item.snippet.topLevelComment.snippet;
                    return `"${snippet.textDisplay}" (Likes: ${snippet.likeCount})`;
                }) || [];
            }
        } catch (apiErr) {
            console.warn('[YouTubeProxy] API v3 Exception:', apiErr);
        }

        // LAYER 1: Transcript Extraction with Language Fallbacks
        try {
            console.log('[YouTubeProxy] Fetching transcript...');

            // Helper to map items
            const mapItems = (items: any[]) => items.map(i => ({
                offset: i.offset,
                duration: i.duration,
                text: i.text,
                formattedTime: formatTime(i.offset / 1000)
            }));

            try {
                // Attempt 1: Auto-detect (default)
                const items = await YoutubeTranscript.fetchTranscript(id);
                transcriptItems = mapItems(items);
                console.log(`[YouTubeProxy] Transcript found (Auto): ${items.length} lines`);
            } catch (err1) {
                console.warn('[YouTubeProxy] Auto transcript failed, trying Spanish...');
                try {
                    // Attempt 2: Spanish explicit
                    const items = await YoutubeTranscript.fetchTranscript(id, { lang: 'es' });
                    transcriptItems = mapItems(items);
                    console.log(`[YouTubeProxy] Transcript found (ES): ${items.length} lines`);
                } catch (err2) {
                    console.warn('[YouTubeProxy] Spanish transcript failed, trying English...');
                    try {
                        // Attempt 3: English explicit
                        const items = await YoutubeTranscript.fetchTranscript(id, { lang: 'en' });
                        transcriptItems = mapItems(items);
                        console.log(`[YouTubeProxy] Transcript found (EN): ${items.length} lines`);
                    } catch (err3) {
                        console.warn('[YouTubeProxy] All direct attempts failed, trying Invidious...');
                        // Attempt 4: Invidious API as last resort (public API, no key needed)
                        try {
                            const invidiousInstances = [
                                'https://invidious.snopyta.org',
                                'https://invidious.fdn.fr',
                                'https://inv.riverside.rocks'
                            ];

                            for (const instance of invidiousInstances) {
                                try {
                                    const captionsUrl = `${instance}/api/v1/captions/${id}?lang=es`;
                                    const captionsRes = await fetch(captionsUrl, { signal: AbortSignal.timeout(5000) });

                                    if (captionsRes.ok) {
                                        const captionsData = await captionsRes.json();
                                        if (captionsData.captions && captionsData.captions.length > 0) {
                                            // Get the WebVTT content
                                            const caption = captionsData.captions[0];
                                            const bodyUrl = caption.url;
                                            const bodyRes = await fetch(bodyUrl, { signal: AbortSignal.timeout(10000) });
                                            const bodyText = await bodyRes.text();

                                            // Parse WebVTT format (skip headers, timestamps, etc.)
                                            const lines = bodyText.split('\n')
                                                .filter(l => l.trim() && !l.includes('-->') && !l.match(/^\d+$/) && !l.startsWith('WEBVTT'));

                                            transcriptItems = lines.map((text, idx) => ({
                                                offset: idx * 3000, // ~3s per line
                                                duration: 3000,
                                                text: text.trim(),
                                                formattedTime: formatTime(idx * 3)
                                            }));

                                            if (transcriptItems.length > 0) {
                                                console.log(`[YouTubeProxy] ✅ Transcript found via Invidious (${instance}): ${transcriptItems.length} lines`);
                                                break;
                                            }
                                        }
                                    }
                                } catch (invErr) {
                                    console.warn(`[YouTubeProxy] Invidious ${instance} failed:`, invErr);
                                    continue;
                                }
                            }
                        } catch (invidiousErr) {
                            console.warn('[YouTubeProxy] Invidious fallback failed:', invidiousErr);
                        }

                        // Attempt 5: YouTube Official Timedtext API (last resort)
                        if (transcriptItems.length === 0) {
                            console.warn('[YouTubeProxy] Trying YouTube official timedtext API...');
                            try {
                                const languages = ['es', 'en', 'es-419', 'en-US'];

                                for (const lang of languages) {
                                    try {
                                        const timedtextUrl = `https://www.youtube.com/api/timedtext?v=${id}&lang=${lang}`;
                                        const response = await fetch(timedtextUrl, {
                                            signal: AbortSignal.timeout(10000),
                                            headers: { 'User-Agent': 'Mozilla/5.0' }
                                        });

                                        if (response.ok) {
                                            const xmlText = await response.text();

                                            // Parse XML format: <text start="0.0" dur="2.5">Hello world</text>
                                            const textMatches = xmlText.matchAll(/<text start="([^"]+)" dur="([^"]+)"[^>]*>([^<]+)<\/text>/g);
                                            const items = Array.from(textMatches);

                                            if (items.length > 0) {
                                                transcriptItems = items.map(match => {
                                                    const start = parseFloat(match[1]);
                                                    const duration = parseFloat(match[2]);
                                                    const text = match[3]
                                                        .replace(/&amp;/g, '&')
                                                        .replace(/&lt;/g, '<')
                                                        .replace(/&gt;/g, '>')
                                                        .replace(/&quot;/g, '"')
                                                        .replace(/&#39;/g, "'");

                                                    return {
                                                        offset: Math.floor(start * 1000),
                                                        duration: Math.floor(duration * 1000),
                                                        text: text.trim(),
                                                        formattedTime: formatTime(start)
                                                    };
                                                });

                                                console.log(`[YouTubeProxy] ✅ Transcript found via YouTube Official (${lang}): ${transcriptItems.length} lines`);
                                                break;
                                            }
                                        }
                                    } catch (langErr) {
                                        console.warn(`[YouTubeProxy] YouTube timedtext ${lang} failed:`, langErr);
                                        continue;
                                    }
                                }
                            } catch (ytErr) {
                                console.warn('[YouTubeProxy] YouTube official API fallback failed:', ytErr);
                            }
                        }
                    }
                }
            }
        } catch (libErr) {
            console.warn('[YouTubeProxy] Transcript fetch system error:', libErr);
        }

        // LAYER 2: Chapter Parsing from Description
        const chapters: { time: string; title: string }[] = [];
        if (videoData.description) {
            // Regex to find timestamps like 00:00 or 1:05:20
            const timestampRegex = /(\d{1,2}:\d{2}(?::\d{2})?)\s+([^\n]+)/g;
            let match;
            while ((match = timestampRegex.exec(videoData.description)) !== null) {
                chapters.push({ time: match[1], title: match[2].trim() });
            }
        }

        isMetadataOnly = transcriptItems.length === 0;

        // Construct Full Text for AI (Transcript with timestamps)
        const fullTranscriptText = transcriptItems.length > 0
            ? transcriptItems.map(i => `${i.formattedTime} ${i.text}`).join('\n')
            : "";

        return res.status(200).json({
            success: true,
            data: {
                transcript: transcriptItems,
                fullTranscriptText,
                title: videoData.title || 'Video de YouTube',
                description: videoData.description || '',
                metadata: videoData.metadata,
                comments,
                chapters,
                isMetadataOnly
            }
        } as YouTubeResult);

    } catch (error: any) {
        console.error('[YouTubeProxy] Final Error:', error.message);
        res.status(500).json({ success: false, error: 'Error procesando video de YouTube.' });
    }
}
