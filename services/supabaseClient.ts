import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://szcsttpuckqpjndadqbk.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6Y3N0dHB1Y2txcGpuZGFkcWJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1MjcxNzEsImV4cCI6MjA4NDEwMzE3MX0.jkySnMjg16zyejivMhhtxgdnPecs7W8nGbNYTxfeFOo';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Auth helpers
export const signUp = async (email: string, password: string, fullName: string, role: 'student' | 'teacher') => {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: fullName,
                role,
            }
        }
    });

    if (error) throw error;
    return data;
};

export const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) throw error;
    return data;
};

export const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
};

export const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
};

// Profile helpers
export const getProfile = async (userId: string) => {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (error) throw error;
    return data;
};

export const updateProfile = async (userId: string, updates: {
    full_name?: string;
    avatar_url?: string;
    xp?: number;
    level?: number;
    streak_days?: number;
}) => {
    const { data, error } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select()
        .single();

    if (error) throw error;
    return data;
};

// Class helpers
export const createClass = async (teacherId: string, classData: {
    name: string;
    code: string;
    description?: string;
    topics?: string[];
    exam_date?: string;
}) => {
    const { data, error } = await supabase
        .from('classes')
        .insert({ teacher_id: teacherId, ...classData })
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const getTeacherClasses = async (teacherId: string) => {
    const { data, error } = await supabase
        .from('classes')
        .select(`
      *,
      enrollments (count),
      materials (count)
    `)
        .eq('teacher_id', teacherId);

    if (error) throw error;
    return data;
};

export const getStudentClasses = async (studentId: string) => {
    const { data, error } = await supabase
        .from('enrollments')
        .select(`
      *,
      classes (*)
    `)
        .eq('student_id', studentId);

    if (error) throw error;
    return data;
};

export const joinClass = async (studentId: string, classCode: string) => {
    // First find the class by code
    const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('id')
        .eq('code', classCode)
        .single();

    if (classError) throw new Error('Clase no encontrada');

    // Then create the enrollment
    const { data, error } = await supabase
        .from('enrollments')
        .insert({ class_id: classData.id, student_id: studentId })
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const getClassEnrollments = async (classId: string) => {
    const { data, error } = await supabase
        .from('enrollments')
        .select(`
            *,
            profiles!enrollments_student_id_fkey (
                id,
                full_name,
                email,
                avatar_url,
                xp,
                level,
                updated_at
            )
        `)
        .eq('class_id', classId);

    if (error) throw error;
    return data;
};

// Flashcards helpers
export const getClassFlashcards = async (classId: string) => {
    const { data, error } = await supabase
        .from('flashcards')
        .select('*')
        .eq('class_id', classId);

    if (error) throw error;
    return data;
};

export const getFlashcardProgress = async (studentId: string, flashcardIds: string[]) => {
    const { data, error } = await supabase
        .from('flashcard_progress')
        .select('*')
        .eq('student_id', studentId)
        .in('flashcard_id', flashcardIds);

    if (error) throw error;
    return data;
};

export const updateFlashcardProgress = async (studentId: string, flashcardId: string, known: boolean) => {
    // SM-2 algorithm simplified
    const { data: existing } = await supabase
        .from('flashcard_progress')
        .select('*')
        .eq('student_id', studentId)
        .eq('flashcard_id', flashcardId)
        .single();

    let easeFactor = existing?.ease_factor || 2.5;
    let interval = existing?.interval || 1;
    let repetitions = existing?.repetitions || 0;

    if (known) {
        repetitions += 1;
        if (repetitions === 1) {
            interval = 1;
        } else if (repetitions === 2) {
            interval = 6;
        } else {
            interval = Math.round(interval * easeFactor);
        }
        easeFactor = Math.max(1.3, easeFactor + 0.1);
    } else {
        repetitions = 0;
        interval = 1;
        easeFactor = Math.max(1.3, easeFactor - 0.2);
    }

    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + interval);

    const { data, error } = await supabase
        .from('flashcard_progress')
        .upsert({
            student_id: studentId,
            flashcard_id: flashcardId,
            ease_factor: easeFactor,
            interval,
            repetitions,
            next_review: nextReview.toISOString().split('T')[0],
            last_reviewed: new Date().toISOString()
        }, {
            onConflict: 'student_id, flashcard_id'
        })
        .select()
        .single();

    if (error) throw error;
    return data;
};

// Quiz helpers
export const getClassQuizzes = async (classId: string) => {
    const { data, error } = await supabase
        .from('quizzes')
        .select('*')
        .eq('class_id', classId);

    if (error) throw error;
    return data;
};

export const getQuizQuestions = async (quizId: string) => {
    const { data, error } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('quiz_id', quizId);

    if (error) throw error;
    return data;
};

export const submitQuizAttempt = async (quizId: string, studentId: string, score: number, maxScore: number, answers: any, timeTaken: number) => {
    const { data, error } = await supabase
        .from('quiz_attempts')
        .insert({
            quiz_id: quizId,
            student_id: studentId,
            score,
            max_score: maxScore,
            answers,
            time_taken_seconds: timeTaken
        })
        .select()
        .single();

    if (error) throw error;
    return data;
};

// Study session helpers
export const logStudySession = async (studentId: string, classId: string, mode: string, durationSeconds: number, cardsReviewed: number, correctCount: number, xpEarned: number) => {
    const { data, error } = await supabase
        .from('study_sessions')
        .insert({
            student_id: studentId,
            class_id: classId,
            mode,
            duration_seconds: durationSeconds,
            cards_reviewed: cardsReviewed,
            correct_count: correctCount,
            xp_earned: xpEarned
        })
        .select()
        .single();

    if (error) throw error;
    return data;
};

// Achievement helpers
export const getAchievements = async () => {
    const { data, error } = await supabase
        .from('achievements')
        .select('*');

    if (error) throw error;
    return data;
};

export const getStudentAchievements = async (studentId: string) => {
    const { data, error } = await supabase
        .from('student_achievements')
        .select(`
      *,
      achievements (*)
    `)
        .eq('student_id', studentId);

    if (error) throw error;
    return data;
};

export const awardAchievement = async (studentId: string, achievementId: string) => {
    const { data, error } = await supabase
        .from('student_achievements')
        .insert({ student_id: studentId, achievement_id: achievementId })
        .select()
        .single();

    if (error && error.code !== '23505') throw error; // Ignore duplicate
    return data;
};

// Materials helpers
export const uploadMaterial = async (classId: string, name: string, type: string, file: File) => {
    // Upload file to storage
    const fileName = `${classId}/${Date.now()}_${file.name}`;
    const { data: fileData, error: uploadError } = await supabase.storage
        .from('materials')
        .upload(fileName, file);

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
        .from('materials')
        .getPublicUrl(fileName);

    // Create material record
    const { data, error } = await supabase
        .from('materials')
        .insert({
            class_id: classId,
            name,
            type,
            file_url: publicUrl,
            status: 'processing'
        })
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const getClassMaterials = async (classId: string) => {
    const { data, error } = await supabase
        .from('materials')
        .select('*')
        .eq('class_id', classId);

    if (error) throw error;
    return data;
};

// Study Sets helpers (for student self-study)
export const createStudySet = async (studentId: string, studySetData: {
    name: string;
    description?: string;
    topics?: string[];
    icon?: string;
    color?: string;
}) => {
    const { data, error } = await supabase
        .from('study_sets')
        .insert({ student_id: studentId, ...studySetData })
        .select()
        .single();

    if (error) throw error;
    return data;
};



export const getStudentStudySets = async (studentId: string) => {
    const { data, error } = await supabase
        .from('study_sets')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
};

export const getStudySetFlashcards = async (studySetId: string) => {
    const { data, error } = await supabase
        .from('flashcards')
        .select('*')
        .eq('study_set_id', studySetId);

    if (error) throw error;
    return data;
};

export const updateStudySet = async (studySetId: string, updates: {
    name?: string;
    description?: string;
    topics?: string[];
}) => {
    const { data, error } = await supabase
        .from('study_sets')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', studySetId)
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const deleteStudySet = async (studySetId: string) => {
    const { error } = await supabase
        .from('study_sets')
        .delete()
        .eq('id', studySetId);

    if (error) throw error;
};

export const addFlashcardToStudySet = async (studySetId: string, flashcard: {
    question: string;
    answer: string;
    category?: string;
}) => {
    const { data, error } = await supabase
        .from('flashcards')
        .insert({ study_set_id: studySetId, ...flashcard })
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const updateFlashcard = async (flashcardId: string, updates: {
    question?: string;
    answer?: string;
    category?: string;
}) => {
    const { data, error } = await supabase
        .from('flashcards')
        .update({ ...updates })
        .eq('id', flashcardId)
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const deleteFlashcard = async (flashcardId: string) => {
    const { error } = await supabase
        .from('flashcards')
        .delete()
        .eq('id', flashcardId);

    if (error) throw error;
};

export const addFlashcardsBatch = async (flashcards: {
    study_set_id: string;
    question: string;
    answer: string;
    category?: string;
    material_id?: string;
}[]) => {
    const { data, error } = await supabase
        .from('flashcards')
        .insert(flashcards)
        .select();

    if (error) throw error;
    return data;
};

// Analytics helpers (for teachers)
export const getClassAnalytics = async (classId: string) => {
    const { data: enrollments, error: enrollError } = await supabase
        .from('enrollments')
        .select(`
      *,
      profiles (id, full_name, avatar_url)
    `)
        .eq('class_id', classId);

    if (enrollError) throw enrollError;

    const { data: sessions, error: sessionsError } = await supabase
        .from('study_sessions')
        .select('*')
        .eq('class_id', classId);

    if (sessionsError) throw sessionsError;

    return { enrollments, sessions };
};

// ============================================
// STUDY SET MATERIALS HELPERS
// ============================================

export interface StudySetMaterial {
    id?: string;
    study_set_id: string;
    name: string;
    type: 'pdf' | 'manual' | 'url' | 'notes';
    file_url?: string;
    content_text?: string;
    flashcards_generated: number;
    created_at?: string;
    summary?: string | null;
}

export const getStudySetMaterials = async (studySetId: string) => {
    const { data, error } = await supabase
        .from('study_set_materials')
        .select('*')
        .eq('study_set_id', studySetId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
};

export const addMaterialToStudySet = async (material: StudySetMaterial) => {
    const { data, error } = await supabase
        .from('study_set_materials')
        .insert(material)
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const updateStudySetMaterial = async (materialId: string, updates: Partial<StudySetMaterial>) => {
    const { data, error } = await supabase
        .from('study_set_materials')
        .update(updates)
        .eq('id', materialId)
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const deleteMaterialFromStudySet = async (materialId: string) => {
    // First, explicitly delete all flashcards associated with this material
    const { error: flashcardsError } = await supabase
        .from('flashcards')
        .delete()
        .eq('material_id', materialId);

    if (flashcardsError) {
        console.error('Error deleting flashcards for material:', flashcardsError);
        // Continue anyway to delete the material
    }

    // Then delete the material itself
    const { error } = await supabase
        .from('study_set_materials')
        .delete()
        .eq('id', materialId);

    if (error) throw error;
};

// Get study set with full details (materials + flashcard count)
export const getStudySetWithDetails = async (studySetId: string) => {
    const { data: studySet, error: setError } = await supabase
        .from('study_sets')
        .select('*')
        .eq('id', studySetId)
        .single();

    if (setError) throw setError;

    const { data: flashcards, error: flashError } = await supabase
        .from('flashcards')
        .select('id, question, answer, category')
        .eq('study_set_id', studySetId);

    if (flashError) throw flashError;

    const { data: materials, error: matError } = await supabase
        .from('study_set_materials')
        .select('*')
        .eq('study_set_id', studySetId)
        .order('created_at', { ascending: false });

    // Materials table might not exist yet, so we handle this gracefully
    const safeMatError = matError?.code === '42P01' ? null : matError;
    if (safeMatError) throw safeMatError;

    return {
        ...studySet,
        flashcards: flashcards || [],
        materials: materials || [],
        flashcard_count: flashcards?.length || 0,
        material_count: materials?.length || 0
    };
};
