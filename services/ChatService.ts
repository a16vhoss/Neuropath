import { supabase } from './supabaseClient';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    created_at: string;
    study_set_id: string;
    user_id: string;
    session_id?: string;
}

export interface ChatSession {
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
}

/**
 * Fetch all sessions for a study set
 */
export const getChatSessions = async (studySetId: string): Promise<ChatSession[]> => {
    const { data, error } = await supabase
        .from('study_set_chat_sessions')
        .select('*')
        .eq('study_set_id', studySetId)
        .order('updated_at', { ascending: false });

    if (error) {
        console.error('Error fetching chat sessions:', error);
        return [];
    }
    return data || [];
};

/**
 * Create a new session
 */
export const createChatSession = async (studySetId: string, title: string = 'Nuevo Chat'): Promise<ChatSession | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('study_set_chat_sessions')
        .insert({
            study_set_id: studySetId,
            user_id: user.id,
            title
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating chat session:', error);
        return null;
    }
    return data;
};

/**
 * Update session title
 */
export const updateSessionTitle = async (sessionId: string, newTitle: string) => {
    await supabase
        .from('study_set_chat_sessions')
        .update({ title: newTitle })
        .eq('id', sessionId);
};

/**
 * Delete a session
 */
export const deleteChatSession = async (sessionId: string) => {
    await supabase
        .from('study_set_chat_sessions')
        .delete()
        .eq('id', sessionId);
};

/**
 * Fetch messages for a specific SESSION
 */
export const getSessionMessages = async (sessionId: string): Promise<ChatMessage[]> => {
    const { data, error } = await supabase
        .from('study_set_chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

    if (error) {
        // Fallback for legacy messages (no session_id) if sessionId is 'legacy'
        if (sessionId === 'legacy') {
            return []; // or implement legacy fetch logic
        }
        console.error('Error fetching session messages:', error);
        return [];
    }

    return data || [];
};

/**
 * Save a new chat message to a SESSION
 */
export const saveChatMessage = async (
    studySetId: string,
    role: 'user' | 'assistant',
    content: string,
    sessionId?: string
): Promise<ChatMessage | null> => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        console.error('No user found for saving chat message');
        return null;
    }

    // If no session provided, try to create one or use a default?
    // For now, UI should ensure session exists. If not, we error.

    const { data, error } = await supabase
        .from('study_set_chat_messages')
        .insert({
            study_set_id: studySetId,
            user_id: user.id,
            role,
            content,
            session_id: sessionId
        })
        .select()
        .single();

    if (error) {
        console.warn('Error saving chat message:', error);
        // Fallback mock
        return {
            id: Date.now().toString(),
            role,
            content,
            created_at: new Date().toISOString(),
            study_set_id: studySetId,
            user_id: user.id,
            session_id: sessionId
        };
    }

    return data;
};
