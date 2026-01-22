-- Function to get leaderboard/ranking for a study set
-- Returns aggregated stats for flashcards and quizzes per student

DROP FUNCTION IF EXISTS public.get_study_set_ranking(UUID);

CREATE OR REPLACE FUNCTION public.get_study_set_ranking(p_study_set_id UUID)
RETURNS TABLE (
    student_id UUID,
    full_name TEXT,
    avatar_url TEXT,
    flashcards_mastered BIGINT, -- Cards with >= 80% mastery
    avg_mastery NUMERIC,        -- Average mastery % across all cards in set
    total_flashcards BIGINT,
    quiz_average NUMERIC,
    quizzes_taken BIGINT,
    last_active TIMESTAMPTZ,
    ranking_score NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER -- Bypass RLS to see other students' aggregate stats
SET search_path = public
AS $$
DECLARE
    v_total_cards BIGINT;
BEGIN
    -- 1. Get total flashcards count for this set
    SELECT COUNT(*) INTO v_total_cards
    FROM flashcards
    WHERE study_set_id = p_study_set_id;

    RETURN QUERY
    WITH student_stats AS (
        SELECT 
            u.id AS uid,
            p.full_name,
            p.avatar_url,
            -- Flashcard stats
            COALESCE(fp_stats.mastered_count, 0) AS mastered_count,
            COALESCE(fp_stats.total_mastery_sum, 0) AS total_mastery_sum,
            COALESCE(fp_stats.last_study, NULL) AS last_study,
            -- Quiz stats
            COALESCE(qs_stats.avg_score, 0) AS avg_score,
            COALESCE(qs_stats.total_quizzes, 0) AS total_quizzes,
            COALESCE(qs_stats.last_quiz, NULL) AS last_quiz
        FROM 
            profiles p
        JOIN 
            auth.users u ON u.id = p.id
        -- Join flashcard progress for this set
        LEFT JOIN (
            SELECT 
                fp.student_id,
                COUNT(*) FILTER (WHERE fp.mastery_percent >= 80) AS mastered_count,
                SUM(fp.mastery_percent) AS total_mastery_sum,
                MAX(fp.last_reviewed) AS last_study
            FROM 
                flashcard_progress fp
            JOIN 
                flashcards f ON f.id = fp.flashcard_id
            WHERE 
                f.study_set_id = p_study_set_id
            GROUP BY 
                fp.student_id
        ) fp_stats ON fp_stats.student_id = p.id
        -- Join quiz sessions for this set
        LEFT JOIN (
            SELECT 
                qs.user_id,
                AVG(qs.percent_correct) AS avg_score,
                COUNT(*) AS total_quizzes,
                MAX(qs.completed_at) AS last_quiz
            FROM 
                quiz_sessions qs
            WHERE 
                qs.study_set_id = p_study_set_id
            GROUP BY 
                qs.user_id
        ) qs_stats ON qs_stats.user_id = p.id
        WHERE 
            -- Include if they have any progress OR are enrolled in the class
            (fp_stats.student_id IS NOT NULL OR qs_stats.user_id IS NOT NULL)
            OR
            EXISTS (
                SELECT 1 
                FROM study_sets ss
                JOIN enrollments e ON e.class_id = ss.class_id
                WHERE ss.id = p_study_set_id AND e.student_id = p.id
            )
    )
    SELECT 
        ss.uid,
        ss.full_name,
        ss.avatar_url,
        ss.mastered_count,
        -- Calculate Avg Mastery: Total Sum / Total Cards (0 if no cards)
        ROUND(
            CASE WHEN v_total_cards > 0 THEN 
                ss.total_mastery_sum::numeric / v_total_cards::numeric 
            ELSE 0 END, 
        1) AS avg_mastery,
        v_total_cards,
        ROUND(ss.avg_score::numeric, 1),
        ss.total_quizzes,
        GREATEST(ss.last_study, ss.last_quiz) AS last_active_date,
        -- Ranking Score: (AvgMastery * 0.6) + (QuizAvg * 0.4)
        CASE 
            WHEN v_total_cards > 0 AND ss.total_quizzes > 0 THEN
                ((ss.total_mastery_sum::numeric / v_total_cards::numeric) * 0.6) + (ss.avg_score * 0.4)
            WHEN v_total_cards > 0 THEN
                (ss.total_mastery_sum::numeric / v_total_cards::numeric)
            WHEN ss.total_quizzes > 0 THEN
                ss.avg_score
            ELSE 0
        END AS rank_score
    FROM 
        student_stats ss
    ORDER BY 
        rank_score DESC NULLS LAST, 
        last_active_date DESC NULLS LAST;
END;
$$;
