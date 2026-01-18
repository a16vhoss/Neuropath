import { createClient } from '@supabase/supabase-js';

const url = 'https://szcsttpuckqpjndadqbk.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6Y3N0dHB1Y2txcGpuZGFkcWJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1MjcxNzEsImV4cCI6MjA4NDEwMzE3MX0.jkySnMjg16zyejivMhhtxgdnPecs7W8nGbNYTxfeFOo';

const supabase = createClient(url, key);

async function check() {
    console.log('Checking study_set_materials table...');
    const { error } = await supabase.from('study_set_materials').select('*').limit(1);
    if (error) {
        console.log('STATUS: ERROR');
        console.log('MESSAGE:', error.message);
    } else {
        console.log('STATUS: SUCCESS');
        console.log('Table exists and is accessible');
    }
}

check();
