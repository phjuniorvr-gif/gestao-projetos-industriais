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

/** Alcança a rota `/importacao` — quem já enxerga tudo (`canViewAll`) mais os papéis `comprador`
 * (Fase 7+) e `gestor_requisicoes` (sessão 2026-10-13, acesso combinado com Requisições/Tarefas
 * por vencer — ver `canViewRequisicoes`). */
export function canViewImportacao(papel: Papel | undefined): boolean {
  return canViewAll(papel) || papel === 'comprador' || papel === 'gestor_requisicoes';
}

/** Alcança a rota `/requisicoes` (sessão 2026-10-13) — quem já enxerga tudo (`canViewAll`) mais
 * `gestor_requisicoes` (dono da tela) e `comprador`: o banco (`valida_edicao_requisicao`) já
 * libera o comprador pra avançar aprovada→comprada→recebida, então ele precisa alcançar essa
 * rota pra usar essa capacidade — sem isso, a permissão do banco ficaria inatingível pela UI.
 * Criar/editar requisição em si é mais restrito ainda — ver `canManageRequisicoes`. */
export function canViewRequisicoes(papel: Papel | undefined): boolean {
  return canViewAll(papel) || papel === 'gestor_requisicoes' || papel === 'comprador';
}

/** Quem pode criar uma requisição nova ou editar os dados dela (item/quantidade/valor/
 * observação) — administrador + `gestor_requisicoes`, mesmo grupo que o INSERT da RLS exige
 * (`eh_administrador_ou_gestor_requisicoes()`). `visualizador` alcança a tela (`canViewRequisicoes`)
 * mas só pra consulta, mesmo padrão de sempre. */
export function canManageRequisicoes(papel: Papel | undefined): boolean {
  return papel === 'administrador' || papel === 'gestor_requisicoes';
}

/** Alcança a rota `/projetos` — quem já enxerga tudo (`canViewAll`) mais o papel `usuario`, que
 * antes só enxergava "Tarefas por vencer" (pedido do usuário: dar acesso de LEITURA à tela de
 * Projetos, sem abrir escrita nenhuma — todo botão/campo de edição ali já trava por
 * `isAdmin !== true`, o mesmo mecanismo que já protege `visualizador` hoje). Só esta rota (não
 * `canViewAll` inteiro) — `/novo-projeto`/Pipeline/Dashboard/etc. continuam fora do alcance de
 * `usuario`. */
export function canViewProjetos(papel: Papel | undefined): boolean {
  return canViewAll(papel) || papel === 'usuario';
}
