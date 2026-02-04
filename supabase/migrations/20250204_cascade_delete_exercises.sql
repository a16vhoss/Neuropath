-- =====================================================
-- CASCADE DELETE EXERCISES WHEN MATERIAL IS DELETED
-- =====================================================
-- 
-- Problem: When a material is deleted, exercises stay orphaned with material_id = NULL
-- Solution: Change foreign key constraint from ON DELETE SET NULL to ON DELETE CASCADE
--
-- This ensures that when a material is deleted, all associated exercises are also deleted,
-- which will cascade to exercise_instances and user_exercise_progress.

-- Drop existing constraint
ALTER TABLE public.exercise_templates
DROP CONSTRAINT IF EXISTS exercise_templates_material_id_fkey;

-- Re-add constraint with CASCADE behavior
ALTER TABLE public.exercise_templates
ADD CONSTRAINT exercise_templates_material_id_fkey
    FOREIGN KEY (material_id)
    REFERENCES public.study_set_materials(id)
    ON DELETE CASCADE;

-- Verify the change
-- You can check with: 
-- SELECT conname, confdeltype FROM pg_constraint 
-- WHERE conname = 'exercise_templates_material_id_fkey';
-- confdeltype should be 'c' (CASCADE) instead of 'n' (SET NULL)
