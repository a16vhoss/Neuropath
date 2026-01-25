/**
 * Individual collapsible section for Study Guide
 */

import React from 'react';
import type { ParsedSection, SectionType } from './types';
import { SECTION_COLORS, SECTION_ICONS } from './types';

interface StudyGuideSectionProps {
  section: ParsedSection;
  isCollapsed: boolean;
  isRead: boolean;
  onToggle: () => void;
}

// Helper to format text with markdown-like syntax
const formatText = (text: string) => {
  let formattedText = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code class="bg-slate-100 px-1.5 py-0.5 rounded text-slate-800 font-mono text-sm">$1</code>');

  return <span dangerouslySetInnerHTML={{ __html: formattedText }} />;
};

const StudyGuideSection: React.FC<StudyGuideSectionProps> = ({
  section,
  isCollapsed,
  isRead,
  onToggle
}) => {
  const colors = SECTION_COLORS[section.type as SectionType] || SECTION_COLORS.general;
  const icon = SECTION_ICONS[section.type as SectionType] || 'article';

  // Intro section (no collapse)
  if (section.type === 'intro') {
    return (
      <div className="bg-gradient-to-r from-violet-50 to-indigo-50 p-6 rounded-2xl border border-violet-100 italic text-slate-700 leading-relaxed shadow-sm">
        {section.content.map((line, lIdx) => (
          <p key={lIdx} className="mb-2 last:mb-0">{formatText(line)}</p>
        ))}
      </div>
    );
  }

  // Helper to render content lines
  const renderContentLines = (content: string[], accentColor: string, textColor: string) => {
    return content.map((line, lIdx) => {
      const trimmedLine = line.trim();

      // Bullet points
      if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('• ')) {
        return (
          <li key={lIdx} className="ml-4 text-slate-600 list-none flex gap-2">
            <span className={`mt-1.5 w-1.5 h-1.5 rounded-full ${accentColor} flex-shrink-0`} />
            <span className="flex-1">{formatText(trimmedLine.substring(2))}</span>
          </li>
        );
      }

      // Numbered items
      const numberedMatch = trimmedLine.match(/^(\d+)\.\s+(.*)/);
      if (numberedMatch) {
        return (
          <li key={lIdx} className="ml-4 text-slate-600 list-none flex gap-2">
            <span className={`font-bold ${textColor} mt-0.5`}>{numberedMatch[1]}.</span>
            <span className="flex-1">{formatText(numberedMatch[2])}</span>
          </li>
        );
      }

      // Empty lines = spacer
      if (!trimmedLine) {
        return <div key={lIdx} className="h-2" />;
      }

      // Regular paragraph
      return (
        <p key={lIdx} className="text-slate-600 leading-relaxed">
          {formatText(line)}
        </p>
      );
    });
  };

  // Helper to render H3 subsection
  const renderH3Section = (child: ParsedSection) => {
    const childColors = SECTION_COLORS[child.type as SectionType] || SECTION_COLORS.general;
    return (
      <div key={child.id} id={child.id} className="mt-5 mb-3">
        <h3 className="text-md font-bold text-slate-800 flex items-center gap-2 mb-3">
          <div className={`w-1.5 h-5 ${childColors.accent} rounded-full`} />
          {child.title}
        </h3>
        <div className="pl-4 space-y-2">
          {renderContentLines(child.content, childColors.accent, childColors.text)}
          {/* Render H4 children inside H3 */}
          {child.children?.map(h4Child => renderH4Section(h4Child))}
        </div>
      </div>
    );
  };

  // Helper to render H4 sub-subsection
  const renderH4Section = (child: ParsedSection) => {
    return (
      <div key={child.id} id={child.id} className="mt-3 mb-2 bg-slate-50 p-4 rounded-xl border border-slate-100">
        <h4 className="text-sm font-bold text-slate-700 mb-2">{child.title}</h4>
        <div className="space-y-1">
          {child.content.map((line, lIdx) => (
            <p key={lIdx} className="text-sm text-slate-500">
              {formatText(line)}
            </p>
          ))}
        </div>
      </div>
    );
  };

  // H2 Section (main collapsible sections) - also handle H1 the same way
  if (section.level === 2 || section.level === 1) {
    return (
      <div
        id={section.id}
        className={`rounded-2xl border shadow-sm overflow-hidden transition-all ${colors.border} ${isCollapsed ? '' : 'shadow-md'}`}
      >
        {/* Clickable Header */}
        <button
          onClick={onToggle}
          className={`w-full px-5 py-4 flex items-center gap-3 ${colors.bg} ${colors.text} hover:opacity-90 transition-opacity`}
        >
          {/* Chevron */}
          <span className={`material-symbols-outlined text-xl transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`}>
            chevron_right
          </span>

          {/* Icon */}
          <span className="material-symbols-outlined text-2xl">
            {icon}
          </span>

          {/* Title */}
          <h2 className="text-base font-bold uppercase tracking-wide flex-1 text-left">
            {section.title}
          </h2>

          {/* Read indicator */}
          {isRead && (
            <span className="material-symbols-outlined text-emerald-500 text-xl">
              check_circle
            </span>
          )}
        </button>

        {/* Collapsible Content */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            isCollapsed ? 'max-h-0' : 'max-h-[10000px]'
          }`}
        >
          <div className="p-5 bg-white space-y-3">
            {/* Render direct content of H2 */}
            {renderContentLines(section.content, colors.accent, colors.text)}

            {/* Render nested H3/H4 children */}
            {section.children?.map(child => {
              if (child.level === 3) {
                return renderH3Section(child);
              } else if (child.level === 4) {
                return renderH4Section(child);
              }
              return null;
            })}
          </div>
        </div>
      </div>
    );
  }

  // H3 Section (subsection)
  if (section.level === 3) {
    return (
      <div id={section.id} className="mt-5 mb-3">
        <h3 className="text-md font-bold text-slate-800 flex items-center gap-2 mb-3">
          <div className={`w-1.5 h-5 ${colors.accent} rounded-full`} />
          {section.title}
        </h3>
        <div className="pl-4 space-y-2">
          {section.content.map((line, lIdx) => (
            <p key={lIdx} className="text-slate-600 leading-relaxed">
              {formatText(line)}
            </p>
          ))}
        </div>
      </div>
    );
  }

  // H4 Section (sub-subsection)
  if (section.level === 4) {
    return (
      <div id={section.id} className="mt-3 mb-2 bg-slate-50 p-4 rounded-xl border border-slate-100">
        <h4 className="text-sm font-bold text-slate-700 mb-2">{section.title}</h4>
        <div className="space-y-1">
          {section.content.map((line, lIdx) => (
            <p key={lIdx} className="text-sm text-slate-500">
              {formatText(line)}
            </p>
          ))}
        </div>
      </div>
    );
  }

  return null;
};

export default StudyGuideSection;
