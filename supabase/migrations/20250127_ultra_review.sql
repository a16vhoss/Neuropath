-- =====================================================
-- ULTRA REVIEW SYSTEM
-- Comprehensive last-day-before-exam study sessions
-- =====================================================

-- ===========================================
-- 1. Ultra Review Sessions
-- ===========================================
CREATE TABLE IF NOT EXISTS public.ultra_review_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    study_set_id UUID NOT NULL REFERENCES public.study_sets(id) ON DELETE CASCADE,

    -- Session configuration
    duration_mode TEXT NOT NULL DEFAULT 'normal'
        CHECK (duration_mode IN ('express', 'normal', 'complete')),

    -- Progress tracking (which phase, 1-6)
    current_phase INTEGER DEFAULT 1 CHECK (current_phase >= 1 AND current_phase <= 6),
    phase_progress JSONB DEFAULT '{}', -- {"1": {"completed": true, "time_spent": 120}, "2": {...}}

    -- Generated content (cached so we don't regenerate)
    generated_content JSONB DEFAULT '{}', -- Stores all AI-generated content for the session

    -- Status
    status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),

    -- Timing
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    total_time_seconds INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- 2. Ultra Review Phase Content Cache
-- ===========================================
-- Separate table for heavy content to keep sessions table lighter
CREATE TABLE IF NOT EXISTS public.ultra_review_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.ultra_review_sessions(id) ON DELETE CASCADE,

    -- Phase identifier
    phase INTEGER NOT NULL CHECK (phase >= 1 AND phase <= 6),
    phase_name TEXT NOT NULL, -- 'summary', 'formulas', 'methodologies', 'flashcards', 'exercises', 'tips'

    -- Content (can be large)
    content JSONB NOT NULL,

    -- Generation metadata
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    generation_model TEXT, -- Which AI model generated this

    UNIQUE(session_id, phase)
);

-- ===========================================
-- 3. Row Level Security
-- ===========================================
ALTER TABLE public.ultra_review_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ultra_review_content ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running migration)
DROP POLICY IF EXISTS "Users manage own ultra review sessions" ON public.ultra_review_sessions;
DROP POLICY IF EXISTS "Users manage own ultra review content" ON public.ultra_review_content;

CREATE POLICY "Users manage own ultra review sessions" ON public.ultra_review_sessions
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own ultra review content" ON public.ultra_review_content
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.ultra_review_sessions s
            WHERE s.id = ultra_review_content.session_id
            AND s.user_id = auth.uid()
        )
    );

-- ===========================================
-- 4. Indexes
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_ultra_review_sessions_user
    ON public.ultra_review_sessions(user_id, study_set_id);

CREATE INDEX IF NOT EXISTS idx_ultra_review_sessions_status
    ON public.ultra_review_sessions(user_id, status);

CREATE INDEX IF NOT EXISTS idx_ultra_review_content_session
    ON public.ultra_review_content(session_id);

-- ===========================================
-- 5. Trigger for updated_at
-- ===========================================
DROP TRIGGER IF EXISTS update_ultra_review_sessions_timestamp ON public.ultra_review_sessions;

CREATE TRIGGER update_ultra_review_sessions_timestamp
    BEFORE UPDATE ON public.ultra_review_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_exercise_timestamp();
