
import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Landing from './pages/Landing';
import AuthPage from './pages/AuthPage';
import TeacherDashboard from './pages/TeacherDashboard';
import TeacherAnalytics from './pages/TeacherAnalytics';
import TeacherClassDetail from './pages/TeacherClassDetail';
import StudentDashboard from './pages/StudentDashboard';
import StudentAchievements from './pages/StudentAchievements';
import StudySetDetail from './pages/StudySetDetail';
import StudyBattles from './pages/StudyBattles';
import BattleArena from './pages/BattleArena';
import StudySession from './pages/StudySession';
import AdaptiveStudySession from './pages/AdaptiveStudySession';
import MockExamPage from './pages/MockExamPage';
import { UserRole } from './types';

// Protected Route component
const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRole?: 'student' | 'teacher' }> = ({
  children,
  allowedRole
}) => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <span className="material-symbols-outlined text-6xl text-primary animate-pulse">neurology</span>
          <p className="mt-4 text-slate-500 font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Only redirect if profile is loaded AND role doesn't match
  // If profile is null (fetch failed), we let them through to avoid infinite loop
  // ideally we'd show an error, but this keeps the app usable
  if (allowedRole && profile && profile.role !== allowedRole) {
    return <Navigate to={profile.role === 'teacher' ? '/teacher' : '/student'} replace />;
  }

  return <>{children}</>;
};

// Public Route (redirect if logged in)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <span className="material-symbols-outlined text-6xl text-primary animate-pulse">neurology</span>
          <p className="mt-4 text-slate-500 font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  if (user && profile) {
    return <Navigate to={profile.role === 'teacher' ? '/teacher' : '/student'} replace />;
  }

  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  const [userRole, setUserRole] = useState<UserRole>(UserRole.STUDENT);
  const { user, profile } = useAuth();

  // Handler for demo login from landing page
  const handleDemoLogin = (role: UserRole) => {
    setUserRole(role);
  };

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Landing onLogin={handleDemoLogin} />} />
      <Route path="/auth" element={<AuthPage />} />

      {/* Student Routes */}
      <Route path="/student" element={
        <ProtectedRoute allowedRole="student">
          <StudentDashboard />
        </ProtectedRoute>
      } />
      <Route path="/student/achievements" element={
        <ProtectedRoute allowedRole="student">
          <StudentAchievements />
        </ProtectedRoute>
      } />
      <Route path="/student/study/:classId" element={
        <ProtectedRoute allowedRole="student">
          <StudySession />
        </ProtectedRoute>
      } />
      <Route path="/student/study-set/:studySetId" element={
        <ProtectedRoute allowedRole="student">
          <StudySession />
        </ProtectedRoute>
      } />
      <Route path="/student/mock-exam" element={
        <ProtectedRoute allowedRole="student">
          <MockExamPage />
        </ProtectedRoute>
      } />
      <Route path="/student/set/:studySetId" element={
        <ProtectedRoute allowedRole="student">
          <StudySetDetail />
        </ProtectedRoute>
      } />
      <Route path="/student/battles" element={
        <ProtectedRoute allowedRole="student">
          <StudyBattles />
        </ProtectedRoute>
      } />
      <Route path="/student/battle/:battleId" element={
        <ProtectedRoute allowedRole="student">
          <BattleArena />
        </ProtectedRoute>
      } />
      <Route path="/student/adaptive-study/:classId" element={
        <ProtectedRoute allowedRole="student">
          <AdaptiveStudySession />
        </ProtectedRoute>
      } />
      <Route path="/student/adaptive-study" element={
        <ProtectedRoute allowedRole="student">
          <AdaptiveStudySession />
        </ProtectedRoute>
      } />
      <Route path="/student/adaptive/:studySetId" element={
        <ProtectedRoute allowedRole="student">
          <AdaptiveStudySession />
        </ProtectedRoute>
      } />

      {/* Teacher Routes */}
      <Route path="/teacher" element={
        <ProtectedRoute allowedRole="teacher">
          <TeacherDashboard />
        </ProtectedRoute>
      } />
      <Route path="/teacher/class/:classId" element={
        <ProtectedRoute allowedRole="teacher">
          <TeacherClassDetail />
        </ProtectedRoute>
      } />
      <Route path="/teacher/analytics/:classId" element={
        <ProtectedRoute allowedRole="teacher">
          <TeacherAnalytics />
        </ProtectedRoute>
      } />

      {/* Demo Routes (bypass auth for demo purposes) */}
      <Route path="/demo/student" element={<StudentDashboard />} />
      <Route path="/demo/student/study/:classId" element={<StudySession />} />
      <Route path="/demo/student/study-set/:studySetId" element={<StudySession />} />
      <Route path="/demo/teacher" element={<TeacherDashboard />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
};

export default App;
