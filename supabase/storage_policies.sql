-- Storage bucket for study materials (PDFs)
-- Run this in Supabase SQL Editor

-- First, create the bucket if it doesn't exist (do this in Supabase Dashboard > Storage > New Bucket)
-- Bucket name: materials
-- Public: true (to allow viewing)

-- Then run these policies:

-- Allow authenticated users to upload files to their own folder
CREATE POLICY "Users can upload their own materials"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'materials' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to view their own materials
CREATE POLICY "Users can view their own materials"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'materials' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public access to materials (for sharing)
CREATE POLICY "Public can view materials"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'materials');

-- Allow users to delete their own materials
CREATE POLICY "Users can delete their own materials"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'materials' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
