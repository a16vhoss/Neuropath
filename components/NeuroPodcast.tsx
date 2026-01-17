import React, { useState, useEffect, useRef } from 'react';
import { generatePodcastScript } from '../services/geminiService';

const ELEVENLABS_API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY;

// Voice IDs
const VOICE_IDS = {
    Alex: 'pNInz6obpgDQGcFmaJgB', // Adam
    Sam: '21m00Tcm4TlvDq8ikWAM'   // Rachel
};

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
    const [audioCache, setAudioCache] = useState<Map<number, string>>(new Map());
    const [isLoadingAudio, setIsLoadingAudio] = useState(false);

    const audioRef = useRef<HTMLAudioElement | null>(null);
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

        return () => {
            // Cleanup audio URLs
            audioCache.forEach(url => URL.revokeObjectURL(url));
        };
    }, [context]);

    // Audio Playback Effects
    useEffect(() => {
        if (!isPlaying || currentLineIndex >= script.length) {
            if (audioRef.current) {
                audioRef.current.pause();
            }
            if (currentLineIndex >= script.length) {
                setIsPlaying(false);
                setCurrentLineIndex(0);
            }
            return;
        }

        playCurrentLine();
    }, [currentLineIndex, isPlaying, script]);

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.playbackRate = playbackSpeed;
        }
    }, [playbackSpeed]);

    const playCurrentLine = async () => {
        if (isLoadingAudio) return; // Prevent double fetch

        let audioUrl = audioCache.get(currentLineIndex);

        if (!audioUrl) {
            // Fetch from ElevenLabs
            setIsLoadingAudio(true);
            try {
                const line = script[currentLineIndex];
                const voiceId = VOICE_IDS[line.speaker as keyof typeof VOICE_IDS] || VOICE_IDS.Alex;

                const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
                    method: 'POST',
                    headers: {
                        'xi-api-key': ELEVENLABS_API_KEY,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        text: line.text,
                        model_id: "eleven_multilingual_v2",
                        voice_settings: {
                            stability: 0.5,
                            similarity_boost: 0.75
                        }
                    })
                });

                if (!response.ok) throw new Error('ElevenLabs API Error');

                const blob = await response.blob();
                audioUrl = URL.createObjectURL(blob);

                setAudioCache(prev => new Map(prev).set(currentLineIndex, audioUrl!));
            } catch (err) {
                console.error("Audio generation failed:", err);
                setError("Error generando audio. Verifique su API Key.");
                setIsPlaying(false);
                setIsLoadingAudio(false);
                return;
            } finally {
                setIsLoadingAudio(false);
            }
        }

        if (audioRef.current) {
            audioRef.current.src = audioUrl;
            audioRef.current.playbackRate = playbackSpeed;
            audioRef.current.play().catch(e => console.error("Play error:", e));

            // Auto-scroll
            if (highlightRef.current) {
                const activeElement = document.getElementById(`line-${currentLineIndex}`);
                activeElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    };

    const handleAudioEnded = () => {
        // Automatically go to next line
        if (currentLineIndex < script.length - 1) {
            setCurrentLineIndex(prev => prev + 1);
        } else {
            setIsPlaying(false);
            setCurrentLineIndex(0);
        }
    };

    const togglePlay = () => {
        setIsPlaying(!isPlaying);
    };

    const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newIndex = parseInt(e.target.value);
        setCurrentLineIndex(newIndex);
        if (isPlaying) {
            // Re-trigger play effect
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
        }
    };

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
            <audio
                ref={audioRef}
                onEnded={handleAudioEnded}
                className="hidden"
            />

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

            {/* Visualizer Area */}
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
            <div className="h-80 overflow-y-auto p-8 bg-slate-900 space-y-6" ref={highlightRef}>
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

            {/* Controls & Progress */}
            <div className="p-6 bg-slate-800 border-t border-slate-700 flex flex-col gap-4">
                {/* Progress Bar */}
                <div className="w-full flex items-center gap-3">
                    <span className="text-xs font-mono text-slate-400">
                        {Math.floor((currentLineIndex / script.length) * 100)}%
                    </span>
                    <input
                        type="range"
                        min="0"
                        max={script.length - 1}
                        value={currentLineIndex}
                        onChange={handleProgressChange}
                        className="flex-1 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-violet-500"
                    />
                    <span className="text-xs font-mono text-slate-400">
                        {currentLineIndex + 1}/{script.length}
                    </span>
                </div>

                {/* Play Button */}
                <div className="flex justify-center">
                    <button
                        onClick={togglePlay}
                        disabled={isLoadingAudio}
                        className={`w-16 h-16 rounded-full bg-white text-slate-900 hover:scale-105 transition-all flex items-center justify-center shadow-lg shadow-violet-500/20 ${isLoadingAudio ? 'opacity-50 cursor-wait' : ''}`}
                    >
                        {isLoadingAudio ? (
                            <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <span className="material-symbols-outlined text-4xl fill-1 ml-1">{isPlaying ? 'pause' : 'play_arrow'}</span>
                        )}
                    </button>
                </div>
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
