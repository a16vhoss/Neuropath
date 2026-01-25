import React, { useState, useEffect, useRef } from 'react';
import { getZpBotResponse } from '../services/geminiService';
import { getChatHistory, saveChatMessage, ChatMessage } from '../services/ChatService';

interface ZpBotChatProps {
    studySetId: string;
    contextText?: string; // All material text combined
}

const ZpBotChat: React.FC<ZpBotChatProps> = ({ studySetId, contextText }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [hasLoadedHistory, setHasLoadedHistory] = useState(false);

    // Initial load of history
    useEffect(() => {
        if (studySetId && isOpen && !hasLoadedHistory) {
            loadHistory();
        }
    }, [studySetId, isOpen]);

    const loadHistory = async () => {
        setLoading(true);
        try {
            const history = await getChatHistory(studySetId);
            if (history && history.length > 0) {
                setMessages(history);
            } else {
                // Initial greeting if no history
                const initialMsg: ChatMessage = {
                    id: 'init-1',
                    role: 'assistant',
                    content: '¡Hola! Soy ZpBot 🤖. Estoy conectado a tus materiales. Pregúntame lo que quieras y te ayudaré (incluso con respuestas directas 😉).',
                    created_at: new Date().toISOString(),
                    study_set_id: studySetId,
                    user_id: 'system'
                };
                setMessages([initialMsg]);
                // Usually we don't save the initial greeting to DB unless user interacts, 
                // but let's leave it ephemeral until first message.
            }
            setHasLoadedHistory(true);
        } catch (error) {
            console.error('Error loading history', error);
        } finally {
            setLoading(false);
        }
    };

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isOpen]);

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userText = input;
        setInput('');
        setLoading(true);

        // Optimizistic UI update
        const tempUserMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: userText,
            created_at: new Date().toISOString(),
            study_set_id: studySetId,
            user_id: 'me'
        };
        setMessages(prev => [...prev, tempUserMsg]);

        try {
            // 1. Save User Message to DB
            await saveChatMessage(studySetId, 'user', userText);

            // 2. Get AI Response
            // Simplify history for the prompt to just role/content
            const historyForAI = messages.map(m => ({ role: m.role, content: m.content }));

            const aiResponseText = await getZpBotResponse(
                userText,
                contextText || '',
                historyForAI
            );

            // 3. Save AI Message to DB
            const savedAiMsg = await saveChatMessage(studySetId, 'assistant', aiResponseText);

            // 4. Update UI with real saved message (or fallback)
            const aiMsgDisplay: ChatMessage = savedAiMsg || {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: aiResponseText,
                created_at: new Date().toISOString(),
                study_set_id: studySetId,
                user_id: 'system'
            };

            setMessages(prev => [...prev, aiMsgDisplay]);

        } catch (error) {
            console.error('Error in chat loop', error);
            // Error feedback
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                content: '😵‍💫 Lo siento, hubo un error de conexión. Intenta de nuevo.',
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
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-full shadow-xl shadow-cyan-500/30 flex items-center justify-center text-white hover:scale-110 transition-transform z-50 group border-2 border-white/20"
            >
                <span className="material-symbols-outlined text-3xl">smart_toy</span>
                {!isOpen && messages.length === 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-cyan-500"></span>
                    </span>
                )}
            </button>

            {/* Chat Window */}
            {isOpen && (
                <div className="fixed bottom-24 right-6 w-96 h-[500px] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50 animate-in slide-in-from-bottom-10 fade-in duration-300">
                    {/* Header */}
                    <div className="bg-slate-800 p-4 border-b border-slate-700 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center">
                                <span className="material-symbols-outlined text-white">smart_toy</span>
                            </div>
                            <div>
                                <h3 className="font-bold text-white">ZpBot</h3>
                                <p className="text-xs text-cyan-400 flex items-center gap-1">
                                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                    En línea
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="text-slate-400 hover:text-white transition-colors"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900/95 scrollbar-thin scrollbar-thumb-slate-700">
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[85%] rounded-2xl p-3 text-sm leading-relaxed ${msg.role === 'user'
                                            ? 'bg-blue-600 text-white rounded-tr-none'
                                            : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-none'
                                        }`}
                                >
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-tl-none p-3">
                                    <div className="flex gap-1">
                                        <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"></span>
                                        <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-100"></span>
                                        <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-200"></span>
                                    </div>
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
                                className="w-full bg-slate-900 text-white placeholder-slate-500 border border-slate-700 rounded-xl px-4 py-3 pl-4 pr-12 focus:outline-none focus:border-cyan-500 transition-colors"
                            />
                            <button
                                onClick={handleSend}
                                disabled={!input.trim() || loading}
                                className="absolute right-2 p-1.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 disabled:opacity-50 disabled:hover:bg-cyan-600 transition-colors"
                            >
                                <span className="material-symbols-outlined text-lg">send</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ZpBotChat;
