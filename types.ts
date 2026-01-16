
export enum UserRole {
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT',
  INSTITUTION = 'INSTITUTION'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
}

export interface ClassInfo {
  id: string;
  name: string;
  description: string;
  studentCount: number;
  averageProgress: number;
  code: string;
  subject: string;
  nextExam?: string;
  atRiskCount?: number;
}

export interface StudentProgress {
  id: string;
  name: string;
  avatar: string;
  scores: Record<string, number>; // moduleId -> score
  totalAvg: number;
  isAtRisk: boolean;
}

export interface Flashcard {
  id: string;
  question: string;
  answer: string;
  category: string;
}
