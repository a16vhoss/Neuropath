-- Fix Foreign Key Constraint on document_chunks
ALTER TABLE document_chunks
DROP CONSTRAINT IF EXISTS document_chunks_material_id_fkey;

ALTER TABLE document_chunks
ADD CONSTRAINT document_chunks_material_id_fkey
FOREIGN KEY (material_id)
REFERENCES study_set_materials(id)
ON DELETE CASCADE;

-- Update match_document_chunks function to join with correct table
CREATE OR REPLACE FUNCTION match_document_chunks (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  filter_user_id uuid,
  filter_study_set_id uuid default null
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  similarity float,
  source_type text,
  source_name text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    document_chunks.id,
    document_chunks.content,
    document_chunks.metadata,
    1 - (document_chunks.embedding <=> query_embedding) AS similarity,
    CASE 
      WHEN document_chunks.material_id IS NOT NULL THEN 'material'
      ELSE 'notebook'
    END AS source_type,
    CASE 
      WHEN m.id IS NOT NULL THEN m.name
      WHEN n.id IS NOT NULL THEN n.title
      ELSE 'Unknown'
    END AS source_name
  FROM document_chunks
  LEFT JOIN study_set_materials m ON document_chunks.material_id = m.id
  LEFT JOIN notebooks n ON document_chunks.notebook_id = n.id
  WHERE document_chunks.user_id = filter_user_id
  AND 1 - (document_chunks.embedding <=> query_embedding) > match_threshold
  AND (
    filter_study_set_id IS NULL 
    OR m.study_set_id = filter_study_set_id 
    OR n.study_set_id = filter_study_set_id
  )
  ORDER BY document_chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
