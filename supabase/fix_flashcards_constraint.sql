-- REPARACIÓN DEFINITIVA DEL ERROR "table materials"
-- Este script arregla el problema donde la base de datos espera una tabla 'materials' que no existe o es incorrecta.

-- 1. Eliminar la restricción incorrecta previa (si existe)
ALTER TABLE flashcards DROP CONSTRAINT IF EXISTS flashcards_material_id_fkey;

-- 2. Limpiar datos corruptos (flashcards que apuntan a materiales inexistentes para evitar errores al crear la restricción)
-- Esto NO borra flashcards válidas, solo las que tienen un ID que no existe en "study_set_materials"
DELETE FROM flashcards 
WHERE material_id IS NOT NULL 
AND material_id NOT IN (SELECT id FROM study_set_materials);

-- 3. Crear el vínculo CORRECTO hacia 'study_set_materials'
ALTER TABLE flashcards
ADD CONSTRAINT flashcards_material_id_fkey
FOREIGN KEY (material_id)
REFERENCES study_set_materials(id)
ON DELETE CASCADE;

-- 4. Asegurar índice para rendimiento
CREATE INDEX IF NOT EXISTS idx_flashcards_material_id ON flashcards(material_id);
