import React, { useState, useEffect, useRef } from 'react';
import { getZpBotResponse } from '../services/geminiService';
import {
    saveChatMessage,
    ChatMessage,
    ChatSession,
    getChatSessions,
    createChatSession,
    getSessionMessages,
    deleteChatSession,
    updateSessionTitle
} from '../services/ChatService';

interface ZpBotChatProps {
    studySetId: string;
    contextText?: string; // All material text combined
}

const ZpBotChat: React.FC<ZpBotChatProps> = ({ studySetId, contextText }) => {
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

    // Initial load: Fetch sessions
    useEffect(() => {
        if (studySetId && isOpen) {
            loadSessions();
        }
    }, [studySetId, isOpen]);

    // When session changes, load messages
    useEffect(() => {
        if (currentSessionId) {
            loadMessages(currentSessionId);
        } else {
            // New Chat State
            setMessages([]);
            setSuggestions(["¿De qué trata este Study Set?", "¿Puedes hacerme un resumen?", "¿Qué es lo más importante?"]);
        }
    }, [currentSessionId]);

    const loadSessions = async () => {
        const list = await getChatSessions(studySetId);
        setSessions(list);

        // Auto-select most recent if exists
        if (list.length > 0 && !currentSessionId) {
            setCurrentSessionId(list[0].id);
        }
    };

    const loadMessages = async (sessionId: string) => {
        setLoading(true);
        try {
            const history = await getSessionMessages(sessionId);
            setMessages(history);
            setSuggestions([]); // Clear initial suggestions on historic load
        } catch (error) {
            console.error('Error loading messages', error);
        } finally {
            setLoading(false);
        }
    };

    const handleNewChat = () => {
        setCurrentSessionId(null); // Reset to "New Chat" state
        setIsSidebarOpen(false); // Close sidebar on mobile/small view if needed
    };

    const handleSelectSession = (sessionId: string) => {
        setCurrentSessionId(sessionId);
        setIsSidebarOpen(false);
    };

    const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
        e.stopPropagation();
        if (!window.confirm('¿Borrar este chat?')) return;

        await deleteChatSession(sessionId);

        // Refresh list
        const updated = sessions.filter(s => s.id !== sessionId);
        setSessions(updated);

        if (currentSessionId === sessionId) {
            if (updated.length > 0) setCurrentSessionId(updated[0].id);
            else setCurrentSessionId(null);
        }
    };

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isOpen, suggestions]);

    const handleSend = async (text?: string) => {
        const userText = text || input;
        if (!userText.trim() || loading) return;

        setInput('');
        setSuggestions([]);
        setLoading(true);

        // Optimistic UI
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

            // Create session if new
            if (!activeSessionId) {
                // Generate simple title from first few words of message
                const newTitle = userText.length > 30 ? userText.substring(0, 30) + '...' : userText;
                const newSession = await createChatSession(studySetId, newTitle);
                if (newSession) {
                    activeSessionId = newSession.id;
                    setCurrentSessionId(activeSessionId);
                    setSessions(prev => [newSession, ...prev]);
                }
            }

            // 1. Save User Message
            await saveChatMessage(studySetId, 'user', userText, activeSessionId || undefined);

            // 2. AI Response
            const historyForAI = messages.map(m => ({ role: m.role, content: m.content }));
            const aiResponse = await getZpBotResponse(userText, contextText || '', historyForAI);

            // 3. Save AI Message
            const savedAiMsg = await saveChatMessage(studySetId, 'assistant', aiResponse.text, activeSessionId || undefined);

            // 4. Update UI
            const aiMsgDisplay = savedAiMsg || {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: aiResponse.text,
                created_at: new Date().toISOString(),
                study_set_id: studySetId,
                user_id: 'system',
                session_id: activeSessionId
            };

            setMessages(prev => [...prev, aiMsgDisplay]);
            setSuggestions(aiResponse.suggestions || []);

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
            {/* Floating Button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-full shadow-xl shadow-cyan-500/30 flex items-center justify-center text-white hover:scale-110 transition-transform z-50 group border-2 border-white/20"
                >
                    <span className="material-symbols-outlined text-3xl">smart_toy</span>
                </button>
            )}

            {/* Main Window */}
            {isOpen && (
                <div className="fixed bottom-6 right-6 w-[400px] h-[600px] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex overflow-hidden z-50 animate-in slide-in-from-bottom-10 fade-in duration-300">

                    {/* Sidebar (History) */}
                    <div className={`${isSidebarOpen ? 'w-64' : 'w-0'} bg-slate-950 transition-all duration-300 border-r border-slate-800 flex flex-col overflow-hidden relative`}>
                        <div className="p-3 border-b border-slate-800 flex justify-between items-center min-w-[256px]">
                            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Historial</span>
                            <button onClick={() => setIsSidebarOpen(false)} className="text-slate-500 hover:text-white">
                                <span className="material-symbols-outlined text-lg">first_page</span>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 min-w-[256px]">
                            {/* New Chat Button in Sidebar */}
                            <button
                                onClick={handleNewChat}
                                className="w-full mb-3 flex items-center gap-2 p-3 bg-cyan-600/10 hover:bg-cyan-600/20 text-cyan-400 rounded-xl border border-dashed border-cyan-500/30 transition-all"
                            >
                                <span className="material-symbols-outlined text-lg">add</span>
                                <span className="text-sm font-medium">Nuevo Chat</span>
                            </button>

                            {/* Session List */}
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

                    {/* Chat Content */}
                    <div className="flex-1 flex flex-col w-full h-full relative">

                        {/* Header */}
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

                        {/* Messages */}
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
                                    </div>
                                </div>
                            ))}

                            {loading && (
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

                            {/* Suggestions */}
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

                        {/* Input Area */}
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
