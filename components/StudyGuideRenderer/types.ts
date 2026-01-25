/**
 * Types for the enhanced StudyGuideRenderer component
 */

// Section types matching the study guide structure
export type SectionType =
  | 'overview'      // Panorama General / Sección 1
  | 'concept'       // Desarrollo Conceptual / Sección 2
  | 'integration'   // Integración Interdisciplinaria / Sección 3
  | 'tools'         // Herramientas Pedagógicas / Sección 4
  | 'practice'      // Práctica y Aplicación / Sección 5
  | 'exam'          // Autoevaluación / Sección 6
  | 'warning'       // Puntos Críticos / Sección 7
  | 'infographic'   // Infografías
  | 'presentation'  // Presentaciones
  | 'intro'         // Intro text before headers
  | 'general';      // Default fallback

// Parsed section from markdown content
export interface ParsedSection {
  id: string;           // Unique ID (e.g., "section-0", "section-1")
  title: string;        // Header text
  type: SectionType;    // Section category
  level: number;        // Header depth (1-4 based on # count, 0 for intro)
  content: string[];    // Array of content lines
  children?: ParsedSection[]; // Nested subsections (H3 inside H2, H4 inside H3)
}

// Database model for reading progress
export interface StudyGuideProgress {
  id: string;
  student_id: string;
  study_set_id: string;
  section_id: string;
  section_title: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  updated_at: string;
}

// Props for the main container component
export interface StudyGuideRendererProps {
  content: string;
  studySetId: string;
  studySetName?: string;
  showTOC?: boolean;          // default: true
  showMindMap?: boolean;      // default: false
  defaultCollapsed?: boolean; // default: true
  onProgressChange?: (percent: number) => void;
}

// Props for individual section component
export interface StudyGuideSectionProps {
  section: ParsedSection;
  isCollapsed: boolean;
  isRead: boolean;
  onToggle: () => void;
  onMarkRead: () => void;
}

// Props for TOC component
export interface StudyGuideTOCProps {
  sections: ParsedSection[];
  activeSectionId: string | null;
  progressMap: Map<string, boolean>;
  onSectionClick: (sectionId: string) => void;
}

// Props for Mind Map component
export interface StudyGuideMindMapProps {
  sections: ParsedSection[];
  studySetName: string;
  onNodeClick?: (sectionId: string) => void;
}

// Color classes for each section type
export const SECTION_COLORS: Record<SectionType, { bg: string; text: string; border: string; accent: string }> = {
  overview: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    accent: 'bg-blue-500'
  },
  concept: {
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
    accent: 'bg-indigo-500'
  },
  integration: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    accent: 'bg-purple-500'
  },
  tools: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    accent: 'bg-emerald-500'
  },
  practice: {
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-200',
    accent: 'bg-orange-500'
  },
  exam: {
    bg: 'bg-fuchsia-50',
    text: 'text-fuchsia-700',
    border: 'border-fuchsia-200',
    accent: 'bg-fuchsia-500'
  },
  warning: {
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    accent: 'bg-rose-500'
  },
  infographic: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    accent: 'bg-amber-500'
  },
  presentation: {
    bg: 'bg-cyan-50',
    text: 'text-cyan-700',
    border: 'border-cyan-200',
    accent: 'bg-cyan-500'
  },
  intro: {
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    border: 'border-slate-200',
    accent: 'bg-slate-500'
  },
  general: {
    bg: 'bg-gray-50',
    text: 'text-gray-700',
    border: 'border-gray-200',
    accent: 'bg-gray-500'
  }
};

// Icons for each section type (Material Symbols)
export const SECTION_ICONS: Record<SectionType, string> = {
  overview: 'info',
  concept: 'menu_book',
  integration: 'hub',
  tools: 'construction',
  practice: 'edit_note',
  exam: 'quiz',
  warning: 'warning',
  infographic: 'leaderboard',
  presentation: 'slideshow',
  intro: 'auto_awesome',
  general: 'article'
};
