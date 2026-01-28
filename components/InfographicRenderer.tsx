import React from 'react';

interface InfographicData {
    title: string;
    centralIdea: string;
    keyConcepts: { name: string; description: string; icon: string }[];
    processSteps: { step: number; description: string }[];
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
            <div className="prose prose-lg max-w-none prose-indigo bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                <pre className="whitespace-pre-wrap font-sans">{content}</pre>
            </div>
        );
    }

    return (
        <div className="bg-slate-50 p-6 md:p-10 rounded-3xl border border-slate-200 shadow-sm max-w-4xl mx-auto">
            {/* Header */}
            <div className="text-center mb-12">
                <h1 className="text-4xl md:text-5xl font-black text-slate-800 tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">
                    {data.title}
                </h1>
                <div className="inline-block bg-white px-6 py-3 rounded-full shadow-sm border border-indigo-100">
                    <p className="text-lg text-indigo-800 font-medium">
                        💡 {data.centralIdea}
                    </p>
                </div>
            </div>

            {/* Key Concepts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                {data.keyConcepts?.map((concept, idx) => (
                    <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <span className="material-symbols-outlined text-6xl text-indigo-500">
                                {concept.icon || 'lightbulb'}
                            </span>
                        </div>
                        <div className="flex items-start gap-4 relative z-10">
                            <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0 text-indigo-600">
                                <span className="material-symbols-outlined text-2xl">
                                    {concept.icon || 'lightbulb'}
                                </span>
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-slate-800 mb-1">{concept.name}</h3>
                                <p className="text-slate-600 text-sm leading-relaxed">{concept.description}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Process Flow */}
            {data.processSteps && data.processSteps.length > 0 && (
                <div className="mb-12">
                    <h3 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <span className="material-symbols-outlined text-amber-500">account_tree</span>
                        Proceso Clave
                    </h3>
                    <div className="space-y-4">
                        {data.processSteps.map((step, idx) => (
                            <div key={idx} className="flex items-center gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                                <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 font-bold flex items-center justify-center shrink-0">
                                    {step.step}
                                </div>
                                <div className="h-0.5 flex-1 bg-slate-100 hidden md:block"></div>
                                <p className="text-slate-700 font-medium md:w-3/4">{step.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Conclusion */}
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white p-8 rounded-2xl shadow-lg relative overflow-hidden">
                <div className="relative z-10 text-center">
                    <h3 className="text-xl font-bold mb-2 opacity-90">Conclusión</h3>
                    <p className="text-lg font-medium leading-relaxed">
                        "{data.conclusion}"
                    </p>
                </div>
                <div className="absolute top-0 left-0 w-full h-full opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
            </div>
        </div>
    );
}
