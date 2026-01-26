/**
 * Daily Summary Service
 * Generates and manages AI-powered daily study summaries
 */

import { supabase } from './supabaseClient';

// Types
export interface PendingAssignment {
  id: string;
  title: string;
  due_date: string;
  class_name: string;
  class_id: string;
}

export interface DailySummaryContent {
  greeting: string;
  cards_due: number;
  assignments_pending: PendingAssignment[];
  streak_status: {
    current: number;
    message: string;
    at_risk: boolean;
  };
  focus_recommendation: string;
  motivational_message: string;
  stats: {
    mastered_cards: number;
    learning_cards: number;
    recent_quiz_score: number | null;
  };
}

export interface DailySummary {
  id: string;
  user_id: string;
  summary_date: string;
  content: DailySummaryContent;
  generated_at: string;
  viewed_at: string | null;
}

export interface UserStudyData {
  userName: string;
  cardsDue: number;
  pendingAssignments: PendingAssignment[];
  streakDays: number;
  lastStudyDate: string | null;
  masteredCards: number;
  learningCards: number;
  recentQuizScore: number | null;
  recentAchievements: string[];
}

/**
 * Get today's summary for a user (if exists)
 */
export const getTodaySummary = async (userId: string): Promise<DailySummary | null> => {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('daily_summaries')
    .select('*')
    .eq('user_id', userId)
    .eq('summary_date', today)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching today summary:', error);
    return null;
  }

  return data;
};

/**
 * Mark summary as viewed
 */
export const markSummaryViewed = async (summaryId: string): Promise<void> => {
  const { error } = await supabase
    .from('daily_summaries')
    .update({ viewed_at: new Date().toISOString() })
    .eq('id', summaryId);

  if (error) {
    console.error('Error marking summary as viewed:', error);
  }
};

/**
 * Check if user has viewed today's summary
 */
export const hasViewedTodaySummary = async (userId: string): Promise<boolean> => {
  const summary = await getTodaySummary(userId);
  return summary?.viewed_at !== null;
};

/**
 * Gather all data needed for daily summary generation
 */
export const gatherUserData = async (userId: string): Promise<UserStudyData> => {
  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, streak_days, last_study_date')
    .eq('id', userId)
    .single();

  // Get cards due today
  const { count: cardsDue } = await supabase
    .from('flashcard_srs_data')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .lte('next_review_at', new Date().toISOString())
    .or('archived.is.null,archived.eq.false');

  // Get mastered cards count (stability > 30 days or mastery_level >= 4)
  const { count: masteredCards } = await supabase
    .from('flashcard_srs_data')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('mastery_level', 4);

  // Get learning cards count
  const { count: learningCards } = await supabase
    .from('flashcard_srs_data')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('state', ['learning', 'relearning']);

  // Get enrolled class IDs
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('class_id')
    .eq('student_id', userId)
    .eq('status', 'active');

  const classIds = enrollments?.map(e => e.class_id) || [];

  // Get pending assignments
  let pendingAssignments: PendingAssignment[] = [];
  if (classIds.length > 0) {
    const { data: assignments } = await supabase
      .from('assignments')
      .select(`
        id,
        title,
        due_date,
        class_id,
        classes!inner(name)
      `)
      .in('class_id', classIds)
      .eq('published', true)
      .gte('due_date', new Date().toISOString())
      .order('due_date', { ascending: true })
      .limit(5);

    if (assignments) {
      // Check which ones don't have submissions yet
      for (const assignment of assignments) {
        const { data: submission } = await supabase
          .from('assignment_submissions')
          .select('status')
          .eq('assignment_id', assignment.id)
          .eq('student_id', userId)
          .single();

        if (!submission || !['turned_in', 'graded'].includes(submission.status)) {
          pendingAssignments.push({
            id: assignment.id,
            title: assignment.title,
            due_date: assignment.due_date,
            class_name: (assignment.classes as any)?.name || 'Clase',
            class_id: assignment.class_id
          });
        }
      }
    }
  }

  // Get recent quiz score
  const { data: recentQuiz } = await supabase
    .from('quiz_attempts')
    .select('score, max_score')
    .eq('student_id', userId)
    .order('completed_at', { ascending: false })
    .limit(1)
    .single();

  const recentQuizScore = recentQuiz
    ? Math.round((recentQuiz.score / recentQuiz.max_score) * 100)
    : null;

  // Get recent achievements (last 7 days)
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { data: achievements } = await supabase
    .from('student_achievements')
    .select('achievements(name)')
    .eq('student_id', userId)
    .gte('earned_at', weekAgo.toISOString());

  const recentAchievements = achievements
    ?.map(a => (a.achievements as any)?.name)
    .filter(Boolean) || [];

  return {
    userName: profile?.full_name?.split(' ')[0] || 'Estudiante',
    cardsDue: cardsDue || 0,
    pendingAssignments,
    streakDays: profile?.streak_days || 0,
    lastStudyDate: profile?.last_study_date || null,
    masteredCards: masteredCards || 0,
    learningCards: learningCards || 0,
    recentQuizScore,
    recentAchievements
  };
};

/**
 * Generate greeting based on time of day
 */
const getTimeBasedGreeting = (name: string): string => {
  const hour = new Date().getHours();
  if (hour < 12) return `¡Buenos días, ${name}!`;
  if (hour < 18) return `¡Buenas tardes, ${name}!`;
  return `¡Buenas noches, ${name}!`;
};

/**
 * Generate streak message
 */
const getStreakMessage = (streakDays: number, lastStudyDate: string | null): { message: string; at_risk: boolean } => {
  if (streakDays === 0) {
    return { message: '¡Comienza tu racha hoy!', at_risk: false };
  }

  // Check if streak is at risk (last study was yesterday or earlier)
  const today = new Date().toDateString();
  const lastStudy = lastStudyDate ? new Date(lastStudyDate).toDateString() : null;
  const atRisk = lastStudy !== today;

  if (atRisk) {
    return {
      message: `⚠️ ¡Tu racha de ${streakDays} días está en riesgo! Estudia hoy para mantenerla.`,
      at_risk: true
    };
  }

  if (streakDays >= 30) {
    return { message: `🔥 ¡Increíble racha de ${streakDays} días! Eres imparable.`, at_risk: false };
  }
  if (streakDays >= 7) {
    return { message: `🔥 ¡${streakDays} días de racha! Sigue así.`, at_risk: false };
  }
  return { message: `🔥 Racha de ${streakDays} días. ¡Buen trabajo!`, at_risk: false };
};

/**
 * Generate focus recommendation based on data
 */
const getFocusRecommendation = (data: UserStudyData): string => {
  // Priority 1: Due flashcards
  if (data.cardsDue > 20) {
    return `Tienes ${data.cardsDue} tarjetas pendientes. Prioriza revisar al menos 20 hoy.`;
  }

  // Priority 2: Urgent assignments
  const urgentAssignments = data.pendingAssignments.filter(a => {
    const dueDate = new Date(a.due_date);
    const today = new Date();
    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 2;
  });

  if (urgentAssignments.length > 0) {
    return `¡Atención! Tienes ${urgentAssignments.length} tarea(s) con fecha límite próxima.`;
  }

  // Priority 3: Cards due
  if (data.cardsDue > 0) {
    return `Revisa tus ${data.cardsDue} tarjetas pendientes para mantener tu progreso.`;
  }

  // Priority 4: Learning cards
  if (data.learningCards > 0) {
    return `Tienes ${data.learningCards} tarjetas en aprendizaje. ¡Practica para dominarlas!`;
  }

  // Default
  return '¡Estás al día! Explora nuevo contenido o repasa temas anteriores.';
};

/**
 * Generate motivational message based on stats
 */
const getMotivationalMessage = (data: UserStudyData): string => {
  const messages = {
    highStreak: [
      '¡Tu dedicación es inspiradora!',
      '¡Eres un ejemplo de constancia!',
      '¡El éxito es tuyo, sigue así!'
    ],
    goodProgress: [
      '¡Cada día te acercas más a tus metas!',
      '¡Tu esfuerzo está dando frutos!',
      '¡Vas por excelente camino!'
    ],
    needsEncouragement: [
      '¡Hoy es un nuevo día para aprender!',
      '¡Un pequeño paso cada día hace la diferencia!',
      '¡Tú puedes, comienza ahora!'
    ],
    achievement: [
      '¡Felicidades por tus logros recientes!',
      '¡Sigue coleccionando logros!',
      '¡Eres increíble!'
    ]
  };

  if (data.recentAchievements.length > 0) {
    return messages.achievement[Math.floor(Math.random() * messages.achievement.length)];
  }
  if (data.streakDays >= 7) {
    return messages.highStreak[Math.floor(Math.random() * messages.highStreak.length)];
  }
  if (data.masteredCards > 10) {
    return messages.goodProgress[Math.floor(Math.random() * messages.goodProgress.length)];
  }
  return messages.needsEncouragement[Math.floor(Math.random() * messages.needsEncouragement.length)];
};

/**
 * Generate and save daily summary for a user
 */
export const generateDailySummary = async (userId: string): Promise<DailySummary | null> => {
  try {
    // Gather user data
    const userData = await gatherUserData(userId);

    // Generate content (without AI for now, using templates)
    const streakStatus = getStreakMessage(userData.streakDays, userData.lastStudyDate);

    const content: DailySummaryContent = {
      greeting: getTimeBasedGreeting(userData.userName),
      cards_due: userData.cardsDue,
      assignments_pending: userData.pendingAssignments,
      streak_status: {
        current: userData.streakDays,
        message: streakStatus.message,
        at_risk: streakStatus.at_risk
      },
      focus_recommendation: getFocusRecommendation(userData),
      motivational_message: getMotivationalMessage(userData),
      stats: {
        mastered_cards: userData.masteredCards,
        learning_cards: userData.learningCards,
        recent_quiz_score: userData.recentQuizScore
      }
    };

    // Save to database
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('daily_summaries')
      .upsert({
        user_id: userId,
        summary_date: today,
        content,
        generated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,summary_date'
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving daily summary:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error generating daily summary:', error);
    return null;
  }
};

/**
 * Get or generate today's summary
 */
export const getOrGenerateTodaySummary = async (userId: string): Promise<DailySummary | null> => {
  // Try to get existing summary
  const existing = await getTodaySummary(userId);
  if (existing) return existing;

  // Generate new one
  return generateDailySummary(userId);
};
