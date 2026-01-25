/**
 * Enhanced Study Guide Renderer
 * Features:
 * - Collapsible H2 sections (collapsed by default)
 * - Floating Table of Contents with scroll sync
 * - Reading progress tracking
 * - Interactive Mind Map visualization
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { StudyGuideRendererProps, ParsedSection, SectionType } from './types';
import StudyGuideTOC from './StudyGuideTOC';
import StudyGuideSection from './StudyGuideSection';
import StudyGuideMindMap from './StudyGuideMindMap';
import { useStudyGuideProgress } from './useStudyGuideProgress';

// Determine section type based on title content
const getSectionType = (title: string): SectionType => {
  if (title.includes('PANORAMA GENERAL') || title.includes('SECCIÓN 1')) return 'overview';
  if (title.includes('DESARROLLO CONCEPTUAL') || title.includes('SECCIÓN 2')) return 'concept';
  if (title.includes('INTEGRACIÓN') || title.includes('SECCIÓN 3')) return 'integration';
  if (title.includes('HERRAMIENTAS') || title.includes('SECCIÓN 4')) return 'tools';
  if (title.includes('PRÁCTICA') || title.includes('SECCIÓN 5')) return 'practice';
  if (title.includes('AUTOEVALUACIÓN') || title.includes('SECCIÓN 6')) return 'exam';
  if (title.includes('PUNTOS CRÍTICOS') || title.includes('SECCIÓN 7')) return 'warning';
  if (title.includes('INFOGRAFÍA') || title.includes('TÍTULO IMPACTANTE')) return 'infographic';
  if (title.includes('SLIDE') || title.includes('DIAPOSITIVA')) return 'presentation';
  return 'general';
};

// Parse markdown content into sections with nested H3/H4 inside H2
const parseContent = (text: string): ParsedSection[] => {
  const lines = text.split('\n');
  const sections: ParsedSection[] = [];
  let sectionIndex = 0;

  // Track current sections at each level
  let currentH2: ParsedSection | null = null;
  let currentH3: ParsedSection | null = null;
  let currentIntro: ParsedSection | null = null;

  const addContentLine = (line: string) => {
    // Add content to the deepest current section
    if (currentH3) {
      if (line.trim() || currentH3.content.length > 0) {
        currentH3.content.push(line);
      }
    } else if (currentH2) {
      if (line.trim() || currentH2.content.length > 0) {
        currentH2.content.push(line);
      }
    } else if (currentIntro) {
      currentIntro.content.push(line);
    }
  };

  lines.forEach(line => {
    const headerMatch = line.match(/^(#{1,4})\s+(.*)/);

    if (headerMatch) {
      const level = headerMatch[1].length;
      const title = headerMatch[2].trim();

      if (level === 1) {
        // H1 - treat like H2 (main section)
        if (currentIntro) {
          sections.push(currentIntro);
          currentIntro = null;
        }
        if (currentH2) {
          sections.push(currentH2);
        }
        currentH2 = {
          id: `section-${sectionIndex++}`,
          title,
          type: getSectionType(title),
          level: 1,
          content: [],
          children: []
        };
        currentH3 = null;
      } else if (level === 2) {
        // H2 - main collapsible section
        if (currentIntro) {
          sections.push(currentIntro);
          currentIntro = null;
        }
        if (currentH2) {
          sections.push(currentH2);
        }
        currentH2 = {
          id: `section-${sectionIndex++}`,
          title,
          type: getSectionType(title),
          level: 2,
          content: [],
          children: []
        };
        currentH3 = null;
      } else if (level === 3 && currentH2) {
        // H3 - subsection inside H2
        currentH3 = {
          id: `section-${sectionIndex++}`,
          title,
          type: currentH2.type, // Inherit parent type
          level: 3,
          content: [],
          children: []
        };
        currentH2.children = currentH2.children || [];
        currentH2.children.push(currentH3);
      } else if (level === 4 && currentH3) {
        // H4 - sub-subsection inside H3
        const h4Section: ParsedSection = {
          id: `section-${sectionIndex++}`,
          title,
          type: currentH3.type,
          level: 4,
          content: []
        };
        currentH3.children = currentH3.children || [];
        currentH3.children.push(h4Section);
      } else if (level === 4 && currentH2) {
        // H4 without H3 parent - add directly to H2
        const h4Section: ParsedSection = {
          id: `section-${sectionIndex++}`,
          title,
          type: currentH2.type,
          level: 4,
          content: []
        };
        currentH2.children = currentH2.children || [];
        currentH2.children.push(h4Section);
      }
    } else if (currentH2 || currentIntro) {
      addContentLine(line);
    } else if (line.trim()) {
      // Intro text before any header
      if (!currentIntro) {
        currentIntro = {
          id: `section-${sectionIndex++}`,
          title: '',
          type: 'intro',
          level: 0,
          content: []
        };
      }
      currentIntro.content.push(line);
    }
  });

  // Push final sections
  if (currentIntro) sections.push(currentIntro);
  if (currentH2) sections.push(currentH2);

  return sections;
};

const StudyGuideRenderer: React.FC<StudyGuideRendererProps> = ({
  content,
  studySetId,
  studySetName = 'Guía de Estudio',
  showTOC = true,
  showMindMap = false,
  defaultCollapsed = true,
  onProgressChange
}) => {
  // Parse content into sections
  const sections = content ? parseContent(content) : [];

  // Progress tracking
  const {
    progressMap,
    markAsRead,
    progressPercent,
    readCount,
    totalSections,
    loading: progressLoading
  } = useStudyGuideProgress(studySetId, sections);

  // Collapsed state for H1/H2 sections (main collapsible sections)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => {
    if (defaultCollapsed) {
      return new Set(sections.filter(s => s.level === 1 || s.level === 2).map(s => s.id));
    }
    return new Set();
  });

  // Active section for TOC highlighting
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  // Mind map visibility
  const [isMindMapVisible, setIsMindMapVisible] = useState(showMindMap);

  // Mobile TOC visibility
  const [showMobileTOC, setShowMobileTOC] = useState(false);

  // Refs for scroll observation
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Notify parent of progress changes
  useEffect(() => {
    if (onProgressChange) {
      onProgressChange(progressPercent);
    }
  }, [progressPercent, onProgressChange]);

  // Intersection Observer for active section tracking
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setActiveSectionId(entry.target.id);
          }
        });
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
    );

    sections
      .filter(s => s.level === 2)
      .forEach(section => {
        const element = document.getElementById(section.id);
        if (element) observer.observe(element);
      });

    return () => observer.disconnect();
  }, [sections]);

  // Toggle section collapse
  const toggleSection = useCallback((sectionId: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
        // Mark as read when expanding
        const section = sections.find(s => s.id === sectionId);
        if (section) {
          markAsRead(sectionId, section.title);
        }
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, [sections, markAsRead]);

  // Scroll to section (from TOC or Mind Map)
  const scrollToSection = useCallback((sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Expand the section if collapsed
      setCollapsedSections(prev => {
        const next = new Set(prev);
        next.delete(sectionId);
        return next;
      });
      // Mark as read
      const section = sections.find(s => s.id === sectionId);
      if (section) {
        markAsRead(sectionId, section.title);
      }
      // Close mobile TOC
      setShowMobileTOC(false);
    }
  }, [sections, markAsRead]);

  // Expand/Collapse all
  const expandAll = useCallback(() => {
    setCollapsedSections(new Set());
  }, []);

  const collapseAll = useCallback(() => {
    setCollapsedSections(new Set(sections.filter(s => s.level === 2).map(s => s.id)));
  }, [sections]);

  if (!content) return null;

  const h2Sections = sections.filter(s => s.level === 2);

  return (
    <div className="relative">
      {/* Header with controls */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {/* Progress indicator */}
          <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full">
            <span className="material-symbols-outlined text-emerald-500 text-lg">
              {progressPercent === 100 ? 'check_circle' : 'progress_activity'}
            </span>
            <span className="text-sm font-medium text-slate-600">
              {readCount}/{totalSections} secciones
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Mind Map toggle */}
          <button
            onClick={() => setIsMindMapVisible(!isMindMapVisible)}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all
              ${isMindMapVisible
                ? 'bg-indigo-100 text-indigo-700'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}
            `}
          >
            <span className="material-symbols-outlined text-lg">hub</span>
            <span className="hidden sm:inline">Mapa Mental</span>
          </button>

          {/* Expand/Collapse buttons */}
          <button
            onClick={expandAll}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
            title="Expandir todo"
          >
            <span className="material-symbols-outlined text-lg">unfold_more</span>
          </button>
          <button
            onClick={collapseAll}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
            title="Colapsar todo"
          >
            <span className="material-symbols-outlined text-lg">unfold_less</span>
          </button>
        </div>
      </div>

      {/* Mind Map (conditionally visible) */}
      {isMindMapVisible && (
        <div className="mb-6 animate-in fade-in slide-in-from-top-4 duration-300">
          <StudyGuideMindMap
            sections={sections}
            studySetName={studySetName}
            onNodeClick={scrollToSection}
          />
        </div>
      )}

      {/* Main layout with TOC */}
      <div className="flex gap-6">
        {/* TOC Sidebar - Desktop */}
        {showTOC && h2Sections.length > 0 && (
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-300">
              <StudyGuideTOC
                sections={sections}
                activeSectionId={activeSectionId}
                progressMap={progressMap}
                onSectionClick={scrollToSection}
              />
            </div>
          </aside>
        )}

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-6">
          {sections.map(section => (
            <StudyGuideSection
              key={section.id}
              section={section}
              isCollapsed={collapsedSections.has(section.id)}
              isRead={progressMap.get(section.id) || false}
              onToggle={() => toggleSection(section.id)}
            />
          ))}
        </div>
      </div>

      {/* Mobile TOC Button */}
      {showTOC && h2Sections.length > 0 && (
        <button
          onClick={() => setShowMobileTOC(true)}
          className="lg:hidden fixed bottom-24 right-4 z-40 p-3 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition-all"
        >
          <span className="material-symbols-outlined">menu_book</span>
        </button>
      )}

      {/* Mobile TOC Slide-over */}
      {showMobileTOC && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/50 animate-in fade-in duration-200"
          onClick={() => setShowMobileTOC(false)}
        >
          <div
            className="absolute right-0 top-0 h-full w-80 max-w-[85vw] bg-white shadow-xl p-6 animate-in slide-in-from-right duration-300"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-slate-800">Contenido</h3>
              <button
                onClick={() => setShowMobileTOC(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <StudyGuideTOC
              sections={sections}
              activeSectionId={activeSectionId}
              progressMap={progressMap}
              onSectionClick={scrollToSection}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default StudyGuideRenderer;
