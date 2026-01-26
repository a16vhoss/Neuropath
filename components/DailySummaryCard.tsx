/**
 * Daily Summary Card
 * Compact card for dashboard sidebar showing summary snapshot
 */

import React from 'react';
import { DailySummary } from '../services/DailySummaryService';

interface DailySummaryCardProps {
  summary: DailySummary | null;
  onOpenModal: () => void;
  loading?: boolean;
}

const DailySummaryCard: React.FC<DailySummaryCardProps> = ({ summary, onOpenModal, loading }) => {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-3/4 mb-3" />
        <div className="h-3 bg-slate-200 rounded w-full mb-2" />
        <div className="h-3 bg-slate-200 rounded w-2/3" />
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  const { content } = summary;
  const hasUrgentItems = content.cards_due > 0 || content.assignments_pending.length > 0 || content.streak_status.at_risk;

  return (
    <button
      onClick={onOpenModal}
      className="w-full text-left bg-gradient-to-br from-indigo-500 via-purple-500 to-violet-600 rounded-2xl shadow-lg p-4 text-white hover:shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden group"
    >
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />

      {/* Header */}
      <div className="relative flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-xl">auto_awesome</span>
        <span className="font-bold text-sm">Tu Día de Hoy</span>
        {hasUrgentItems && (
          <span className="ml-auto flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-amber-300 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
          </span>
        )}
      </div>

      {/* Quick Stats */}
      <div className="relative flex items-center gap-3 mb-3">
        {/* Cards Due */}
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-base opacity-80">style</span>
          <span className="text-sm font-semibold">{content.cards_due}</span>
        </div>

        {/* Divider */}
        <div className="w-px h-4 bg-white/30" />

        {/* Assignments */}
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-base opacity-80">assignment</span>
          <span className="text-sm font-semibold">{content.assignments_pending.length}</span>
        </div>

        {/* Divider */}
        <div className="w-px h-4 bg-white/30" />

        {/* Streak */}
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-base opacity-80">local_fire_department</span>
          <span className={`text-sm font-semibold ${content.streak_status.at_risk ? 'text-amber-300' : ''}`}>
            {content.streak_status.current}
          </span>
        </div>
      </div>

      {/* Recommendation Preview */}
      <p className="relative text-xs text-white/80 line-clamp-2 leading-relaxed">
        {content.focus_recommendation}
      </p>

      {/* CTA */}
      <div className="relative flex items-center justify-end mt-3 text-xs font-medium text-white/70 group-hover:text-white transition-colors">
        <span>Ver resumen completo</span>
        <span className="material-symbols-outlined text-base ml-1 group-hover:translate-x-0.5 transition-transform">
          arrow_forward
        </span>
      </div>
    </button>
  );
};

export default DailySummaryCard;
