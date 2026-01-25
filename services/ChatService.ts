import { supabase } from './supabaseClient';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    created_at: string;
    study_set_id: string;
    user_id: string;
}

/**
 * Fetch chat history for a specific study set
 */
export const getChatHistory = async (studySetId: string): Promise<ChatMessage[]> => {
    const { data, error } = await supabase
        .from('study_set_chat_messages')
        .select('*')
        .eq('study_set_id', studySetId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching chat history:', error);
        return [];
    }

    return data || [];
};

/**
 * Save a new chat message
 */
export const saveChatMessage = async (
    studySetId: string,
    role: 'user' | 'assistant',
    content: string
): Promise<ChatMessage | null> => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        console.error('No user found for saving chat message');
        return null;
    }

    const { data, error } = await supabase
        .from('study_set_chat_messages')
        .insert({
            study_set_id: studySetId,
            user_id: user.id,
            role,
            content
        })
        .select()
        .single();

    if (error) {
        // If table doesn't exist yet, we fail gracefully locally so UI doesn't crash
        // but we log it.
        console.warn('Error saving chat message (table might not exist yet):', error);
        return {
            id: Date.now().toString(), // fallback ID
            role,
            content,
            created_at: new Date().toISOString(),
            study_set_id: studySetId,
            user_id: user.id
        };
    }

    return data;
};

/**
 * Clear chat history for a study set (optional utility)
 */
export const clearChatHistory = async (studySetId: string) => {
    const { error } = await supabase
        .from('study_set_chat_messages')
        .delete()
        .eq('study_set_id', studySetId);

    if (error) throw error;
};
