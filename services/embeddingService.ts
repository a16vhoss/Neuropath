import { getGeminiSDK } from './geminiModelManager';
import { supabase } from './supabaseClient';

const EMBEDDING_MODEL = "text-embedding-004";
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

/**
 * Generates an embedding vector for a given text using Gemini
 */
export const generateEmbedding = async (text: string): Promise<number[] | null> => {
    const ai = getGeminiSDK();
    if (!ai) {
        console.error("Gemini SDK not initialized");
        return null;
    }

    try {
        const response = await ai.models.embedContent({
            model: EMBEDDING_MODEL,
            contents: [{ text: text }], // Fixed: Property is 'contents' and expects an array of Content objects
        });
        // @ts-ignore - Handle potential SDK response shape variance
        return response.embeddings?.[0]?.values || response.embedding?.values || null;
    } catch (error) {
        console.error("Error generating embedding:", error);
        return null;
    }
};

/**
 * Splits text into chunks with overlap
 */
const splitIntoChunks = (text: string, chunkSize: number, overlap: number): string[] => {
    if (!text) return [];
    const chunks: string[] = [];
    let i = 0;
    while (i < text.length) {
        const end = Math.min(i + chunkSize, text.length);
        chunks.push(text.slice(i, end));
        i += chunkSize - overlap;
    }
    return chunks;
};

interface StoreOptions {
    materialId?: string;
    notebookId?: string;
    userId: string;
    metadata?: any;
}

/**
 * Chunks content, generates embeddings, and stores them in Supabase
 */
export const storeDocumentEmbeddings = async (
    content: string,
    options: StoreOptions
): Promise<boolean> => {
    if (!content || (!options.materialId && !options.notebookId)) {
        console.error("Invalid content or missing source ID");
        return false;
    }

    const chunks = splitIntoChunks(content, CHUNK_SIZE, CHUNK_OVERLAP);
    console.log(`Processing ${chunks.length} chunks for vector store...`);

    let successCount = 0;

    // Process in batches to avoid overwhelming the API
    const BATCH_SIZE = 5;
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);

        await Promise.all(batch.map(async (chunkText, index) => {
            const embedding = await generateEmbedding(chunkText);
            if (embedding) {
                const { error } = await supabase.from('document_chunks').insert({
                    material_id: options.materialId,
                    notebook_id: options.notebookId,
                    user_id: options.userId,
                    content: chunkText,
                    embedding,
                    metadata: {
                        ...options.metadata,
                        chunkIndex: i + index,
                        totalChunks: chunks.length
                    }
                });

                if (error) {
                    console.error("Error inserting chunk:", error);
                } else {
                    successCount++;
                }
            }
        }));
    }

    console.log(`Successfully stored ${successCount}/${chunks.length} chunks.`);
    return successCount > 0;
};

/**
 * Searches for relevant context using vector similarity
 */
export const searchRelevantContext = async (
    query: string,
    userId: string,
    matchCount: number = 5,
    studySetId?: string
): Promise<any[]> => {
    const queryEmbedding = await generateEmbedding(query);
    if (!queryEmbedding) return [];

    const { data, error } = await supabase.rpc('match_document_chunks', {
        query_embedding: queryEmbedding,
        match_threshold: 0.5, // Adjust based on testing
        match_count: matchCount,
        filter_user_id: userId,
        filter_study_set_id: studySetId
    });

    if (error) {
        console.error("Error searching vector store:", error);
        return [];
    }

    return data;
};

/**
 * Delete embeddings for a specific source
 */
export const deleteDocumentEmbeddings = async (
    sourceId: string,
    sourceType: 'material' | 'notebook'
) => {
    const column = sourceType === 'material' ? 'material_id' : 'notebook_id';
    const { error } = await supabase
        .from('document_chunks')
        .delete()
        .eq(column, sourceId);

    if (error) {
        console.error("Error deleting embeddings:", error);
    }
};
