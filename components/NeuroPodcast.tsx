import React, { useState, useEffect, useRef } from 'react';
import { generatePodcastScript } from '../services/geminiService';

interface PodcastLine {
    speaker: string;
    text: string;
}

interface NeuroPodcastProps {
    context: string;
    topicTitle: string;
}

const NeuroPodcast: React.FC<NeuroPodcastProps> = ({ context, topicTitle }) => {
    const [script, setScript] = useState<PodcastLine[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentLineIndex, setCurrentLineIndex] = useState(0);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [error, setError] = useState('');

    const synth = window.speechSynthesis;
    const highlightRef = useRef<HTMLDivElement>(null);

    // Generate Script on Mount
    useEffect(() => {
        const initPodcast = async () => {
            setLoading(true);
            try {
                const generatedScript = await generatePodcastScript(context);
                if (generatedScript && generatedScript.length > 0) {
                    setScript(generatedScript);
                } else {
                    setError("No pudimos generar un guion para este contenido.");
                }
            } catch (err) {
                setError("Error al conectar con el estudio de grabación.");
            } finally {
                setLoading(false);
            }
        };
        initPodcast();

        // Cleanup speech on unmount
        return () => {
            synth.cancel();
        };
    }, [context]);

    // Handle Speech Logic
    useEffect(() => {
        if (loading || script.length === 0) return;

        if (isPlaying) {
            if (synth.speaking) {
                // Already speaking, just ensure not paused
                synth.resume();
            } else {
                // Start speaking current line
                speakLine(currentLineIndex);
            }
        } else {
            synth.pause();
        }
    }, [isPlaying, script, loading]);


    const speakLine = (index: number) => {
        if (index >= script.length) {
            setIsPlaying(false);
            setCurrentLineIndex(0);
            return;
        }

        const line = script[index];
        const utterance = new SpeechSynthesisUtterance(line.text);
        utterance.rate = playbackSpeed;

        // Select Voice based on Speaker
        const voices = synth.getVoices();
        // Try to find male/female distinct voices. This is browser dependent.
        // Mac/Chrome usually has Google US English or system voices. 
        // We try to pick spanish voices if available given the content is likely spanish? 
        // Or just distinct voices. Let's assume Spanish for now based on context.
        const esVoices = voices.filter(v => v.lang.startsWith('es'));

        if (esVoices.length > 0) {
            if (line.speaker === 'Alex') {
                utterance.voice = esVoices[0]; // First voice
            } else {
                utterance.voice = esVoices.length > 1 ? esVoices[1] : esVoices[0]; // Second voice or falback
            }
        }

        utterance.onend = () => {
            setCurrentLineIndex(prev => {
                const next = prev + 1;
                if (isPlaying && next < script.length) {
                    speakLine(next);
                } else if (next >= script.length) {
                    setIsPlaying(false);
                }
                return next;
            });
        };

        // Force auto-scroll
        if (highlightRef.current) {
            const activeElement = document.getElementById(`line-${index}`);
            activeElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        synth.speak(utterance);
    };

    const togglePlay = () => {
        if (isPlaying) {
            setIsPlaying(false);
            synth.cancel(); // Reset to avoid weird pause states in some browsers
        } else {
            setIsPlaying(true);
            speakLine(currentLineIndex);
        }
    };

    const handleRestart = () => {
        synth.cancel();
        setCurrentLineIndex(0);
        setIsPlaying(true);
        speakLine(0);
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-96 text-center p-8 bg-slate-900 rounded-3xl text-white">
                <div className="w-16 h-16 mb-6 relative">
                    <span className="absolute inset-0 animate-ping rounded-full bg-violet-500 opacity-75"></span>
                    <div className="relative bg-violet-600 w-16 h-16 rounded-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-3xl">mic</span>
                    </div>
                </div>
                <h3 className="text-2xl font-bold mb-2">Produciendo Podcast...</h3>
                <p className="text-slate-400">Nuestros presentadores IA están leyendo tus notas.</p>
            </div>
        );
    }

    if (error) {
        return <div className="p-8 text-center text-rose-500 bg-rose-50 rounded-3xl">{error}</div>;
    }

    return (
        <div className="bg-slate-900 text-white rounded-3xl overflow-hidden shadow-2xl max-w-4xl mx-auto border border-slate-800">
            {/* Tape Recorder Header Style */}
            <div className="p-6 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className={`w-3 h-3 rounded-full ${isPlaying ? 'bg-red-500 animate-pulse' : 'bg-slate-600'}`}></div>
                    <div>
                        <h2 className="font-bold text-lg tracking-wide">NEURO PODCAST</h2>
                        <p className="text-xs text-slate-400 uppercase tracking-widest">{topicTitle || 'Episodio Especial'}</p>
                    </div>
                </div>
                <div className="flex bg-slate-900 rounded-lg p-1">
                    {[1, 1.5, 2].map(speed => (
                        <button
                            key={speed}
                            onClick={() => setPlaybackSpeed(speed)}
                            className={`px-3 py-1 rounded text-xs font-bold transition-all ${playbackSpeed === speed ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'}`}
                        >
                            {speed}x
                        </button>
                    ))}
                </div>
            </div>

            {/* Cassette / Visualizer Area (Static for now) */}
            <div className="h-32 bg-gradient-to-br from-violet-900/50 to-indigo-900/50 flex items-center justify-center relative overflow-hidden">
                <div className="flex items-end gap-1 h-16">
                    {[...Array(20)].map((_, i) => (
                        <div
                            key={i}
                            className={`w-2 rounded-full bg-violet-500 transition-all duration-100 ${isPlaying ? 'animate-music-bar' : 'h-2'}`}
                            style={{
                                height: isPlaying ? `${Math.random() * 100}%` : '4px',
                                animationDelay: `${i * 0.05}s`
                            }}
                        ></div>
                    ))}
                </div>
            </div>

            {/* Transcript */}
            <div className="h-96 overflow-y-auto p-8 bg-slate-900 space-y-6" ref={highlightRef}>
                {script.map((line, i) => (
                    <div
                        id={`line-${i}`}
                        key={i}
                        className={`flex gap-4 transition-all duration-500 ${i === currentLineIndex ? 'opacity-100 scale-105' : 'opacity-40 grayscale blur-[1px]'}`}
                    >
                        <div className={`w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-xl
                      ${line.speaker === 'Alex' ? 'bg-blue-500 text-white' : 'bg-pink-500 text-white'}
                  `}>
                            {line.speaker[0]}
                        </div>
                        <div>
                            <h4 className={`text-sm font-bold mb-1 ${line.speaker === 'Alex' ? 'text-blue-400' : 'text-pink-400'}`}>
                                {line.speaker}
                            </h4>
                            <p className="text-lg leading-relaxed font-serif text-slate-200">
                                {line.text}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Controls */}
            <div className="p-6 bg-slate-800 border-t border-slate-700 flex justify-center gap-6">
                <button onClick={() => {
                    const prev = Math.max(0, currentLineIndex - 1);
                    setCurrentLineIndex(prev);
                    if (isPlaying) {
                        synth.cancel();
                        speakLine(prev);
                    }
                }} className="p-4 rounded-full bg-slate-700 hover:bg-slate-600 transition-all text-white">
                    <span className="material-symbols-outlined">skip_previous</span>
                </button>

                <button onClick={togglePlay} className="w-20 h-20 rounded-full bg-white text-slate-900 hover:scale-105 transition-all flex items-center justify-center shadow-lg shadow-violet-500/20">
                    <span className="material-symbols-outlined text-4xl fill-1 ml-1">{isPlaying ? 'pause' : 'play_arrow'}</span>
                </button>

                <button onClick={() => {
                    const next = Math.min(script.length - 1, currentLineIndex + 1);
                    setCurrentLineIndex(next);
                    if (isPlaying) {
                        synth.cancel();
                        speakLine(next);
                    }
                }} className="p-4 rounded-full bg-slate-700 hover:bg-slate-600 transition-all text-white">
                    <span className="material-symbols-outlined">skip_next</span>
                </button>
            </div>

            <style>{`
        @keyframes music-bar {
            0%, 100% { height: 10%; }
            50% { height: 80%; }
        } 
      `}</style>
        </div>
    );
};

export default NeuroPodcast;
