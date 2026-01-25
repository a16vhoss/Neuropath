
export enum UserRole {
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT',
  INSTITUTION = 'INSTITUTION'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
}

export interface ClassInfo {
  id: string;
  name: string;
  description: string;
  studentCount: number;
  averageProgress: number;
  code: string;
  subject: string;
  nextExam?: string;
  atRiskCount?: number;
}

export interface StudentProgress {
  id: string;
  name: string;
  avatar: string;
  scores: Record<string, number>; // moduleId -> score
  totalAvg: number;
  isAtRisk: boolean;
}

export interface Flashcard {
  id: string;
  question: string;
  answer: string;
  category: string;
  is_ai_generated?: boolean;
  source_name?: string;
}

// ============================================
// Notebooks (Cuadernos de notas)
// ============================================

export interface Notebook {
  id: string;
  study_set_id: string;
  title: string;
  description?: string;
  content: string;
  last_saved_content?: string;
  last_saved_at?: string;
  flashcards_generated: number;
  created_at: string;
  updated_at: string;
}

export interface NotebookSave {
  id: string;
  notebook_id: string;
  content_snapshot: string;
  new_content_diff?: string;
  flashcards_generated: number;
  saved_at: string;
}

export interface NotebookFlashcardLink {
  id: string;
  notebook_save_id: string;
  flashcard_id: string;
  created_at: string;
}

export interface FlashcardPreview {
  question: string;
  answer: string;
  category: string;
  tempId?: string; // Para edicion en preview
}

export interface NotebookSaveResult {
  hasNewContent: boolean;
  newContentDiff: string;
  flashcardPreviews: FlashcardPreview[];
  suggestedCount: number;
}
