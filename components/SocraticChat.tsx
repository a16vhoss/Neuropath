import React, { useState, useRef, useEffect } from 'react';
import { getTutorResponse } from '../services/geminiService';
import { useAuth } from '../contexts/AuthContext';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

interface SocraticChatProps {
    context: string; // The active flashcard or topic
    studentName?: string;
}

const SocraticChat: React.FC<SocraticChatProps> = ({ context, studentName }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [isTyping, setIsTyping] = useState(false);

    // Initial greeting
    useEffect(() => {
        if (isOpen && messages.length === 0) {
            const initialMessage: Message = {
                id: 'init',
                role: 'assistant',
                content: `¡Hola ${studentName || 'estudiante'}! Soy tu tutor Socrático. 🦉\n\nNo te daré las respuestas, pero te ayudaré a encontrarlas. ¿En qué concepto te has atascado?`,
                timestamp: new Date()
            };
            setMessages([initialMessage]);
        }
    }, [isOpen, messages.length, studentName]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);
        setIsTyping(true);

        try {
            // Small delay to simulate thinking
            await new Promise(resolve => setTimeout(resolve, 600));

            const response = await getTutorResponse(userMsg.content, context);

            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: response || "Lo siento, estoy teniendo problemas para pensar ahora mismo. ¿Intentamos otra vez?",
                timestamp: new Date()
            };

            setMessages(prev => [...prev, aiMsg]);
        } catch (error) {
            console.error("Chat error", error);
        } finally {
            setLoading(false);
            setIsTyping(false);
        }
    };

    const handleHintRequest = async () => {
        const hintMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: "Dame una pista, por favor.",
            timestamp: new Date()
        };
        setMessages(prev => [...prev, hintMsg]);
        setInput('');
        setLoading(true);
        setIsTyping(true);

        try {
            const response = await getTutorResponse("Dame una pista sutil, no la respuesta completa.", context);
            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: response || "Piensa en las palabras clave del concepto...",
                timestamp: new Date()
            };
            setMessages(prev => [...prev, aiMsg]);
        } catch (error) {
            console.error("Hint error", error);
        } finally {
            setLoading(false);
            setIsTyping(false);
        }
    }

    return (
        <>
            {/* Floating Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`fixed bottom-6 right-6 z-50 transition-all duration-300 shadow-2xl flex items-center justify-center
          ${isOpen ? 'w-12 h-12 bg-slate-200 text-slate-600 rounded-full rotate-90' : 'w-16 h-16 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-2xl hover:scale-110 rotate-0'}
        `}
            >
                <span className="material-symbols-outlined text-3xl">
                    {isOpen ? 'close' : 'smart_toy'}
                </span>
                {!isOpen && (
                    <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full border-2 border-white"></span>
                )}
            </button>

            {/* Chat Window */}
            <div
                className={`fixed bottom-24 right-6 w-[90vw] md:w-[400px] bg-white rounded-3xl shadow-2xl z-40 flex flex-col transition-all duration-300 origin-bottom-right border border-slate-100 overflow-hidden
        ${isOpen ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto h-[600px] max-h-[80vh]' : 'opacity-0 scale-90 translate-y-10 pointer-events-none h-0'}
        `}
            >
                {/* Header */}
                <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg">
                        <span className="material-symbols-outlined text-white text-xl">school</span>
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 leading-none">Tutor Socrático</h3>
                        <p className="text-xs text-violet-600 font-medium mt-1">Guía IA • Online</p>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white scrollbar-hide">
                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm
                  ${msg.role === 'user'
                                        ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-tr-sm'
                                        : 'bg-slate-100 text-slate-800 rounded-tl-sm border border-slate-200'}
                `}
                            >
                                {msg.content}
                            </div>
                        </div>
                    ))}
                    {isTyping && (
                        <div className="flex justify-start">
                            <div className="bg-slate-100 p-4 rounded-2xl rounded-tl-sm border border-slate-200 flex gap-2 items-center">
                                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
                                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-75"></span>
                                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-150"></span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 border-t border-slate-100 bg-slate-50">
                    {/* Quick Actions */}
                    <div className="flex gap-2 mb-3 overflow-x-auto pb-1 scrollbar-hide">
                        <button
                            onClick={handleHintRequest}
                            disabled={loading}
                            className="whitespace-nowrap px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold hover:bg-amber-200 transition-colors flex items-center gap-1"
                        >
                            <span className="material-symbols-outlined text-sm">lightbulb</span>
                            Dame una pista
                        </button>
                        <button
                            onClick={() => setInput("¿Puedes explicarme esto con una analogía?")}
                            disabled={loading}
                            className="whitespace-nowrap px-3 py-1.5 bg-violet-100 text-violet-700 rounded-lg text-xs font-bold hover:bg-violet-200 transition-colors"
                        >
                            Usar una analogía
                        </button>
                    </div>

                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Pregunta o responde..."
                            className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-200 outline-none text-sm transition-all shadow-sm"
                        />
                        <button
                            onClick={handleSend}
                            disabled={loading || !input.trim()}
                            className="bg-violet-600 text-white w-12 rounded-xl hover:bg-violet-700 disabled:opacity-50 flex items-center justify-center shadow-lg shadow-violet-200 transition-all hover:scale-105 active:scale-95"
                        >
                            <span className="material-symbols-outlined">send</span>
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default SocraticChat;
