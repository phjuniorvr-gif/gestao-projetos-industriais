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

/** Alcança a rota `/requisicoes` — pedido do usuário pra liberar a aba pra TODO MUNDO (inclusive
 * `usuario`, antes restrito a Tarefas por vencer/Projetos). Cobre literalmente os 5 valores de
 * `Papel` hoje; mantido como enumeração explícita (não `papel !== undefined`) pelo mesmo padrão
 * dos outros `canView*` — se um papel novo for criado depois, PRECISA entrar aqui também pra
 * continuar valendo "todo mundo". Visualização é sempre liberada; criar/editar/avançar status
 * continuam restritos por `canManageRequisicoes`/pelo banco (`valida_edicao_requisicao`), que não
 * mudaram — abrir a ROTA não abriu nenhuma escrita nova. */
export function canViewRequisicoes(papel: Papel | undefined): boolean {
  return canViewAll(papel) || papel === 'gestor_requisicoes' || papel === 'comprador' || papel === 'usuario';
}

/** Quem pode EDITAR os dados de uma requisição JÁ CRIADA (item/quantidade/valor/observação) e
 * decidir pendente→em_cotacao→aprovada|reprovada — administrador + `gestor_requisicoes`, mesmo
 * grupo que o trigger `valida_edicao_requisicao` exige pra tocar em qualquer coluna além de
 * `status`. Diferente de `canCreateRequisicao` (criar é mais aberto) — ver essa função abaixo pro
 * porquê da separação. */
export function canManageRequisicoes(papel: Papel | undefined): boolean {
  return papel === 'administrador' || papel === 'gestor_requisicoes';
}

/** Quem pode CRIAR uma requisição nova — pedido do usuário pra abrir pra TODO MUNDO (antes só
 * `canManageRequisicoes`). Separada de `canManageRequisicoes` de propósito: criar vira livre, mas
 * editar depois de criada continua restrita (o trigger `valida_edicao_requisicao` só roda em
 * UPDATE, nunca em INSERT, então a RLS de INSERT — aberta a qualquer autenticado — é quem governa
 * de verdade; esta função só decide se a UI oferece o botão). `undefined` (carregando) conta como
 * NÃO podendo, mesmo padrão fail-closed de sempre — evita o botão piscar antes do papel resolver. */
export function canCreateRequisicao(papel: Papel | undefined): boolean {
  return papel !== undefined;
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
