import { SchemaType } from "@google/generative-ai";
import { getStudentStudySets, getStudySetFlashcards } from "./supabaseClient";
import { getBestGeminiModel, getGeminiSDK } from "./geminiModelManager";

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

        // 2. Fetch flashcards from using available sets
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

        // 3. Generate Exam using Gemini Dynamic
        const genAI = getGeminiSDK();
        if (!genAI) return null;

        const modelName = await getBestGeminiModel();

        const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: {
                        questions: {
                            type: SchemaType.ARRAY,
                            items: {
                                type: SchemaType.OBJECT,
                                properties: {
                                    id: { type: SchemaType.STRING },
                                    type: { type: SchemaType.STRING },
                                    question: { type: SchemaType.STRING },
                                    options: {
                                        type: SchemaType.ARRAY,
                                        items: { type: SchemaType.STRING }
                                    },
                                    correctAnswer: { type: SchemaType.STRING },
                                    explanation: { type: SchemaType.STRING }
                                },
                                required: ["id", "type", "question", "correctAnswer", "explanation"]
                            }
                        }
                    },
                    required: ["questions"]
                }
            }
        });

        const prompt = `You are an expert examiner. Create a challenging mock exam based on the following study notes.
      
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
      
      Return strictly a JSON object with a "questions" array.`;

        const result = await model.generateContent(prompt);
        const responseData = JSON.parse(result.response.text() || "{}");

        if (!responseData.questions) return null;

        return {
            id: Date.now().toString(),
            questions: responseData.questions,
            totalQuestions: responseData.questions.length
        };

    } catch (error) {
        console.error("Error generating mock exam:", error);
        return null;
    }
};

export const validateExamAnswers = async (questions: ExamQuestion[], userAnswers: Record<string, string>): Promise<Record<string, boolean>> => {
    try {
        const genAI = getGeminiSDK();
        if (!genAI) throw new Error("No API Key configured");

        // Prepare payload
        const gradingPayload = questions.map(q => ({
            id: q.id,
            question: q.question,
            correctAnswer: q.correctAnswer,
            userAnswer: userAnswers[q.id] || "No answer"
        }));

        const modelName = await getBestGeminiModel();
        const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.ARRAY,
                    items: {
                        type: SchemaType.OBJECT,
                        properties: {
                            id: { type: SchemaType.STRING },
                            correct: { type: SchemaType.BOOLEAN }
                        },
                        required: ["id", "correct"]
                    }
                }
            }
        });

        const prompt = `You are a strict but fair teacher grading an exam.
             Compare the student's answer with the correct answer for each question.
             
             Rules:
             1. For Multiple Choice and True/False, strict equality is required (case-insensitive).
             2. For Short Answer, be GENEROUS.
                - If the student mentions the core keyword (e.g., "digital" in "pagos digitales"), MARK IT CORRECT.
                - Synonyms are accepted.
                - Spelling mistakes (if minor) are accepted.
                - Partial matches that convey the right meaning are ACCEPTED.
                
             Input JSON:
             ${JSON.stringify(gradingPayload)}
             
             Return a JSON array of objects with "id" and "correct" boolean.`;

        const result = await model.generateContent(prompt);
        const gradingResults: { id: string, correct: boolean }[] = JSON.parse(result.response.text() || "[]");

        // Convert array back to record
        const output: Record<string, boolean> = {};
        gradingResults.forEach(item => {
            output[item.id] = item.correct;
        });

        return output;
    } catch (error) {
        console.error("Error validating exam:", error);
        throw error;
    }
};
