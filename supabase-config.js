// Cole aqui as credenciais do seu projeto Supabase
// Em: https://supabase.com → Settings → API
const SUPABASE_URL = 'https://quekoyaphphldaqxrkym.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1ZWtveWFwaHBobGRhcXhya3ltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwMzQwNjIsImV4cCI6MjEwNTYxMDA2Mn0.Dj9LLEqo_KXJP0Ro5FYAaeoCTXnbW4askYmtub11bPs';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);