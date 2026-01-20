import React from 'react';
import { Assignment } from '../services/ClassroomService';

interface AssignmentCardProps {
    assignment: Assignment;
    onClick?: () => void;
    isTeacher?: boolean;
    onEdit?: () => void;
    onDelete?: () => void;
}

const AssignmentCard: React.FC<AssignmentCardProps> = ({
    assignment,
    onClick,
    isTeacher = false,
    onEdit,
    onDelete
}) => {
    const getTypeIcon = () => {
        switch (assignment.type) {
            case 'quiz_assignment': return 'quiz';
            case 'material': return 'menu_book';
            case 'discussion': return 'forum';
            default: return 'assignment';
        }
    };

    const getTypeLabel = () => {
        switch (assignment.type) {
            case 'quiz_assignment': return 'Quiz';
            case 'material': return 'Material';
            case 'discussion': return 'Discusión';
            default: return 'Tarea';
        }
    };

    const getTypeColor = () => {
        switch (assignment.type) {
            case 'quiz_assignment': return 'bg-amber-100 text-amber-700';
            case 'material': return 'bg-blue-100 text-blue-700';
            case 'discussion': return 'bg-emerald-100 text-emerald-700';
            default: return 'bg-violet-100 text-violet-700';
        }
    };

    const formatDueDate = (dateStr?: string) => {
        if (!dateStr) return null;
        const date = new Date(dateStr);
        const now = new Date();
        const diff = date.getTime() - now.getTime();
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

        if (days < 0) {
            return { text: 'Vencida', urgent: true };
        } else if (days === 0) {
            return { text: 'Vence hoy', urgent: true };
        } else if (days === 1) {
            return { text: 'Vence mañana', urgent: true };
        } else if (days <= 7) {
            return { text: `Vence en ${days} días`, urgent: false };
        } else {
            return { text: date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }), urgent: false };
        }
    };

    const dueInfo = formatDueDate(assignment.due_date);

    return (
        <div
            onClick={onClick}
            className={`bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md hover:border-violet-300 transition cursor-pointer group ${!assignment.published ? 'opacity-60' : ''}`}
        >
            <div className="flex items-start gap-3">
                {/* Icon */}
                <div className={`w-10 h-10 rounded-xl ${getTypeColor()} flex items-center justify-center flex-shrink-0`}>
                    <span className="material-symbols-outlined">{getTypeIcon()}</span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-slate-900 group-hover:text-violet-700 transition truncate">
                            {assignment.title}
                        </h3>
                        {!assignment.published && (
                            <span className="bg-slate-200 text-slate-600 text-xs font-medium px-2 py-0.5 rounded-full">
                                Borrador
                            </span>
                        )}
                    </div>

                    {assignment.description && (
                        <p className="text-sm text-slate-500 mt-1 line-clamp-2">{assignment.description}</p>
                    )}

                    {/* Meta Info */}
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                        {/* Points */}
                        <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">grade</span>
                            {assignment.points} pts
                        </span>

                        {/* Due Date */}
                        {dueInfo && (
                            <span className={`flex items-center gap-1 ${dueInfo.urgent ? 'text-rose-600 font-medium' : ''}`}>
                                <span className="material-symbols-outlined text-sm">schedule</span>
                                {dueInfo.text}
                            </span>
                        )}

                        {/* Submissions count (teacher view) */}
                        {isTeacher && assignment.submissions_count !== undefined && (
                            <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">people</span>
                                {assignment.submissions_count} entregas
                            </span>
                        )}

                        {/* Topic */}
                        {assignment.topic && (
                            <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded">
                                <span className="material-symbols-outlined text-sm">folder</span>
                                {assignment.topic.name}
                            </span>
                        )}
                    </div>

                    {/* Attachments indicator */}
                    {assignment.attachments && assignment.attachments.length > 0 && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-slate-400">
                            <span className="material-symbols-outlined text-sm">attach_file</span>
                            {assignment.attachments.length} archivo{assignment.attachments.length > 1 ? 's' : ''}
                        </div>
                    )}
                </div>

                {/* Actions (Teacher) */}
                {isTeacher && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                        {onEdit && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                title="Editar"
                            >
                                <span className="material-symbols-outlined text-lg">edit</span>
                            </button>
                        )}
                        {onDelete && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                title="Eliminar"
                            >
                                <span className="material-symbols-outlined text-lg">delete</span>
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AssignmentCard;
