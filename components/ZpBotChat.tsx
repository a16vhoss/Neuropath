import React, { useState, useEffect, useRef } from 'react';
import { getZpBotResponseStream, generatePromptedFlashcards, searchInternet, generateResearchClarifications, isSearchServiceAvailable } from '../services/geminiService';
import { addFlashcardsBatch, createMaterialWithFlashcards } from '../services/supabaseClient';
import { generateFlashcardsFromText } from '../services/pdfProcessingService';
import { generateEducationalImage, shouldGenerateImage, isImageServiceAvailable } from '../services/imageGenerationService';
import {
    saveChatMessage,
    ChatMessage,
    ChatSession,
    getChatSessions,
    createChatSession,
    getSessionMessages,
    deleteChatSession
} from '../services/ChatService';

interface ZpBotChatProps {
    studySetId: string;
    studySetName: string;
    contextText?: string; // All material text combined
}

const ZpBotChat: React.FC<ZpBotChatProps> = ({ studySetId, studySetName, contextText }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Data
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);

    // UI State
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Streaming State
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);

    // Image Generation State
    const [messageImages, setMessageImages] = useState<Record<string, string>>({});
    const [generatingImage, setGeneratingImage] = useState(false);

    // Initial load: Fetch sessions
    useEffect(() => {
        if (studySetId && isOpen) {
            loadSessions();
        }
    }, [studySetId, isOpen]);

    const loadSessions = async () => {
        const list = await getChatSessions(studySetId);
        setSessions(list);

        if (list.length > 0 && !currentSessionId) {
            const mostRecent = list[0];
            setCurrentSessionId(mostRecent.id);
            loadMessages(mostRecent.id);
        }
    };

    const loadMessages = async (sessionId: string) => {
        setLoading(true);
        try {
            const history = await getSessionMessages(sessionId);
            setMessages(history);
            setSuggestions([]);
        } catch (error) {
            console.error('Error loading messages', error);
        } finally {
            setLoading(false);
        }
    };

    const handleNewChat = () => {
        setCurrentSessionId(null);
        setMessages([]);
        setSuggestions([
            `¿De qué trata "${studySetName}"?`,
            "¿Puedes hacerme un resumen?",
            "¿Qué es lo más importante?"
        ]);
        setIsSidebarOpen(false);
    };

    const handleSelectSession = (sessionId: string) => {
        setCurrentSessionId(sessionId);
        loadMessages(sessionId);
        setIsSidebarOpen(false);
    };

    const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
        e.stopPropagation();
        if (!window.confirm('¿Borrar este chat?')) return;

        await deleteChatSession(sessionId);
        const updated = sessions.filter(s => s.id !== sessionId);
        setSessions(updated);

        if (currentSessionId === sessionId) {
            if (updated.length > 0) {
                const next = updated[0];
                setCurrentSessionId(next.id);
                loadMessages(next.id);
            } else {
                handleNewChat();
            }
        }
    };

    // Flashcard Wizard State
    const [fcMode, setFcMode] = useState<'idle' | 'asking_topic' | 'generating' | 'preview'>('idle');
    const [fcTopic, setFcTopic] = useState('');
    const [generatedCards, setGeneratedCards] = useState<any[]>([]);

    // Research Wizard State
    const [researchMode, setResearchMode] = useState<'idle' | 'asking_topic' | 'clarifying' | 'searching' | 'results'>('idle');
    const [researchResults, setResearchResults] = useState<any[]>([]);
    const [clarificationData, setClarificationData] = useState<{ question: string; options: string[] } | null>(null);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isOpen, suggestions, fcMode, researchMode, researchResults, isStreaming, messageImages, generatingImage]);

    const startFlashcardFlow = () => {
        setFcMode('asking_topic');
        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'assistant',
            content: `🤖 ¡Claro! Crearemos flashcards para **${studySetName}** usando IA. ¿Sobre qué tema específico te gustaría? (Ej: "Todo el contenido", "Conceptos claves", "Resumen")`,
            created_at: new Date().toISOString(),
            study_set_id: studySetId,
            user_id: 'system'
        }]);
    };

    const startResearchFlow = () => {
        setResearchMode('asking_topic');
        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'assistant',
            content: `🔍 ¡Entendido! Puedo investigar temas nuevos por ti. ¿Qué te gustaría que busque en internet hoy?`,
            created_at: new Date().toISOString(),
            study_set_id: studySetId,
            user_id: 'system'
        }]);
    };

    const handlePerformResearch = async (topic: string) => {
        setLoading(true);
        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'user',
            content: topic,
            created_at: new Date().toISOString(),
            study_set_id: studySetId,
            user_id: 'me',
            session_id: currentSessionId || 'temp'
        }]);

        try {
            setResearchMode('clarifying');
            const clarifications = await generateResearchClarifications(topic, contextText || '', studySetName);
            setClarificationData(clarifications);

            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: clarifications.question,
                created_at: new Date().toISOString(),
                study_set_id: studySetId,
                user_id: 'system'
            }]);

            setSuggestions(clarifications.options);

        } catch (error) {
            console.error("Research clarification failed", error);
            proceedWithSearch(topic);
        } finally {
            setLoading(false);
        }
    };

    const proceedWithSearch = async (finalQuery: string) => {
        setResearchMode('searching');
        setSuggestions([]);
        const loadingMsgId = Date.now().toString();

        setMessages(prev => [...prev, {
            id: loadingMsgId,
            role: 'assistant',
            content: `🌐 Excelente elección. Buscando los mejores recursos sobre "${finalQuery}"...`,
            created_at: new Date().toISOString(),
            study_set_id: studySetId,
            user_id: 'system'
        }]);

        try {
            const results = await searchInternet(finalQuery, contextText || '', studySetName);
            setResearchResults(results);
            setResearchMode('results');

            setMessages(prev => prev.filter(m => m.id !== loadingMsgId).concat({
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `✅ He encontrado ${results.length} recursos de alta calidad. Revísalos abajo.`,
                created_at: new Date().toISOString(),
                study_set_id: studySetId,
                user_id: 'system'
            }));
        } catch (error) {
            console.error(error);
            setResearchMode('idle');
        }
    };

    const handleAddResourceAsMaterial = async (resource: any) => {
        setLoading(true);
        try {
            const initialCards = await generateFlashcardsFromText(
                `Título: ${resource.title}\nDescripción: ${resource.snippet}`,
                resource.title,
                3
            ) || [];

            await createMaterialWithFlashcards({
                study_set_id: studySetId,
                name: resource.title,
                type: 'url',
                file_url: resource.url,
                summary: resource.snippet,
                content_text: `Fuente externa: ${resource.url}\n\n${resource.snippet}`,
                flashcards: initialCards.map(c => ({ ...c, is_ai_generated: true }))
            });

            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                content: `📖 ¡He añadido "${resource.title}" a tus materiales! Se están generando flashcards automáticamente.`,
                created_at: new Date().toISOString(),
                study_set_id: studySetId,
                user_id: 'system'
            }]);

            setTimeout(() => window.location.reload(), 2000);
        } catch (error) {
            console.error('Error adding resource:', error);
            alert('Error al añadir material');
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateFlashcards = async (topic: string) => {
        setFcMode('generating');
        const loadingMsgId = Date.now().toString();

        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'user',
            content: topic,
            created_at: new Date().toISOString(),
            study_set_id: studySetId,
            user_id: 'me',
            session_id: currentSessionId || 'temp'
        }]);

        setMessages(prev => [...prev, {
            id: loadingMsgId,
            role: 'assistant',
            content: '⚙️ Analizando tus materiales y profundizando en el tema... Dame unos segundos.',
            created_at: new Date().toISOString(),
            study_set_id: studySetId,
            user_id: 'system'
        }]);

        try {
            if (currentSessionId) {
                await saveChatMessage(studySetId, 'user', topic, currentSessionId);
            }

            const cards = await generatePromptedFlashcards(topic, contextText || '', studySetName, 5);
            setGeneratedCards(cards);
            setFcMode('preview');

            setMessages(prev => prev.filter(m => m.id !== loadingMsgId).concat({
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `✅ He generado ${cards.length} flashcards sobre "${topic}". Revísalas abajo y dime si te gustan.`,
                created_at: new Date().toISOString(),
                study_set_id: studySetId,
                user_id: 'system'
            }));

        } catch (err) {
            console.error(err);
            setMessages(prev => prev.filter(m => m.id !== loadingMsgId).concat({
                id: Date.now().toString(),
                role: 'assistant',
                content: '❌ Hubo un error al generar las tarjetas. Intenta de nuevo.',
                created_at: new Date().toISOString(),
                study_set_id: studySetId,
                user_id: 'system'
            }));
            setFcMode('idle');
        }
    };

    const saveGeneratedFlashcards = async () => {
        setLoading(true);
        try {
            const formatted = generatedCards.map(c => ({
                question: c.question,
                answer: c.answer,
                category: c.category || 'AI Generated',
                study_set_id: studySetId,
                is_ai_generated: true
            }));

            await addFlashcardsBatch(formatted);

            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                content: '🎉 ¡Flashcards guardadas con éxito! Las verás en tu lista con el icono de robot (🤖).',
                created_at: new Date().toISOString(),
                study_set_id: studySetId,
                user_id: 'system'
            }]);

            setGeneratedCards([]);
            setFcMode('idle');
            window.location.reload();
        } catch (error) {
            console.error(error);
            alert('Error al guardar');
        } finally {
            setLoading(false);
        }
    };

    const handleSend = async (text?: string) => {
        const userText = text || input;
        if (!userText.trim() || loading) return;

        if (fcMode === 'asking_topic') {
            setInput('');
            handleGenerateFlashcards(userText);
            return;
        }

        if (researchMode === 'asking_topic') {
            setInput('');
            handlePerformResearch(userText);
            return;
        }

        if (researchMode === 'clarifying') {
            setInput('');
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'user',
                content: userText,
                created_at: new Date().toISOString(),
                study_set_id: studySetId,
                user_id: 'me',
                session_id: currentSessionId || 'temp'
            }]);
            proceedWithSearch(userText);
            return;
        }

        setInput('');
        setSuggestions([]);
        setLoading(true);

        const tempUserMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: userText,
            created_at: new Date().toISOString(),
            study_set_id: studySetId,
            user_id: 'me',
            session_id: currentSessionId || 'temp'
        };
        setMessages(prev => [...prev, tempUserMsg]);

        try {
            let activeSessionId = currentSessionId;

            if (!activeSessionId) {
                const newTitle = userText.length > 30 ? userText.substring(0, 30) + '...' : userText;
                const newSession = await createChatSession(studySetId, newTitle);
                if (newSession) {
                    activeSessionId = newSession.id;
                    setCurrentSessionId(activeSessionId);
                    setSessions(prev => [newSession, ...prev]);
                }
            }

            await saveChatMessage(studySetId, 'user', userText, activeSessionId || undefined);

            const historyForAI = messages.map(m => ({ role: m.role, content: m.content }));

            // Create placeholder message for streaming
            const aiMsgId = (Date.now() + 1).toString();
            setStreamingMsgId(aiMsgId);
            setIsStreaming(true);
            setLoading(false); // Hide loading dots, show streaming cursor instead

            const placeholderMsg: ChatMessage = {
                id: aiMsgId,
                role: 'assistant',
                content: '',
                created_at: new Date().toISOString(),
                study_set_id: studySetId,
                user_id: 'system',
                session_id: activeSessionId || undefined
            };
            setMessages(prev => [...prev, placeholderMsg]);

            // Use streaming response
            const finalText = await getZpBotResponseStream(
                userText,
                contextText || '',
                historyForAI,
                // onChunk - update message content in real-time
                (accumulatedText) => {
                    setMessages(prev => prev.map(m =>
                        m.id === aiMsgId ? { ...m, content: accumulatedText } : m
                    ));
                },
                // onComplete - handle suggestions
                (newSuggestions) => {
                    setIsStreaming(false);
                    setStreamingMsgId(null);
                    setSuggestions(newSuggestions);
                }
            );

            // Save final message to DB
            await saveChatMessage(studySetId, 'assistant', finalText, activeSessionId || undefined);

            // Check if we should generate an image for this response
            if (isImageServiceAvailable() && shouldGenerateImage(userText, finalText)) {
                setGeneratingImage(true);
                try {
                    const imageResult = await generateEducationalImage(userText, contextText);
                    if (imageResult?.url) {
                        setMessageImages(prev => ({ ...prev, [aiMsgId]: imageResult.url }));
                    }
                } catch (imgError) {
                    console.error('Image generation failed:', imgError);
                } finally {
                    setGeneratingImage(false);
                }
            }

        } catch (error) {
            console.error('Error in chat loop', error);
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                content: '😵‍💫 Error de conexión.',
                created_at: new Date().toISOString(),
                study_set_id: studySetId,
                user_id: 'system'
            }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-full shadow-xl shadow-cyan-500/30 flex items-center justify-center text-white hover:scale-110 transition-transform z-50 group border-2 border-white/20"
                >
                    <span className="material-symbols-outlined text-3xl">smart_toy</span>
                </button>
            )}

            {isOpen && (
                <div className="fixed bottom-6 right-6 w-[400px] h-[600px] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex overflow-hidden z-50 animate-in slide-in-from-bottom-10 fade-in duration-300">
                    <div className={`${isSidebarOpen ? 'w-64' : 'w-0'} bg-slate-950 transition-all duration-300 border-r border-slate-800 flex flex-col overflow-hidden relative`}>
                        <div className="p-3 border-b border-slate-800 flex justify-between items-center min-w-[256px]">
                            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Historial</span>
                            <button onClick={() => setIsSidebarOpen(false)} className="text-slate-500 hover:text-white">
                                <span className="material-symbols-outlined text-lg">first_page</span>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 min-w-[256px]">
                            <button
                                onClick={handleNewChat}
                                className="w-full mb-3 flex items-center gap-2 p-3 bg-cyan-600/10 hover:bg-cyan-600/20 text-cyan-400 rounded-xl border border-dashed border-cyan-500/30 transition-all"
                            >
                                <span className="material-symbols-outlined text-lg">add</span>
                                <span className="text-sm font-medium">Nuevo Chat</span>
                            </button>

                            {sessions.map(session => (
                                <div
                                    key={session.id}
                                    onClick={() => handleSelectSession(session.id)}
                                    className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer mb-1 transition-colors ${currentSessionId === session.id ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'}`}
                                >
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <span className="material-symbols-outlined text-lg opacity-70">chat_bubble_outline</span>
                                        <span className="text-sm truncate max-w-[140px]">{session.title}</span>
                                    </div>
                                    <button
                                        onClick={(e) => handleDeleteSession(e, session.id)}
                                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity"
                                    >
                                        <span className="material-symbols-outlined text-sm">delete</span>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col w-full h-full relative">
                        <div className="bg-slate-800 p-3 border-b border-slate-700 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                                    className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 transition-colors"
                                >
                                    <span className="material-symbols-outlined">menu</span>
                                </button>
                                <span className="font-bold text-white flex items-center gap-2">
                                    <span className="material-symbols-outlined text-cyan-400">smart_toy</span>
                                    ZpBot
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={startFlashcardFlow}
                                    className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-emerald-400 transition-colors"
                                    title="Crear Flashcards con IA"
                                    disabled={loading || fcMode !== 'idle'}
                                >
                                    <span className="material-symbols-outlined">style</span>
                                </button>
                                <button
                                    onClick={startResearchFlow}
                                    className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-cyan-400 transition-colors"
                                    title="Investigar Tema"
                                    disabled={loading || researchMode !== 'idle'}
                                >
                                    <span className="material-symbols-outlined">search</span>
                                </button>
                                <button
                                    onClick={handleNewChat}
                                    className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-cyan-400 transition-colors"
                                    title="Nuevo Chat"
                                >
                                    <span className="material-symbols-outlined">add_comment</span>
                                </button>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded-lg text-slate-400 transition-colors"
                                >
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900/95 scrollbar-thin scrollbar-thumb-slate-700">
                            {!currentSessionId && messages.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-slate-500 p-6 text-center animate-in fade-in zoom-in duration-500">
                                    <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 shadow-xl shadow-cyan-900/10">
                                        <span className="material-symbols-outlined text-4xl text-cyan-500">smart_toy</span>
                                    </div>
                                    <h4 className="text-white font-medium mb-1">¡Hola! Soy ZpBot</h4>
                                    <p className="text-sm">¿En qué te ayudo hoy?</p>
                                </div>
                            )}

                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-[85%] rounded-2xl p-3 text-sm leading-relaxed ${msg.role === 'user'
                                            ? 'bg-blue-600 text-white rounded-tr-none shadow-lg shadow-blue-900/20'
                                            : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-none shadow-sm'
                                            }`}
                                    >
                                        {msg.content}
                                        {/* Streaming cursor */}
                                        {isStreaming && msg.id === streamingMsgId && (
                                            <span className="inline-block w-2 h-4 ml-1 bg-cyan-400 animate-pulse rounded-sm" />
                                        )}

                                        {/* Generated image */}
                                        {msg.role === 'assistant' && messageImages[msg.id] && (
                                            <div className="mt-3 rounded-lg overflow-hidden border border-slate-600">
                                                <img
                                                    src={messageImages[msg.id]}
                                                    alt="Ilustracion educativa"
                                                    className="w-full h-auto"
                                                    loading="lazy"
                                                />
                                                <div className="bg-slate-700/50 px-2 py-1 text-[10px] text-slate-400 flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-xs">auto_awesome</span>
                                                    Imagen generada por IA
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {/* Loading indicator (only when not streaming) */}
                            {loading && !isStreaming && (
                                <div className="flex justify-start">
                                    <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-tl-none p-4 shadow-sm">
                                        <div className="flex gap-1.5">
                                            <span className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce"></span>
                                            <span className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce delay-100"></span>
                                            <span className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce delay-200"></span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Image generation indicator */}
                            {generatingImage && (
                                <div className="flex justify-start pl-4">
                                    <div className="flex items-center gap-2 text-xs text-cyan-400 bg-slate-800/50 px-3 py-2 rounded-xl border border-cyan-500/20">
                                        <span className="material-symbols-outlined text-sm animate-spin">refresh</span>
                                        Generando ilustracion...
                                    </div>
                                </div>
                            )}

                            {fcMode === 'preview' && generatedCards.length > 0 && (
                                <div className="space-y-3 pl-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="bg-slate-800 border border-emerald-500/30 rounded-2xl p-4 shadow-lg shadow-emerald-900/10">
                                        <div className="flex justify-between items-center mb-3">
                                            <h5 className="text-emerald-400 font-bold text-sm flex items-center gap-2">
                                                <span className="material-symbols-outlined text-lg">smart_toy</span>
                                                Vista Previa ({generatedCards.length})
                                            </h5>
                                            <button
                                                onClick={() => { setFcMode('idle'); setGeneratedCards([]); }}
                                                className="text-slate-400 hover:text-white"
                                            >
                                                <span className="material-symbols-outlined text-sm">close</span>
                                            </button>
                                        </div>
                                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-600 mb-3">
                                            {generatedCards.map((c, i) => (
                                                <div key={i} className="bg-slate-900/50 p-2 rounded-lg border border-slate-700/50 text-xs">
                                                    <p className="font-bold text-slate-200 mb-1">P: {c.question}</p>
                                                    <p className="text-slate-400">R: {c.answer}</p>
                                                </div>
                                            ))}
                                        </div>
                                        <button
                                            onClick={saveGeneratedFlashcards}
                                            className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm transition shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2"
                                        >
                                            <span className="material-symbols-outlined text-sm">save</span>
                                            Guardar Flashcards
                                        </button>
                                    </div>
                                </div>
                            )}

                            {researchMode === 'results' && researchResults.length > 0 && (
                                <div className="space-y-3 pl-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="bg-slate-800 border border-cyan-500/30 rounded-2xl p-4 shadow-lg shadow-cyan-900/10">
                                        <div className="flex justify-between items-center mb-3">
                                            <div className="flex flex-col gap-1">
                                                <h5 className="text-cyan-400 font-bold text-sm flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-lg">travel_explore</span>
                                                    Resultados de Investigacion ({researchResults.length})
                                                </h5>
                                                {/* Real search badge */}
                                                {isSearchServiceAvailable() && (
                                                    <div className="flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-[10px] text-green-400">verified</span>
                                                        <span className="text-[10px] text-green-400 font-medium">URLs verificadas de internet</span>
                                                    </div>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => { setResearchMode('idle'); setResearchResults([]); }}
                                                className="text-slate-400 hover:text-white"
                                            >
                                                <span className="material-symbols-outlined text-sm">close</span>
                                            </button>
                                        </div>
                                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-600 mb-3">
                                            {researchResults.map((res, i) => (
                                                <div key={i} className="bg-slate-900/50 p-3 rounded-xl border border-slate-700/50 hover:border-cyan-500/30 transition-all group">
                                                    <div className="flex justify-between items-start gap-2 mb-1">
                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${res.type === 'youtube' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                                            {res.type}
                                                        </span>
                                                        <a href={res.url} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-cyan-400">
                                                            <span className="material-symbols-outlined text-sm">open_in_new</span>
                                                        </a>
                                                    </div>
                                                    <p className="font-bold text-slate-200 text-xs mb-1 line-clamp-1">{res.title}</p>
                                                    <p className="text-slate-400 text-[11px] mb-2 line-clamp-2">{res.snippet}</p>
                                                    <button
                                                        onClick={() => handleAddResourceAsMaterial(res)}
                                                        className="w-full py-1.5 bg-slate-700 hover:bg-cyan-600 text-white rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1"
                                                    >
                                                        <span className="material-symbols-outlined text-[14px]">add</span>
                                                        Añadir a Materiales
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {!loading && suggestions.length > 0 && (
                                <div className="pl-2 space-y-2 animate-in slide-in-from-left-2 fade-in duration-300">
                                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider ml-1 mb-1">Sugerencias Inteligentes</p>
                                    <div className="flex flex-wrap gap-2">
                                        {suggestions.map((s, i) => (
                                            <button
                                                key={i}
                                                onClick={() => handleSend(s)}
                                                className="text-left text-xs bg-slate-800 hover:bg-slate-700 hover:border-cyan-500/50 text-cyan-300/90 border border-slate-700 rounded-xl px-3 py-2 transition-all shadow-sm"
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        <div className="p-3 bg-slate-800 border-t border-slate-700">
                            <div className="relative flex items-center gap-2">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                    placeholder="Escribe tu duda..."
                                    disabled={loading}
                                    className="w-full bg-slate-900 text-white placeholder-slate-500 border border-slate-700 rounded-xl px-4 py-3 pl-4 pr-12 focus:outline-none focus:border-cyan-500 transition-all shadow-inner"
                                />
                                <button
                                    onClick={() => handleSend()}
                                    disabled={!input.trim() || loading}
                                    className="absolute right-2 p-1.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 disabled:opacity-50 disabled:hover:bg-cyan-600 transition-colors shadow-lg shadow-cyan-900/30"
                                >
                                    <span className="material-symbols-outlined text-lg">send</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ZpBotChat;
