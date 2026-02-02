/**
 * videoChunkingService.ts
 * 
 * Service for chunking long video transcripts into processable segments
 * and estimating optimal flashcard counts based on content density.
 */

import type { AnnotatedTranscript } from './youtubeService';

export interface TranscriptChunk {
    text: string;
    startTime: string; // HH:MM:SS
    endTime: string; // HH:MM:SS
    startOffset: number; // seconds
    endOffset: number; // seconds
    durationMinutes: number;
    transcriptSegments: AnnotatedTranscript[];
}

/**
 * Format seconds to HH:MM:SS
 */
function formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Chunk transcript into time-based segments with overlap
 * 
 * @param transcript - Annotated transcript with timestamps
 * @param chapters - Optional video chapters for natural divisions
 * @param chunkMinutes - Target chunk size in minutes (default: 12)
 * @param overlapSeconds - Overlap between chunks to avoid context loss (default: 30)
 */
export function chunkTranscript(
    transcript: AnnotatedTranscript[],
    chapters?: { time: string; title: string }[],
    chunkMinutes: number = 18,
    overlapSeconds: number = 45
): TranscriptChunk[] {

    if (!transcript || transcript.length === 0) {
        return [];
    }

    const chunks: TranscriptChunk[] = [];
    const chunkSeconds = chunkMinutes * 60;

    // Strategy 1: Use chapters if available (natural divisions)
    if (chapters && chapters.length > 1) {
        console.log(`Using ${chapters.length} video chapters for chunking`);

        for (let i = 0; i < chapters.length; i++) {
            const chapterStartTime = parseTimeToSeconds(chapters[i].time);
            const chapterEndTime = i < chapters.length - 1
                ? parseTimeToSeconds(chapters[i + 1].time)
                : transcript[transcript.length - 1].offset + transcript[transcript.length - 1].duration;

            const chapterSegments = transcript.filter(
                seg => seg.offset >= chapterStartTime && seg.offset < chapterEndTime
            );

            if (chapterSegments.length > 0) {
                const chapterText = chapterSegments.map(seg => seg.text).join(' ');
                const duration = (chapterEndTime - chapterStartTime) / 60;

                chunks.push({
                    text: chapterText,
                    startTime: formatTime(chapterStartTime),
                    endTime: formatTime(chapterEndTime),
                    startOffset: chapterStartTime,
                    endOffset: chapterEndTime,
                    durationMinutes: duration,
                    transcriptSegments: chapterSegments
                });
            }
        }

        return chunks;
    }

    // Strategy 2: Time-based chunking with overlap
    console.log(`Using time-based chunking (${chunkMinutes} min chunks, ${overlapSeconds}s overlap)`);

    const totalDuration = transcript[transcript.length - 1].offset + transcript[transcript.length - 1].duration;
    let currentStart = 0;

    while (currentStart < totalDuration) {
        const currentEnd = Math.min(currentStart + chunkSeconds, totalDuration);
        const overlapStart = Math.max(0, currentStart - overlapSeconds);

        const chunkSegments = transcript.filter(
            seg => seg.offset >= overlapStart && seg.offset < currentEnd
        );

        if (chunkSegments.length > 0) {
            const chunkText = chunkSegments.map(seg => {
                // Add timestamp annotation every ~2 minutes within chunk
                const shouldAnnotate = seg.offset % 120 < 5; // Every ~2 min
                if (shouldAnnotate && seg.formattedTime) {
                    return `[${seg.formattedTime}] ${seg.text}`;
                }
                return seg.text;
            }).join(' ');

            const duration = (currentEnd - currentStart) / 60;

            chunks.push({
                text: chunkText,
                startTime: formatTime(currentStart),
                endTime: formatTime(currentEnd),
                startOffset: currentStart,
                endOffset: currentEnd,
                durationMinutes: duration,
                transcriptSegments: chunkSegments
            });
        }

        // Move to next chunk (without overlap for start position)
        currentStart += chunkSeconds;
    }

    console.log(`Created ${chunks.length} chunks from ${formatTime(totalDuration)} video`);
    return chunks;
}

/**
 * Parse time string (HH:MM:SS or MM:SS) to seconds
 */
function parseTimeToSeconds(timeStr: string): number {
    const parts = timeStr.split(':').map(Number);
    if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    }
    return 0;
}

/**
 * Estimate optimal flashcard count for a chunk based on content density
 * 
 * Heuristics:
 * - Check for definitions (keywords like "es", "significa", "se define")
 * - Count lists and enumerations
 * - Detect formulas and equations
 * - Measure unique concept density
 * 
 * Returns: Recommended flashcard count (5-30 per chunk)
 */
export function estimateFlashcardCount(chunkText: string): number {
    const text = chunkText.toLowerCase();
    let score = 0;

    // Base: 1 flashcard per 2 minutes of content (approximation: ~150 words/min spoken)
    const wordCount = chunkText.split(/\s+/).length;
    const estimatedMinutes = wordCount / 150;
    score = Math.ceil(estimatedMinutes / 2);

    // Boost for definitions (high learning value)
    const definitionPatterns = [
        / es /g,
        / significa /g,
        / se define como /g,
        / se refiere a /g,
        / consiste en /g,
        / es decir /g
    ];

    let definitionCount = 0;
    definitionPatterns.forEach(pattern => {
        const matches = text.match(pattern);
        if (matches) definitionCount += matches.length;
    });
    score += Math.min(definitionCount * 0.3, 5); // Cap boost at +5

    // Boost for lists and enumerations
    const listPatterns = [
        /primero|segundo|tercero|cuarto|quinto/g,
        /\d+\./g, // numbered lists
        /paso \d+/g
    ];

    let listCount = 0;
    listPatterns.forEach(pattern => {
        const matches = text.match(pattern);
        if (matches) listCount += matches.length;
    });
    score += Math.min(listCount * 0.2, 4); // Cap boost at +4

    // Boost for formulas/equations (mathematical content)
    const formulaKeywords = [
        'fórmula', 'ecuación', 'teorema', 'ley de',
        'se calcula', 'igual a', '='
    ];

    let formulaCount = 0;
    formulaKeywords.forEach(keyword => {
        if (text.includes(keyword)) formulaCount++;
    });
    score += Math.min(formulaCount * 0.5, 3); // Cap boost at +3

    // Boost for technical/academic language (higher density)
    const technicalKeywords = [
        'análisis', 'proceso', 'método', 'principio', 'concepto',
        'característica', 'propiedad', 'función', 'relación'
    ];

    let technicalCount = 0;
    technicalKeywords.forEach(keyword => {
        if (text.includes(keyword)) technicalCount++;
    });
    score += Math.min(technicalCount * 0.3, 3); // Cap boost at +3

    // Clamp to reasonable range
    const finalCount = Math.max(5, Math.min(30, Math.round(score)));

    console.log(`Estimated ${finalCount} flashcards for chunk (${Math.round(estimatedMinutes)} min, ${definitionCount} defs, ${listCount} lists)`);

    return finalCount;
}

/**
 * Deduplicate flashcards based on question similarity
 * 
 * Strategy: Keep flashcards with unique questions (>20% difference)
 * If two flashcards are too similar, keep the one with the longer/better answer
 */
export function deduplicateFlashcards(flashcards: any[]): any[] {
    if (flashcards.length === 0) return [];

    const unique: any[] = [];

    for (const card of flashcards) {
        const questionLower = card.question.toLowerCase();

        // Check if similar question already exists
        const isDuplicate = unique.some(existingCard => {
            const similarity = calculateSimilarity(
                questionLower,
                existingCard.question.toLowerCase()
            );
            return similarity > 0.8; // 80% similarity threshold
        });

        if (!isDuplicate) {
            unique.push(card);
        } else {
            // Replace if this answer is significantly better
            const similarIndex = unique.findIndex(existingCard => {
                const similarity = calculateSimilarity(
                    questionLower,
                    existingCard.question.toLowerCase()
                );
                return similarity > 0.8;
            });

            if (similarIndex !== -1 && card.answer.length > unique[similarIndex].answer.length * 1.3) {
                console.log(`Replacing duplicate with better answer: "${card.question.slice(0, 50)}..."`);
                unique[similarIndex] = card;
            }
        }
    }

    console.log(`Deduplicated: ${flashcards.length} → ${unique.length} flashcards`);
    return unique;
}

/**
 * Calculate string similarity (Jaccard coefficient on words)
 */
function calculateSimilarity(str1: string, str2: string): number {
    const words1 = new Set(str1.split(/\s+/));
    const words2 = new Set(str2.split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
}
