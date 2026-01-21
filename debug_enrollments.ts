
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://szcsttpuckqpjndadqbk.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6Y3N0dHB1Y2txcGpuZGFkcWJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1MjcxNzEsImV4cCI6MjA4NDEwMzE3MX0.jkySnMjg16zyejivMhhtxgdnPecs7W8nGbNYTxfeFOo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugEnrollments() {
    console.log("Searching for class RHBI8C...");
    const { data: cls, error: clsError } = await supabase
        .from('classes')
        .select('id, name')
        .eq('code', 'RHBI8C')
        .single();

    if (clsError) {
        console.error("Class error:", clsError);
        return;
    }

    console.log("Found class:", cls);

    const { data: enrollments, error: enrollError } = await supabase
        .from('enrollments')
        .select(`
        *,
        profiles (
            id,
            full_name,
            email
        )
    `)
        .eq('class_id', cls.id);

    if (enrollError) {
        console.error("Enrollment error:", enrollError);
        // Try without the join to see raw enrollments
        const { data: rawEnrollments } = await supabase.from('enrollments').select('*').eq('class_id', cls.id);
        console.log("Raw enrollments:", rawEnrollments);
    } else {
        console.log("Enrollments with profiles:", JSON.stringify(enrollments, null, 2));
    }
}

debugEnrollments();
