import { GoogleGenAI, Type } from "@google/genai";
import { getStudentStudySets, getStudySetFlashcards } from "./supabaseClient";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export interface ExamQuestion {
    id: string;
    type: 'multiple_choice' | 'true_false' | 'short_answer';
    question: string;
    options?: string[]; // For MC
    correctAnswer: string;
    explanation: string;
}

export interface MockExam {
    id: string; // ephemeral ID
    questions: ExamQuestion[];
    totalQuestions: number;
}

export const generateMockExam = async (userId: string, studySetIds: string[] = []): Promise<MockExam | null> => {
    try {
        // 1. Fetch all study sets for the user
        const studySets = await getStudentStudySets(userId);

        if (!studySets || studySets.length === 0) {
            console.warn("No study sets found for user");
            return null;
        }

        // 2. Fetch flashcards from the most recent 5 study sets to build context
        // We limit to 5 to avoid token limits and keep it relevant
        const recentSets = studySets.slice(0, 5);
        let allContent = "";

        for (const set of recentSets) {
            const flashcards = await getStudySetFlashcards(set.id);
            if (flashcards && flashcards.length > 0) {
                allContent += `\nSubject: ${set.name}\n`;
                flashcards.forEach((card: any) => {
                    allContent += `- Q: ${card.question} A: ${card.answer}\n`;
                });
            }
        }

        if (allContent.length < 50) {
            console.warn("Not enough content to generate exam");
            return null;
        }

        // 3. Generate Exam using Gemini directly here for specialized prompt
        if (!API_KEY || API_KEY === 'PLACEHOLDER_API_KEY') {
            console.error("No API Key for exam generation");
            return null;
        }

        const ai = new GoogleGenAI({ apiKey: API_KEY });
        const response = await ai.models.generateContent({
            model: "gemini-1.5-flash",
            contents: `You are an expert examiner. Create a challenging mock exam based on the following study notes.
      
      Requirements:
      - Generate 10 questions.
      - Mix question types: 
        - 4 Multiple Choice (4 options)
        - 3 True/False
        - 3 Short Answer (provide the ideal short keyword/phrase as answer)
      - Questions should test understanding, not just rote memorization.
      - Language: Spanish.
      - For True/False questions, the correctAnswer MUST be exactly "Verdadero" or "Falso".
      
      Study Notes:
      ${allContent.substring(0, 25000)}
      
      Return strictly a JSON array of objects with this schema:
      {
        id: string (unique),
        type: "multiple_choice" | "true_false" | "short_answer",
        question: string,
        options: string[] (optional, required for multiple_choice),
        correctAnswer: string,
        explanation: string
      }`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        questions: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    type: { type: Type.STRING, enum: ["multiple_choice", "true_false", "short_answer"] },
                                    question: { type: Type.STRING },
                                    options: {
                                        type: Type.ARRAY,
                                        items: { type: Type.STRING }
                                    },
                                    correctAnswer: { type: Type.STRING },
                                    explanation: { type: Type.STRING }
                                },
                                required: ["id", "type", "question", "correctAnswer", "explanation"]
                            }
                        }
                    }
                }
            }
        });

        const result = JSON.parse(response.text || "{}");

        if (!result.questions) return null;

        return {
            id: Date.now().toString(),
            questions: result.questions,
            totalQuestions: result.questions.length
        };

    } catch (error) {
        console.error("Error generating mock exam:", error);
        return null;
    }
};

export const validateExamAnswers = async (questions: ExamQuestion[], userAnswers: Record<string, string>): Promise<Record<string, boolean>> => {
    try {
        if (!API_KEY || API_KEY === 'PLACEHOLDER_API_KEY') {
            throw new Error("No API Key configurada para validación");
        }

        const ai = new GoogleGenAI({ apiKey: API_KEY });

        // Prepare payload
        const gradingPayload = questions.map(q => ({
            id: q.id,
            question: q.question,
            correctAnswer: q.correctAnswer,
            userAnswer: userAnswers[q.id] || "No answer"
        }));

        const response = await ai.models.generateContent({
            model: "gemini-1.5-flash",
            contents: `You are a strict but fair teacher grading an exam.
             Compare the student's answer with the correct answer for each question.
             
             Rules:
             1. For Multiple Choice and True/False, strict equality is required (case-insensitive).
             2. For Short Answer, be GENEROUS.
                - If the student mentions the core keyword (e.g., "digital" in "pagos digitales"), MARK IT CORRECT.
                - Synonyms are accepted.
                - Spelling mistakes (if minor) are accepted.
                - Partial matches that convey the right meaning are ACCEPTED.
                
             Input JSON:
                
             Input JSON:
             ${JSON.stringify(gradingPayload)}
             
             Return a JSON object where keys are question IDs and values are booleans (true for correct, false for incorrect).
             Example: { "q1": true, "q2": false }`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    additionalProperties: { type: Type.BOOLEAN }
                }
            }
        });

        return JSON.parse(response.text || "{}");
    } catch (error) {
        console.error("Error validating exam:", error);
        throw error;
    }
};
