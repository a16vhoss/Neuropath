import React from 'react';

interface BreadcrumbItem {
    id: string | null; // null for root
    name: string;
}

interface BreadcrumbsProps {
    items: BreadcrumbItem[];
    onNavigate: (item: BreadcrumbItem) => void;
}

const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items, onNavigate }) => {
    return (
        <nav className="flex items-center gap-1 text-sm overflow-x-auto no-scrollbar whitespace-nowrap py-2">
            <button
                onClick={() => onNavigate({ id: null, name: 'Home' })}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-colors ${items.length === 0 ? 'bg-slate-100 text-slate-800 font-bold' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}
            >
                <span className="material-symbols-outlined text-lg">home</span>
                {items.length === 0 && <span>Inicio</span>}
            </button>

            {items.map((item, index) => {
                const isLast = index === items.length - 1;

                return (
                    <div key={item.id || 'root'} className="flex items-center gap-1 animate-in fade-in slide-in-from-left-2 duration-200">
                        <span className="material-symbols-outlined text-slate-300 text-lg">chevron_right</span>
                        <button
                            onClick={() => !isLast && onNavigate(item)}
                            disabled={isLast}
                            className={`flex items-center gap-1 px-2 py-1 rounded-lg max-w-[150px] truncate transition-colors
                ${isLast
                                    ? 'bg-primary/10 text-primary font-bold cursor-default pointer-events-none'
                                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 font-medium'
                                }
              `}
                        >
                            {isLast && <span className="material-symbols-outlined text-lg">folder_open</span>}
                            <span className="truncate">{item.name}</span>
                        </button>
                    </div>
                );
            })}
        </nav>
    );
};

export default Breadcrumbs;
