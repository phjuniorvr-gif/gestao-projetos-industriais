import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button, Card, ConfirmDialog, FormField, Input, Textarea } from '../ui';
import type { Requisicao, RequisicaoStatus } from '../../types';
import { formatDatePtBr } from '../../utils';

interface RequisicaoDialogProps {
  open: boolean;
  /** `null` = modo criação — aberto pra qualquer papel logado (`canCreateRequisicao`, checado na
   * página); campos ficam destravados em modo criação independente de `canManage` (ver
   * `fieldsLocked` abaixo — só trava edição de requisição JÁ EXISTENTE). */
  requisicao: Requisicao | null;
  /** Administrador/gestor_requisicoes — edita item/quantidade/valor/observação, avança
   * pendente→em_cotacao→aprovada|reprovada, e exclui. */
  canManage: boolean;
  /** Comprador — só vê os campos (sem editar) e avança aprovada→comprada→recebida. */
  isComprador: boolean;
  criadoPorNome: string;
  onClose: () => void;
  onCreate: (input: { item: string; quantidade: number; valorEstimado?: number; observacao?: string }) => Promise<unknown>;
  onSave: (id: string, patch: { item: string; quantidade: number; valorEstimado?: number; observacao?: string }) => Promise<unknown>;
  onAdvanceStatus: (id: string, status: RequisicaoStatus) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
}

/**
 * Criar/editar requisição + avançar status — um diálogo só, comportamento muda por modo/papel:
 * em modo CRIAÇÃO qualquer papel logado edita os campos livremente (pedido do usuário, sessão
 * seguinte — "todos poder criar"); em modo EDIÇÃO (requisição já existente), `canManage` é quem
 * edita os dados e decide pendente→em_cotacao→aprovada|reprovada; `isComprador` só lê os dados e
 * decide aprovada→comprada→recebida; qualquer outro papel (ex. visualizador) só lê, sem botão
 * nenhum. A validação de verdade é no banco (RLS de INSERT aberta + trigger
 * `valida_edicao_requisicao` pro UPDATE) — esta UI só evita oferecer um botão que o servidor
 * recusaria.
 */
export function RequisicaoDialog({
  open,
  requisicao,
  canManage,
  isComprador,
  criadoPorNome,
  onClose,
  onCreate,
  onSave,
  onAdvanceStatus,
  onDelete,
}: RequisicaoDialogProps) {
  const [item, setItem] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [valorEstimado, setValorEstimado] = useState('');
  const [observacao, setObservacao] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setItem(requisicao?.item ?? '');
    setQuantidade(requisicao ? String(requisicao.quantidade) : '');
    setValorEstimado(requisicao?.valorEstimado !== undefined ? String(requisicao.valorEstimado) : '');
    setObservacao(requisicao?.observacao ?? '');
    setError('');
  }, [open, requisicao]);

  if (!open) return null;

  const isCreate = requisicao === null;
  const fieldsLocked = !isCreate && !canManage;

  async function handleSave() {
    if (!item.trim()) {
      setError('Informe o item.');
      return;
    }
    const qtd = Number(quantidade);
    if (!quantidade.trim() || Number.isNaN(qtd) || qtd <= 0) {
      setError('Informe uma quantidade válida.');
      return;
    }
    const valor = valorEstimado.trim() ? Number(valorEstimado) : undefined;
    if (valorEstimado.trim() && (Number.isNaN(valor) || (valor ?? 0) < 0)) {
      setError('Valor estimado inválido.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const payload = { item: item.trim(), quantidade: qtd, valorEstimado: valor, observacao: observacao.trim() || undefined };
      if (isCreate) await onCreate(payload);
      else await onSave(requisicao.id, payload);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAdvance(status: RequisicaoStatus) {
    if (!requisicao) return;
    setError('');
    setSaving(true);
    try {
      await onAdvanceStatus(requisicao.id, status);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível avançar o status.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <Card className="w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-text">{isCreate ? 'Nova requisição' : 'Requisição'}</p>
          {canManage && !isCreate && (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="rounded-lg p-1.5 text-text-muted hover:bg-status-delayed/10 hover:text-status-delayed"
              title="Excluir requisição"
              aria-label="Excluir requisição"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="mt-3 space-y-3">
          <FormField label="Item" required error={error}>
            <Input value={item} onChange={(e) => setItem(e.target.value)} className="w-full" disabled={fieldsLocked} placeholder="O que precisa comprar" />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Quantidade" required>
              <Input
                type="number"
                min="0"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                className="w-full"
                disabled={fieldsLocked}
              />
            </FormField>
            <FormField label="Valor estimado">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={valorEstimado}
                onChange={(e) => setValorEstimado(e.target.value)}
                className="w-full"
                disabled={fieldsLocked}
                placeholder="R$"
              />
            </FormField>
          </div>
          <FormField label="Observação">
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={3}
              className="w-full"
              disabled={fieldsLocked}
            />
          </FormField>
          {!isCreate && requisicao && (
            <p className="text-xs text-text-muted">
              Criada por {criadoPorNome} em {formatDatePtBr(requisicao.createdAt.slice(0, 10))}
            </p>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {canManage && requisicao?.status === 'pendente' && (
              <Button variant="secondary" onClick={() => handleAdvance('em_cotacao')} disabled={saving}>
                Mover pra Em cotação
              </Button>
            )}
            {canManage && requisicao?.status === 'em_cotacao' && (
              <>
                <Button variant="primary" onClick={() => handleAdvance('aprovada')} disabled={saving}>
                  Aprovar
                </Button>
                <Button variant="danger" onClick={() => handleAdvance('reprovada')} disabled={saving}>
                  Reprovar
                </Button>
              </>
            )}
            {isComprador && requisicao?.status === 'aprovada' && (
              <Button variant="primary" onClick={() => handleAdvance('comprada')} disabled={saving}>
                Marcar como Comprada
              </Button>
            )}
            {isComprador && requisicao?.status === 'comprada' && (
              <Button variant="primary" onClick={() => handleAdvance('recebida')} disabled={saving}>
                Marcar como Recebida
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Fechar
            </Button>
            {!fieldsLocked && (
              <Button variant="primary" onClick={handleSave} disabled={saving}>
                {isCreate ? 'Criar requisição' : 'Salvar'}
              </Button>
            )}
          </div>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmingDelete}
        title="Excluir requisição"
        message={`Tem certeza que deseja excluir "${requisicao?.item ?? ''}"? Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        danger
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={async () => {
          if (requisicao) await onDelete(requisicao.id);
          setConfirmingDelete(false);
          onClose();
        }}
      />
    </div>
  );
}
