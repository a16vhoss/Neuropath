import React, { useState } from 'react';

interface FolderItemProps {
    folder: any;
    onOpen: (folder: any) => void;
    onRename: (folder: any, newName: string) => void;
    onDelete: (folder: any) => void;
    canManage?: boolean;
    selectionMode?: boolean;
    isSelected?: boolean;
    onSelect?: (folder: any) => void;
}

const FolderItem: React.FC<FolderItemProps> = ({
    folder,
    onOpen,
    onRename,
    onDelete,
    selectionMode = false,
    isSelected = false,
    onSelect
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(folder.name);
    const [showOptions, setShowOptions] = useState(false);

    const handleSubmitRename = () => {
        if (editName.trim() && editName !== folder.name) {
            onRename(folder, editName);
        }
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSubmitRename();
        } else if (e.key === 'Escape') {
            setEditName(folder.name);
            setIsEditing(false);
        }
    };

    if (isEditing) {
        return (
            <div className="bg-white p-3 rounded-2xl border border-blue-200 shadow-sm flex flex-col items-center justify-center gap-2">
                <span className="material-symbols-outlined text-4xl text-blue-400">folder_open</span>
                <input
                    autoFocus
                    className="w-full text-center text-sm font-bold border border-blue-300 rounded px-1 py-0.5 outline-none focus:ring-2 focus:ring-blue-100"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={handleSubmitRename}
                    onKeyDown={handleKeyDown}
                    onClick={(e) => e.stopPropagation()}
                />
            </div>
        );
    }

    return (
        <div
            className={`group relative bg-white p-4 rounded-xl border transition-all cursor-pointer flex flex-col items-center gap-2
        ${selectionMode
                    ? (isSelected ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-slate-100 hover:border-slate-300')
                    : 'border-slate-100 hover:shadow-md hover:border-blue-200'
                }
      `}
            onClick={(e) => {
                if (selectionMode && onSelect) {
                    onSelect(folder);
                } else {
                    onOpen(folder);
                }
            }}
            draggable={!selectionMode}
            onDragStart={(e) => {
                e.dataTransfer.setData('application/json', JSON.stringify({ type: 'folder', id: folder.id }));
                e.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const data = e.dataTransfer.getData('application/json');
                if (data) {
                    try {
                        const item = JSON.parse(data);
                        // Don't drop folder into itself
                        if (item.id !== folder.id) {
                            // Emit drop event to parent container logic or handle here if prop provided
                            // For now, parent FolderBrowser handles "onFolderDrop" usually, but here we are drop target *inside* grid
                            // We need a way to bubble this up.
                            // Let's assume standard HTML5 drag/drop bubbling or pass a handler props.
                        }
                    } catch (err) { }
                }
            }}
        >
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors
        ${folder.color === 'blue' ? 'bg-blue-50 text-blue-500' :
                    folder.color === 'violet' ? 'bg-violet-50 text-violet-500' :
                        folder.color === 'emerald' ? 'bg-emerald-50 text-emerald-500' :
                            folder.color === 'amber' ? 'bg-amber-50 text-amber-500' :
                                folder.color === 'rose' ? 'bg-rose-50 text-rose-500' :
                                    'bg-slate-50 text-blue-400'
                }`}
            >
                <span className="material-symbols-outlined text-3xl fill-1">folder</span>
            </div>

            <div className="w-full text-center">
                <h3 className="font-bold text-slate-700 text-sm truncate px-1" title={folder.name}>{folder.name}</h3>
                <p className="text-[10px] text-slate-400 font-medium">Carpeta</p>
            </div>

            {/* Action Menu Trigger (Visible on Hover) */}
            {!selectionMode && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowOptions(!showOptions);
                    }}
                    className="absolute top-2 right-2 p-1 text-slate-300 hover:text-slate-600 rounded-full hover:bg-slate-100 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity bg-white/80 md:bg-transparent"
                >
                    <span className="material-symbols-outlined text-lg">more_vert</span>
                </button>
            )}

            {/* Action Popover */}
            {showOptions && (
                <>
                    <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setShowOptions(false); }}></div>
                    <div className="absolute top-8 right-2 z-20 bg-white rounded-lg shadow-xl border border-slate-100 py-1 w-32 animate-in fade-in zoom-in-95 duration-100">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsEditing(true);
                                setShowOptions(false);
                            }}
                            className="w-full text-left px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-primary flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined text-base">edit</span> Renombrar
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(folder);
                                setShowOptions(false);
                            }}
                            className="w-full text-left px-3 py-2 text-xs font-bold text-rose-500 hover:bg-rose-50 flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined text-base">delete</span> Eliminar
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default FolderItem;
