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

// ============================================
// DIFFICULTY LEVEL & MASTERY SYSTEM
// ============================================

export interface MasteryResult {
    student_id: string;
    flashcard_id: string;
    previous_level: number;
    new_level: number;
    level_changed: boolean;
    mastery_percent: number;
    success_rate: number;
    attempts_at_level: number;
}

export interface FlashcardWithMastery {
    id: string;
    question: string;
    answer: string;
    category?: string;
    difficulty_level: number;
    mastery_percent: number;
    correct_at_level: number;
    attempts_at_level: number;
}

// Update flashcard mastery and check for level progression
export const updateFlashcardMastery = async (
    studentId: string,
    flashcardId: string,
    isCorrect: boolean
): Promise<MasteryResult> => {
    const { data, error } = await supabase
        .rpc('update_flashcard_mastery', {
            p_student_id: studentId,
            p_flashcard_id: flashcardId,
            p_is_correct: isCorrect
        });

    if (error) throw error;
    return data as MasteryResult;
};

// Get mastery stats for a study set
export const getStudySetMasteryStats = async (studentId: string, studySetId: string) => {
    const { data, error } = await supabase
        .from('flashcard_progress')
        .select(`
            difficulty_level,
            mastery_percent,
            correct_at_level,
            attempts_at_level,
            flashcard_id,
            flashcards!inner(
                id,
                question,
                answer,
                category,
                study_set_id
            )
        `)
        .eq('student_id', studentId)
        .eq('flashcards.study_set_id', studySetId);

    if (error) throw error;
    return data;
};

// Get flashcards with mastery info for adaptive study
export const getFlashcardsWithMastery = async (
    studentId: string,
    studySetId: string
): Promise<FlashcardWithMastery[]> => {
    // Get all flashcards
    const { data: flashcards, error: flashError } = await supabase
        .from('flashcards')
        .select('id, question, answer, category')
        .eq('study_set_id', studySetId);

    if (flashError) throw flashError;

    // Get progress for these flashcards
    const flashcardIds = flashcards?.map(f => f.id) || [];
    const { data: progress, error: progressError } = await supabase
        .from('flashcard_progress')
        .select('flashcard_id, difficulty_level, mastery_percent, correct_at_level, attempts_at_level')
        .eq('student_id', studentId)
        .in('flashcard_id', flashcardIds);

    if (progressError) throw progressError;

    // Create a map for quick lookup
    const progressMap = new Map(progress?.map(p => [p.flashcard_id, p]));

    // Merge flashcards with their progress
    return (flashcards || []).map(fc => ({
        ...fc,
        difficulty_level: progressMap.get(fc.id)?.difficulty_level || 1,
        mastery_percent: progressMap.get(fc.id)?.mastery_percent || 0,
        correct_at_level: progressMap.get(fc.id)?.correct_at_level || 0,
        attempts_at_level: progressMap.get(fc.id)?.attempts_at_level || 0
    }));
};

// Helper to get level display info
export const getDifficultyLevelInfo = (level: number) => {
    const levels = {
        1: { name: 'Básico', stars: '⭐', color: '#10b981' },
        2: { name: 'Intermedio', stars: '⭐⭐', color: '#3b82f6' },
        3: { name: 'Avanzado', stars: '⭐⭐⭐', color: '#8b5cf6' },
        4: { name: 'Experto', stars: '⭐⭐⭐⭐', color: '#f59e0b' }
    };
    return levels[level as keyof typeof levels] || levels[1];
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

    // Auto-create study set for the material
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        try {
            // We use the new helper defined at the end of file
            // Since this is called at runtime, the function reference will be available
            await createClassStudySet(classId, data.id, user.id, name, 'Material de clase generado automáticamente');
        } catch (err) {
            console.error('Error auto-creating study set:', err);
        }
    }

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
    infographic?: string;
    presentation?: string;
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

export const toggleStudySetEditor = async (studySetId: string, userId: string) => {
    const { error } = await supabase.rpc('toggle_study_set_editor', {
        set_id: studySetId,
        user_id: userId
    });

    if (error) throw error;
};

export const addFlashcardToStudySet = async (studySetId: string, flashcard: {
    question: string;
    answer: string;
    category?: string;
    is_ai_generated?: boolean;
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
    is_ai_generated?: boolean;
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

export const createMaterialWithFlashcards = async (params: {
    study_set_id: string;
    name: string;
    type: 'pdf' | 'manual' | 'url' | 'notes';
    content_text?: string;
    summary?: string;
    file_url?: string;
    flashcards: any[];
}) => {
    const { data, error } = await supabase
        .rpc('create_material_with_flashcards', {
            p_study_set_id: params.study_set_id,
            p_name: params.name,
            p_type: params.type,
            p_content_text: params.content_text || null,
            p_summary: params.summary || null,
            p_file_url: params.file_url || null,
            p_flashcards: params.flashcards
        });

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
    const { data: studySetData, error: setError } = await supabase
        .from('study_sets')
        .select(`
            *,
            teacher_id:classes(teacher_id)
        `)
        .eq('id', studySetId)
        .single();

    if (setError) throw setError;

    // Safe extraction of teacher_id from join
    const teacherData = (studySetData as any).teacher_id;
    let teacherId = null;
    if (teacherData) {
        teacherId = Array.isArray(teacherData) ? teacherData[0]?.teacher_id : teacherData?.teacher_id;
    }

    const studySet = {
        ...studySetData,
        teacher_id: teacherId
    };

    // 1. Fetch Flashcards (Robustly)
    let flashcardsQuery = supabase
        .from('flashcards')
        .select('*');

    if (studySet.source_material_id) {
        flashcardsQuery = flashcardsQuery.or(`study_set_id.eq.${studySetId},material_id.eq.${studySet.source_material_id}`);
    } else {
        flashcardsQuery = flashcardsQuery.eq('study_set_id', studySetId);
    }

    const { data: flashcards, error: flashError } = await flashcardsQuery;
    if (flashError) throw flashError;

    // 2. Fetch Materials
    const { data: materials, error: matError } = await supabase
        .from('study_set_materials')
        .select('*')
        .eq('study_set_id', studySetId)
        .order('created_at', { ascending: false });

    const safeMatError = matError?.code === '42P01' ? null : matError;
    if (safeMatError) throw safeMatError;

    // 3. Merge Materials with their respective flashcard count
    const materialsWithCounts = (materials || []).map(mat => ({
        ...mat,
        flashcards_generated: (flashcards || []).filter(fc => fc.material_id === mat.id).length
    }));

    return {
        ...studySet,
        flashcards: flashcards || [],
        materials: materialsWithCounts,
        flashcard_count: flashcards?.length || 0,
        material_count: materials?.length || 0
    };
};

// Class Study Set Integration Helpers
export const getClassStudySet = async (materialId: string) => {
    const { data, error } = await supabase
        .from('study_sets')
        .select(`
            *,
            flashcards (count),
            materials:study_set_materials (count)
        `)
        .eq('source_material_id', materialId)
        .single();

    if (error && error.code !== 'PGRST116') throw error; // Ignore no rows found
    return data;
};

export const createClassStudySet = async (
    classId: string,
    materialId: string,
    teacherId: string,
    title: string,
    description: string,
    flashcards: any[] = []
) => {
    let studySetMaterialId: string | null = null;
    // 1. Create the Study Set
    const { data: studySet, error: createError } = await supabase
        .from('study_sets')
        .insert({
            student_id: teacherId,
            class_id: classId,
            source_material_id: materialId,
            name: title,
            description: description || 'Material de estudio de la clase',
            is_public_to_class: true,
            icon: 'school',
            color: 'indigo'
        })
        .select()
        .single();

    if (createError) throw createError;

    // 2. Link existing flashcards
    // We assume flashcards might have been created via 'generateFlashcards' which sets material_id
    if (materialId) {
        const { error: updateError } = await supabase
            .from('flashcards')
            .update({ study_set_id: studySet.id })
            .eq('material_id', materialId);

        if (updateError) console.error("Error linking flashcards to set:", updateError);

        // 3. Automatically add the source material to study_set_materials
        try {
            const { data: material } = await supabase
                .from('materials')
                .select('*')
                .eq('id', materialId)
                .single();

            if (material) {
                let studySetType = 'manual';
                // Map types
                if (material.type === 'pdf') studySetType = 'pdf';
                else if (material.type === 'video' || material.type === 'link') studySetType = 'url';
                else if (material.type === 'doc' || material.type === 'text') studySetType = 'notes';

                // Check if already exists to avoid duplicates (though rare in this flow)
                const { count } = await supabase
                    .from('study_set_materials')
                    .select('*', { count: 'exact', head: true })
                    .eq('study_set_id', studySet.id)
                    .eq('name', material.name);

                if (count === 0) {
                    const { data: matData } = await supabase.from('study_set_materials').insert({
                        study_set_id: studySet.id,
                        name: material.name,
                        type: studySetType,
                        file_url: material.url || material.file_url,
                        content_text: material.content_text,
                        summary: material.summary,
                        flashcards_generated: material.flashcard_count || 0
                    }).select().single();
                    studySetMaterialId = matData?.id;
                }
            }
        } catch (matError) {
            console.error("Error auto-linking material to study set:", matError);
        }
    }

    // 4. Return both
    return { ...studySet, studySetMaterialId };
};

// ============================================
// FOLDER MANAGEMENT
// ============================================

export interface Folder {
    id: string;
    name: string;
    description?: string;
    parent_id: string | null;
    owner_id: string;
    class_id?: string | null;
    color?: string;
    icon?: string;
    created_at: string;
}

export const createFolder = async (folderData: {
    name: string;
    description?: string;
    parent_id?: string | null;
    owner_id: string;
    class_id?: string | null;
    color?: string;
    icon?: string;
}) => {
    const { data, error } = await supabase
        .from('folders')
        .insert(folderData)
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const getFolders = async (
    ownerId: string,
    parentId: string | null = null,
    classId: string | null = null
) => {
    let query = supabase
        .from('folders')
        .select('*')
        .eq('owner_id', ownerId);

    // Filter by parent_id (handling null for root)
    if (parentId) {
        query = query.eq('parent_id', parentId);
    } else {
        query = query.is('parent_id', null);
    }

    // Filter by class_id (handling null for personal study)
    if (classId) {
        query = query.eq('class_id', classId);
    } else {
        query = query.is('class_id', null);
    }

    const { data, error } = await query.order('name', { ascending: true });

    if (error) throw error;
    return data;
};

// Get study sets inside a folder (or root)
export const getFolderStudySets = async (
    ownerId: string,
    folderId: string | null = null,
    classId: string | null = null // Optional filtering by context
) => {
    let query = supabase
        .from('study_sets')
        .select('*')
        .eq('student_id', ownerId);

    if (folderId) {
        query = query.eq('folder_id', folderId);
    } else {
        query = query.is('folder_id', null);
    }

    // Default default ordering
    const { data, error } = await query.order('created_at', { ascending: false });

    // For root level, we might get everything if we don't filter carefully, 
    // but schema says study_sets don't strictly require class_id yet. 
    // Assuming personal sets for now.

    if (error) throw error;
    return data;
};

export const updateFolder = async (folderId: string, updates: Partial<Folder>) => {
    const { data, error } = await supabase
        .from('folders')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', folderId)
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const deleteFolder = async (folderId: string) => {
    // Recursive delete handled by DB CASCADE on parent_id and folder_id
    const { error } = await supabase
        .from('folders')
        .delete()
        .eq('id', folderId);

    if (error) throw error;
};

export const moveItem = async (
    itemId: string,
    type: 'folder' | 'set',
    newFolderId: string | null
) => {
    const table = type === 'folder' ? 'folders' : 'study_sets';
    const column = type === 'folder' ? 'parent_id' : 'folder_id';

    const { data, error } = await supabase
        .from(table)
        .update({ [column]: newFolderId, updated_at: new Date().toISOString() })
        .eq('id', itemId)
        .select()
        .single();

    if (error) throw error;
    return data;
};
