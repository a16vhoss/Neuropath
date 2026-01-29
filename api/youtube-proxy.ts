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
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `[${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}]`;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { videoId } = req.query;

    if (!videoId) {
        return res.status(400).json({ error: 'Missing videoId parameter' });
    }

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
            console.log('[YouTubeProxy] Attempting YouTube Data API v3...');

            // 1. Get Video Details (Snippet, ContentDetails, Statistics)
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
                        duration: item.contentDetails?.duration, // ISO 8601 format (PT15M33S)
                        viewCount: item.statistics?.viewCount
                    };
                    console.log('[YouTubeProxy] API v3 Metadata Extracted Success');
                }
            } else {
                console.warn('[YouTubeProxy] API v3 details failed:', apiRes.status);
            }

            // 2. Get Top Comments ("Collective Wisdom")
            const commentsUrl = `https://www.googleapis.com/youtube/v3/commentThreads?videoId=${id}&key=${YOUTUBE_API_KEY}&part=snippet&order=relevance&maxResults=5`;
            const commentsRes = await fetch(commentsUrl);

            if (commentsRes.ok) {
                const cData = await commentsRes.json();
                comments = cData.items?.map((item: any) => {
                    const snippet = item.snippet.topLevelComment.snippet;
                    return `"${snippet.textDisplay}" (Likes: ${snippet.likeCount})`;
                }) || [];
                console.log(`[YouTubeProxy] Extracted ${comments.length} top comments`);
            }

        } catch (apiErr) {
            console.warn('[YouTubeProxy] API v3 Exception:', apiErr);
        }

        // LAYER 1: Transcript Extraction
        try {
            const items = await YoutubeTranscript.fetchTranscript(id);
            transcriptItems = items.map(i => ({
                offset: i.offset,
                duration: i.duration,
                text: i.text,
                formattedTime: formatTime(i.offset / 1000)
            }));
        } catch (libErr) {
            console.warn('[YouTubeProxy] Transcript fetch failed:', libErr);
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
