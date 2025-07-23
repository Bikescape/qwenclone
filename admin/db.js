const SUPABASE_URL = 'https://nldgdctetiqocqrjvdbe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sZGdkY3RldGlxb2Nxcmp2ZGJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyNjYzMDksImV4cCI6MjA2ODg0MjMwOX0.8e3C4zyp3RAaSNt9s_hRFlTRG1rWLfHxgOTLgRbmK78';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);