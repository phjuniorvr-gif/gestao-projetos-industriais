import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  /** Troca a própria senha (pedido do usuário — qualquer papel, inclusive usuário comum restrito
   * só a "/tarefas-proximas"). `supabase.auth.updateUser` já opera sobre a sessão logada, sem
   * precisar de senha atual nem de Admin API/Edge Function — não é "trocar senha de outra
   * pessoa" (isso continua exclusivo da Edge Function `criar-usuario`, admin-only). */
  const changePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return error ? error.message : null;
  }, []);

  return { session, loading, signIn, signOut, changePassword };
}
