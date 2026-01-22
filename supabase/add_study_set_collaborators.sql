-- Add editors column to study_sets for granular permission control
ALTER TABLE public.study_sets 
ADD COLUMN IF NOT EXISTS editors UUID[] DEFAULT '{}';

-- Update RLS for Study Sets to allow editors to update (but not delete the set itself)
DROP POLICY IF EXISTS "Editors can update study sets" ON public.study_sets;
CREATE POLICY "Editors can update study sets" ON public.study_sets
FOR UPDATE USING (
    auth.uid() = ANY(editors) OR auth.uid() = student_id
);

-- Update RLS for Flashcards to allow editors to manage them
DROP POLICY IF EXISTS "Editors can manage flashcards" ON public.flashcards;
CREATE POLICY "Editors can manage flashcards" ON public.flashcards
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.study_sets 
        WHERE id = flashcards.study_set_id 
        AND (auth.uid() = study_sets.student_id OR auth.uid() = ANY(study_sets.editors))
    )
);

-- Update RLS for Study Set Materials to allow editors to manage them
DROP POLICY IF EXISTS "Editors can manage set materials" ON public.study_set_materials;
CREATE POLICY "Editors can manage set materials" ON public.study_set_materials
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.study_sets 
        WHERE id = study_set_materials.study_set_id 
        AND (auth.uid() = study_sets.student_id OR auth.uid() = ANY(study_sets.editors))
    )
);

-- Function to toggle editor status (helper for frontend)
CREATE OR REPLACE FUNCTION toggle_study_set_editor(set_id UUID, user_id UUID)
RETURNS VOID AS $$
DECLARE
    current_editors UUID[];
BEGIN
    SELECT editors INTO current_editors FROM public.study_sets WHERE id = set_id;
    
    IF user_id = ANY(current_editors) THEN
        -- Remove if exists
        UPDATE public.study_sets 
        SET editors = array_remove(editors, user_id)
        WHERE id = set_id;
    ELSE
        -- Add if not exists
        UPDATE public.study_sets 
        SET editors = array_append(editors, user_id)
        WHERE id = set_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
