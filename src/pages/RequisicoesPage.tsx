import { useMemo, useState } from 'react';
import { CheckCircle2, Clock, PackageCheck, Plus, ShoppingCart, type LucideIcon } from 'lucide-react';
import { PageHeader } from '../components/layout';
import { Badge, Button, Card, EmptyState, SummaryCard } from '../components/ui';
import { RequisicaoDialog } from '../components/requisicoes';
import {
  canCreateRequisicao,
  canManageRequisicoes,
  useAprovadores,
  useAuth,
  usePapel,
  usePeople,
  useProjects,
  useRequisicoes,
} from '../hooks';
import {
  REQUISICAO_STATUS_LABEL,
  REQUISICAO_STATUS_ORDER,
  TIPO_PEDIDO_LABEL,
  type Requisicao,
  type RequisicaoStatus,
} from '../types';
import { formatDatePtBr } from '../utils';

// Cores por status (tokens já existentes no design system — sem cor nova) escolhidas pra não
// repetir entre colunas VIZINHAS do quadro (`REQUISICAO_STATUS_ORDER`): pendente(cinza) →
// aprovada(azul) → comprada(roxo) → recebida(verde).
const STATUS_COLOR: Record<RequisicaoStatus, string> = {
  pendente: 'var(--color-text-muted)',
  aprovada: 'var(--color-action)',
  comprada: 'var(--color-status-planned)',
  recebida: 'var(--color-status-done)',
};

const STATUS_ICON: Record<RequisicaoStatus, LucideIcon> = {
  pendente: Clock,
  aprovada: CheckCircle2,
  comprada: ShoppingCart,
  recebida: PackageCheck,
};

function formatValor(v: number | undefined): string {
  if (v === undefined) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Requisição de compra/material (sessão 2026-10-13, pedido do usuário) — Kanban por status
 * (`REQUISICAO_STATUS_ORDER`), desktop (sem layout mobile dedicado ainda, grid já responsivo).
 * Qualquer papel logado cria (pedido do usuário — "quero mudar pra todos poder criar");
 * administrador/gestor_requisicoes são quem EDITA depois de criada e avança
 * pendente→aprovada; comprador avança aprovada→comprada→recebida — tudo reforçado no banco
 * (RLS + trigger `valida_edicao_requisicao`), esta tela só decide o que OFERECER.
 */
export function RequisicoesPage() {
  const { session } = useAuth();
  const papel = usePapel();
  const canCreate = canCreateRequisicao(papel);
  const canManage = canManageRequisicoes(papel);
  const isComprador = papel === 'comprador';
  const { people } = usePeople();
  const { projects } = useProjects();
  const { requisicoes, loaded, createRequisicao, updateRequisicao, avancarStatus, deleteRequisicao } = useRequisicoes();
  // Lista PRÓPRIA de aprovadores (pedido do usuário — "não é essa lista [pessoas], será uma lista
  // nova") — independente de `people`/`usePeople()`, que continua só pra resolver "Criada por".
  const { aprovadores, createAprovador } = useAprovadores();
  const [selected, setSelected] = useState<Requisicao | null | 'new'>(null);
  // Pedido do usuário — "quero nessa tela tenha a opção de tabela como fizemos na importação" —
  // mesmo toggle Tabela/Kanban (visual idêntico ao de `ProjectSchedulePage.tsx`), aqui com Kanban
  // como padrão (comportamento de sempre desta tela, inalterado).
  const [view, setView] = useState<'kanban' | 'tabela'>('kanban');

  function resolveAprovadorNome(aprovadorId: string | undefined): string | undefined {
    if (!aprovadorId) return undefined;
    return aprovadores.find((a) => a.id === aprovadorId)?.name;
  }

  // Opções do seletor de projeto (sessão seguinte, pedido do usuário — "a pessoa tenha a opção de
  // associar a um projeto") — mesmo formato "{código} — {nome}" já usado em outras listas do app
  // (ex. `importacaoProjectOptions`), ordenado por código. Projeto concluído some da lista — mesmo
  // pedido/raciocínio que escondeu concluído da tabela de Projetos (associar requisição nova a um
  // projeto já encerrado não faz sentido) — exceto o projeto JÁ vinculado à requisição aberta no
  // momento, senão editar uma requisição antiga faria parecer que ela perdeu o vínculo.
  const openRequisicaoProjectId = selected && selected !== 'new' ? selected.projectId : undefined;
  const projectOptions = useMemo(
    () =>
      [...projects]
        .filter((p) => p.status !== 'completed' || p.id === openRequisicaoProjectId)
        .sort((a, b) => a.code.localeCompare(b.code, 'pt-BR', { numeric: true }))
        .map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` })),
    [projects, openRequisicaoProjectId],
  );

  function resolveProjectLabel(projectId: string | undefined): string | undefined {
    if (!projectId) return undefined;
    const project = projects.find((p) => p.id === projectId);
    return project ? `${project.code} — ${project.name}` : undefined;
  }

  const groups = useMemo(() => {
    const byStatus: Record<RequisicaoStatus, Requisicao[]> = {
      pendente: [],
      aprovada: [],
      comprada: [],
      recebida: [],
    };
    for (const r of requisicoes) byStatus[r.status].push(r);
    return byStatus;
  }, [requisicoes]);

  // Achado ao testar (print do usuário, "grava o nome do usuario e o dia"): já gravava (`criado_por`
  // + `created_at`, desde a criação da tela) — o problema era só a RESOLUÇÃO do nome. `pessoas` tem
  // `userId` vinculado pra todo mundo MENOS a conta administrador (verificado no banco: é a única
  // linha de `perfis` sem `pessoas` correspondente) — então o próprio administrador criando/vendo
  // sua requisição sempre caía no fallback genérico "Usuário". Corrigido com um segundo fallback
  // ANTES do genérico: se quem está logado agora é o mesmo `userId` que criou, usa o e-mail da
  // PRÓPRIA sessão (`session.user.email`, sempre disponível) — resolve o caso real sem precisar
  // vincular uma pessoa pro administrador nem buscar `perfis` de outra pessoa (que RLS não deixa
  // pra quem não é admin). Criador de outra pessoa ainda sem vínculo (caso raro, hoje não existe
  // nenhum) continua caindo no "Usuário" genérico.
  function resolveCriadoPorNome(userId: string): string {
    const pessoa = people.find((p) => p.userId === userId)?.name;
    if (pessoa) return pessoa;
    if (userId === session?.user.id && session.user.email) return session.user.email;
    return 'Usuário';
  }

  const dialogOpen = selected !== null;
  const dialogRequisicao = selected === 'new' ? null : selected;
  // Pedido do usuário — "quero também um botão de editar e apagar pra pessoa que fez": quem criou
  // a requisição edita os dados/exclui a PRÓPRIA, mesmo sem ser administrador/gestor_requisicoes.
  // Avançar status continua exclusivo de `canManage`/`isComprador` (papel, não "dono") — ver
  // `RequisicaoDialog.tsx`.
  const isOwner = Boolean(dialogRequisicao && session?.user.id && dialogRequisicao.criadoPorUserId === session.user.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Requisições"
        subtitle="Requisições de compra/material — pendente → aprovada → comprada → recebida"
        actions={
          <>
            {/* Mesmo toggle Tabela/Kanban (visual idêntico) do pedido do usuário pra Importação
                (`ProjectSchedulePage.tsx`) — aqui Kanban continua o padrão, igual sempre foi. */}
            <div className="flex items-center rounded-[9px] border border-border bg-page p-0.5">
              <button
                type="button"
                onClick={() => setView('tabela')}
                className={`rounded-[7px] px-3 py-1.5 text-sm font-semibold transition-colors ${
                  view === 'tabela' ? 'bg-card text-action shadow-sm' : 'text-text-muted hover:text-text'
                }`}
              >
                Tabela
              </button>
              <button
                type="button"
                onClick={() => setView('kanban')}
                className={`rounded-[7px] px-3 py-1.5 text-sm font-semibold transition-colors ${
                  view === 'kanban' ? 'bg-card text-action shadow-sm' : 'text-text-muted hover:text-text'
                }`}
              >
                Kanban
              </button>
            </div>
            {canCreate && (
              <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setSelected('new')}>
                Nova requisição
              </Button>
            )}
          </>
        }
      />

      {!loaded ? null : requisicoes.length === 0 ? (
        <EmptyState
          title="Nenhuma requisição ainda"
          description={canCreate ? 'Clique em "Nova requisição" pra começar a lista.' : 'Ainda não há requisições cadastradas.'}
        />
      ) : view === 'tabela' ? (
        // Pedido do usuário, com as duas correções seguintes: "Tipo de Requisição" (era "Tipo de
        // Pedido"/"Pedido") fica logo depois de "N° da Req"; "N° do Pedido" (campo NOVO, número
        // digitado de até 10 dígitos — não é o mesmo dado de "Tipo de Requisição") fica logo
        // depois de "Status", que por sua vez fica logo depois de "Projeto". Mesma ordem de
        // linhas (`created_at desc`) que o fetch já traz — sem ordenação por coluna, não pedida.
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-page/60 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                <th className="px-4 py-2.5">Aprovador</th>
                <th className="px-4 py-2.5">N° da Req</th>
                <th className="px-4 py-2.5">Tipo de Requisição</th>
                <th className="px-4 py-2.5 text-right">Valor da Req</th>
                <th className="px-4 py-2.5">Descrição</th>
                <th className="px-4 py-2.5">Projeto</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">N° do Pedido</th>
                <th className="px-4 py-2.5">Observação</th>
                <th className="px-4 py-2.5">Data de Criação</th>
              </tr>
            </thead>
            <tbody>
              {requisicoes.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-page/40"
                >
                  <td className="px-4 py-2.5 text-text-muted">{resolveAprovadorNome(r.aprovadorId) ?? '—'}</td>
                  <td className="px-4 py-2.5 text-text">{r.quantidade}</td>
                  <td className="px-4 py-2.5 text-text-muted">{r.tipoPedido ? TIPO_PEDIDO_LABEL[r.tipoPedido] : '—'}</td>
                  <td className="px-4 py-2.5 text-right text-text-muted">{formatValor(r.valorEstimado)}</td>
                  <td className="max-w-0 px-4 py-2.5">
                    <p className="truncate text-text">{r.item}</p>
                  </td>
                  <td className="px-4 py-2.5 text-text-muted">{resolveProjectLabel(r.projectId) ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <Badge color={STATUS_COLOR[r.status]}>{REQUISICAO_STATUS_LABEL[r.status]}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-text-muted">{r.numeroPedido ?? '—'}</td>
                  <td className="max-w-0 px-4 py-2.5">
                    <p className="truncate text-text-muted">{r.observacao ?? '—'}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-text-muted">{formatDatePtBr(r.createdAt.slice(0, 10))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        // Pedido do usuário — "uns cards semelhantes a esse" (print de "Tarefas por vencer"),
        // corrigido pra "quero cards desses" apontando pros cabeçalhos do próprio quadro (PENDENTE
        // · 3 etc.) — viraram `SummaryCard` de verdade. Pedido seguinte — "tira o total... deixa
        // cada etapa empilhada": sem card "Total" avulso nem faixa separada; o card de cada status
        // empilha dentro da PRÓPRIA coluna (card no topo, lista de requisições embaixo), mesmo
        // componente `SummaryCard`, só-leitura.
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {REQUISICAO_STATUS_ORDER.map((status) => (
            <div key={status} className="space-y-2">
              <SummaryCard
                label={REQUISICAO_STATUS_LABEL[status]}
                value={groups[status].length}
                icon={STATUS_ICON[status]}
                color={STATUS_COLOR[status]}
              />
              {groups[status].length === 0 ? (
                <p className="px-1 text-xs text-text-muted2">Nenhuma requisição.</p>
              ) : (
                groups[status].map((r) => (
                  <button key={r.id} type="button" onClick={() => setSelected(r)} className="block w-full text-left">
                    <Card
                      className="space-y-1.5 border-l-4 p-3 transition-colors hover:border-text-muted2"
                      style={{ borderLeftColor: STATUS_COLOR[status] }}
                    >
                      <p className="truncate text-sm font-semibold text-text">{r.item}</p>
                      {resolveProjectLabel(r.projectId) && (
                        <p className="truncate text-xs font-semibold text-action">{resolveProjectLabel(r.projectId)}</p>
                      )}
                      <p className="text-xs text-text-muted">Requisição: {r.quantidade}</p>
                      <p className="text-xs text-text-muted">Valor estimado: {formatValor(r.valorEstimado)}</p>
                      {r.observacao && <p className="truncate text-xs text-text-muted">{r.observacao}</p>}
                      <p className="text-xs text-text-muted2">
                        {resolveCriadoPorNome(r.criadoPorUserId)} · {formatDatePtBr(r.createdAt.slice(0, 10))}
                      </p>
                    </Card>
                  </button>
                ))
              )}
            </div>
          ))}
        </div>
      )}

      <RequisicaoDialog
        open={dialogOpen}
        requisicao={dialogRequisicao}
        canManage={canManage}
        isOwner={isOwner}
        isComprador={isComprador}
        criadoPorNome={dialogRequisicao ? resolveCriadoPorNome(dialogRequisicao.criadoPorUserId) : ''}
        projectOptions={projectOptions}
        aprovadores={aprovadores}
        onCreateAprovador={createAprovador}
        onClose={() => setSelected(null)}
        onCreate={(input) => createRequisicao({ ...input, criadoPorUserId: session?.user.id ?? '' })}
        onSave={(id, patch) => updateRequisicao(id, patch)}
        onAdvanceStatus={(id, status) => avancarStatus(id, status)}
        onDelete={(id) => deleteRequisicao(id)}
      />
    </div>
  );
}
