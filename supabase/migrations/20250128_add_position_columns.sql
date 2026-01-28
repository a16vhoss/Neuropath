-- =====================================================
-- DRAG AND DROP POSITION COLUMNS
-- Support for reordering flashcards and materials
-- =====================================================

-- ===========================================
-- 1. Add position columns
-- ===========================================

-- Añadir columna position a flashcards
ALTER TABLE public.flashcards ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;

-- Añadir columna position a study_set_materials
ALTER TABLE public.study_set_materials ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;

-- ===========================================
-- 2. Indexes for efficient ordering
-- ===========================================

CREATE INDEX IF NOT EXISTS idx_flashcards_position ON public.flashcards(study_set_id, position);
CREATE INDEX IF NOT EXISTS idx_materials_position ON public.study_set_materials(study_set_id, position);

-- ===========================================
-- 3. Initialize positions for existing data
-- ===========================================

-- Update existing flashcards with sequential positions within each study set
WITH numbered AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY study_set_id ORDER BY created_at) - 1 AS pos
    FROM public.flashcards
    WHERE position = 0 OR position IS NULL
)
UPDATE public.flashcards f
SET position = numbered.pos
FROM numbered
WHERE f.id = numbered.id;

-- Update existing materials with sequential positions within each study set
WITH numbered AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY study_set_id ORDER BY created_at) - 1 AS pos
    FROM public.study_set_materials
    WHERE position = 0 OR position IS NULL
)
UPDATE public.study_set_materials m
SET position = numbered.pos
FROM numbered
WHERE m.id = numbered.id;

-- ===========================================
-- 4. Functions for reordering
-- ===========================================

-- Function to reorder flashcards in batch
CREATE OR REPLACE FUNCTION reorder_flashcards(
    p_flashcard_ids UUID[],
    p_positions INTEGER[]
) RETURNS void AS $$
BEGIN
    FOR i IN 1..array_length(p_flashcard_ids, 1) LOOP
        UPDATE public.flashcards
        SET position = p_positions[i], updated_at = NOW()
        WHERE id = p_flashcard_ids[i];
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reorder materials in batch
CREATE OR REPLACE FUNCTION reorder_materials(
    p_material_ids UUID[],
    p_positions INTEGER[]
) RETURNS void AS $$
BEGIN
    FOR i IN 1..array_length(p_material_ids, 1) LOOP
        UPDATE public.study_set_materials
        SET position = p_positions[i], updated_at = NOW()
        WHERE id = p_material_ids[i];
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to move flashcard to another study set
CREATE OR REPLACE FUNCTION move_flashcard_to_set(
    p_flashcard_id UUID,
    p_new_study_set_id UUID,
    p_new_position INTEGER
) RETURNS void AS $$
BEGIN
    UPDATE public.flashcards
    SET study_set_id = p_new_study_set_id,
        position = p_new_position,
        updated_at = NOW()
    WHERE id = p_flashcard_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
