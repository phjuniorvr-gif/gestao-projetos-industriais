import { usePapel } from './usePapel';

/**
 * Papel de acesso do usuário logado (Fase 5, `perfis.papel`) — só responde "é administrador
 * (pode escrever)?". `undefined` enquanto carrega — mesmo padrão já usado no projeto: não assume
 * nada antes de saber de verdade. `false` tanto pra 'usuario' quanto pro papel `visualizador`
 * (Fase 7+, enxerga tudo mas não escreve nada) — os dois são tratados como não-administrador por
 * todo trigger/RLS que depende de `eh_administrador()`, então esta função continua correta pros
 * dois sem precisar de nenhuma mudança.
 *
 * Quem usa isto pra travar campo/ação deve tratar `undefined` como TRAVADO, não liberado:
 * `disabled={isAdmin !== true}`, nunca `disabled={isAdmin === false}` — do jeito errado, a tela
 * piscaria liberada por um instante pra qualquer usuário até a resposta do Supabase chegar.
 */
export function usePerfil(): boolean | undefined {
  const papel = usePapel();
  return papel === undefined ? undefined : papel === 'administrador';
}
