// Cole aqui as credenciais do seu projeto Supabase
// Em: https://supabase.com → Settings → API
const SUPABASE_URL = 'https://nhozbcbukrnrsmzujhli.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ob3piY2J1a3JucnNtenVqaGxpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5Nzc5MTYsImV4cCI6MjA5MjU1MzkxNn0.2_Hds7idXKRax8XjfqH-qMuo90zVab36JtVlPBza368';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);