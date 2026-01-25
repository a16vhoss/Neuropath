import { supabase } from './supabaseClient';
import { Notebook, NotebookSave, NotebookFlashcardLink, FlashcardPreview, NotebookSaveResult } from '../types';
import { generateFlashcardsFromNotebook } from './geminiService';

// ============================================
// CRUD Operations
// ============================================

export const createNotebook = async (
  studySetId: string,
  title: string,
  description?: string
): Promise<Notebook> => {
  const { data, error } = await supabase
    .from('notebooks')
    .insert({
      study_set_id: studySetId,
      title,
      description: description || '',
      content: '',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getNotebooksForStudySet = async (studySetId: string): Promise<Notebook[]> => {
  const { data, error } = await supabase
    .from('notebooks')
    .select('*')
    .eq('study_set_id', studySetId)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const getNotebook = async (notebookId: string): Promise<Notebook | null> => {
  const { data, error } = await supabase
    .from('notebooks')
    .select('*')
    .eq('id', notebookId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
};

export const updateNotebook = async (
  notebookId: string,
  updates: {
    title?: string;
    description?: string;
    content?: string;
  }
): Promise<Notebook> => {
  const { data, error } = await supabase
    .from('notebooks')
    .update(updates)
    .eq('id', notebookId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteNotebook = async (notebookId: string): Promise<void> => {
  const { error } = await supabase
    .from('notebooks')
    .delete()
    .eq('id', notebookId);

  if (error) throw error;
};

// ============================================
// Save History Operations
// ============================================

export const getNotebookSaves = async (notebookId: string): Promise<NotebookSave[]> => {
  const { data, error } = await supabase
    .from('notebook_saves')
    .select('*')
    .eq('notebook_id', notebookId)
    .order('saved_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const getNotebookSaveById = async (saveId: string): Promise<NotebookSave | null> => {
  const { data, error } = await supabase
    .from('notebook_saves')
    .select('*')
    .eq('id', saveId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
};

export const getFlashcardsForSave = async (saveId: string): Promise<string[]> => {
  const { data, error } = await supabase
    .from('notebook_flashcard_links')
    .select('flashcard_id')
    .eq('notebook_save_id', saveId);

  if (error) throw error;
  return (data || []).map(link => link.flashcard_id);
};

// ============================================
// Content Diff Logic
// ============================================

/**
 * Extrae el texto plano del HTML (para comparacion y analisis)
 */
export const extractTextFromHtml = (html: string): string => {
  if (!html) return '';

  // Remover tags HTML pero preservar estructura
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

/**
 * Calcula el contenido nuevo comparando con el ultimo guardado
 */
export const calculateNewContent = (
  currentContent: string,
  lastSavedContent: string | null | undefined
): string => {
  if (!lastSavedContent) {
    // Primera vez guardando - todo es nuevo
    return extractTextFromHtml(currentContent);
  }

  const currentText = extractTextFromHtml(currentContent);
  const lastText = extractTextFromHtml(lastSavedContent);

  if (currentText === lastText) {
    return ''; // Sin cambios
  }

  // Estrategia: encontrar el contenido que se agrego al final o en medio
  // Para simplificar, si el contenido anterior esta contenido en el actual,
  // extraemos lo que se agrego

  if (currentText.startsWith(lastText)) {
    // Contenido agregado al final
    return currentText.slice(lastText.length).trim();
  }

  // Si el contenido fue modificado en medio, tomamos todo el texto nuevo
  // pero marcamos que hay contexto previo
  const lastWords = lastText.split(/\s+/);
  const currentWords = currentText.split(/\s+/);

  // Encontrar donde divergen los textos
  let divergeIndex = 0;
  for (let i = 0; i < Math.min(lastWords.length, currentWords.length); i++) {
    if (lastWords[i] !== currentWords[i]) {
      divergeIndex = i;
      break;
    }
    divergeIndex = i + 1;
  }

  // El contenido nuevo es desde donde diverge
  const newWords = currentWords.slice(divergeIndex);
  return newWords.join(' ').trim();
};

/**
 * Calcula cuantas flashcards generar basado en el contenido
 */
export const calculateOptimalFlashcardCount = (newContent: string): number => {
  if (!newContent || newContent.trim().length === 0) {
    return 0;
  }

  // 1. Contar palabras del contenido nuevo
  const wordCount = newContent.split(/\s+/).filter(w => w.length > 0).length;

  // 2. Detectar densidad de informacion
  const bulletPoints = (newContent.match(/[-•*]\s/g) || []).length;
  const numberedLists = (newContent.match(/\d+\.\s/g) || []).length;
  const definitions = (newContent.match(/:\s|=\s|significa|es decir|se define|consiste en/gi) || []).length;
  const keyTerms = (newContent.match(/\*\*.*?\*\*|__.*?__|"[^"]{3,}"/g) || []).length;
  const questions = (newContent.match(/\?/g) || []).length;

  // 3. Calcular score de densidad
  const densityScore =
    bulletPoints * 0.5 +
    numberedLists * 0.5 +
    definitions * 1.0 +
    keyTerms * 0.8 +
    questions * 0.3;

  // 4. Formula base: 1 flashcard por cada 60-80 palabras
  let baseCount = Math.ceil(wordCount / 70);

  // 5. Ajustar por densidad (contenido denso = mas flashcards)
  const densityMultiplier = 1 + Math.min(densityScore / 10, 0.5);
  let adjustedCount = Math.round(baseCount * densityMultiplier);

  // 6. Limites: minimo 1, maximo 15 por guardado
  return Math.max(1, Math.min(15, adjustedCount));
};

// ============================================
// Core: Save and Generate Flashcards
// ============================================

/**
 * Prepara el guardado: detecta contenido nuevo y genera preview de flashcards
 */
export const prepareNotebookSave = async (
  notebookId: string,
  currentContent: string,
  studySetId: string,
  studySetName: string
): Promise<NotebookSaveResult> => {
  // 1. Obtener el notebook actual
  const notebook = await getNotebook(notebookId);
  if (!notebook) {
    throw new Error('Notebook not found');
  }

  // 2. Calcular contenido nuevo
  const isFirstSave = !notebook.last_saved_content || notebook.last_saved_content.trim() === '';
  const newContentDiff = calculateNewContent(currentContent, notebook.last_saved_content);

  // Debug log
  console.log('[Notebook] First save:', isFirstSave);
  console.log('[Notebook] New content length:', newContentDiff?.length);
  console.log('[Notebook] New content preview:', newContentDiff?.slice(0, 100));

  // Si es primera vez, el minimo es 5 caracteres; si no, 10
  const minChars = isFirstSave ? 5 : 10;
  if (!newContentDiff || newContentDiff.trim().length < minChars) {
    // No hay suficiente contenido nuevo para generar flashcards
    return {
      hasNewContent: false,
      newContentDiff: '',
      flashcardPreviews: [],
      suggestedCount: 0,
    };
  }

  // 3. Calcular cuantas flashcards generar
  const suggestedCount = calculateOptimalFlashcardCount(newContentDiff);

  // 4. Obtener contexto: contenido previo y flashcards existentes
  const previousContent = notebook.last_saved_content || '';

  const { data: existingFlashcards } = await supabase
    .from('flashcards')
    .select('question, answer')
    .eq('study_set_id', studySetId)
    .limit(50);

  const existingQA = (existingFlashcards || [])
    .map(f => `Q: ${f.question}\nA: ${f.answer}`)
    .join('\n---\n');

  // 5. Generar flashcards con IA
  const flashcardPreviews = await generateFlashcardsFromNotebook({
    newContent: newContentDiff,
    previousContent: extractTextFromHtml(previousContent),
    existingFlashcards: existingQA,
    studySetName,
    notebookTitle: notebook.title,
    count: suggestedCount,
  });

  return {
    hasNewContent: true,
    newContentDiff,
    flashcardPreviews,
    suggestedCount,
  };
};

/**
 * Confirma la generacion: guarda flashcards y crea registro de save
 */
export const confirmNotebookSave = async (
  notebookId: string,
  studySetId: string,
  currentContent: string,
  newContentDiff: string,
  flashcards: FlashcardPreview[]
): Promise<{ saveId: string; flashcardIds: string[] }> => {
  // 1. Insertar flashcards
  const flashcardInserts = flashcards.map(fc => ({
    study_set_id: studySetId,
    question: fc.question,
    answer: fc.answer,
    category: fc.category || 'Nota',
    is_ai_generated: true,
    source_name: `Cuaderno`,
  }));

  const { data: insertedFlashcards, error: flashcardsError } = await supabase
    .from('flashcards')
    .insert(flashcardInserts)
    .select('id');

  if (flashcardsError) throw flashcardsError;

  const flashcardIds = (insertedFlashcards || []).map(f => f.id);

  // 2. Crear notebook_save
  const { data: save, error: saveError } = await supabase
    .from('notebook_saves')
    .insert({
      notebook_id: notebookId,
      content_snapshot: currentContent,
      new_content_diff: newContentDiff,
      flashcards_generated: flashcardIds.length,
    })
    .select()
    .single();

  if (saveError) throw saveError;

  // 3. Crear links entre save y flashcards
  if (flashcardIds.length > 0) {
    const links = flashcardIds.map(fcId => ({
      notebook_save_id: save.id,
      flashcard_id: fcId,
    }));

    const { error: linksError } = await supabase
      .from('notebook_flashcard_links')
      .insert(links);

    if (linksError) throw linksError;
  }

  // 4. Actualizar notebook
  const { error: updateError } = await supabase
    .from('notebooks')
    .update({
      content: currentContent,
      last_saved_content: currentContent,
      last_saved_at: new Date().toISOString(),
      flashcards_generated: supabase.rpc ? undefined : flashcardIds.length, // Increment would be better
    })
    .eq('id', notebookId);

  if (updateError) throw updateError;

  // Incrementar contador de flashcards
  await supabase.rpc('increment_notebook_flashcards', {
    notebook_id: notebookId,
    count: flashcardIds.length,
  }).catch(() => {
    // Si la funcion no existe, ignorar
  });

  return { saveId: save.id, flashcardIds };
};

/**
 * Guarda solo el contenido sin generar flashcards
 */
export const saveNotebookContentOnly = async (
  notebookId: string,
  content: string
): Promise<void> => {
  const { error } = await supabase
    .from('notebooks')
    .update({ content })
    .eq('id', notebookId);

  if (error) throw error;
};

// ============================================
// Regenerate Flashcards from Save
// ============================================

/**
 * Regenera flashcards de un save especifico
 */
export const regenerateFlashcardsFromSave = async (
  saveId: string,
  studySetId: string,
  studySetName: string
): Promise<FlashcardPreview[]> => {
  // 1. Obtener el save
  const save = await getNotebookSaveById(saveId);
  if (!save || !save.new_content_diff) {
    throw new Error('Save not found or has no content diff');
  }

  // 2. Obtener el notebook para el titulo
  const notebook = await getNotebook(save.notebook_id);
  if (!notebook) {
    throw new Error('Notebook not found');
  }

  // 3. Eliminar flashcards anteriores de este save
  const oldFlashcardIds = await getFlashcardsForSave(saveId);
  if (oldFlashcardIds.length > 0) {
    await supabase
      .from('flashcards')
      .delete()
      .in('id', oldFlashcardIds);

    await supabase
      .from('notebook_flashcard_links')
      .delete()
      .eq('notebook_save_id', saveId);
  }

  // 4. Obtener contexto
  const { data: existingFlashcards } = await supabase
    .from('flashcards')
    .select('question, answer')
    .eq('study_set_id', studySetId)
    .limit(50);

  const existingQA = (existingFlashcards || [])
    .map(f => `Q: ${f.question}\nA: ${f.answer}`)
    .join('\n---\n');

  // 5. Regenerar
  const count = calculateOptimalFlashcardCount(save.new_content_diff);

  return generateFlashcardsFromNotebook({
    newContent: save.new_content_diff,
    previousContent: '', // No usamos contexto previo en regeneracion
    existingFlashcards: existingQA,
    studySetName,
    notebookTitle: notebook.title,
    count,
  });
};

/**
 * Confirma la regeneracion de flashcards
 */
export const confirmRegeneratedFlashcards = async (
  saveId: string,
  studySetId: string,
  flashcards: FlashcardPreview[]
): Promise<string[]> => {
  // 1. Insertar nuevas flashcards
  const flashcardInserts = flashcards.map(fc => ({
    study_set_id: studySetId,
    question: fc.question,
    answer: fc.answer,
    category: fc.category || 'Nota',
    is_ai_generated: true,
    source_name: `Cuaderno (regenerado)`,
  }));

  const { data: insertedFlashcards, error } = await supabase
    .from('flashcards')
    .insert(flashcardInserts)
    .select('id');

  if (error) throw error;

  const flashcardIds = (insertedFlashcards || []).map(f => f.id);

  // 2. Crear nuevos links
  if (flashcardIds.length > 0) {
    const links = flashcardIds.map(fcId => ({
      notebook_save_id: saveId,
      flashcard_id: fcId,
    }));

    await supabase
      .from('notebook_flashcard_links')
      .insert(links);
  }

  // 3. Actualizar contador del save
  await supabase
    .from('notebook_saves')
    .update({ flashcards_generated: flashcardIds.length })
    .eq('id', saveId);

  return flashcardIds;
};
