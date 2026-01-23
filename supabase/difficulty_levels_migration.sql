-- ============================================
-- DIFFICULTY LEVELS MIGRATION
-- Sistema de Niveles de Dificultad (⭐→⭐⭐⭐⭐)
-- ============================================

-- 1. Add new columns to flashcard_progress for mastery tracking
ALTER TABLE public.flashcard_progress 
ADD COLUMN IF NOT EXISTS difficulty_level INTEGER DEFAULT 1 CHECK (difficulty_level BETWEEN 1 AND 4);

ALTER TABLE public.flashcard_progress 
ADD COLUMN IF NOT EXISTS mastery_percent INTEGER DEFAULT 0 CHECK (mastery_percent BETWEEN 0 AND 100);

ALTER TABLE public.flashcard_progress 
ADD COLUMN IF NOT EXISTS correct_at_level INTEGER DEFAULT 0;

ALTER TABLE public.flashcard_progress 
ADD COLUMN IF NOT EXISTS attempts_at_level INTEGER DEFAULT 0;

ALTER TABLE public.flashcard_progress 
ADD COLUMN IF NOT EXISTS sessions_at_level INTEGER DEFAULT 0;

ALTER TABLE public.flashcard_progress 
ADD COLUMN IF NOT EXISTS level_up_date TIMESTAMPTZ;

-- 2. Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_flashcard_progress_mastery 
ON public.flashcard_progress(student_id, difficulty_level);

-- 3. Create a view for easy mastery statistics
CREATE OR REPLACE VIEW public.student_mastery_stats AS
SELECT 
    fp.student_id,
    f.study_set_id,
    f.category,
    COUNT(fp.id) as total_cards,
    AVG(fp.mastery_percent) as avg_mastery,
    COUNT(CASE WHEN fp.difficulty_level = 1 THEN 1 END) as level_1_count,
    COUNT(CASE WHEN fp.difficulty_level = 2 THEN 1 END) as level_2_count,
    COUNT(CASE WHEN fp.difficulty_level = 3 THEN 1 END) as level_3_count,
    COUNT(CASE WHEN fp.difficulty_level = 4 THEN 1 END) as level_4_count
FROM public.flashcard_progress fp
JOIN public.flashcards f ON f.id = fp.flashcard_id
GROUP BY fp.student_id, f.study_set_id, f.category;

-- 4. RPC function to update mastery with level progression logic
CREATE OR REPLACE FUNCTION public.update_flashcard_mastery(
    p_student_id UUID,
    p_flashcard_id UUID,
    p_is_correct BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_level INTEGER;
    v_current_mastery INTEGER;
    v_correct_at_level INTEGER;
    v_attempts_at_level INTEGER;
    v_sessions_at_level INTEGER;
    v_new_level INTEGER;
    v_new_mastery INTEGER;
    v_success_rate REAL;
    v_level_changed BOOLEAN := FALSE;
    v_result JSONB;
BEGIN
    -- Get or initialize progress record
    SELECT 
        COALESCE(difficulty_level, 1),
        COALESCE(mastery_percent, 0),
        COALESCE(correct_at_level, 0),
        COALESCE(attempts_at_level, 0),
        COALESCE(sessions_at_level, 0)
    INTO v_current_level, v_current_mastery, v_correct_at_level, v_attempts_at_level, v_sessions_at_level
    FROM public.flashcard_progress
    WHERE student_id = p_student_id AND flashcard_id = p_flashcard_id;

    -- Initialize if no record exists
    IF v_current_level IS NULL THEN
        v_current_level := 1;
        v_current_mastery := 0;
        v_correct_at_level := 0;
        v_attempts_at_level := 0;
        v_sessions_at_level := 0;
    END IF;

    -- Update attempt counters
    v_attempts_at_level := v_attempts_at_level + 1;
    IF p_is_correct THEN
        v_correct_at_level := v_correct_at_level + 1;
    END IF;

    -- Calculate success rate at current level
    v_success_rate := v_correct_at_level::REAL / GREATEST(v_attempts_at_level, 1);

    -- Calculate new mastery (weighted average)
    -- Mastery increases more slowly, decreases faster on wrong answers
    IF p_is_correct THEN
        v_new_mastery := LEAST(100, v_current_mastery + GREATEST(5, (100 - v_current_mastery) / 10));
    ELSE
        v_new_mastery := GREATEST(0, v_current_mastery - 10);
    END IF;

    -- Determine new level based on mastery and success rate
    v_new_level := v_current_level;

    -- Level UP criteria: ≥80% success rate at current level, ≥3 attempts, mastery thresholds
    IF v_success_rate >= 0.80 AND v_attempts_at_level >= 3 THEN
        IF v_current_level = 1 AND v_new_mastery >= 30 THEN
            v_new_level := 2;
            v_level_changed := TRUE;
        ELSIF v_current_level = 2 AND v_new_mastery >= 55 THEN
            v_new_level := 3;
            v_level_changed := TRUE;
        ELSIF v_current_level = 3 AND v_new_mastery >= 80 THEN
            v_new_level := 4;
            v_level_changed := TRUE;
        END IF;
    END IF;

    -- Level DOWN criteria: <50% success rate at current level, ≥5 attempts
    IF v_success_rate < 0.50 AND v_attempts_at_level >= 5 AND v_current_level > 1 THEN
        v_new_level := v_current_level - 1;
        v_level_changed := TRUE;
    END IF;

    -- Reset level-specific counters if level changed
    IF v_level_changed THEN
        v_correct_at_level := 0;
        v_attempts_at_level := 0;
        v_sessions_at_level := 0;
    END IF;

    -- Upsert the progress record
    INSERT INTO public.flashcard_progress (
        student_id,
        flashcard_id,
        difficulty_level,
        mastery_percent,
        correct_at_level,
        attempts_at_level,
        sessions_at_level,
        level_up_date,
        last_reviewed
    ) VALUES (
        p_student_id,
        p_flashcard_id,
        v_new_level,
        v_new_mastery,
        v_correct_at_level,
        v_attempts_at_level,
        v_sessions_at_level,
        CASE WHEN v_level_changed THEN NOW() ELSE NULL END,
        NOW()
    )
    ON CONFLICT (student_id, flashcard_id) DO UPDATE SET
        difficulty_level = v_new_level,
        mastery_percent = v_new_mastery,
        correct_at_level = v_correct_at_level,
        attempts_at_level = v_attempts_at_level,
        sessions_at_level = EXCLUDED.sessions_at_level,
        level_up_date = CASE WHEN v_level_changed THEN NOW() ELSE flashcard_progress.level_up_date END,
        last_reviewed = NOW();

    -- Build result
    v_result := jsonb_build_object(
        'student_id', p_student_id,
        'flashcard_id', p_flashcard_id,
        'previous_level', v_current_level,
        'new_level', v_new_level,
        'level_changed', v_level_changed,
        'mastery_percent', v_new_mastery,
        'success_rate', ROUND(v_success_rate * 100),
        'attempts_at_level', v_attempts_at_level
    );

    RETURN v_result;
END;
$$;

-- 5. Grant access to the function
GRANT EXECUTE ON FUNCTION public.update_flashcard_mastery TO authenticated;
