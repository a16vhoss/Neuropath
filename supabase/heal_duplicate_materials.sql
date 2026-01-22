-- 1. Eliminar duplicados en study_set_materials antes de contar
-- Nos quedamos con el registro más antiguo (menor ID) por cada nombre y set.
DELETE FROM public.study_set_materials a
USING public.study_set_materials b
WHERE a.id > b.id 
  AND a.study_set_id = b.study_set_id 
  AND a.name = b.name;

-- 2. Asegurar que las flashcards estén vinculadas a un material dentro de su set
-- Si material_id es NULL, lo vinculamos al primer material que encuentre en ese set.
UPDATE public.flashcards f
SET material_id = (
    SELECT id FROM public.study_set_materials ssm 
    WHERE ssm.study_set_id = f.study_set_id 
    LIMIT 1
)
WHERE f.material_id IS NULL;

-- 3. Sincronizar conteo REAL de flashcards en la tabla de materiales
-- Contamos cuántas flashcards tiene asignadas cada material actualmente.
WITH card_counts AS (
    SELECT material_id, COUNT(*) as actual_count
    FROM public.flashcards
    WHERE material_id IS NOT NULL
    GROUP BY material_id
)
UPDATE public.study_set_materials ssm
SET flashcards_generated = cc.actual_count
FROM card_counts cc
WHERE ssm.id = cc.material_id;

-- 4. Opcional: Sincronizar también desde la tabla 'materials' (clase) si existe el vínculo
UPDATE public.study_set_materials ssm
SET file_url = COALESCE(ssm.file_url, m.file_url)
FROM public.study_sets ss
JOIN public.materials m ON m.id = ss.source_material_id
WHERE ssm.study_set_id = ss.id
  AND ssm.name = m.name;


