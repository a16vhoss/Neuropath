-- =====================================================
-- CASCADE DELETE EXERCISES WHEN MATERIAL IS DELETED
-- (Safe version - checks if table exists first)
-- =====================================================
-- 
-- Problem: exercise_templates table might not exist yet if exercise_system 
-- migration hasn't been run. This version safely handles both cases.

-- Only modify constraint if table exists
DO $$
BEGIN
    -- Check if exercise_templates table exists
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'exercise_templates'
    ) THEN
        -- Drop existing constraint if it exists
        IF EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'exercise_templates_material_id_fkey'
            AND table_name = 'exercise_templates'
        ) THEN
            ALTER TABLE public.exercise_templates
            DROP CONSTRAINT exercise_templates_material_id_fkey;
        END IF;

        -- Re-add constraint with CASCADE behavior
        ALTER TABLE public.exercise_templates
        ADD CONSTRAINT exercise_templates_material_id_fkey
            FOREIGN KEY (material_id)
            REFERENCES public.study_set_materials(id)
            ON DELETE CASCADE;
            
        RAISE NOTICE 'Successfully updated exercise_templates constraint to CASCADE';
    ELSE
        RAISE NOTICE 'exercise_templates table does not exist yet - skipping migration';
        RAISE NOTICE 'This is OK - the constraint will be correct when you create the exercise system';
    END IF;
END $$;

-- Verification query (optional - uncomment to check)
-- SELECT 
--     conname as constraint_name,
--     CASE confdeltype 
--         WHEN 'a' THEN 'NO ACTION'
--         WHEN 'r' THEN 'RESTRICT'
--         WHEN 'c' THEN 'CASCADE'
--         WHEN 'n' THEN 'SET NULL'
--         WHEN 'd' THEN 'SET DEFAULT'
--     END as on_delete_action
-- FROM pg_constraint 
-- WHERE conname = 'exercise_templates_material_id_fkey';
