-- SQL Patch to fix the 'materials' table schema
-- Run this in the Supabase SQL Editor

-- 1. Add missing columns to 'materials' table
ALTER TABLE public.materials 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS url TEXT,
ADD COLUMN IF NOT EXISTS content_text TEXT,
ADD COLUMN IF NOT EXISTS flashcard_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS quiz_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS size_bytes BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id);

-- 2. (Optional) Migrate existing data if necessary
-- UPDATE public.materials SET url = file_url WHERE url IS NULL;
-- UPDATE public.materials SET flashcard_count = flashcards_count WHERE flashcard_count = 0;
-- UPDATE public.materials SET quiz_count = quizzes_count WHERE quiz_count = 0;
