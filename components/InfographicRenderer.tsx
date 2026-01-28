import React from 'react';

// Enhanced Interface to support 'Detailed Sections' with Citations
interface InfographicData {
    title: string;
    centralIdea: string;
    keyConcepts: { name: string; description: string; icon: string }[];
    processSteps: { step: number; description: string }[];
    detailedSections?: {
        title: string;
        content: string;
        icon: string;
        citations?: { sourceType: 'Notebook' | 'Material'; title: string }[];
    }[];
    conclusion: string;
}

interface Props {
    content: string; // JSON string or Markdown (fallback)
}

export default function InfographicRenderer({ content }: Props) {
    let data: InfographicData | null = null;
    let isJson = false;

    try {
        // Try parsing as JSON first
        if (content.trim().startsWith('{')) {
            data = JSON.parse(content);
            isJson = true;
        }
    } catch (e) {
        console.warn("Infographic content is not JSON, falling back to Markdown display", e);
    }

    // Fallback for old Markdown content
    if (!isJson || !data) {
        return (
            <div className="prose prose-lg max-w-none bg-white p-12 rounded-3xl border border-slate-100 shadow-sm">
                <pre className="whitespace-pre-wrap font-sans text-slate-600 leading-relaxed">{content}</pre>
            </div>
        );
    }

    return (
        <div className="bg-[#FCFCFD] relative overflow-hidden p-4 md:p-12 rounded-[3rem] border border-slate-200 shadow-2xl max-w-6xl mx-auto selection:bg-indigo-100 selection:text-indigo-900 font-sans text-slate-900">

            {/* Background Texture & Effects - Premium Look */}
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/graphy.png')] opacity-[0.05] pointer-events-none"></div>
            <div className="absolute top-0 left-0 w-[800px] h-[800px] bg-blue-500/5 rounded-full blur-[140px] pointer-events-none -translate-x-1/2 -translate-y-1/2"></div>
            <div className="absolute bottom-0 right-0 w-[800px] h-[800px] bg-indigo-500/5 rounded-full blur-[140px] pointer-events-none translate-x-1/2 translate-y-1/2"></div>

            {/* Header - Modern & Large */}
            <header className="relative z-10 text-center mb-24 mt-12">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-[10px] font-black uppercase tracking-[0.3em] mb-8 shadow-sm">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                    </span>
                    Inteligencia Adaptativa
                </div>
                <h1 className="text-6xl md:text-[5.5rem] font-black tracking-tight leading-[0.9] mb-12 text-slate-900 bg-clip-text">
                    {data.title}
                </h1>

                <div className="max-w-4xl mx-auto">
                    <div className="bg-white/40 backdrop-blur-2xl border border-white/60 p-10 rounded-[2.5rem] shadow-xl shadow-indigo-100/20 text-center relative group">
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 bg-white rounded-2xl shadow-lg border border-indigo-50 flex items-center justify-center text-indigo-500 transition-transform group-hover:scale-110 group-hover:rotate-12">
                            <span className="material-symbols-outlined filled text-2xl">auto_awesome</span>
                        </div>
                        <p className="text-2xl md:text-3xl font-medium font-serif italic text-slate-700 leading-snug">
                            "{data.centralIdea}"
                        </p>
                    </div>
                </div>
            </header>

            {/* Main Content Grid (Bento Style) */}
            <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-8 mb-24">

                {/* Left Column: Key Concepts (Cards) */}
                <div className="md:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                    {data.keyConcepts?.map((concept, idx) => (
                        <div key={idx} className={`bg-white group p-8 rounded-[2rem] border border-slate-100 shadow-md hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 relative overflow-hidden ${idx === 0 ? 'md:col-span-2' : ''}`}>
                            <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-bl-full opacity-50 group-hover:bg-indigo-50 transition-colors"></div>

                            <div className="relative z-10">
                                <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                                    <span className="material-symbols-outlined text-3xl">
                                        {concept.icon || 'star'}
                                    </span>
                                </div>
                                <h3 className="text-2xl font-bold mb-4 group-hover:text-indigo-900 transition-colors">{concept.name}</h3>
                                <p className="text-lg text-slate-500 leading-relaxed font-medium">
                                    {concept.description}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Right Column: Process/Flow (Tall) */}
                <div className="md:col-span-4 bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden flex flex-col">
                    <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/20 via-transparent to-transparent opacity-50 pointer-events-none"></div>
                    <div className="relative z-10">
                        <h3 className="text-2xl font-black mb-10 flex items-center gap-3">
                            <span className="material-symbols-outlined text-indigo-400">route</span>
                            Proceso
                        </h3>

                        <div className="space-y-10">
                            {data.processSteps?.map((step, idx) => (
                                <div key={idx} className="flex gap-6 group">
                                    <div className="flex flex-col items-center">
                                        <div className="w-10 h-10 rounded-full border-2 border-indigo-400/50 flex items-center justify-center text-indigo-300 font-bold text-sm bg-slate-900 z-10 group-hover:border-indigo-400 group-hover:text-white transition-all">
                                            {step.step}
                                        </div>
                                        {idx !== data.processSteps.length - 1 && (
                                            <div className="w-0.5 h-16 bg-gradient-to-b from-indigo-400/50 to-transparent my-2"></div>
                                        )}
                                    </div>
                                    <div className="font-medium text-slate-300 group-hover:text-white transition-colors leading-relaxed">
                                        {step.description}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-auto pt-10 relative z-10">
                        <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
                            <p className="text-indigo-200/60 text-[10px] uppercase tracking-[0.2em] font-black mb-2">Insight Final</p>
                            <p className="text-sm italic font-light leading-relaxed">{data.conclusion.split('.')[0]}.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Full-Width Detailed Sections (The "Deep Dive") */}
            {data.detailedSections && data.detailedSections.length > 0 && (
                <div className="relative z-10 space-y-10 mb-24">
                    <div className="flex items-center gap-8 mb-12">
                        <h2 className="text-3xl font-black tracking-tight shrink-0">Análisis Detallado</h2>
                        <div className="h-px bg-slate-200 flex-1"></div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        {data.detailedSections.map((section, idx) => (
                            <div key={idx} className="bg-white border border-slate-100 p-12 rounded-[2.5rem] shadow-xl shadow-slate-200/40 group hover:shadow-2xl transition-all duration-500">
                                <div className="flex items-center gap-6 mb-8">
                                    <div className="w-16 h-16 rounded-2xl bg-indigo-500 text-white flex items-center justify-center shadow-lg transform group-hover:-rotate-3 transition-transform">
                                        <span className="material-symbols-outlined text-3xl">{section.icon || 'auto_stories'}</span>
                                    </div>
                                    <h3 className="text-3xl font-bold leading-none">{section.title}</h3>
                                </div>
                                <div className="prose prose-slate prose-lg max-w-none text-slate-600 mb-10 leading-relaxed font-normal">
                                    {section.content.split('\n').map((p, i) => (
                                        <p key={i} className="mb-4">{p}</p>
                                    ))}
                                </div>

                                {/* Citations */}
                                {section.citations && section.citations.length > 0 && (
                                    <div className="pt-8 border-t border-slate-50 flex flex-wrap gap-3">
                                        {section.citations.map((cite, i) => (
                                            <div key={i} className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 border border-slate-100 hover:bg-white hover:text-indigo-600 hover:border-indigo-100 hover:shadow-md transition-all cursor-default">
                                                <span className="material-symbols-outlined text-xs">
                                                    {cite.sourceType === 'Notebook' ? 'book' : 'description'}
                                                </span>
                                                {cite.title}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Conclusion - Minimalist and Premium */}
            <footer className="relative z-10">
                <div className="bg-gradient-to-br from-indigo-700 to-indigo-900 rounded-[3rem] p-16 text-center shadow-3xl relative overflow-hidden isolate">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 mix-blend-overlay"></div>
                    <div className="absolute top-[-50%] left-[-20%] w-[100%] h-[150%] bg-indigo-500/20 blur-[120px] rounded-full"></div>

                    <div className="relative z-10">
                        <div className="w-16 h-1 bg-white/30 rounded-full mx-auto mb-10"></div>
                        <p className="text-4xl md:text-5xl font-serif italic text-white leading-tight max-w-4xl mx-auto drop-shadow-2xl">
                            "{data.conclusion}"
                        </p>
                    </div>
                </div>

                <div className="mt-12 text-center text-slate-300 text-[10px] font-black uppercase tracking-[0.5em] pb-8">
                    Neuropath Adaptive Learning &copy; 2026
                </div>
            </footer>
        </div>
    );
}
