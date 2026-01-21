import { supabase } from './supabaseClient';

// ============================================
// TYPES
// ============================================

export interface ClassTopic {
    id: string;
    class_id: string;
    name: string;
    description?: string;
    order_index: number;
    created_at: string;
}

export interface Announcement {
    id: string;
    class_id: string;
    teacher_id: string;
    title?: string;
    content: string;
    pinned: boolean;
    allow_comments: boolean;
    scheduled_for?: string;
    attachments: any[];
    published: boolean;
    created_at: string;
    teacher?: {
        full_name: string;
        avatar_url?: string;
    };
    comments?: AnnouncementComment[];
    comments_count?: number;
}

export interface AnnouncementComment {
    id: string;
    announcement_id: string;
    author_id: string;
    content: string;
    created_at: string;
    author?: {
        full_name: string;
        avatar_url?: string;
    };
}

export interface Assignment {
    id: string;
    class_id: string;
    topic_id?: string;
    title: string;
    description?: string;
    instructions?: string;
    points: number;
    due_date?: string;
    due_time?: string;
    scheduled_publish?: string;
    allow_late_submissions: boolean;
    late_penalty_percent: number;
    attachments: any[];
    attached_materials: string[];
    attached_flashcard_sets: string[];
    type: 'assignment' | 'quiz_assignment' | 'material' | 'discussion';
    published: boolean;
    created_at: string;
    topic?: ClassTopic;
    submissions_count?: number;
    graded_count?: number;
}

export interface AssignmentSubmission {
    id: string;
    assignment_id: string;
    student_id: string;
    status: 'assigned' | 'in_progress' | 'turned_in' | 'graded' | 'returned' | 'missing';
    submitted_at?: string;
    attachments: any[];
    text_response?: string;
    link_response?: string;
    grade?: number;
    grade_percent?: number;
    feedback?: string;
    private_notes?: string;
    graded_at?: string;
    is_late: boolean;
    student?: {
        id: string;
        full_name: string;
        avatar_url?: string;
        email: string;
    };
}

export interface ScheduledExam {
    id: string;
    class_id: string;
    quiz_id: string;
    topic_id?: string;
    title: string;
    instructions?: string;
    start_time: string;
    end_time: string;
    duration_minutes: number;
    allow_retakes: boolean;
    max_attempts: number;
    shuffle_questions: boolean;
    shuffle_options: boolean;
    show_results_immediately: boolean;
    show_correct_answers: boolean;
    require_webcam: boolean;
    passcode?: string;
    published: boolean;
    created_at: string;
    quiz?: {
        name: string;
        type: string;
    };
}

export interface Rubric {
    id: string;
    teacher_id: string;
    name: string;
    description?: string;
    criteria: RubricCriterion[];
    max_points: number;
    is_template: boolean;
    created_at: string;
}

export interface RubricCriterion {
    name: string;
    points: number;
    levels: {
        score: number;
        description: string;
    }[];
}

export interface StudentGroup {
    id: string;
    class_id: string;
    name: string;
    description?: string;
    color: string;
    members?: { student_id: string; student?: any }[];
}

// ============================================
// CLASS MATERIALS
// ============================================

export async function getClassMaterials(classId: string): Promise<any[]> {
    const { data, error } = await supabase
        .from('materials')
        .select('*')
        .eq('class_id', classId)
        .neq('status', 'error')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

// ============================================
// CLASS TOPICS
// ============================================

export async function getClassTopics(classId: string): Promise<ClassTopic[]> {
    const { data, error } = await supabase
        .from('class_topics')
        .select('*')
        .eq('class_id', classId)
        .order('order_index');

    if (error) throw error;
    return data || [];
}

export async function createTopic(classId: string, name: string, description?: string): Promise<ClassTopic> {
    // Get max order_index
    const { data: existing } = await supabase
        .from('class_topics')
        .select('order_index')
        .eq('class_id', classId)
        .order('order_index', { ascending: false })
        .limit(1);

    const nextOrder = existing && existing.length > 0 ? existing[0].order_index + 1 : 0;

    const { data, error } = await supabase
        .from('class_topics')
        .insert({ class_id: classId, name, description, order_index: nextOrder })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function updateTopic(topicId: string, updates: Partial<ClassTopic>): Promise<ClassTopic> {
    const { data, error } = await supabase
        .from('class_topics')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', topicId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deleteTopic(topicId: string): Promise<void> {
    const { error } = await supabase.from('class_topics').delete().eq('id', topicId);
    if (error) throw error;
}

export async function reorderTopics(classId: string, topicIds: string[]): Promise<void> {
    const updates = topicIds.map((id, index) => ({ id, order_index: index }));

    for (const update of updates) {
        await supabase.from('class_topics').update({ order_index: update.order_index }).eq('id', update.id);
    }
}

// ============================================
// ANNOUNCEMENTS
// ============================================

export async function getClassAnnouncements(classId: string): Promise<Announcement[]> {
    const { data, error } = await supabase
        .from('announcements')
        .select(`
      *,
      teacher:profiles!teacher_id(full_name, avatar_url),
      comments:announcement_comments(count)
    `)
        .eq('class_id', classId)
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((a: any) => ({
        ...a,
        comments_count: a.comments?.[0]?.count || 0
    }));
}

export async function createAnnouncement(data: {
    class_id: string;
    teacher_id: string;
    title?: string;
    content: string;
    pinned?: boolean;
    allow_comments?: boolean;
    scheduled_for?: string;
    attachments?: any[];
}): Promise<Announcement> {
    const { data: result, error } = await supabase
        .from('announcements')
        .insert({
            ...data,
            published: !data.scheduled_for || new Date(data.scheduled_for) <= new Date()
        })
        .select(`*, teacher:profiles!teacher_id(full_name, avatar_url)`)
        .single();

    if (error) throw error;
    return result;
}

export async function updateAnnouncement(id: string, updates: Partial<Announcement>): Promise<Announcement> {
    const { data, error } = await supabase
        .from('announcements')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deleteAnnouncement(id: string): Promise<void> {
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) throw error;
}

export async function getAnnouncementComments(announcementId: string): Promise<AnnouncementComment[]> {
    const { data, error } = await supabase
        .from('announcement_comments')
        .select(`*, author:profiles!author_id(full_name, avatar_url)`)
        .eq('announcement_id', announcementId)
        .order('created_at');

    if (error) throw error;
    return data || [];
}

export async function addComment(announcementId: string, authorId: string, content: string): Promise<AnnouncementComment> {
    const { data, error } = await supabase
        .from('announcement_comments')
        .insert({ announcement_id: announcementId, author_id: authorId, content })
        .select(`*, author:profiles!author_id(full_name, avatar_url)`)
        .single();

    if (error) throw error;
    return data;
}

export async function deleteComment(commentId: string): Promise<void> {
    const { error } = await supabase.from('announcement_comments').delete().eq('id', commentId);
    if (error) throw error;
}

// ============================================
// ASSIGNMENTS
// ============================================

export async function getClassAssignments(classId: string, topicId?: string): Promise<Assignment[]> {
    let query = supabase
        .from('assignments')
        .select(`
      *,
      topic:class_topics(id, name),
      submissions:assignment_submissions(count)
    `)
        .eq('class_id', classId)
        .order('created_at', { ascending: false });

    if (topicId) {
        query = query.eq('topic_id', topicId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((a: any) => ({
        ...a,
        submissions_count: a.submissions?.[0]?.count || 0
    }));
}

export async function getAssignment(assignmentId: string): Promise<Assignment> {
    const { data, error } = await supabase
        .from('assignments')
        .select(`*, topic:class_topics(id, name)`)
        .eq('id', assignmentId)
        .single();

    if (error) throw error;
    return data;
}

export async function createAssignment(data: Partial<Assignment>): Promise<Assignment> {
    const { data: result, error } = await supabase
        .from('assignments')
        .insert(data)
        .select()
        .single();

    if (error) throw error;
    return result;
}

export async function updateAssignment(id: string, updates: Partial<Assignment>): Promise<Assignment> {
    const { data, error } = await supabase
        .from('assignments')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deleteAssignment(id: string): Promise<void> {
    const { error } = await supabase.from('assignments').delete().eq('id', id);
    if (error) throw error;
}

export async function publishAssignment(id: string): Promise<Assignment> {
    return updateAssignment(id, { published: true });
}

// ============================================
// SUBMISSIONS
// ============================================

export async function getAssignmentSubmissions(assignmentId: string): Promise<AssignmentSubmission[]> {
    const { data, error } = await supabase
        .from('assignment_submissions')
        .select(`
      *,
      student:profiles!student_id(id, full_name, avatar_url, email)
    `)
        .eq('assignment_id', assignmentId)
        .order('submitted_at', { ascending: false, nullsFirst: false });

    if (error) throw error;
    return data || [];
}

export async function getStudentSubmission(assignmentId: string, studentId: string): Promise<AssignmentSubmission | null> {
    const { data, error } = await supabase
        .from('assignment_submissions')
        .select(`
      *,
      student:profiles!student_id(id, full_name, avatar_url, email)
    `)
        .eq('assignment_id', assignmentId)
        .eq('student_id', studentId)
        .maybeSingle();

    if (error) throw error;
    return data;
}

export async function getSubmission(submissionId: string): Promise<AssignmentSubmission> {
    const { data, error } = await supabase
        .from('assignment_submissions')
        .select(`*, student:profiles!student_id(id, full_name, avatar_url, email)`)
        .eq('id', submissionId)
        .single();

    if (error) throw error;
    return data;
}

export async function submitAssignment(submissionId: string, submission: {
    text_response?: string;
    link_response?: string;
    attachments?: any[];
}): Promise<AssignmentSubmission> {
    // Check if late
    const { data: sub } = await supabase
        .from('assignment_submissions')
        .select('assignment:assignments(due_date)')
        .eq('id', submissionId)
        .single();

    const assignment: any = sub?.assignment;
    const dueDate = Array.isArray(assignment) ? assignment[0]?.due_date : assignment?.due_date;
    const isLate = dueDate && new Date(dueDate) < new Date();

    const { data, error } = await supabase
        .from('assignment_submissions')
        .update({
            ...submission,
            status: 'turned_in',
            submitted_at: new Date().toISOString(),
            is_late: isLate,
            updated_at: new Date().toISOString()
        })
        .eq('id', submissionId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function gradeSubmission(
    submissionId: string,
    grade: number,
    feedback?: string,
    privateNotes?: string
): Promise<AssignmentSubmission> {
    const { data: user } = await supabase.auth.getUser();

    const { data, error } = await supabase
        .from('assignment_submissions')
        .update({
            grade,
            feedback,
            private_notes: privateNotes,
            status: 'graded',
            graded_at: new Date().toISOString(),
            graded_by: user?.user?.id,
            updated_at: new Date().toISOString()
        })
        .eq('id', submissionId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function returnSubmission(submissionId: string): Promise<AssignmentSubmission> {
    const { data, error } = await supabase
        .from('assignment_submissions')
        .update({
            status: 'returned',
            returned_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .eq('id', submissionId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function bulkGrade(assignmentId: string, grade: number): Promise<void> {
    const { error } = await supabase
        .from('assignment_submissions')
        .update({
            grade,
            status: 'graded',
            graded_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .eq('assignment_id', assignmentId)
        .eq('status', 'turned_in');

    if (error) throw error;
}

// ============================================
// SCHEDULED EXAMS
// ============================================

export async function getClassExams(classId: string): Promise<ScheduledExam[]> {
    const { data, error } = await supabase
        .from('scheduled_exams')
        .select(`*, quiz:quizzes(name, type)`)
        .eq('class_id', classId)
        .order('start_time');

    if (error) throw error;
    return data || [];
}

export async function getUpcomingExams(classId: string): Promise<ScheduledExam[]> {
    const { data, error } = await supabase
        .from('scheduled_exams')
        .select(`*, quiz:quizzes(name, type)`)
        .eq('class_id', classId)
        .eq('published', true)
        .gte('end_time', new Date().toISOString())
        .order('start_time');

    if (error) throw error;
    return data || [];
}

export async function scheduleExam(data: Partial<ScheduledExam>): Promise<ScheduledExam> {
    const { data: result, error } = await supabase
        .from('scheduled_exams')
        .insert(data)
        .select()
        .single();

    if (error) throw error;
    return result;
}

export async function updateScheduledExam(id: string, updates: Partial<ScheduledExam>): Promise<ScheduledExam> {
    const { data, error } = await supabase
        .from('scheduled_exams')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deleteScheduledExam(id: string): Promise<void> {
    const { error } = await supabase.from('scheduled_exams').delete().eq('id', id);
    if (error) throw error;
}

// ============================================
// RUBRICS
// ============================================

export async function getTeacherRubrics(teacherId: string): Promise<Rubric[]> {
    const { data, error } = await supabase
        .from('rubrics')
        .select('*')
        .or(`teacher_id.eq.${teacherId},is_template.eq.true`)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

export async function createRubric(data: Partial<Rubric>): Promise<Rubric> {
    const { data: result, error } = await supabase
        .from('rubrics')
        .insert(data)
        .select()
        .single();

    if (error) throw error;
    return result;
}

export async function updateRubric(id: string, updates: Partial<Rubric>): Promise<Rubric> {
    const { data, error } = await supabase
        .from('rubrics')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deleteRubric(id: string): Promise<void> {
    const { error } = await supabase.from('rubrics').delete().eq('id', id);
    if (error) throw error;
}

export async function linkRubricToAssignment(assignmentId: string, rubricId: string): Promise<void> {
    const { error } = await supabase
        .from('assignment_rubrics')
        .upsert({ assignment_id: assignmentId, rubric_id: rubricId });

    if (error) throw error;
}

// ============================================
// STUDENT GROUPS
// ============================================

export async function getClassStudentGroups(classId: string): Promise<StudentGroup[]> {
    const { data, error } = await supabase
        .from('student_groups')
        .select(`
      *,
      members:student_group_members(
        student_id,
        student:profiles(id, full_name, avatar_url)
      )
    `)
        .eq('class_id', classId)
        .order('created_at');

    if (error) throw error;
    return data || [];
}

export async function createStudentGroup(classId: string, name: string, color?: string): Promise<StudentGroup> {
    const { data, error } = await supabase
        .from('student_groups')
        .insert({ class_id: classId, name, color: color || '#8B5CF6' })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function addStudentToGroup(groupId: string, studentId: string): Promise<void> {
    const { error } = await supabase
        .from('student_group_members')
        .insert({ group_id: groupId, student_id: studentId });

    if (error) throw error;
}

export async function removeStudentFromGroup(groupId: string, studentId: string): Promise<void> {
    const { error } = await supabase
        .from('student_group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('student_id', studentId);

    if (error) throw error;
}

export async function deleteStudentGroup(groupId: string): Promise<void> {
    const { error } = await supabase.from('student_groups').delete().eq('id', groupId);
    if (error) throw error;
}

// ============================================
// ANALYTICS
// ============================================

export async function getClassAnalytics(classId: string) {
    // Get enrollment count
    const { count: studentCount } = await supabase
        .from('enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('class_id', classId);

    // Get assignment stats
    const { data: assignments } = await supabase
        .from('assignments')
        .select('id, title, points')
        .eq('class_id', classId)
        .eq('published', true);

    // Get submission stats
    const { data: submissions } = await supabase
        .from('assignment_submissions')
        .select('status, grade, assignment_id')
        .in('assignment_id', (assignments || []).map(a => a.id));

    const totalSubmissions = submissions?.length || 0;
    const gradedSubmissions = submissions?.filter(s => s.status === 'graded').length || 0;
    const turnedIn = submissions?.filter(s => s.status === 'turned_in' || s.status === 'graded').length || 0;
    const averageGrade = gradedSubmissions > 0
        ? submissions!.filter(s => s.grade !== null).reduce((sum, s) => sum + (s.grade || 0), 0) / gradedSubmissions
        : 0;

    // Get recent study sessions
    const { data: sessions } = await supabase
        .from('study_sessions')
        .select('*')
        .eq('class_id', classId)
        .order('completed_at', { ascending: false })
        .limit(100);

    const totalStudyTime = sessions?.reduce((sum, s) => sum + s.duration_seconds, 0) || 0;
    const avgAccuracy = sessions && sessions.length > 0
        ? sessions.reduce((sum, s) => sum + (s.correct_count / Math.max(s.cards_reviewed, 1) * 100), 0) / sessions.length
        : 0;

    return {
        studentCount: studentCount || 0,
        assignmentCount: assignments?.length || 0,
        totalSubmissions,
        gradedSubmissions,
        turnedIn,
        averageGrade: Math.round(averageGrade * 10) / 10,
        submissionRate: totalSubmissions > 0 ? Math.round((turnedIn / totalSubmissions) * 100) : 0,
        totalStudyTime,
        avgAccuracy: Math.round(avgAccuracy)
    };
}

export async function getStudentClassProgress(classId: string, studentId: string) {
    // Get all assignments for this class
    const { data: assignments } = await supabase
        .from('assignments')
        .select('id, title, points, due_date')
        .eq('class_id', classId)
        .eq('published', true);

    // Get student submissions
    const { data: submissions } = await supabase
        .from('assignment_submissions')
        .select('*')
        .eq('student_id', studentId)
        .in('assignment_id', (assignments || []).map(a => a.id));

    // Get study sessions
    const { data: sessions } = await supabase
        .from('study_sessions')
        .select('*')
        .eq('class_id', classId)
        .eq('student_id', studentId);

    const completedAssignments = submissions?.filter(s => s.status === 'turned_in' || s.status === 'graded').length || 0;
    const totalPoints = assignments?.reduce((sum, a) => sum + a.points, 0) || 0;
    const earnedPoints = submissions?.filter(s => s.grade !== null).reduce((sum, s) => sum + (s.grade || 0), 0) || 0;
    const totalStudyTime = sessions?.reduce((sum, s) => sum + s.duration_seconds, 0) || 0;

    return {
        totalAssignments: assignments?.length || 0,
        completedAssignments,
        totalPoints,
        earnedPoints,
        gradePercent: totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0,
        totalStudyTime,
        sessionsCount: sessions?.length || 0,
        submissions: submissions || []
    };
}

// ============================================
// AI ENHANCEMENTS
// ============================================

interface AtRiskStudent {
    studentId: string;
    studentName: string;
    studentEmail: string;
    riskScore: number; // 0-100, higher = more at risk
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    riskFactors: string[];
    lastActivity?: string;
    missedAssignments: number;
    averageGrade?: number;
    studyTimeMinutes: number;
}

export async function getAtRiskStudents(classId: string): Promise<AtRiskStudent[]> {
    // Get all enrolled students
    const { data: enrollments } = await supabase
        .from('enrollments')
        .select(`
            student_id,
            progress,
            profiles:profiles!student_id(id, full_name, email, updated_at)
        `)
        .eq('class_id', classId);

    if (!enrollments || enrollments.length === 0) return [];

    // Get published assignments
    const { data: assignments } = await supabase
        .from('assignments')
        .select('id, points, due_date')
        .eq('class_id', classId)
        .eq('published', true);

    const assignmentIds = (assignments || []).map(a => a.id);

    // Get all submissions
    const { data: allSubmissions } = await supabase
        .from('assignment_submissions')
        .select('student_id, assignment_id, status, grade, submitted_at')
        .in('assignment_id', assignmentIds.length > 0 ? assignmentIds : ['no-ids']);

    // Get recent study sessions (last 14 days)
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const { data: recentSessions } = await supabase
        .from('study_sessions')
        .select('student_id, duration_seconds, completed_at')
        .eq('class_id', classId)
        .gte('completed_at', twoWeeksAgo.toISOString());

    const atRiskStudents: AtRiskStudent[] = [];

    for (const enrollment of enrollments) {
        const profile = enrollment.profiles as any;
        if (!profile) continue;

        const studentId = enrollment.student_id;
        const riskFactors: string[] = [];
        let riskScore = 0;

        // Factor 1: Submission rate
        const studentSubmissions = allSubmissions?.filter(s => s.student_id === studentId) || [];
        const submittedCount = studentSubmissions.filter(s =>
            s.status === 'turned_in' || s.status === 'graded' || s.status === 'returned'
        ).length;
        const missedCount = studentSubmissions.filter(s => s.status === 'missing').length;
        const totalAssignments = assignments?.length || 0;

        if (totalAssignments > 0) {
            const submissionRate = submittedCount / totalAssignments;
            if (submissionRate < 0.5) {
                riskScore += 30;
                riskFactors.push(`Solo ${Math.round(submissionRate * 100)}% de tareas entregadas`);
            } else if (submissionRate < 0.75) {
                riskScore += 15;
                riskFactors.push(`${Math.round(submissionRate * 100)}% de tareas entregadas`);
            }
        }

        // Factor 2: Missing assignments
        if (missedCount >= 3) {
            riskScore += 25;
            riskFactors.push(`${missedCount} tareas no entregadas`);
        } else if (missedCount >= 1) {
            riskScore += 10;
            riskFactors.push(`${missedCount} tarea(s) no entregada(s)`);
        }

        // Factor 3: Average grade
        const gradedSubmissions = studentSubmissions.filter(s => s.grade !== null && s.grade !== undefined);
        let averageGrade: number | undefined;
        if (gradedSubmissions.length > 0) {
            const totalEarned = gradedSubmissions.reduce((sum, s) => sum + (s.grade || 0), 0);
            const totalPossible = gradedSubmissions.length * 100; // Assume normalized to 100
            averageGrade = Math.round((totalEarned / gradedSubmissions.length));

            if (averageGrade < 60) {
                riskScore += 30;
                riskFactors.push(`Promedio bajo: ${averageGrade}%`);
            } else if (averageGrade < 70) {
                riskScore += 15;
                riskFactors.push(`Promedio en riesgo: ${averageGrade}%`);
            }
        }

        // Factor 4: Study time in last 2 weeks
        const studentSessions = recentSessions?.filter(s => s.student_id === studentId) || [];
        const studyTimeSeconds = studentSessions.reduce((sum, s) => sum + s.duration_seconds, 0);
        const studyTimeMinutes = Math.round(studyTimeSeconds / 60);

        if (studyTimeMinutes < 30) {
            riskScore += 20;
            riskFactors.push(`Solo ${studyTimeMinutes} min de estudio en 2 semanas`);
        } else if (studyTimeMinutes < 60) {
            riskScore += 10;
            riskFactors.push(`${studyTimeMinutes} min de estudio en 2 semanas`);
        }

        // Factor 5: Last activity
        const lastSession = studentSessions
            .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())[0];
        const lastSubmission = studentSubmissions
            .filter(s => s.submitted_at)
            .sort((a, b) => new Date(b.submitted_at!).getTime() - new Date(a.submitted_at!).getTime())[0];

        const lastActivityDate = lastSession?.completed_at || lastSubmission?.submitted_at || profile.updated_at;
        const daysSinceActivity = lastActivityDate
            ? Math.floor((Date.now() - new Date(lastActivityDate).getTime()) / (1000 * 60 * 60 * 24))
            : 999;

        if (daysSinceActivity > 14) {
            riskScore += 25;
            riskFactors.push(`Sin actividad por ${daysSinceActivity} días`);
        } else if (daysSinceActivity > 7) {
            riskScore += 10;
            riskFactors.push(`${daysSinceActivity} días sin actividad`);
        }

        // Determine risk level
        let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
        if (riskScore >= 70) riskLevel = 'critical';
        else if (riskScore >= 50) riskLevel = 'high';
        else if (riskScore >= 25) riskLevel = 'medium';

        // Only include students with some risk
        if (riskScore >= 15 || riskFactors.length > 0) {
            atRiskStudents.push({
                studentId,
                studentName: profile.full_name || 'Estudiante',
                studentEmail: profile.email || '',
                riskScore: Math.min(riskScore, 100),
                riskLevel,
                riskFactors,
                lastActivity: lastActivityDate,
                missedAssignments: missedCount,
                averageGrade,
                studyTimeMinutes
            });
        }
    }

    // Sort by risk score (highest first)
    return atRiskStudents.sort((a, b) => b.riskScore - a.riskScore);
}

// Get suggested interventions for at-risk students
export function getSuggestedInterventions(student: AtRiskStudent): string[] {
    const interventions: string[] = [];

    if (student.missedAssignments >= 2) {
        interventions.push('📧 Enviar recordatorio personalizado sobre tareas pendientes');
    }
    if (student.averageGrade && student.averageGrade < 70) {
        interventions.push('📚 Recomendar sesión de tutoría o materiales de refuerzo');
    }
    if (student.studyTimeMinutes < 60) {
        interventions.push('⏰ Sugerir horario de estudio estructurado');
    }
    if (student.riskLevel === 'critical') {
        interventions.push('📞 Programar reunión individual con el estudiante');
        interventions.push('👨‍👩‍👧 Considerar contactar al tutor/padre si aplica');
    }
    if (student.riskFactors.some(f => f.includes('Sin actividad'))) {
        interventions.push('🔔 Enviar mensaje de seguimiento para verificar situación');
    }

    return interventions;
}

// Get class performance summary for AI insights
export async function getClassPerformanceSummary(classId: string) {
    const analytics = await getClassAnalytics(classId);
    const atRiskStudents = await getAtRiskStudents(classId);

    const criticalCount = atRiskStudents.filter(s => s.riskLevel === 'critical').length;
    const highRiskCount = atRiskStudents.filter(s => s.riskLevel === 'high').length;
    const mediumRiskCount = atRiskStudents.filter(s => s.riskLevel === 'medium').length;

    // Identify common risk factors
    const factorCounts: Record<string, number> = {};
    atRiskStudents.forEach(s => {
        s.riskFactors.forEach(f => {
            const key = f.split(':')[0].split(' ')[0]; // Simplify factor
            factorCounts[key] = (factorCounts[key] || 0) + 1;
        });
    });

    const commonIssues = Object.entries(factorCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([issue, count]) => ({ issue, count }));

    return {
        ...analytics,
        atRiskStudents: atRiskStudents.length,
        criticalCount,
        highRiskCount,
        mediumRiskCount,
        commonIssues,
        healthScore: Math.max(0, 100 - (criticalCount * 15) - (highRiskCount * 10) - (mediumRiskCount * 5))
    };
}

