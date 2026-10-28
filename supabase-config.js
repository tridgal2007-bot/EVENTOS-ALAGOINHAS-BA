/*
 * Configuração pública do Supabase.
 * Use apenas a URL do projeto e a chave anon/public do projeto.
 * Nunca coloque a service_role key neste arquivo ou em código do navegador.
 */
(() => {
  'use strict';

  const SUPABASE_URL = 'https://nhozbcbukrnrsmzujhli.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ob3piY2J1a3JucnNtenVqaGxpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5Nzc5MTYsImV4cCI6MjA5MjU1MzkxNn0.2_Hds7idXKRax8XjfqH-qMuo90zVab36JtVlPBza368';
  const looksConfigured = SUPABASE_URL.startsWith('https://') &&
    !SUPABASE_URL.includes('COLE_AQUI') &&
    SUPABASE_ANON_KEY.length > 20 &&
    !SUPABASE_ANON_KEY.includes('COLE_AQUI');

  if (!looksConfigured) {
    window.supabaseClient = null;
    console.warn('Supabase não configurado. Edite supabase-config.js com a URL e a chave anon/public do seu projeto.');
    return;
  }

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    window.supabaseClient = null;
    console.error('A biblioteca do Supabase não foi carregada. Verifique a conexão com a internet.');
    return;
  }

  window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    },
    realtime: {
      params: { eventsPerSecond: 5 }
    }
  });
})();
