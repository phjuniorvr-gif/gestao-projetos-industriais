import { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import type { Papel } from '../types';
import { useAuth } from './useAuth';

/**
 * Papel de acesso bruto do usuário logado (`perfis.papel`) — `undefined` enquanto carrega, mesmo
 * padrão de `usePerfil`. Existe separado de `usePerfil` (que só responde "é administrador?",
 * boolean) porque a partir do papel `visualizador` (Fase 7+) passou a existir uma pergunta
 * diferente: "pode NAVEGAR por tudo?" (administrador OU visualizador) — `usePerfil` continua
 * governando só escrita (`eh_administrador()`/RLS só reconhecem 'administrador').
 */
export function usePapel(): Papel | undefined {
  const { session } = useAuth();
  const [papel, setPapel] = useState<Papel | undefined>(undefined);

  useEffect(() => {
    if (!session) {
      setPapel(undefined);
      return;
    }
    let cancelled = false;
    supabase
      .from('perfis')
      .select('papel')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setPapel(data?.papel as Papel | undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  return papel;
}

/** Enxerga toda a navegação (administrador ou visualizador) — `undefined` (carregando) conta
 * como NÃO podendo, mesmo padrão fail-closed de `usePerfil`: nunca libera a tela por engano
 * antes de saber o papel de verdade. */
export function canViewAll(papel: Papel | undefined): boolean {
  return papel === 'administrador' || papel === 'visualizador';
}
