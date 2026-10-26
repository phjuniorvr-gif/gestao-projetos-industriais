import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader } from '../components/layout';
import { Button, Card, EmptyState } from '../components/ui';
import { RequisicaoDialog } from '../components/requisicoes';
import { canManageRequisicoes, useAuth, usePapel, usePeople, useRequisicoes } from '../hooks';
import { REQUISICAO_STATUS_LABEL, REQUISICAO_STATUS_ORDER, type Requisicao, type RequisicaoStatus } from '../types';
import { formatDatePtBr } from '../utils';

// Cores por status (tokens já existentes no design system — sem cor nova) escolhidas pra não
// repetir entre colunas VIZINHAS do quadro (`REQUISICAO_STATUS_ORDER`): pendente(cinza) →
// em_cotacao(âmbar) → aprovada(azul) → reprovada(vermelho) → comprada(roxo) → recebida(verde).
const STATUS_COLOR: Record<RequisicaoStatus, string> = {
  pendente: 'var(--color-text-muted)',
  em_cotacao: 'var(--color-status-progress)',
  aprovada: 'var(--color-action)',
  reprovada: 'var(--color-status-delayed)',
  comprada: 'var(--color-status-planned)',
  recebida: 'var(--color-status-done)',
};

function formatValor(v: number | undefined): string {
  if (v === undefined) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Requisição de compra/material (sessão 2026-10-13, pedido do usuário) — Kanban por status
 * (`REQUISICAO_STATUS_ORDER`), desktop (sem layout mobile dedicado ainda, grid já responsivo).
 * Administrador/gestor_requisicoes criam e avançam pendente→em_cotacao→aprovada|reprovada;
 * comprador avança aprovada→comprada→recebida; visualizador só consulta — tudo reforçado no
 * banco (RLS + trigger `valida_edicao_requisicao`), esta tela só decide o que OFERECER.
 */
export function RequisicoesPage() {
  const { session } = useAuth();
  const papel = usePapel();
  const canManage = canManageRequisicoes(papel);
  const isComprador = papel === 'comprador';
  const { people } = usePeople();
  const { requisicoes, loaded, createRequisicao, updateRequisicao, avancarStatus, deleteRequisicao } = useRequisicoes();
  const [selected, setSelected] = useState<Requisicao | null | 'new'>(null);

  const groups = useMemo(() => {
    const byStatus: Record<RequisicaoStatus, Requisicao[]> = {
      pendente: [],
      em_cotacao: [],
      aprovada: [],
      reprovada: [],
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Requisições"
        subtitle="Requisições de compra/material — pendente → em cotação → aprovada/reprovada → comprada → recebida"
        actions={
          canManage ? (
            <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setSelected('new')}>
              Nova requisição
            </Button>
          ) : undefined
        }
      />

      {!loaded ? null : requisicoes.length === 0 ? (
        <EmptyState
          title="Nenhuma requisição ainda"
          description={canManage ? 'Clique em "Nova requisição" pra começar a lista.' : 'Ainda não há requisições cadastradas.'}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {REQUISICAO_STATUS_ORDER.map((status) => (
            <div key={status} className="space-y-2">
              <div className="px-1 text-xs font-semibold uppercase tracking-wide" style={{ color: STATUS_COLOR[status] }}>
                {REQUISICAO_STATUS_LABEL[status]} · {groups[status].length}
              </div>
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
                      <p className="text-xs text-text-muted">Quantidade: {r.quantidade}</p>
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
        isComprador={isComprador}
        criadoPorNome={dialogRequisicao ? resolveCriadoPorNome(dialogRequisicao.criadoPorUserId) : ''}
        onClose={() => setSelected(null)}
        onCreate={(input) => createRequisicao({ ...input, criadoPorUserId: session?.user.id ?? '' })}
        onSave={(id, patch) => updateRequisicao(id, patch)}
        onAdvanceStatus={(id, status) => avancarStatus(id, status)}
        onDelete={(id) => deleteRequisicao(id)}
      />
    </div>
  );
}
