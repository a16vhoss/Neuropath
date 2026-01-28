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
            <div className="prose prose-lg max-w-none bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                <pre className="whitespace-pre-wrap font-sans text-slate-600">{content}</pre>
            </div>
        );
    }

    return (
        <div className="bg-slate-50 relative overflow-hidden p-6 md:p-12 rounded-[2.5rem] border border-slate-200 shadow-xl max-w-5xl mx-auto selection:bg-indigo-100 selection:text-indigo-900">

            {/* Background Texture & Effects */}
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none"></div>
            <div className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none"></div>
            <div className="absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none"></div>

            {/* Header */}
            <div className="text-center mb-20 relative z-10">
                <div className="inline-block mb-4">
                    <span className="bg-white/50 backdrop-blur-md border border-indigo-100 text-indigo-600 text-xs font-black uppercase tracking-[0.3em] px-4 py-2 rounded-full shadow-sm">
                        Infografía de Estudio
                    </span>
                </div>
                <h1 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tight mb-8 drop-shadow-sm">
                    {data.title}
                </h1>

                <div className="relative inline-block group">
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl blur opacity-20 group-hover:opacity-30 transition-opacity"></div>
                    <div className="relative bg-white/80 backdrop-blur-xl px-10 py-6 rounded-2xl shadow-lg border border-white/50 max-w-3xl mx-auto">
                        <p className="text-2xl text-slate-700 font-medium font-serif italic leading-relaxed">
                            <span className="text-indigo-400 font-sans font-bold not-italic mr-2">💡 Idea Central:</span>
                            {data.centralIdea}
                        </p>
                    </div>
                </div>
            </div>

            {/* Detailed Sections "Deep Dive" */}
            {data.detailedSections && data.detailedSections.length > 0 && (
                <div className="mb-24 relative z-10">
                    <div className="flex items-center gap-6 mb-12">
                        <div className="h-px bg-slate-200 flex-1"></div>
                        <div className="flex items-center gap-2 text-slate-400 bg-slate-50 px-4">
                            <span className="material-symbols-outlined text-lg">psychology</span>
                            <span className="text-xs font-bold uppercase tracking-[0.2em]">Análisis Profundo</span>
                        </div>
                        <div className="h-px bg-slate-200 flex-1"></div>
                    </div>

                    <div className="space-y-12">
                        {data.detailedSections.map((section, idx) => (
                            <div key={idx} className="bg-white p-10 rounded-3xl border border-slate-100 shadow-lg hover:shadow-2xl transition-all duration-500 group relative overflow-hidden">
                                {/* Decorative Gradient Blob */}
                                <div className="absolute -right-20 -top-20 w-64 h-64 bg-slate-50 rounded-full blur-3xl group-hover:bg-indigo-50 transition-colors duration-500"></div>

                                <div className="relative z-10 flex flex-col md:flex-row gap-8">
                                    <div className="shrink-0">
                                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-200 flex items-center justify-center transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                                            <span className="material-symbols-outlined text-4xl">
                                                {section.icon || 'article'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <h2 className="text-3xl font-bold text-slate-800 mb-6 group-hover:text-indigo-700 transition-colors">{section.title}</h2>
                                        <div className="prose prose-lg text-slate-600 leading-relaxed max-w-none text-lg">
                                            {section.content.split('\n').map((line, i) => (
                                                <p key={i} className="mb-4">{line}</p>
                                            ))}
                                        </div>

                                        {/* Citations */}
                                        {section.citations && section.citations.length > 0 && (
                                            <div className="mt-8 flex flex-wrap gap-3 pt-6 border-t border-slate-50">
                                                {section.citations.map((cite, i) => (
                                                    <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-500 border border-slate-100 hover:bg-white hover:shadow-md hover:text-indigo-600 hover:border-indigo-100 transition-all cursor-default">
                                                        <span className="material-symbols-outlined text-sm">
                                                            {cite.sourceType === 'Notebook' ? 'book' : 'description'}
                                                        </span>
                                                        <span>{cite.title}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Key Concepts Grid - Bento Grid Style */}
            <div className="mb-24 relative z-10">
                <h3 className="text-3xl font-black text-slate-800 mb-10 text-center">Conceptos Clave</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr">
                    {data.keyConcepts?.map((concept, idx) => (
                        <div key={idx} className="bg-white p-8 rounded-3xl border border-slate-100 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col items-center text-center group">
                            <div className="w-16 h-16 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-6 group-hover:bg-indigo-500 group-hover:text-white transition-colors duration-300 shadow-sm">
                                <span className="material-symbols-outlined text-3xl">
                                    {concept.icon || 'lightbulb'}
                                </span>
                            </div>
                            <h3 className="font-bold text-xl text-slate-800 mb-4">{concept.name}</h3>
                            <p className="text-slate-600 leading-relaxed text-sm flex-1">{concept.description}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Process Flow - Timeline */}
            {data.processSteps && data.processSteps.length > 0 && (
                <div className="mb-24 relative z-10">
                    <h3 className="text-3xl font-black text-slate-800 mb-12 text-center">Flujo del Proceso</h3>
                    <div className="relative">
                        {/* Connecting Line (Desktop) */}
                        <div className="absolute left-[39px] top-8 bottom-8 w-1 bg-slate-200 hidden md:block rounded-full"></div>

                        <div className="space-y-8">
                            {data.processSteps.map((step, idx) => (
                                <div key={idx} className="flex items-start md:items-center gap-8 relative group">
                                    <div className="w-20 h-20 rounded-2xl bg-white border-4 border-slate-50 text-slate-300 text-3xl font-black flex items-center justify-center shrink-0 shadow-lg group-hover:border-indigo-500 group-hover:text-indigo-600 group-hover:scale-110 transition-all duration-300 z-10 relative">
                                        {step.step}
                                    </div>
                                    <div className="flex-1 bg-white p-8 rounded-3xl border border-slate-100 shadow-md group-hover:shadow-xl group-hover:translate-x-2 transition-all duration-300 relative overflow-hidden">
                                        <div className="absolute left-0 top-0 bottom-0 w-2 bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                        <p className="text-slate-700 font-medium text-lg md:text-xl leading-relaxed">{step.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Conclusion CTA */}
            <div className="relative z-10">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-[2.5rem] transform rotate-1 opacity-20 blur-sm"></div>
                <div className="bg-slate-900 text-white p-16 rounded-[2.5rem] shadow-2xl relative overflow-hidden text-center isolate">
                    {/* Background Noise */}
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 mix-blend-overlay"></div>

                    {/* Glowing Orbs */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500 rounded-full blur-[80px] opacity-40 mix-blend-screen"></div>
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500 rounded-full blur-[80px] opacity-40 mix-blend-screen"></div>

                    <div className="relative z-10">
                        <span className="material-symbols-outlined text-6xl mb-8 text-transparent bg-clip-text bg-gradient-to-tr from-indigo-200 to-white inline-block">auto_awesome</span>
                        <h3 className="text-lg font-bold uppercase tracking-[0.3em] mb-8 text-indigo-200/60">Conclusión</h3>
                        <p className="text-3xl md:text-4xl font-serif italic leading-relaxed text-indigo-50 max-w-4xl mx-auto drop-shadow-xl">
                            "{data.conclusion}"
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
