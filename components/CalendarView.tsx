import React, { useState, useEffect } from 'react';
import { Assignment, AssignmentSubmission } from '../services/ClassroomService';

interface CalendarViewProps {
    assignments: Assignment[];
    submissions: AssignmentSubmission[];
    onAssignmentClick: (assignmentId: string) => void;
}

const CalendarView: React.FC<CalendarViewProps> = ({ assignments, submissions, onAssignmentClick }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [weekDays, setWeekDays] = useState<Date[]>([]);

    useEffect(() => {
        generateWeek(currentDate);
    }, [currentDate]);

    const generateWeek = (date: Date) => {
        const startOfWeek = new Date(date);
        const day = startOfWeek.getDay();
        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
        startOfWeek.setDate(diff);

        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            days.push(d);
        }
        setWeekDays(days);
    };

    const nextWeek = () => {
        const next = new Date(currentDate);
        next.setDate(currentDate.getDate() + 7);
        setCurrentDate(next);
    };

    const prevWeek = () => {
        const prev = new Date(currentDate);
        prev.setDate(currentDate.getDate() - 7);
        setCurrentDate(prev);
    };

    const goToToday = () => {
        setCurrentDate(new Date());
    };

    const isSameDay = (d1: Date, d2: Date) => {
        return d1.getFullYear() === d2.getFullYear() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getDate() === d2.getDate();
    };

    const getAssignmentsForDay = (date: Date) => {
        return assignments.filter(a => {
            if (!a.due_date) return false;
            // Parse due_date (YYYY-MM-DD or ISO)
            const due = new Date(a.due_date);

            // Check if matches day
            const matchesDay = isSameDay(due, date);
            if (!matchesDay) return false;

            // Check submission status
            const sub = submissions.find(s => s.assignment_id === a.id);
            const isCompleted = sub && (sub.status === 'turned_in' || sub.status === 'graded');

            // Hide if completed
            if (isCompleted) return false;

            return true;
        });
    };

    const isOverdue = (assignment: Assignment) => {
        if (!assignment.due_date) return false;
        const due = new Date(assignment.due_date);
        const today = new Date();
        // Clear time for fair comparison
        today.setHours(0, 0, 0, 0);
        return due < today;
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold text-slate-800 capitalize">
                        {currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                    </h2>
                    <div className="flex bg-white rounded-lg border border-slate-200 shadow-sm">
                        <button onClick={prevWeek} className="p-2 hover:bg-slate-50 text-slate-600 border-r border-slate-200">
                            <span className="material-symbols-outlined text-lg">chevron_left</span>
                        </button>
                        <button onClick={goToToday} className="px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">
                            HOY
                        </button>
                        <button onClick={nextWeek} className="p-2 hover:bg-slate-50 text-slate-600 border-l border-slate-200">
                            <span className="material-symbols-outlined text-lg">chevron_right</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="flex-1 overflow-y-auto">
                <div className="grid grid-cols-7 h-full min-w-[800px]">
                    {weekDays.map((day, mapIndex) => {
                        const isToday = isSameDay(day, new Date());
                        const dayAssignments = getAssignmentsForDay(day);

                        return (
                            <div key={mapIndex} className={`border-r last:border-r-0 border-slate-100 flex flex-col ${isToday ? 'bg-blue-50/30' : ''}`}>
                                {/* Day Header */}
                                <div className={`p-3 text-center border-b border-slate-100 sticky top-0 bg-white/95 backdrop-blur-sm z-10 ${isToday ? 'bg-blue-50/90' : ''}`}>
                                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">
                                        {day.toLocaleDateString('es-ES', { weekday: 'short' })}
                                    </p>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto text-sm font-bold ${isToday ? 'bg-primary text-white shadow-md' : 'text-slate-700'
                                        }`}>
                                        {day.getDate()}
                                    </div>
                                </div>

                                {/* Events */}
                                <div className="p-2 space-y-2 flex-1 relative min-h-[100px]">
                                    {dayAssignments.map(assignment => {
                                        const overdue = isOverdue(assignment);
                                        return (
                                            <div
                                                key={assignment.id}
                                                onClick={() => onAssignmentClick(assignment.id)}
                                                className={`p-2 rounded-lg text-xs font-medium cursor-pointer border shadow-sm transition-all hover:shadow-md group ${overdue
                                                        ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                                                        : 'bg-white border-slate-200 text-slate-700 hover:border-primary/50'
                                                    }`}
                                            >
                                                <div className="flex items-start gap-1">
                                                    <div className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${overdue ? 'bg-rose-500' : 'bg-primary'}`}></div>
                                                    <span className="line-clamp-3 leading-tight">
                                                        {assignment.title}
                                                    </span>
                                                </div>
                                                {assignment.points > 0 && (
                                                    <p className="mt-1 ml-2.5 text-[10px] opacity-70">
                                                        {assignment.points} pts
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default CalendarView;
