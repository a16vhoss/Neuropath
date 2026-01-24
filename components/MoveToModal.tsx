import React, { useState, useEffect } from 'react';
import { supabase, getFolders } from '../services/supabaseClient';

interface MoveToModalProps {
    isOpen: boolean;
    onClose: () => void;
    onMove: (targetFolderId: string | null) => void;
    itemToMove: { id: string; type: 'folder' | 'set'; name: string } | null;
    currentFolderId: string | null;
    userId: string;
}

interface FolderOption {
    id: string;
    name: string;
    parent_id: string | null;
}

const MoveToModal: React.FC<MoveToModalProps> = ({
    isOpen,
    onClose,
    onMove,
    itemToMove,
    currentFolderId,
    userId
}) => {
    const [folders, setFolders] = useState<FolderOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPath, setCurrentPath] = useState<{ id: string | null, name: string }[]>([{ id: null, name: 'Inicio' }]);
    const [browsingFolderId, setBrowsingFolderId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            loadFolders(null);
            setBrowsingFolderId(null);
            setCurrentPath([{ id: null, name: 'Inicio' }]);
        }
    }, [isOpen]);

    const loadFolders = async (parentId: string | null) => {
        setLoading(true);
        try {
            // Reuse getFolders from service
            const data = await getFolders(userId, parentId);

            // Filter out the item itself if we are moving a folder (can't move into self)
            let validFolders = data || [];
            if (itemToMove?.type === 'folder') {
                validFolders = validFolders.filter((f: any) => f.id !== itemToMove.id);
            }

            setFolders(validFolders);
        } catch (error) {
            console.error('Error loading folders:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleNavigate = (folder: FolderOption | null) => {
        if (folder) {
            setBrowsingFolderId(folder.id);
            setCurrentPath(prev => [...prev, { id: folder.id, name: folder.name }]);
            loadFolders(folder.id);
        } else {
            // Go to root
            setBrowsingFolderId(null);
            setCurrentPath([{ id: null, name: 'Inicio' }]);
            loadFolders(null);
        }
    };

    const handleGoBack = () => {
        if (currentPath.length > 1) {
            // Remove last
            const newPath = [...currentPath];
            newPath.pop();
            const parent = newPath[newPath.length - 1];
            setCurrentPath(newPath);
            setBrowsingFolderId(parent.id);
            loadFolders(parent.id);
        }
    };

    if (!isOpen) return null;

    const isCurrentLocation = browsingFolderId === currentFolderId;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800">Mover "{itemToMove?.name}"</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="p-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                    {currentPath.length > 1 && (
                        <button onClick={handleGoBack} className="p-1 hover:bg-white rounded-md text-slate-500">
                            <span className="material-symbols-outlined text-lg">arrow_back</span>
                        </button>
                    )}
                    <span className="text-sm font-bold text-slate-600 flex items-center gap-1">
                        <span className="material-symbols-outlined text-lg text-blue-500">folder</span>
                        {currentPath[currentPath.length - 1].name}
                    </span>
                </div>

                <div className="flex-1 overflow-y-auto p-2 min-h-[300px]">
                    {loading ? (
                        <div className="flex justify-center p-8">
                            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {folders.length === 0 ? (
                                <div className="text-center py-8 text-slate-400 text-sm">
                                    Carpeta vacía
                                </div>
                            ) : (
                                folders.map(folder => (
                                    <div
                                        key={folder.id}
                                        onClick={() => handleNavigate(folder)}
                                        className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-100 cursor-pointer group transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center">
                                                <span className="material-symbols-outlined">folder</span>
                                            </div>
                                            <span className="font-bold text-slate-700 text-sm">{folder.name}</span>
                                        </div>
                                        <span className="material-symbols-outlined text-slate-300 group-hover:text-primary">chevron_right</span>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-slate-100 bg-white">
                    <button
                        onClick={() => onMove(browsingFolderId)}
                        disabled={isCurrentLocation}
                        className="w-full bg-primary text-white font-bold py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {isCurrentLocation ? 'Ya está aquí' : 'Mover Aquí'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MoveToModal;
