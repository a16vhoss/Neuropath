-- Migration: Create notebooks system for study sets
-- Date: 2025-01-24
-- Description: Tables for notebooks, save history, and flashcard generation tracking

-- ============================================
-- TABLA: notebooks (cuadernos de notas)
-- ============================================
CREATE TABLE IF NOT EXISTS public.notebooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_set_id UUID NOT NULL REFERENCES public.study_sets(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT DEFAULT '',
  last_saved_content TEXT,
  last_saved_at TIMESTAMPTZ,
  flashcards_generated INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comentarios descriptivos
COMMENT ON TABLE public.notebooks IS 'Cuadernos de notas dentro de study sets';
COMMENT ON COLUMN public.notebooks.content IS 'Contenido actual del cuaderno (HTML)';
COMMENT ON COLUMN public.notebooks.last_saved_content IS 'Contenido en el ultimo guardado (para calcular diff)';
COMMENT ON COLUMN public.notebooks.last_saved_at IS 'Timestamp del ultimo guardado que genero flashcards';

-- ============================================
-- TABLA: notebook_saves (historial de guardados)
-- ============================================
CREATE TABLE IF NOT EXISTS public.notebook_saves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id UUID NOT NULL REFERENCES public.notebooks(id) ON DELETE CASCADE,
  content_snapshot TEXT NOT NULL,
  new_content_diff TEXT,
  flashcards_generated INTEGER DEFAULT 0,
  saved_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.notebook_saves IS 'Historial de guardados de cuadernos';
COMMENT ON COLUMN public.notebook_saves.content_snapshot IS 'Contenido completo al momento del guardado';
COMMENT ON COLUMN public.notebook_saves.new_content_diff IS 'Solo el contenido nuevo que genero flashcards';

-- ============================================
-- TABLA: notebook_flashcard_links (tracking de generacion)
-- ============================================
CREATE TABLE IF NOT EXISTS public.notebook_flashcard_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_save_id UUID NOT NULL REFERENCES public.notebook_saves(id) ON DELETE CASCADE,
  flashcard_id UUID NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(notebook_save_id, flashcard_id)
);

COMMENT ON TABLE public.notebook_flashcard_links IS 'Vincula flashcards con el guardado que las genero';

-- ============================================
-- INDICES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_notebooks_study_set ON public.notebooks(study_set_id);
CREATE INDEX IF NOT EXISTS idx_notebooks_updated ON public.notebooks(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_notebook_saves_notebook ON public.notebook_saves(notebook_id);
CREATE INDEX IF NOT EXISTS idx_notebook_saves_date ON public.notebook_saves(notebook_id, saved_at DESC);
CREATE INDEX IF NOT EXISTS idx_notebook_flashcard_links_save ON public.notebook_flashcard_links(notebook_save_id);
CREATE INDEX IF NOT EXISTS idx_notebook_flashcard_links_flashcard ON public.notebook_flashcard_links(flashcard_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.notebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notebook_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notebook_flashcard_links ENABLE ROW LEVEL SECURITY;

-- Politicas para notebooks (acceso a traves del study_set padre)
CREATE POLICY "Users can manage own notebooks" ON public.notebooks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.study_sets s
      WHERE s.id = notebooks.study_set_id
      AND (s.student_id = auth.uid() OR auth.uid() = ANY(s.editors))
    )
  );

CREATE POLICY "Class members can view shared notebooks" ON public.notebooks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.study_sets s
      JOIN public.enrollments e ON e.class_id = s.class_id
      WHERE s.id = notebooks.study_set_id
      AND s.is_public_to_class = TRUE
      AND e.student_id = auth.uid()
    )
  );

-- Politicas para notebook_saves
CREATE POLICY "Users can manage own notebook saves" ON public.notebook_saves
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.notebooks n
      JOIN public.study_sets s ON s.id = n.study_set_id
      WHERE n.id = notebook_saves.notebook_id
      AND (s.student_id = auth.uid() OR auth.uid() = ANY(s.editors))
    )
  );

CREATE POLICY "Class members can view shared notebook saves" ON public.notebook_saves
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.notebooks n
      JOIN public.study_sets s ON s.id = n.study_set_id
      JOIN public.enrollments e ON e.class_id = s.class_id
      WHERE n.id = notebook_saves.notebook_id
      AND s.is_public_to_class = TRUE
      AND e.student_id = auth.uid()
    )
  );

-- Politicas para notebook_flashcard_links
CREATE POLICY "Users can manage own flashcard links" ON public.notebook_flashcard_links
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.notebook_saves ns
      JOIN public.notebooks n ON n.id = ns.notebook_id
      JOIN public.study_sets s ON s.id = n.study_set_id
      WHERE ns.id = notebook_flashcard_links.notebook_save_id
      AND (s.student_id = auth.uid() OR auth.uid() = ANY(s.editors))
    )
  );

-- ============================================
-- TRIGGER: Actualizar updated_at automaticamente
-- ============================================
CREATE OR REPLACE FUNCTION public.update_notebooks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notebooks_updated_at ON public.notebooks;
CREATE TRIGGER trigger_notebooks_updated_at
  BEFORE UPDATE ON public.notebooks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_notebooks_updated_at();
