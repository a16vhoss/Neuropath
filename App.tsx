
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
import StudySession from './pages/StudySession';
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

  if (allowedRole && profile?.role !== allowedRole) {
    return <Navigate to={profile?.role === 'teacher' ? '/teacher' : '/student'} replace />;
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
      <Route path="/auth" element={
        <PublicRoute>
          <AuthPage />
        </PublicRoute>
      } />

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
