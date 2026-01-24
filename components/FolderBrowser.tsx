import React, { useState, useEffect } from 'react';
import { supabase, createFolder, getFolders, getFolderStudySets, updateFolder, deleteFolder, moveItem } from '../services/supabaseClient';
import FolderItem from './FolderItem';
import Breadcrumbs from './Breadcrumbs';
import MoveToModal from './MoveToModal';
import { useNavigate } from 'react-router-dom';

interface FolderBrowserProps {
    userId: string;
    classId?: string | null; // Optional: If we are in class context
    onStudySetClick: (setId: string) => void;
    canManage?: boolean;
}

const FolderBrowser: React.FC<FolderBrowserProps> = ({ userId, classId = null, onStudySetClick, canManage = true }) => {
    const navigate = useNavigate();

    // Navigation State
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
    const [breadcrumbs, setBreadcrumbs] = useState<{ id: string | null, name: string }[]>([]); // Current path

    // Data State
    const [folders, setFolders] = useState<any[]>([]);
    const [studySets, setStudySets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // UI State
    const [isDragging, setIsDragging] = useState(false);
    const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
    const [showCreateFolder, setShowCreateFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');

    // Modal State
    const [moveModalOpen, setMoveModalOpen] = useState(false);
    const [itemToMove, setItemToMove] = useState<{ id: string, type: 'folder' | 'set', name: string } | null>(null);

    useEffect(() => {
        loadContent();
    }, [userId, currentFolderId, classId]);

    const loadContent = async () => {
        setLoading(true);
        try {
            // Parallel fetch
            const [foldersData, setsData] = await Promise.all([
                getFolders(userId, currentFolderId, classId),
                getFolderStudySets(userId, currentFolderId, classId)
            ]);

            setFolders(foldersData || []);
            setStudySets(setsData || []);

        } catch (error) {
            console.error('Error loading folder content:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleNavigate = async (folderId: string | null, folderName: string) => {
        if (folderId === null) {
            setBreadcrumbs([]);
            setCurrentFolderId(null);
        } else {
            // If navigating from breadcrumb, strip crumbs after target
            const existingIndex = breadcrumbs.findIndex(b => b.id === folderId);
            if (existingIndex >= 0) {
                setBreadcrumbs(prev => prev.slice(0, existingIndex + 1));
            } else {
                setBreadcrumbs(prev => [...prev, { id: folderId, name: folderName }]);
            }
            setCurrentFolderId(folderId);
        }
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;
        try {
            await createFolder({
                name: newFolderName,
                owner_id: userId,
                parent_id: currentFolderId,
                class_id: classId,
                color: ['blue', 'violet', 'emerald', 'amber'][Math.floor(Math.random() * 4)],
            });
            setNewFolderName('');
            setShowCreateFolder(false);
            loadContent();
        } catch (error) {
            console.error('Error creating folder', error);
        }
    };

    const handleDeleteFolder = async (folder: any) => {
        if (window.confirm(`¿Estás seguro de eliminar la carpeta "${folder.name}"? Todo su contenido será eliminado permanentemente.`)) {
            try {
                await deleteFolder(folder.id);
                loadContent();
            } catch (error) {
                console.error('Error deleting folder', error);
            }
        }
    };

    const handleRenameFolder = async (folder: any, newName: string) => {
        try {
            await updateFolder(folder.id, { name: newName });
            loadContent();
        } catch (error) {
            console.error('Error renaming folder', error);
        }
    };

    // Drag and Drop Logic
    const handleDrop = async (e: React.DragEvent, targetFolderId: string | null) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOverFolderId(null);
        const data = e.dataTransfer.getData('application/json');

        if (data) {
            try {
                const item = JSON.parse(data);
                // Avoid self-drop
                if (item.type === 'folder' && item.id === targetFolderId) return;

                await moveItem(item.id, item.type, targetFolderId);
                loadContent();
            } catch (err) {
                console.error('Drop error', err);
            }
        }
    };

    return (
        <div
            className="space-y-6"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
                // Drop on "empty space" implies staying in current folder (no-op if dragging from same folder)
                // But if we want to support "drop to parent" via breadcrumbs later, we can.
                // For now, this handler prevents browser default behavior.
                e.preventDefault();
            }}
        >
            {/* Header & Controls */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <Breadcrumbs
                    items={breadcrumbs}
                    onNavigate={(item) => handleNavigate(item.id, item.name)}
                />

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    {canManage && (
                        showCreateFolder ? (
                            <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-blue-200 shadow-sm animate-in slide-in-from-right-2 w-full sm:w-auto">
                                <input
                                    autoFocus
                                    placeholder="Nombre de carpeta..."
                                    className="px-3 py-2 outline-none text-sm min-w-[150px] w-full sm:w-auto"
                                    value={newFolderName}
                                    onChange={e => setNewFolderName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
                                />
                                <button onClick={handleCreateFolder} className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200">
                                    <span className="material-symbols-outlined text-lg">check</span>
                                </button>
                                <button onClick={() => setShowCreateFolder(false)} className="p-2 text-slate-400 hover:text-slate-600">
                                    <span className="material-symbols-outlined text-lg">close</span>
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowCreateFolder(true)}
                                className="px-4 py-2 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center gap-2 text-sm shadow-sm"
                            >
                                <span className="material-symbols-outlined text-yellow-500">create_new_folder</span>
                                Nueva Carpeta
                            </button>
                        )
                    )}
                </div>
            </div>

            {/* Content Grid */}
            {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="aspect-square bg-slate-100 rounded-2xl animate-pulse"></div>
                    ))}
                </div>
            ) : folders.length === 0 && studySets.length === 0 ? (
                <div className="py-16 text-center border-2 border-dashed border-slate-100 rounded-3xl bg-slate-50/50">
                    <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mx-auto mb-4">
                        <span className="material-symbols-outlined text-3xl text-slate-300">folder_open</span>
                    </div>
                    <p className="text-slate-500 font-medium">Esta carpeta está vacía</p>
                    {canManage && (
                        <button onClick={() => setShowCreateFolder(true)} className="text-primary text-sm font-bold mt-2 hover:underline">
                            Crear una carpeta
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {/* Folders First */}
                    {folders.map(folder => (
                        <div
                            key={folder.id}
                            onDragOver={(e) => {
                                if (!canManage) return;
                                e.preventDefault();
                                setDragOverFolderId(folder.id);
                            }}
                            onDragLeave={() => setDragOverFolderId(null)}
                            onDrop={(e) => {
                                if (!canManage) return;
                                handleDrop(e, folder.id);
                            }}
                            className={dragOverFolderId === folder.id ? 'scale-105 ring-2 ring-primary ring-offset-2 rounded-xl transition-all' : ''}
                        >
                            <FolderItem
                                folder={folder}
                                onOpen={() => handleNavigate(folder.id, folder.name)}
                                onRename={handleRenameFolder}
                                onDelete={handleDeleteFolder}
                                canManage={canManage}
                            />
                        </div>
                    ))}

                    {/* Study Sets */}
                    {studySets.map(set => (
                        <div
                            key={set.id}
                            draggable={canManage}
                            onDragStart={(e) => {
                                if (!canManage) return;
                                e.dataTransfer.setData('application/json', JSON.stringify({ type: 'set', id: set.id }));
                            }}
                            onClick={() => onStudySetClick(set.id)}
                            className="group relative bg-white p-4 rounded-xl border border-slate-100 hover:shadow-md hover:border-violet-200 transition-all cursor-pointer flex flex-col gap-3 min-h-[140px]"
                        >
                            <div className="flex justify-between items-start">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center
                            ${set.color === 'blue' ? 'bg-blue-50 text-blue-500' :
                                        set.color === 'violet' ? 'bg-violet-50 text-violet-500' :
                                            'bg-slate-50 text-slate-500'}`
                                }>
                                    <span className="material-symbols-outlined">{set.icon || 'menu_book'}</span>
                                </div>
                                {canManage && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setItemToMove({ id: set.id, type: 'set', name: set.name });
                                            setMoveModalOpen(true);
                                        }}
                                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-all"
                                        title="Mover"
                                    >
                                        <span className="material-symbols-outlined text-lg">drive_file_move</span>
                                    </button>
                                )}
                            </div>

                            <div>
                                <h3 className="font-bold text-slate-800 text-sm line-clamp-2 leading-tight mb-1" title={set.name}>
                                    {set.name}
                                </h3>
                                <p className="text-xs text-slate-400">{set.flashcards_count || 0} tarjetas</p>
                            </div>


                        </div>
                    ))}
                </div>
            )}

            {/* Move Modal */}
            <MoveToModal
                isOpen={moveModalOpen}
                onClose={() => setMoveModalOpen(false)}
                itemToMove={itemToMove}
                currentFolderId={currentFolderId}
                userId={userId}
                onMove={async (targetId) => {
                    if (itemToMove) {
                        await moveItem(itemToMove.id, itemToMove.type, targetId);
                        setMoveModalOpen(false);
                        loadContent();
                    }
                }}
            />
        </div>
    );
};

export default FolderBrowser;
