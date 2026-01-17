import React, { useState, useEffect, useRef } from 'react';
import { getTutorResponse } from '../services/geminiService';
import { supabase } from '../services/supabaseClient';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

interface AITutorChatProps {
    classId?: string; // Optional now
    topic?: string;   // Fallback context
}

const AITutorChat: React.FC<AITutorChatProps> = ({ classId, topic }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { id: '1', role: 'assistant', content: 'Hola, soy tu tutor de IA. ¿En qué puedo ayudarte hoy?' }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [context, setContext] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen && !context) {
            loadClassContext();
        }
    }, [isOpen]);

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const loadClassContext = async () => {
        if (!classId) {
            setContext(`Contexto general: ${topic || 'Estudio general'}`);
            return;
        }

        try {
            // Fetch content_text from all materials in this class
            const { data: materials } = await supabase
                .from('materials')
                .select('content_text, name')
                .eq('class_id', classId)
                .eq('status', 'ready');

            if (materials && materials.length > 0) {
                // Concatenate text, prioritizing recent usage or just brute force for now
                // Limit to ~30k chars to stay safe with tokens provided to Gemini
                const fullText = materials
                    .map(m => `--- Documento: ${m.name} ---\n${m.content_text || ''}\n`)
                    .join('\n');

                setContext(fullText.slice(0, 30000));
            } else {
                setContext('No hay materiales con contenido de texto disponible para esta clase.');
            }
        } catch (error) {
            console.error('Error loading context:', error);
        }
    };

    const handleSend = async (text?: string, mode: 'standard' | 'hint' | 'analogy' = 'standard') => {
        const contentToSend = text || input;

        // If special mode without text, use "CONTEXTO_ANTERIOR" or implied request
        let finalContent = contentToSend;
        if (!finalContent && mode !== 'standard') {
            if (mode === 'hint') finalContent = "No sé la respuesta, dame una pista";
            if (mode === 'analogy') finalContent = "Explícalo con una metáfora o analogía";
        }

        if (!finalContent.trim() || loading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: finalContent
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setLoading(true);

        try {
            const response = await getTutorResponse(finalContent, context, topic, mode);
            const aiMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: response || 'Lo siento, tuve un problema pensando la respuesta.'
            };
            setMessages(prev => [...prev, aiMessage]);
        } catch (error) {
            console.error('Error getting AI response:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {/* Floating Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-full shadow-2xl flex items-center justify-center text-white hover:scale-110 transition-transform z-50 group"
            >
                <span className="material-symbols-outlined text-3xl group-hover:animate-pulse">smart_toy</span>
                {!isOpen && (
                    <span className="absolute -top-2 -right-2 bg-red-500 w-4 h-4 rounded-full border-2 border-white"></span>
                )}
            </button>

            {/* Chat Window */}
            {isOpen && (
                <div className="fixed bottom-24 right-6 w-96 h-[500px] bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden z-50 animate-in slide-in-from-bottom-10 fade-in duration-300">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-violet-600 to-fuchsia-600 p-4 flex items-center justify-between text-white">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                                <span className="material-symbols-outlined">neurology</span>
                            </div>
                            <div>
                                <h3 className="font-bold">Neuropath AI Tutor</h3>
                                <p className="text-xs text-violet-100 flex items-center gap-1">
                                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                                    {context ? 'Contexto cargado' : 'Cargando contexto...'}
                                </p>
                            </div>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[85%] rounded-2xl p-3 text-sm ${msg.role === 'user'
                                        ? 'bg-violet-600 text-white rounded-tr-none shadow-md'
                                        : 'bg-white text-slate-700 border border-slate-200 rounded-tl-none shadow-sm'
                                        }`}
                                >
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none p-3 shadow-sm">
                                    <div className="flex gap-1">
                                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
                                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-100"></span>
                                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-200"></span>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>


                    {/* Quick Actions */}
                    <div className="px-4 py-2 flex gap-2 overflow-x-auto">
                        <button
                            onClick={() => handleSend(undefined, 'hint')}
                            disabled={loading || messages.length <= 1}
                            className="flex items-center gap-1 px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold hover:bg-yellow-200 transition-colors whitespace-nowrap disabled:opacity-50"
                        >
                            <span className="material-symbols-outlined text-sm">lightbulb</span> Pista
                        </button>
                        <button
                            onClick={() => handleSend(undefined, 'analogy')}
                            disabled={loading || messages.length <= 1}
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-xs font-bold hover:bg-blue-200 transition-colors whitespace-nowrap disabled:opacity-50"
                        >
                            <span className="material-symbols-outlined text-sm">auto_stories</span> Metáfora
                        </button>
                    </div>

                    {/* Input */}
                    <div className="p-4 bg-white border-t border-slate-100">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                placeholder="Pregunta sobre la clase..."
                                disabled={loading}
                                className="flex-1 bg-slate-100 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                            />
                            <button
                                onClick={() => handleSend()}
                                disabled={!input.trim() || loading}
                                className="bg-violet-600 text-white w-10 h-10 rounded-xl flex items-center justify-center hover:bg-violet-700 transition-colors disabled:opacity-50"
                            >
                                <span className="material-symbols-outlined text-sm">send</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default AITutorChat;
