-- Este script agrega la columna 'summary' que falta en la tabla.
-- Si la tabla ya existía de antes, el script anterior no la modificó.

ALTER TABLE public.study_set_materials 
ADD COLUMN IF NOT EXISTS summary text;

-- También recargamos la caché de permisos por si acaso
NOTIFY pgrst, 'reload config';
