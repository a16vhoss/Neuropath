/* 
 * FIX: Add ON DELETE CASCADE to study_sets foreign keys
 * This ensures that when a Study Set is deleted, all related
 * quizzes, flashcards, and sessions are also removed.
 */

-- 1. Correct quiz_sessions foreign key
-- (This one was definitely missing CASCADE in the recent migration)
ALTER TABLE public.quiz_sessions
DROP CONSTRAINT IF EXISTS quiz_sessions_study_set_id_fkey;

ALTER TABLE public.quiz_sessions
ADD CONSTRAINT quiz_sessions_study_set_id_fkey
FOREIGN KEY (study_set_id)
REFERENCES public.study_sets(id)
ON DELETE CASCADE;

-- 2. Correct flashcards foreign key
-- (Ensuring flashcards are deleted with the set)
ALTER TABLE public.flashcards
DROP CONSTRAINT IF EXISTS flashcards_study_set_id_fkey;

ALTER TABLE public.flashcards
ADD CONSTRAINT flashcards_study_set_id_fkey
FOREIGN KEY (study_set_id)
REFERENCES public.study_sets(id)
ON DELETE CASCADE;

-- 3. Correct study_set_materials
-- (Ensuring PDFs/materials are deleted with the set)
ALTER TABLE public.study_set_materials
DROP CONSTRAINT IF EXISTS study_set_materials_study_set_id_fkey;

ALTER TABLE public.study_set_materials
ADD CONSTRAINT study_set_materials_study_set_id_fkey
FOREIGN KEY (study_set_id)
REFERENCES public.study_sets(id)
ON DELETE CASCADE;
