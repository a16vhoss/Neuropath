/**
 * Daily Summary Modal
 * Shows AI-generated daily study summary
 */

import React from 'react';
import { DailySummary } from '../services/DailySummaryService';
import { useNavigate } from 'react-router-dom';

interface DailySummaryModalProps {
  summary: DailySummary;
  onClose: () => void;
}

const DailySummaryModal: React.FC<DailySummaryModalProps> = ({ summary, onClose }) => {
  const navigate = useNavigate();
  const { content } = summary;

  // Format due date
  const formatDueDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Hoy';
    }
    if (date.toDateString() === tomorrow.toDateString()) {
      return 'Mañana';
    }
    return date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  // Handle start studying
  const handleStartStudy = () => {
    onClose();
    // Navigate to study based on priority
    if (content.cards_due > 0) {
      navigate('/student'); // Will use adaptive study
    } else if (content.assignments_pending.length > 0) {
      navigate(`/student/class/${content.assignments_pending[0].class_id}`);
    } else {
      navigate('/student');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600 p-6 text-white relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 hover:bg-white/20 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>

          {/* Greeting */}
          <div className="relative">
            <div className="flex items-center gap-3 mb-2">
              <span className="material-symbols-outlined text-3xl">waving_hand</span>
              <h2 className="text-2xl font-bold">{content.greeting}</h2>
            </div>
            <p className="text-white/80 text-sm">{content.motivational_message}</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
            {/* Cards Due */}
            <div className={`p-3 rounded-xl text-center ${content.cards_due > 0 ? 'bg-violet-50' : 'bg-emerald-50'}`}>
              <div className={`text-2xl font-black ${content.cards_due > 0 ? 'text-violet-600' : 'text-emerald-600'}`}>
                {content.cards_due}
              </div>
              <div className={`text-xs font-medium ${content.cards_due > 0 ? 'text-violet-500' : 'text-emerald-500'}`}>
                Tarjetas
              </div>
            </div>

            {/* Assignments */}
            <div className={`p-3 rounded-xl text-center ${content.assignments_pending.length > 0 ? 'bg-blue-50' : 'bg-emerald-50'}`}>
              <div className={`text-2xl font-black ${content.assignments_pending.length > 0 ? 'text-blue-600' : 'text-emerald-600'}`}>
                {content.assignments_pending.length}
              </div>
              <div className={`text-xs font-medium ${content.assignments_pending.length > 0 ? 'text-blue-500' : 'text-emerald-500'}`}>
                Tareas
              </div>
            </div>

            {/* Streak */}
            <div className={`p-3 rounded-xl text-center ${content.streak_status.at_risk ? 'bg-orange-50' : 'bg-amber-50'}`}>
              <div className={`text-2xl font-black ${content.streak_status.at_risk ? 'text-orange-600' : 'text-amber-600'}`}>
                {content.streak_status.current}
              </div>
              <div className={`text-xs font-medium ${content.streak_status.at_risk ? 'text-orange-500' : 'text-amber-500'}`}>
                Racha
              </div>
            </div>
          </div>

          {/* Streak Status Alert */}
          {content.streak_status.at_risk && (
            <div className="flex items-center gap-3 p-3 bg-orange-50 border border-orange-200 rounded-xl">
              <span className="material-symbols-outlined text-orange-500">warning</span>
              <p className="text-sm text-orange-700 font-medium">{content.streak_status.message}</p>
            </div>
          )}

          {/* Focus Recommendation */}
          <div className="flex items-start gap-3 p-4 bg-indigo-50 rounded-xl">
            <span className="material-symbols-outlined text-indigo-500 mt-0.5">lightbulb</span>
            <div>
              <p className="text-sm font-semibold text-indigo-900">Recomendación del día</p>
              <p className="text-sm text-indigo-700 mt-1">{content.focus_recommendation}</p>
            </div>
          </div>

          {/* Pending Assignments */}
          {content.assignments_pending.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">assignment</span>
                Tareas Pendientes
              </h4>
              <div className="space-y-2">
                {content.assignments_pending.slice(0, 3).map(assignment => (
                  <div
                    key={assignment.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-xl"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{assignment.title}</p>
                      <p className="text-xs text-slate-500">{assignment.class_name}</p>
                    </div>
                    <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded-lg">
                      {formatDueDate(assignment.due_date)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stats Row */}
          {(content.stats.mastered_cards > 0 || content.stats.recent_quiz_score !== null) && (
            <div className="flex items-center justify-center gap-6 py-3 border-t border-slate-100">
              {content.stats.mastered_cards > 0 && (
                <div className="text-center">
                  <div className="text-lg font-bold text-emerald-600">{content.stats.mastered_cards}</div>
                  <div className="text-xs text-slate-500">Dominadas</div>
                </div>
              )}
              {content.stats.learning_cards > 0 && (
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-600">{content.stats.learning_cards}</div>
                  <div className="text-xs text-slate-500">Aprendiendo</div>
                </div>
              )}
              {content.stats.recent_quiz_score !== null && (
                <div className="text-center">
                  <div className="text-lg font-bold text-violet-600">{content.stats.recent_quiz_score}%</div>
                  <div className="text-xs text-slate-500">Último Quiz</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 text-slate-600 font-medium rounded-xl hover:bg-slate-100 transition-colors"
          >
            Después
          </button>
          <button
            onClick={handleStartStudy}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg"
          >
            <span className="material-symbols-outlined">play_arrow</span>
            ¡A Estudiar!
          </button>
        </div>
      </div>
    </div>
  );
};

export default DailySummaryModal;
