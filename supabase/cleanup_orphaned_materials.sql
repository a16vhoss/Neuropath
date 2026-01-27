-- cleanup_orphaned_materials.sql
-- This script identifies and removes records in the 'materials' table 
-- that are not referenced by any assignment.

-- 1. Identify and delete materials that are NOT in the 'attached_materials' array of any assignment
DELETE FROM public.materials
WHERE id NOT IN (
    SELECT unnest(attached_materials)
    FROM public.assignments
    WHERE attached_materials IS NOT NULL
);  

-- Note: We only delete from the 'materials' table. 
-- The actual files in Storage might stay there for now unless we manually clean them, 
-- but this fix resolves the UI count discrepancy.
