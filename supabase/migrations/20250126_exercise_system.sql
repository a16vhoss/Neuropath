-- =====================================================
-- EXERCISE SYSTEM
-- Adaptive learning with exercises and study materials
-- =====================================================

-- ===========================================
-- 1. Add content_type to study_set_materials
-- ===========================================
ALTER TABLE public.study_set_materials
ADD COLUMN IF NOT EXISTS content_type TEXT DEFAULT 'study_material'
CHECK (content_type IN ('study_material', 'exercises', 'mixed'));

-- ===========================================
-- 2. Exercise Templates Table
-- ===========================================
CREATE TABLE IF NOT EXISTS public.exercise_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    study_set_id UUID NOT NULL REFERENCES public.study_sets(id) ON DELETE CASCADE,
    material_id UUID REFERENCES public.study_set_materials(id) ON DELETE SET NULL,

    -- Exercise content
    problem_statement TEXT NOT NULL,
    solution TEXT,
    step_by_step_explanation JSONB DEFAULT '[]',

    -- Classification
    exercise_type TEXT NOT NULL DEFAULT 'general'
        CHECK (exercise_type IN ('mathematical', 'programming', 'case_study', 'conceptual', 'practical', 'general')),
    difficulty INTEGER DEFAULT 3 CHECK (difficulty >= 1 AND difficulty <= 5),
    topic TEXT,
    subtopic TEXT,

    -- Related theory concepts (links to flashcards)
    related_concepts TEXT[] DEFAULT '{}',
    related_flashcard_ids UUID[] DEFAULT '{}',

    -- Metadata for generation
    variables JSONB DEFAULT '{}',
    generation_template TEXT,

    -- Tracking
    times_practiced INTEGER DEFAULT 0,
    avg_success_rate DECIMAL(5,2) DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- 3. User Exercise Progress
-- ===========================================
CREATE TABLE IF NOT EXISTS public.user_exercise_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    exercise_template_id UUID NOT NULL REFERENCES public.exercise_templates(id) ON DELETE CASCADE,

    -- Progress tracking
    attempts INTEGER DEFAULT 0,
    correct_attempts INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    last_correct_at TIMESTAMPTZ,

    -- Mastery (similar to flashcard SRS)
    mastery_level INTEGER DEFAULT 0 CHECK (mastery_level >= 0 AND mastery_level <= 5),
    next_review_at TIMESTAMPTZ DEFAULT NOW(),

    -- Time tracking
    avg_time_seconds INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, exercise_template_id)
);

-- ===========================================
-- 4. Generated Exercise Instances
-- ===========================================
CREATE TABLE IF NOT EXISTS public.exercise_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES public.exercise_templates(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

    -- Generated content (variations of the template)
    generated_problem TEXT NOT NULL,
    generated_solution TEXT,
    generated_steps JSONB DEFAULT '[]',

    -- User's answer
    user_answer TEXT,
    is_correct BOOLEAN,
    feedback TEXT,

    -- Context
    quiz_session_id UUID,
    study_session_id UUID,

    -- Timing
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    time_spent_seconds INTEGER,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- 5. Study Set Learning Stats (Theory vs Practice)
-- ===========================================
CREATE TABLE IF NOT EXISTS public.study_set_learning_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    study_set_id UUID NOT NULL REFERENCES public.study_sets(id) ON DELETE CASCADE,

    -- Theory performance (flashcards)
    theory_total_reviews INTEGER DEFAULT 0,
    theory_correct_reviews INTEGER DEFAULT 0,
    theory_mastery_avg DECIMAL(5,2) DEFAULT 0,

    -- Exercise performance
    exercise_total_attempts INTEGER DEFAULT 0,
    exercise_correct_attempts INTEGER DEFAULT 0,
    exercise_mastery_avg DECIMAL(5,2) DEFAULT 0,

    -- Adaptive balance (0 = all theory, 100 = all exercises)
    recommended_exercise_ratio INTEGER DEFAULT 50 CHECK (recommended_exercise_ratio >= 0 AND recommended_exercise_ratio <= 100),

    -- Weak areas
    weak_theory_topics TEXT[] DEFAULT '{}',
    weak_exercise_types TEXT[] DEFAULT '{}',

    last_updated TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, study_set_id)
);

-- ===========================================
-- 6. Row Level Security
-- ===========================================
ALTER TABLE public.exercise_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_exercise_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_set_learning_stats ENABLE ROW LEVEL SECURITY;

-- Exercise templates: viewable by anyone with access to the study set
CREATE POLICY "Users can view exercise templates" ON public.exercise_templates
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.study_sets s
            WHERE s.id = exercise_templates.study_set_id
            AND (s.student_id = auth.uid() OR s.teacher_id = auth.uid() OR auth.uid() = ANY(s.editors))
        )
    );

CREATE POLICY "Owners can manage exercise templates" ON public.exercise_templates
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.study_sets s
            WHERE s.id = exercise_templates.study_set_id
            AND (s.student_id = auth.uid() OR s.teacher_id = auth.uid())
        )
    );

-- User exercise progress: users manage their own
CREATE POLICY "Users manage own exercise progress" ON public.user_exercise_progress
    FOR ALL USING (auth.uid() = user_id);

-- Exercise instances: users manage their own
CREATE POLICY "Users manage own exercise instances" ON public.exercise_instances
    FOR ALL USING (auth.uid() = user_id);

-- Learning stats: users manage their own
CREATE POLICY "Users manage own learning stats" ON public.study_set_learning_stats
    FOR ALL USING (auth.uid() = user_id);

-- ===========================================
-- 7. Indexes for Performance
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_exercise_templates_study_set
    ON public.exercise_templates(study_set_id);

CREATE INDEX IF NOT EXISTS idx_exercise_templates_type
    ON public.exercise_templates(exercise_type);

CREATE INDEX IF NOT EXISTS idx_exercise_templates_topic
    ON public.exercise_templates(study_set_id, topic);

CREATE INDEX IF NOT EXISTS idx_user_exercise_progress_user
    ON public.user_exercise_progress(user_id);

CREATE INDEX IF NOT EXISTS idx_user_exercise_progress_review
    ON public.user_exercise_progress(user_id, next_review_at);

CREATE INDEX IF NOT EXISTS idx_exercise_instances_user
    ON public.exercise_instances(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_learning_stats_user_set
    ON public.study_set_learning_stats(user_id, study_set_id);

-- ===========================================
-- 8. Trigger for updated_at
-- ===========================================
CREATE OR REPLACE FUNCTION update_exercise_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_exercise_templates_timestamp
    BEFORE UPDATE ON public.exercise_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_exercise_timestamp();

CREATE TRIGGER update_user_exercise_progress_timestamp
    BEFORE UPDATE ON public.user_exercise_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_exercise_timestamp();
