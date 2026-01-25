/**
 * Floating Table of Contents for Study Guide
 * Shows all H1/H2 sections with progress indicators
 */

import React from 'react';
import type { StudyGuideTOCProps } from './types';
import { SECTION_ICONS } from './types';

const StudyGuideTOC: React.FC<StudyGuideTOCProps> = ({
  sections,
  activeSectionId,
  progressMap,
  onSectionClick
}) => {
  // Filter to show H1/H2 sections in TOC (main collapsible sections)
  const mainSections = sections.filter(s => s.level === 1 || s.level === 2);

  if (mainSections.length === 0) return null;

  const readCount = mainSections.filter(s => progressMap.get(s.id)).length;
  const progressPercent = Math.round((readCount / mainSections.length) * 100);

  return (
    <nav className="space-y-2">
      {/* Header */}
      <div className="mb-4">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
          Contenido
        </h4>
        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {progressPercent}%
          </span>
        </div>
      </div>

      {/* Section list */}
      <div className="space-y-1">
        {mainSections.map(section => {
          const isActive = activeSectionId === section.id;
          const isRead = progressMap.get(section.id) || false;
          // Clean title for display (remove "SECCIÓN X:" prefix)
          const displayTitle = section.title
            .replace(/^SECCIÓN\s*\d+[:\-]\s*/i, '')
            .trim();

          return (
            <button
              key={section.id}
              onClick={() => onSectionClick(section.id)}
              className={`
                w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all
                flex items-center gap-2 group
                ${isActive
                  ? 'bg-indigo-100 text-indigo-700 font-medium shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'}
              `}
            >
              {/* Read indicator */}
              {isRead ? (
                <span className="material-symbols-outlined text-emerald-500 text-lg flex-shrink-0">
                  check_circle
                </span>
              ) : (
                <span className={`
                  material-symbols-outlined text-lg flex-shrink-0
                  ${isActive ? 'text-indigo-500' : 'text-slate-400 group-hover:text-slate-500'}
                `}>
                  {SECTION_ICONS[section.type] || 'article'}
                </span>
              )}

              {/* Title */}
              <span className="truncate flex-1">
                {displayTitle || section.title}
              </span>
            </button>
          );
        })}
      </div>

      {/* Footer stats */}
      <div className="mt-4 pt-4 border-t border-slate-200">
        <p className="text-xs text-slate-400">
          {readCount} de {mainSections.length} secciones leídas
        </p>
      </div>
    </nav>
  );
};

export default StudyGuideTOC;
