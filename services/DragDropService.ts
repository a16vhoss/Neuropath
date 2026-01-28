import { supabase } from '../lib/supabase';

/**
 * Service for handling drag and drop operations with database persistence
 */
export const DragDropService = {
    /**
     * Reorder flashcards within the same study set
     * @param flashcardIds - Array of flashcard IDs in new order
     * @param positions - Array of new positions (indices)
     */
    async reorderFlashcards(flashcardIds: string[], positions: number[]): Promise<void> {
        const { error } = await supabase.rpc('reorder_flashcards', {
            p_flashcard_ids: flashcardIds,
            p_positions: positions
        });

        if (error) {
            console.error('Error reordering flashcards:', error);
            throw error;
        }
    },

    /**
     * Reorder materials within the same study set
     * @param materialIds - Array of material IDs in new order
     * @param positions - Array of new positions (indices)
     */
    async reorderMaterials(materialIds: string[], positions: number[]): Promise<void> {
        const { error } = await supabase.rpc('reorder_materials', {
            p_material_ids: materialIds,
            p_positions: positions
        });

        if (error) {
            console.error('Error reordering materials:', error);
            throw error;
        }
    },

    /**
     * Move a flashcard to a different study set
     * @param flashcardId - The flashcard to move
     * @param newStudySetId - The target study set
     * @param position - Position in the new set (defaults to end)
     */
    async moveFlashcardToSet(flashcardId: string, newStudySetId: string, position: number = 0): Promise<void> {
        const { error } = await supabase.rpc('move_flashcard_to_set', {
            p_flashcard_id: flashcardId,
            p_new_study_set_id: newStudySetId,
            p_new_position: position
        });

        if (error) {
            console.error('Error moving flashcard to set:', error);
            throw error;
        }
    },

    /**
     * Get the count of flashcards in a study set (for position calculation)
     */
    async getFlashcardCount(studySetId: string): Promise<number> {
        const { count, error } = await supabase
            .from('flashcards')
            .select('*', { count: 'exact', head: true })
            .eq('study_set_id', studySetId);

        if (error) {
            console.error('Error getting flashcard count:', error);
            return 0;
        }

        return count || 0;
    }
};
