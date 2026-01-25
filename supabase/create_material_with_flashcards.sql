-- Drop function if exists to allow updates
DROP FUNCTION IF EXISTS public.create_material_with_flashcards;

-- Create RPC function to handle material and flashcard creation atomically
CREATE OR REPLACE FUNCTION public.create_material_with_flashcards(
    p_study_set_id UUID,
    p_name TEXT,
    p_type TEXT,
    p_content_text TEXT,
    p_summary TEXT,
    p_file_url TEXT,
    p_flashcards JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_material_id UUID;
    v_flashcard JSONB;
    v_result JSONB;
    v_flashcard_count INTEGER;
BEGIN
    -- Calculate flashcard count
    v_flashcard_count := jsonb_array_length(p_flashcards);

    -- 1. Insert Material
    INSERT INTO public.study_set_materials (
        study_set_id,
        name,
        type,
        content_text,
        summary,
        file_url,
        flashcards_generated
    ) VALUES (
        p_study_set_id,
        p_name,
        p_type,
        p_content_text,
        p_summary,
        p_file_url,
        v_flashcard_count
    )
    RETURNING id INTO v_material_id;

    -- 2. Insert Flashcards linked to the new Material
    IF v_flashcard_count > 0 THEN
        INSERT INTO public.flashcards (
            study_set_id,
            material_id,
            question,
            answer,
            category,
            is_ai_generated
        )
        SELECT 
            p_study_set_id,
            v_material_id,
            (item->>'question')::text,
            (item->>'answer')::text,
            (item->>'category')::text,
            COALESCE((item->>'is_ai_generated')::boolean, FALSE)
        FROM jsonb_array_elements(p_flashcards) AS item;
    END IF;

    -- 3. Return result
    SELECT jsonb_build_object(
        'id', v_material_id,
        'study_set_id', p_study_set_id,
        'name', p_name,
        'flashcard_count', v_flashcard_count
    ) INTO v_result;

    RETURN v_result;
END;
$$;
