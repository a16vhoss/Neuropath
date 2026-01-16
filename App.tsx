
import React, { useState } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import Landing from './pages/Landing';
import TeacherDashboard from './pages/TeacherDashboard';
import TeacherAnalytics from './pages/TeacherAnalytics';
import TeacherClassDetail from './pages/TeacherClassDetail';
import StudentDashboard from './pages/StudentDashboard';
import StudentAchievements from './pages/StudentAchievements';
import StudySession from './pages/StudySession';
import { UserRole } from './types';

const App: React.FC = () => {
  const [userRole, setUserRole] = useState<UserRole>(UserRole.STUDENT);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing onLogin={(role) => setUserRole(role)} />} />

        {/* Student Routes */}
        <Route path="/student" element={<StudentDashboard />} />
        <Route path="/student/achievements" element={<StudentAchievements />} />
        <Route path="/student/study/:classId" element={<StudySession />} />

        {/* Teacher Routes */}
        <Route path="/teacher" element={<TeacherDashboard />} />
        <Route path="/teacher/class/:classId" element={<TeacherClassDetail />} />
        <Route path="/teacher/analytics/:classId" element={<TeacherAnalytics />} />
      </Routes>
    </Router>
  );
};

export default App;

