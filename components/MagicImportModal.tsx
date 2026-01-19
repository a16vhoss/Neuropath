
import React, { useState } from 'react';
import { extractTextFromPDF } from '../services/pdfProcessingService';
import { generateStudySetFromContext, generateFlashcardsFromYouTubeURL } from '../services/geminiService';
import { useAuth } from '../contexts/AuthContext';
import { createStudySet, addFlashcardsBatch, addMaterialToStudySet } from '../services/supabaseClient';

interface MagicImportModalProps {
    onClose: () => void;
    onSuccess: (newSet: any) => void;
}

const MagicImportModal: React.FC<MagicImportModalProps> = ({ onClose, onSuccess }) => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'text' | 'pdf' | 'youtube'>('text');
    const [inputValue, setInputValue] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');

    // PDF State
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    // Helper to convert file to base64
    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });
    };

    const handleImport = async () => {
        if (!user || !name) return;
        setLoading(true);
        setStatus('Procesando contenido con IA...');

        try {
            let processedContent = '';
            let cardData: any[] = [];

            // 1. Extract content based on source
            if (activeTab === 'pdf' && selectedFile) {
                setStatus('Extrayendo texto del PDF...');
                const base64File = await fileToBase64(selectedFile);
                const base64Data = base64File.split(',')[1];
                processedContent = await extractTextFromPDF(base64Data) || '';

                if (!processedContent) throw new Error("No se pudo extraer texto del PDF.");

                setStatus(`Analizando ${processedContent.length} caracteres con Gemini...`);
                cardData = await generateStudySetFromContext(processedContent, 'pdf');

            } else if (activeTab === 'text') {
                processedContent = inputValue;

                if (!processedContent.trim()) throw new Error("Escribe o pega el texto a analizar.");

                setStatus(`Analizando ${processedContent.length} caracteres con Gemini...`);
                cardData = await generateStudySetFromContext(processedContent, 'text');

            } else if (activeTab === 'youtube') {
                if (!inputValue.trim()) throw new Error("Ingresa un enlace de YouTube.");

                // Validate YouTube URL format
                const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)/;
                if (!youtubeRegex.test(inputValue)) {
                    throw new Error("Enlace de YouTube inválido. Usa el formato: youtube.com/watch?v=...");
                }

                setStatus('Analizando video con Gemini IA...');

                // Direct Gemini video analysis - returns flashcards + detailed summary
                const youtubeResult = await generateFlashcardsFromYouTubeURL(inputValue);
                cardData = youtubeResult.flashcards;

                // Store YouTube data for material creation
                (window as any).__youtubeAnalysis = {
                    summary: youtubeResult.summary,
                    videoTitle: youtubeResult.videoTitle,
                    channelName: youtubeResult.channelName,
                    videoUrl: youtubeResult.videoUrl
                };
            }

            if (!cardData || cardData.length === 0) {
                throw new Error("No se pudieron generar flashcards. Intenta con otro contenido.");
            }

            // 3. Save to Supabase - with timeout to prevent hanging
            const saveTimeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Tiempo de espera agotado al guardar. Verifica tu conexión.")), 15000)
            );

            const saveContent = async () => {
                setStatus('Guardando set de estudio...');
                // Create the set first
                const newSet = await createStudySet(user.id, {
                    name: name,
                    description: `Generado con IA desde ${activeTab.toUpperCase()}`,
                    topics: ['IA', activeTab],
                    icon: activeTab === 'youtube' ? 'play_circle' : (activeTab === 'pdf' ? 'picture_as_pdf' : 'description')
                });

                if (!newSet?.id) throw new Error("Error al crear el set de estudio (ID no retornado).");

                // Add flashcards in batch
                setStatus(`Guardando ${cardData.length} flashcards...`);

                const flashcardsToInsert = cardData.map((card: any) => ({
                    study_set_id: newSet.id,
                    question: card.question,
                    answer: card.answer,
                    category: card.category || 'General'
                }));

                await addFlashcardsBatch(flashcardsToInsert);

                // 4. Save the source material with detailed summary for YouTube
                setStatus('Guardando material original...');
                try {
                    // Get YouTube analysis data if available
                    const youtubeAnalysis = (window as any).__youtubeAnalysis;

                    if (activeTab === 'youtube' && youtubeAnalysis) {
                        await addMaterialToStudySet({
                            study_set_id: newSet.id,
                            name: youtubeAnalysis.videoTitle || 'Video de YouTube',
                            type: 'url',
                            file_url: youtubeAnalysis.videoUrl,
                            content_text: `Canal: ${youtubeAnalysis.channelName}\n\n${youtubeAnalysis.summary}`,
                            flashcards_generated: cardData.length,
                            summary: youtubeAnalysis.summary
                        });
                        // Clean up
                        delete (window as any).__youtubeAnalysis;
                    } else if (processedContent) {
                        await addMaterialToStudySet({
                            study_set_id: newSet.id,
                            name: activeTab === 'pdf' && selectedFile ? selectedFile.name : `Material Original (${activeTab})`,
                            type: activeTab === 'pdf' ? 'pdf' : 'notes',
                            file_url: '',
                            content_text: processedContent,
                            flashcards_generated: cardData.length,
                            summary: `Material importado automáticamente desde ${activeTab}`
                        });
                    }
                } catch (matError) {
                    console.error('Error saving material:', matError);
                    // Don't fail the whole process if material save fails
                }

                return newSet;
            };

            const newSet = await Promise.race([saveContent(), saveTimeout]) as any;

            setStatus('¡Listo!');
            onSuccess(newSet);
            onClose();

        } catch (error) {
            console.error('Magic Import Failed:', error);
            setStatus('Error: ' + ((error as any).message || 'Ocurrió un error inesperado.'));
            setTimeout(() => setLoading(false), 3000);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            <span className="text-3xl">🪄</span> Magic Import
                        </h2>
                        <p className="text-indigo-100 text-sm mt-1">Crea sets de estudio en segundos desde cualquier fuente.</p>
                    </div>
                    <button onClick={onClose} className="text-white/80 hover:text-white bg-white/10 p-2 rounded-full hover:bg-white/20 transition-all">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-100">
                    <button
                        onClick={() => setActiveTab('text')}
                        className={`flex-1 py-4 text-sm font-semibold transition-all flex items-center justify-center gap-2 ${activeTab === 'text' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        <span className="material-symbols-outlined">description</span> Texto / Notas
                    </button>
                    <button
                        onClick={() => setActiveTab('pdf')}
                        className={`flex-1 py-4 text-sm font-semibold transition-all flex items-center justify-center gap-2 ${activeTab === 'pdf' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        <span className="material-symbols-outlined">picture_as_pdf</span> PDF
                    </button>
                    <button
                        onClick={() => setActiveTab('youtube')}
                        className={`flex-1 py-4 text-sm font-semibold transition-all flex items-center justify-center gap-2 ${activeTab === 'youtube' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        <span className="material-symbols-outlined">play_circle</span> YouTube
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1 space-y-6">

                    {/* Name Input */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Nombre del Set</label>
                        <input
                            type="text"
                            placeholder="Ej: Historia de la Biología"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                        />
                    </div>

                    {/* Content Input Area */}
                    <div className="bg-gray-50 p-6 rounded-xl border border-dashed border-gray-300">
                        {activeTab === 'text' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Pega tus apuntes aquí</label>
                                <textarea
                                    className="w-full h-48 p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                                    placeholder="Copia y pega texto de Wikipedia, Word, o tus notas..."
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                ></textarea>
                            </div>
                        )}

                        {activeTab === 'pdf' && (
                            <div className="text-center py-8">
                                <span className="material-symbols-outlined text-5xl text-gray-300 mb-4">cloud_upload</span>
                                <p className="text-gray-600 font-medium mb-2">Sube tu PDF</p>
                                <p className="text-xs text-gray-400 mb-4">Máx 10MB. Se extraerá el texto automáticamente.</p>
                                <input
                                    type="file"
                                    accept=".pdf"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0] || null;
                                        setSelectedFile(file);
                                        if (file && !name) {
                                            // Remove extension for auto-name
                                            const simpleName = file.name.split('.').slice(0, -1).join('.');
                                            setName(simpleName);
                                        }
                                    }}
                                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-all"
                                />
                            </div>
                        )}

                        {activeTab === 'youtube' && (
                            <div>
                                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-4 mb-4">
                                    <div className="flex items-start gap-3">
                                        <span className="material-symbols-outlined text-indigo-600 text-2xl">smart_toy</span>
                                        <div>
                                            <p className="text-sm font-medium text-indigo-800 mb-1">Análisis con IA</p>
                                            <p className="text-xs text-indigo-600">
                                                Gemini analizará el contenido del video directamente y creará flashcards automáticamente.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Enlace de YouTube</label>
                                <input
                                    type="text"
                                    placeholder="https://youtube.com/watch?v=..."
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
                                />
                                <p className="text-xs text-gray-400 mt-2">Funciona con videos públicos en cualquier idioma.</p>
                            </div>
                        )}
                    </div>

                    {/* Status Message */}
                    {status && (
                        <div className={`p-4 rounded-xl flex items-center gap-3 animate-fade-in ${loading ? 'bg-indigo-50 text-indigo-700' : 'bg-red-50 text-red-700'}`}>
                            {loading && <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>}
                            <span className="text-sm font-medium">{status}</span>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-xl font-medium text-gray-600 hover:bg-gray-200 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleImport}
                        disabled={loading || !name || (activeTab === 'pdf' && !selectedFile) || (activeTab !== 'pdf' && !inputValue)}
                        className="px-6 py-2.5 rounded-xl font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-200 transition-all transform active:scale-95"
                    >
                        {loading ? 'Generando...' : '✨ Crear Set Mágico'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MagicImportModal;
