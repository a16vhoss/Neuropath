/**
 * Custom hook for managing study guide reading progress
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getStudyGuideProgress, markSectionAsRead } from '../../services/studyGuideService';
import type { ParsedSection } from './types';

interface UseStudyGuideProgressReturn {
  progressMap: Map<string, boolean>;
  markAsRead: (sectionId: string, sectionTitle: string) => Promise<void>;
  progressPercent: number;
  readCount: number;
  totalSections: number;
  loading: boolean;
}

export const useStudyGuideProgress = (
  studySetId: string,
  sections: ParsedSection[]
): UseStudyGuideProgressReturn => {
  const { user } = useAuth();
  const [progressMap, setProgressMap] = useState<Map<string, boolean>>(new Map());
  const [loading, setLoading] = useState(true);

  // Count H1/H2 sections for progress (main collapsible sections)
  const mainSections = sections.filter(s => s.level === 1 || s.level === 2);
  const totalSections = mainSections.length;

  // Load initial progress from database
  useEffect(() => {
    const loadProgress = async () => {
      if (!user?.id || !studySetId) {
        setLoading(false);
        return;
      }

      try {
        const progress = await getStudyGuideProgress(user.id, studySetId);
        const map = new Map<string, boolean>();
        progress.forEach(p => map.set(p.section_id, p.is_read));
        setProgressMap(map);
      } catch (error) {
        console.error('Error loading study guide progress:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProgress();
  }, [user?.id, studySetId]);

  // Mark a section as read
  const markAsRead = useCallback(async (sectionId: string, sectionTitle: string) => {
    if (!user?.id || progressMap.get(sectionId)) return;

    // Optimistic update
    setProgressMap(prev => new Map(prev).set(sectionId, true));

    try {
      await markSectionAsRead(user.id, studySetId, sectionId, sectionTitle);
    } catch (error) {
      console.error('Error marking section as read:', error);
      // Revert on error
      setProgressMap(prev => {
        const newMap = new Map(prev);
        newMap.delete(sectionId);
        return newMap;
      });
    }
  }, [user?.id, studySetId, progressMap]);

  // Calculate progress
  const readCount = mainSections.filter(s => progressMap.get(s.id)).length;
  const progressPercent = totalSections > 0 ? Math.round((readCount / totalSections) * 100) : 0;

  return {
    progressMap,
    markAsRead,
    progressPercent,
    readCount,
    totalSections,
    loading
  };
};

export default useStudyGuideProgress;
