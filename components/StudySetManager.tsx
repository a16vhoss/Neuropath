import React, { useState, useEffect } from 'react';
import { updateStudySet, deleteStudySet, getStudySetFlashcards, updateFlashcard, deleteFlashcard, addFlashcardToStudySet } from '../services/supabaseClient';
import CumulativeReportsCard from './CumulativeReportsCard';
import VisualProgressionMap from './VisualProgressionMap';

interface Flashcard {
    id: string;
    question: string;
    answer: string;
    category?: string;
}

interface StudySet {
    id: string;
    name: string;
    description: string;
    topics: string[];
}

interface StudySetManagerProps {
    studySet: StudySet;
    onClose: () => void;
    onUpdate: () => void;
}

const StudySetManager: React.FC<StudySetManagerProps> = ({ studySet, onClose, onUpdate }) => {
    const [activeTab, setActiveTab] = useState<'details' | 'content' | 'reports'>('details');
    const [name, setName] = useState(studySet.name);
    const [description, setDescription] = useState(studySet.description || '');
    const [topics, setTopics] = useState(studySet.topics?.join(', ') || '');
    const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
    const [loading, setLoading] = useState(false);

    // Flashcard form state
    const [newQuestion, setNewQuestion] = useState('');
    const [newAnswer, setNewAnswer] = useState('');
    const [editingFlashcardId, setEditingFlashcardId] = useState<string | null>(null);

    useEffect(() => {
        if (activeTab === 'content') {
            loadFlashcards();
        }
    }, [activeTab]);

    const loadFlashcards = async () => {
        try {
            const data = await getStudySetFlashcards(studySet.id);
            setFlashcards(data || []);
        } catch (error) {
            console.error('Error loading flashcards:', error);
        }
    };

    const handleUpdateDetails = async () => {
        setLoading(true);
        try {
            await updateStudySet(studySet.id, {
                name,
                description,
                topics: topics.split(',').map(t => t.trim()).filter(Boolean)
            });
            onUpdate();
            alert('Study set updated successfully!');
        } catch (error) {
            console.error('Error updating study set:', error);
            alert('Failed to update study set');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteSet = async () => {
        if (!confirm('Are you sure you want to delete this study set? This cannot be undone.')) return;

        setLoading(true);
        try {
            await deleteStudySet(studySet.id);
            onUpdate();
            onClose();
        } catch (error) {
            console.error('Error deleting study set:', error);
            alert('Failed to delete study set');
        } finally {
            setLoading(false);
        }
    };

    const handleAddFlashcard = async () => {
        if (!newQuestion || !newAnswer) return;

        try {
            await addFlashcardToStudySet(studySet.id, {
                question: newQuestion,
                answer: newAnswer
            });
            setNewQuestion('');
            setNewAnswer('');
            loadFlashcards();
        } catch (error) {
            console.error('Error adding flashcard:', error);
        }
    };

    const handleUpdateFlashcard = async (id: string, question: string, answer: string) => {
        try {
            await updateFlashcard(id, { question, answer });
            setEditingFlashcardId(null);
            loadFlashcards();
        } catch (error) {
            console.error('Error updating flashcard:', error);
        }
    };

    const handleDeleteFlashcard = async (id: string) => {
        if (!confirm('Delete this flashcard?')) return;
        try {
            await deleteFlashcard(id);
            loadFlashcards();
        } catch (error) {
            console.error('Error deleting flashcard:', error);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="p-4 border-b flex justify-between items-center bg-indigo-50">
                    <h2 className="text-xl font-bold text-indigo-900">Manage Study Set</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
                </div>

                <div className="flex border-b">
                    <button
                        className={`flex-1 p-3 font-medium text-sm ${activeTab === 'details' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('details')}
                    >
                        Details
                    </button>
                    <button
                        className={`flex-1 p-3 font-medium text-sm ${activeTab === 'content' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('content')}
                    >
                        Content ({flashcards.length} cards)
                    </button>
                    <button
                        className={`flex-1 p-3 font-medium text-sm ${activeTab === 'reports' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('reports')}
                    >
                        Reportes
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {activeTab === 'details' && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    rows={3}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Topics (comma separated)</label>
                                <input
                                    type="text"
                                    value={topics}
                                    onChange={(e) => setTopics(e.target.value)}
                                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            <div className="pt-4 flex justify-between">
                                <button
                                    onClick={handleDeleteSet}
                                    className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                                    disabled={loading}
                                >
                                    Delete Set
                                </button>
                                <button
                                    onClick={handleUpdateDetails}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                                    disabled={loading}
                                >
                                    {loading ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'content' && (
                        <div className="space-y-6">
                            {/* Add New Card Form */}
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <h3 className="text-sm font-bold text-gray-700 mb-2">Add New Flashcard</h3>
                                <div className="space-y-2">
                                    <input
                                        placeholder="Question / Term"
                                        value={newQuestion}
                                        onChange={(e) => setNewQuestion(e.target.value)}
                                        className="w-full p-3 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
                                    />
                                    <input
                                        placeholder="Answer / Definition"
                                        value={newAnswer}
                                        onChange={(e) => setNewAnswer(e.target.value)}
                                        className="w-full p-3 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
                                    />
                                    <button
                                        onClick={handleAddFlashcard}
                                        disabled={!newQuestion || !newAnswer}
                                        className="w-full py-2 bg-indigo-100 text-indigo-700 rounded text-sm font-medium hover:bg-indigo-200 disabled:opacity-50"
                                    >
                                        + Add Card
                                    </button>
                                </div>
                            </div>

                            {/* Flashcards List */}
                            <div className="space-y-3">
                                {flashcards.map(card => (
                                    <div key={card.id} className="p-3 border rounded-lg flex flex-col gap-2 hover:bg-gray-50 group">
                                        {editingFlashcardId === card.id ? (
                                            // Edit Mode
                                            <div className="space-y-2">
                                                <input
                                                    defaultValue={card.question}
                                                    id={`q-${card.id}`}
                                                    className="w-full p-2 border rounded text-sm"
                                                />
                                                <input
                                                    defaultValue={card.answer}
                                                    id={`a-${card.id}`}
                                                    className="w-full p-2 border rounded text-sm"
                                                />
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => setEditingFlashcardId(null)}
                                                        className="px-3 py-1 text-xs bg-gray-200 rounded"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            const q = (document.getElementById(`q-${card.id}`) as HTMLInputElement).value;
                                                            const a = (document.getElementById(`a-${card.id}`) as HTMLInputElement).value;
                                                            handleUpdateFlashcard(card.id, q, a);
                                                        }}
                                                        className="px-3 py-1 text-xs bg-indigo-600 text-white rounded"
                                                    >
                                                        Save
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            // View Mode
                                            <div className="flex justify-between items-start gap-4">
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium text-gray-900">{card.question}</p>
                                                    <p className="text-sm text-gray-600 mt-1">{card.answer}</p>
                                                </div>
                                                <div className="flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0">
                                                    <button
                                                        onClick={() => setEditingFlashcardId(card.id)}
                                                        className="p-2 text-gray-400 hover:text-indigo-600 bg-gray-50 md:bg-transparent rounded-full md:rounded-none"
                                                        title="Edit"
                                                    >
                                                        ✎
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteFlashcard(card.id)}
                                                        className="p-2 text-gray-400 hover:text-red-600 bg-gray-50 md:bg-transparent rounded-full md:rounded-none"
                                                        title="Delete"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {flashcards.length === 0 && (
                                    <p className="text-center text-gray-400 text-sm py-4">No flashcards yet.</p>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'reports' && (
                        <div className="space-y-6 pb-6">
                            <h3 className="text-lg font-semibold text-gray-800">Progreso en este Set</h3>
                            <div className="grid grid-cols-1 gap-6">
                                <VisualProgressionMap studySetId={studySet.id} />
                                <CumulativeReportsCard studySetId={studySet.id} />
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default StudySetManager;
