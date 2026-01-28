import React, { useState } from 'react';

// --- Types matching the new Schema ---
type VisualTheme = "modern_dark" | "clean_light" | "professional_blue" | "warm_paper" | "default";
type SlideLayout = "title_slide" | "content_list" | "two_column" | "quote_visual" | "data_highlight" | "section_header";

interface Slide {
    layout: SlideLayout;
    title: string;
    subtitle?: string;
    content: string[];
    visualCue: string;
    speakerNotes: string;
    citations?: { sourceType: 'Notebook' | 'Material', title: string }[];
}

interface PresentationData {
    visualTheme: VisualTheme;
    slides: Slide[];
}

interface Props {
    content: string; // JSON string or Markdown
}

// --- Enhanced Theme Configurations with Gradients and Patterns ---
// More vibrant, higher contrast themes
const themes: Record<VisualTheme, {
    bg: string,
    text: string,
    accent: string,
    secondary: string,
    card: string,
    pattern: string,
    visualBg: string
}> = {
    modern_dark: {
        bg: "bg-slate-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950 via-slate-950 to-black",
        text: "text-slate-50",
        accent: "bg-indigo-500 text-indigo-50 shadow-[0_0_20px_rgba(99,102,241,0.5)]",
        secondary: "text-slate-400",
        card: "bg-slate-900/60 backdrop-blur-xl border-white/5 shadow-2xl shadow-black/50 ring-1 ring-white/10",
        pattern: "opacity-30",
        visualBg: "bg-gradient-to-br from-indigo-900/50 to-purple-900/50"
    },
    clean_light: {
        bg: "bg-white bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-50 via-white to-indigo-50",
        text: "text-slate-800",
        accent: "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20",
        secondary: "text-slate-500",
        card: "bg-white/80 backdrop-blur-2xl border-white/40 shadow-xl shadow-slate-200/50 ring-1 ring-slate-100",
        pattern: "opacity-5",
        visualBg: "bg-gradient-to-br from-blue-100 to-indigo-100"
    },
    professional_blue: {
        bg: "bg-slate-900 bg-[conic-gradient(at_top_right,_var(--tw-gradient-stops))] from-sky-900 via-slate-900 to-slate-950",
        text: "text-white",
        accent: "bg-sky-500 text-sky-50 shadow-[0_0_20px_rgba(14,165,233,0.5)]",
        secondary: "text-sky-200/70",
        card: "bg-slate-900/60 backdrop-blur-xl border-sky-500/10 shadow-2xl ring-1 ring-sky-500/20",
        pattern: "opacity-15",
        visualBg: "bg-gradient-to-br from-sky-900/50 to-blue-900/50 text-sky-200"
    },
    warm_paper: {
        bg: "bg-[#FDFBF7] bg-[linear-gradient(to_bottom_right,#fff,#f5f5f4)]",
        text: "text-stone-800",
        accent: "bg-orange-600 text-white shadow-lg shadow-orange-600/20",
        secondary: "text-stone-600",
        card: "bg-white backdrop-blur-sm border-stone-200 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.05)] ring-1 ring-stone-100",
        pattern: "opacity-5",
        visualBg: "bg-gradient-to-br from-orange-100 to-stone-200 text-orange-900"
    },
    default: {
        bg: "bg-slate-900",
        text: "text-white",
        accent: "bg-indigo-500",
        secondary: "text-slate-400",
        card: "bg-slate-800",
        pattern: "opacity-10",
        visualBg: "bg-slate-800"
    }
};

const VisualPlaceholder = ({ cue, theme }: { cue: string, theme: any }) => (
    <div className={`w-full h-full min-h-[300px] rounded-2xl overflow-hidden relative group ${theme.card} border-0 transition-transform duration-500 hover:scale-[1.02]`}>
        {/* Animated Background */}
        <div className={`absolute inset-0 ${theme.visualBg}`}></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 animate-pulse"></div>

        {/* Decorative Circles */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-black/10 rounded-full blur-2xl"></div>

        <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-8 text-center">
            <div className={`w-20 h-20 rounded-2xl ${theme.accent.split(' ')[0]}/20 flex items-center justify-center mb-6 border border-white/10`}>
                <span className="material-symbols-outlined text-4xl opacity-80">image</span>
            </div>

            <p className={`text-xs uppercase tracking-[0.2em] font-bold opacity-60 mb-3`}>Visualización Sugerida</p>
            <p className={`text-lg font-serif italic opacity-90 leading-relaxed max-w-sm`}>
                "{cue}"
            </p>
        </div>
    </div>
);

const Citations = ({ citations, theme }: { citations?: { sourceType: string, title: string }[], theme: any }) => {
    if (!citations || citations.length === 0) return null;
    return (
        <div className="absolute bottom-6 left-8 flex flex-wrap gap-2 pointer-events-none z-20 max-w-[70%]">
            {citations.map((cite, i) => (
                <div key={i} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] uppercase tracking-wider font-bold backdrop-blur-md border ${theme.card} ${theme.secondary} shadow-sm`}>
                    <span className="material-symbols-outlined text-xs">
                        {cite.sourceType === 'Notebook' ? 'book' : 'description'}
                    </span>
                    <span className="truncate max-w-[150px]">{cite.title}</span>
                </div>
            ))}
        </div>
    );
};

export default function PresentationRenderer({ content }: Props) {
    let data: PresentationData | null = null;
    let isJson = false;

    try {
        if (content.trim().startsWith('{')) {
            data = JSON.parse(content);
            isJson = true;
            if (!data?.slides) isJson = false;
        }
    } catch (e) {
        console.warn("Presentation content not JSON", e);
    }

    const [currentSlide, setCurrentSlide] = useState(0);

    if (!isJson || !data) {
        return (
            <div className="prose prose-lg max-w-none bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                <pre className="whitespace-pre-wrap font-sans text-sm text-slate-600">{content}</pre>
            </div>
        );
    }

    const theme = themes[data.visualTheme || "modern_dark"] || themes.default;
    const slide = data.slides[currentSlide];

    const renderLayout = () => {
        const layout = slide.layout || 'content_list';

        switch (layout) {
            case 'title_slide':
                return (
                    <div className="h-full flex flex-col justify-center items-center text-center p-16 relative overflow-hidden">
                        <div className="absolute inset-0 flex items-center justify-center opacity-50">
                            <div className={`w-[800px] h-[800px] bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-full blur-[120px]`}></div>
                        </div>

                        <div className="relative z-10 max-w-5xl">
                            <div className="flex justify-center mb-10">
                                <span className={`inline-block px-5 py-2 rounded-full text-xs font-bold tracking-[0.3em] uppercase ${theme.card} ${theme.text} border`}>
                                    Presentación
                                </span>
                            </div>
                            <h1 className={`text-6xl md:text-8xl font-black mb-10 leading-none tracking-tight ${theme.text} drop-shadow-2xl`}>
                                {slide.title}
                            </h1>
                            {slide.subtitle && (
                                <p className={`text-2xl md:text-3xl font-light ${theme.secondary} max-w-3xl mx-auto leading-relaxed`}>
                                    {slide.subtitle}
                                </p>
                            )}
                        </div>
                    </div>
                );

            case 'section_header':
                return (
                    <div className="h-full flex flex-row items-center p-20 gap-20">
                        {/* Large decorative number/bar */}
                        <div className="flex items-center justify-center w-24">
                            <div className={`w-1 h-64 ${theme.accent.split(' ')[0]} rounded-full opacity-80 shadow-[0_0_20px_currentColor]`}></div>
                        </div>

                        <div className="flex-1">
                            <span className={`uppercase tracking-[0.4em] text-sm font-bold mb-8 block ${theme.secondary}`}>
                                Nueva Sección
                            </span>
                            <h1 className={`text-7xl font-black ${theme.text} mb-10 leading-tight`}>{slide.title}</h1>
                            {slide.visualCue && (
                                <div className="mt-12 max-w-lg h-64">
                                    <VisualPlaceholder cue={slide.visualCue} theme={theme} />
                                </div>
                            )}
                        </div>
                    </div>
                );

            case 'two_column':
                return (
                    <div className="h-full grid grid-cols-2 gap-16 p-16 items-center">
                        <div className="flex flex-col justify-center h-full overflow-y-auto pr-4 scrollbar-hide">
                            <h2 className={`text-5xl font-bold mb-10 ${theme.text}`}>{slide.title}</h2>
                            <ul className="space-y-8">
                                {slide.content.map((p, i) => (
                                    <li key={i} className={`text-2xl leading-relaxed flex items-start gap-5 ${theme.text}`}>
                                        <div className={`mt-3 w-2.5 h-2.5 rounded-full ${theme.accent.split(' ')[0]} shrink-0 shadow-lg`} />
                                        <span>{p}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="h-full flex flex-col gap-6 items-stretch justify-center">
                            <div className="flex-1 max-h-[60%]">
                                <VisualPlaceholder cue={slide.visualCue} theme={theme} />
                            </div>
                            {slide.subtitle && (
                                <div className={`${theme.card} p-8 rounded-2xl border`}>
                                    <div className="flex items-center gap-3 mb-3 opacity-50">
                                        <span className="material-symbols-outlined text-lg">info</span>
                                        <span className="text-xs uppercase tracking-wider font-bold">Nota</span>
                                    </div>
                                    <p className={`text-lg italic ${theme.secondary}`}>{slide.subtitle}</p>
                                </div>
                            )}
                        </div>
                    </div>
                );

            case 'quote_visual':
                return (
                    <div className="h-full flex flex-col justify-center items-center p-24 text-center relative overflow-hidden">
                        <span className={`absolute top-20 left-20 text-[12rem] opacity-[0.03] font-serif ${theme.text}`}>"</span>
                        <div className="relative z-10 max-w-6xl">
                            <blockquote className={`text-5xl md:text-6xl font-serif italic leading-tight mb-14 ${theme.text} drop-shadow-lg`}>
                                {slide.content[0] || slide.title}
                            </blockquote>
                            <div className="flex items-center justify-center gap-6">
                                <div className={`h-px w-20 ${theme.secondary} opacity-30`}></div>
                                <cite className={`text-xl font-bold not-italic tracking-[0.2em] uppercase ${theme.secondary}`}>
                                    {slide.subtitle || "Concepto Clave"}
                                </cite>
                                <div className={`h-px w-20 ${theme.secondary} opacity-30`}></div>
                            </div>
                        </div>
                    </div>
                );

            case 'data_highlight':
                return (
                    <div className="h-full flex flex-col p-16">
                        <h2 className={`text-4xl font-bold mb-16 text-center ${theme.text}`}>{slide.title}</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 flex-1 content-center">
                            {slide.content.map((item, idx) => (
                                <div key={idx} className={`${theme.card} p-10 rounded-3xl flex flex-col items-center text-center justify-center hover:scale-105 transition-all duration-300 group cursor-default`}>
                                    <div className={`w-20 h-20 rounded-2xl ${theme.accent.split(' ')[0]} flex items-center justify-center mb-8 text-3xl font-bold shadow-lg group-hover:shadow-[0_0_30px_currentColor] transition-shadow duration-300`}>
                                        {idx + 1}
                                    </div>
                                    <span className={`text-2xl font-medium leading-relaxed ${theme.text}`}>{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                );

            case 'content_list':
            default:
                // FIX: Better scrolling and layout for content list
                return (
                    <div className="h-full grid grid-cols-12 gap-12 p-16">
                        <div className="col-span-7 flex flex-col h-full">
                            <div className="mb-10 pl-8 border-l-[6px] border-white/10">
                                <h2 className={`text-5xl md:text-6xl font-black ${theme.text} tracking-tight`}>{slide.title}</h2>
                            </div>

                            {/* Scrollable area for list items */}
                            <div className="flex-1 overflow-y-auto pr-6 -mr-6 space-y-4 pb-4 scrollbar-thin scrollbar-thumb-white/20 hover:scrollbar-thumb-white/40">
                                {slide.content.map((point, idx) => (
                                    <div key={idx} className={`flex items-center gap-6 p-6 rounded-2xl transition-all duration-300 hover:translate-x-2 ${theme.card}`}>
                                        <div className={`w-3 h-3 rounded-full ${theme.accent.split(' ')[0]} shrink-0 shadow-[0_0_10px_currentColor]`}></div>
                                        <p className={`text-xl font-medium leading-snug ${theme.text}`}>{point}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="col-span-5 flex flex-col gap-6 h-full justify-center">
                            {slide.subtitle && (
                                <div className={`${theme.card} p-8 rounded-3xl border`}>
                                    <h3 className={`text-xs font-bold uppercase tracking-[0.2em] mb-4 opacity-50 ${theme.text}`}>Resumen</h3>
                                    <p className={`text-lg leading-relaxed ${theme.text}`}>{slide.subtitle}</p>
                                </div>
                            )}
                            <div className="flex-1 min-h-[250px] overflow-hidden rounded-3xl shadow-2xl">
                                <VisualPlaceholder cue={slide.visualCue} theme={theme} />
                            </div>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 select-none">
            {/* Viewport Frame */}
            <div className={`aspect-video ${theme.bg} rounded-[2rem] shadow-2xl overflow-hidden relative group transition-all duration-700 ring-1 ring-slate-900/10`}>

                {/* Background Pattern */}
                <div className={`absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] ${theme.pattern} mix-blend-overlay pointer-events-none`}></div>

                {/* Floating Gradient Orbs */}
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-gradient-to-br from-indigo-500/20 to-purple-500/0 rounded-full blur-[100px] pointer-events-none animate-pulse"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-gradient-to-tl from-blue-500/10 to-teal-500/0 rounded-full blur-[100px] pointer-events-none"></div>

                {/* Render Layout */}
                <div className="absolute inset-0 z-10">
                    {renderLayout()}
                </div>

                {/* Citations Overlay */}
                <Citations citations={slide.citations} theme={theme} />

                {/* Slide Counter (Bottom Right) */}
                <div className="absolute bottom-8 right-10 z-20 font-mono text-sm opacity-30">
                    <span className={`${theme.text} text-lg font-bold`}>{currentSlide + 1} <span className="mx-2 text-xs opacity-50">/</span> {data.slides.length}</span>
                </div>

                {/* Navigation Overlay (Hover) */}
                <div className="absolute inset-0 z-30 pointer-events-none flex justify-between px-6 items-center opacity-0 group-hover:opacity-100 transition-all duration-500">
                    <button
                        onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
                        disabled={currentSlide === 0}
                        className="pointer-events-auto w-16 h-16 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 flex items-center justify-center hover:bg-white/10 disabled:opacity-0 transition-all transform hover:scale-110 shadow-lg"
                    >
                        <span className={`material-symbols-outlined text-4xl ${theme.text}`}>arrow_back</span>
                    </button>
                    <button
                        onClick={() => setCurrentSlide(Math.min(data.slides.length - 1, currentSlide + 1))}
                        disabled={currentSlide === data.slides.length - 1}
                        className="pointer-events-auto w-16 h-16 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 flex items-center justify-center hover:bg-white/10 disabled:opacity-0 transition-all transform hover:scale-110 shadow-lg"
                    >
                        <span className={`material-symbols-outlined text-4xl ${theme.text}`}>arrow_forward</span>
                    </button>
                </div>
            </div>

            {/* Speaker Notes Console - Refined Visuals */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 bg-gradient-to-br from-amber-50 to-orange-50 p-8 rounded-3xl border border-amber-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                        <span className="material-symbols-outlined text-[8rem] text-amber-900 icon-filled">mic</span>
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-5 text-amber-800 font-bold text-xs uppercase tracking-[0.2em]">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_currentColor]"></span>
                            Guion del Presentador
                        </div>
                        <p className="text-amber-950/80 leading-8 font-serif text-xl border-l-2 border-amber-200 pl-6">
                            {slide.speakerNotes || "Sin notas para esta diapositiva."}
                        </p>
                    </div>
                </div>

                {/* Controls - Premium Look */}
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-5">
                        <div className={`w-14 h-14 rounded-2xl ${theme.bg} shadow-lg flex items-center justify-center shrink-0`}>
                            <span className="text-white font-bold text-xl">{currentSlide + 1}</span>
                        </div>
                        <div className="overflow-hidden">
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1.5">Diapositiva Actual</div>
                            <div className="text-base font-bold text-slate-700 truncate">{slide.title}</div>
                        </div>
                    </div>

                    <div className="h-px bg-slate-100 w-full my-6"></div>

                    <div className="flex flex-col gap-3">
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Tema Visual</div>
                        <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-100">
                            <span className={`w-4 h-4 rounded-full ${theme.accent.split(' ')[0]} shadow-sm`}></span>
                            <span className="text-sm font-medium text-slate-600 capitalize">{data.visualTheme.replace('_', ' ')}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
