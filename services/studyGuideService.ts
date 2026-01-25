/**
 * Study Guide Service
 * Handles CRUD operations for study guide reading progress
 */

import { supabase } from './supabaseClient';
import type { StudyGuideProgress } from '../components/StudyGuideRenderer/types';

/**
 * Get all reading progress for a student's study set
 */
export const getStudyGuideProgress = async (
  studentId: string,
  studySetId: string
): Promise<StudyGuideProgress[]> => {
  const { data, error } = await supabase
    .from('study_guide_progress')
    .select('*')
    .eq('student_id', studentId)
    .eq('study_set_id', studySetId);

  if (error) {
    console.error('Error fetching study guide progress:', error);
    throw error;
  }

  return data || [];
};

/**
 * Mark a section as read
 * Uses upsert to create or update the progress record
 */
export const markSectionAsRead = async (
  studentId: string,
  studySetId: string,
  sectionId: string,
  sectionTitle: string
): Promise<StudyGuideProgress | null> => {
  const { data, error } = await supabase
    .from('study_guide_progress')
    .upsert(
      {
        student_id: studentId,
        study_set_id: studySetId,
        section_id: sectionId,
        section_title: sectionTitle,
        is_read: true,
        read_at: new Date().toISOString()
      },
      {
        onConflict: 'student_id, study_set_id, section_id'
      }
    )
    .select()
    .single();

  if (error) {
    console.error('Error marking section as read:', error);
    throw error;
  }

  return data;
};

/**
 * Mark a section as unread (reset progress)
 */
export const markSectionAsUnread = async (
  studentId: string,
  studySetId: string,
  sectionId: string
): Promise<void> => {
  const { error } = await supabase
    .from('study_guide_progress')
    .update({
      is_read: false,
      read_at: null
    })
    .eq('student_id', studentId)
    .eq('study_set_id', studySetId)
    .eq('section_id', sectionId);

  if (error) {
    console.error('Error marking section as unread:', error);
    throw error;
  }
};

/**
 * Get reading progress percentage for a study guide
 */
export const getReadingProgressPercent = async (
  studentId: string,
  studySetId: string,
  totalSections: number
): Promise<number> => {
  if (totalSections <= 0) return 0;

  const { count, error } = await supabase
    .from('study_guide_progress')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .eq('study_set_id', studySetId)
    .eq('is_read', true);

  if (error) {
    console.error('Error getting reading progress percent:', error);
    return 0;
  }

  return Math.round(((count || 0) / totalSections) * 100);
};

/**
 * Reset all reading progress for a study guide
 */
export const resetStudyGuideProgress = async (
  studentId: string,
  studySetId: string
): Promise<void> => {
  const { error } = await supabase
    .from('study_guide_progress')
    .delete()
    .eq('student_id', studentId)
    .eq('study_set_id', studySetId);

  if (error) {
    console.error('Error resetting study guide progress:', error);
    throw error;
  }
};

/**
 * Batch mark multiple sections as read
 */
export const markMultipleSectionsAsRead = async (
  studentId: string,
  studySetId: string,
  sections: { sectionId: string; sectionTitle: string }[]
): Promise<void> => {
  const records = sections.map(s => ({
    student_id: studentId,
    study_set_id: studySetId,
    section_id: s.sectionId,
    section_title: s.sectionTitle,
    is_read: true,
    read_at: new Date().toISOString()
  }));

  const { error } = await supabase
    .from('study_guide_progress')
    .upsert(records, {
      onConflict: 'student_id, study_set_id, section_id'
    });

  if (error) {
    console.error('Error batch marking sections as read:', error);
    throw error;
  }
};
