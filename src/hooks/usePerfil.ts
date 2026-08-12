import { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from './useAuth';

/**
 * Papel de acesso do usuário logado (Fase 5, `perfis.papel`). `undefined` enquanto carrega —
 * mesmo padrão de `holidaysLoaded`/`replanejamentosLoaded` já usado no projeto: não assume nada
 * antes de saber de verdade. `false` (não administrador) quando não existe linha em `perfis` pro
 * usuário — fail-closed, nunca assume administrador por omissão.
 *
 * Quem usa isto pra travar campo/ação deve tratar `undefined` como TRAVADO, não liberado:
 * `disabled={isAdmin !== true}`, nunca `disabled={isAdmin === false}` — do jeito errado, a tela
 * piscaria liberada por um instante pra qualquer usuário até a resposta do Supabase chegar.
 */
export function usePerfil(): boolean | undefined {
  const { session } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    if (!session) {
      setIsAdmin(undefined);
      return;
    }
    let cancelled = false;
    supabase
      .from('perfis')
      .select('papel')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setIsAdmin(data?.papel === 'administrador');
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  return isAdmin;
}
