import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button, Card, ConfirmDialog, FormField, Input, Select, Textarea } from '../ui';
import { REQUISICAO_STATUS_LABEL, REQUISICAO_STATUS_ORDER, type Requisicao, type RequisicaoStatus } from '../../types';
import { formatDatePtBr } from '../../utils';

/** Opções do select de status (pedido do usuário — "um flag pra ir mudando de status", em vez dos
 * botões por transição que existiam antes): administrador/gestor_requisicoes veem os 4 status
 * (`REQUISICAO_STATUS_ORDER`, sem "em_cotacao"/"reprovada" — removidos do fluxo na sessão de
 * 2026-10-26) — já bypassam toda checagem do trigger `valida_edicao_requisicao`, então pular etapa
 * é permitido de verdade no banco, não só na UI. Comprador só vê a transição que o trigger de fato
 * aceita (aprovada→comprada, comprada→recebida) — fora dessas duas situações não tem o que
 * oferecer. */
function statusOptionsFor(status: RequisicaoStatus, canManage: boolean, isComprador: boolean): RequisicaoStatus[] {
  if (canManage) return REQUISICAO_STATUS_ORDER;
  if (isComprador && status === 'aprovada') return ['aprovada', 'comprada'];
  if (isComprador && status === 'comprada') return ['comprada', 'recebida'];
  return [status];
}

interface RequisicaoDialogProps {
  open: boolean;
  /** `null` = modo criação — aberto pra qualquer papel logado (`canCreateRequisicao`, checado na
   * página); campos ficam destravados em modo criação independente de `canManage` (ver
   * `fieldsLocked` abaixo — só trava edição de requisição JÁ EXISTENTE). */
  requisicao: Requisicao | null;
  /** Administrador/gestor_requisicoes — edita item/quantidade/valor/observação, avança
   * pendente→aprovada→comprada→recebida (select com os 4 status, livre), e exclui. */
  canManage: boolean;
  /** Quem CRIOU esta requisição (pedido do usuário — "editar e apagar pra pessoa que fez") —
   * edita os mesmos campos que `canManage` edita e exclui, mas NÃO ganha o select de status
   * (isso continua exclusivo de papel: `canManage`/`isComprador`). Espelha o trigger
   * `valida_edicao_requisicao` no banco, que já faz essa mesma distinção. */
  isOwner: boolean;
  /** Comprador — só vê os campos (sem editar) e avança aprovada→comprada→recebida. */
  isComprador: boolean;
  criadoPorNome: string;
  /** Vínculo OPCIONAL com projeto (sessão seguinte, pedido do usuário) — lista já ordenada por
   * código, resolvida na página (`projectOptions`, `useProjects()`). */
  projectOptions: { value: string; label: string }[];
  onClose: () => void;
  onCreate: (input: {
    item: string;
    quantidade: number;
    valorEstimado?: number;
    observacao?: string;
    projectId?: string;
  }) => Promise<unknown>;
  onSave: (
    id: string,
    patch: { item: string; quantidade: number; valorEstimado?: number; observacao?: string; projectId: string | null },
  ) => Promise<unknown>;
  onAdvanceStatus: (id: string, status: RequisicaoStatus) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
}

/**
 * Criar/editar requisição + avançar status — um diálogo só, comportamento muda por modo/papel:
 * em modo CRIAÇÃO qualquer papel logado edita os campos livremente (pedido do usuário, sessão
 * seguinte — "todos poder criar"); em modo EDIÇÃO (requisição já existente), `canManage` OU
 * `isOwner` (quem criou, pedido seguinte — "editar e apagar pra pessoa que fez") editam os dados
 * e excluem; o STATUS vira um `<select>` único (pedido do usuário — "um flag pra ir mudando de
 * status", em vez dos botões por transição de antes), com as opções filtradas por
 * `statusOptionsFor`: `canManage` vê os 5 status livremente; `isComprador` só vê a transição que
 * o banco de fato aceita (aprovada→comprada, comprada→recebida); qualquer outro papel (ex.
 * visualizador, ou alguém vendo a requisição de outra pessoa) não vê o select, só lê. A validação
 * de verdade é no banco (RLS de INSERT aberta + trigger `valida_edicao_requisicao` pro UPDATE,
 * que já reconhece o dono da mesma forma) — esta UI só evita oferecer uma opção que o servidor
 * recusaria.
 */
export function RequisicaoDialog({
  open,
  requisicao,
  canManage,
  isOwner,
  isComprador,
  criadoPorNome,
  projectOptions,
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
  const [projectId, setProjectId] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setItem(requisicao?.item ?? '');
    setQuantidade(requisicao ? String(requisicao.quantidade) : '');
    setValorEstimado(requisicao?.valorEstimado !== undefined ? String(requisicao.valorEstimado) : '');
    setObservacao(requisicao?.observacao ?? '');
    setProjectId(requisicao?.projectId ?? '');
    setError('');
  }, [open, requisicao]);

  if (!open) return null;

  const isCreate = requisicao === null;
  // Dono edita os campos tanto quanto `canManage` (pedido do usuário) — só não ganha o select de
  // status, que continua condicionado a `canManage`/`isComprador` abaixo (`canChangeStatus`).
  const canEditFields = canManage || isOwner;
  const fieldsLocked = !isCreate && !canEditFields;
  // Select de status só aparece quando há pelo menos uma opção de verdade além da atual
  // (`statusOptionsFor` devolve só `[status]` quando ninguém tem o que oferecer) — nunca em modo
  // criação, já que toda requisição nasce `pendente`.
  const canChangeStatus =
    !isCreate && requisicao !== null && statusOptionsFor(requisicao.status, canManage, isComprador).length > 1;

  async function handleSave() {
    if (!item.trim()) {
      setError('Informe a descrição.');
      return;
    }
    if (!/^\d{1,8}$/.test(quantidade.trim())) {
      setError('Informe o número da requisição (só números, até 8 dígitos).');
      return;
    }
    const qtd = Number(quantidade);
    const valor = valorEstimado.trim() ? Number(valorEstimado) : undefined;
    if (valorEstimado.trim() && (Number.isNaN(valor) || (valor ?? 0) < 0)) {
      setError('Valor estimado inválido.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const base = { item: item.trim(), quantidade: qtd, valorEstimado: valor, observacao: observacao.trim() || undefined };
      if (isCreate) await onCreate({ ...base, projectId: projectId || undefined });
      else await onSave(requisicao.id, { ...base, projectId: projectId || null });
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
          {canEditFields && !isCreate && (
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
          <FormField label="Descrição" required error={error}>
            <Input value={item} onChange={(e) => setItem(e.target.value)} className="w-full" disabled={fieldsLocked} placeholder="O que precisa comprar" />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Requisição" required>
              <Input
                type="text"
                inputMode="numeric"
                pattern="\d*"
                maxLength={8}
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value.replace(/\D/g, '').slice(0, 8))}
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
          <FormField label="Projeto (opcional)">
            <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full" disabled={fieldsLocked}>
              <option value="">Sem projeto</option>
              {projectOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Observação">
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={3}
              className="w-full"
              disabled={fieldsLocked}
            />
          </FormField>
          {canChangeStatus && requisicao && (
            <FormField label="Status">
              <Select
                value={requisicao.status}
                onChange={(e) => handleAdvance(e.target.value as RequisicaoStatus)}
                className="w-full"
                disabled={saving}
              >
                {statusOptionsFor(requisicao.status, canManage, isComprador).map((s) => (
                  <option key={s} value={s}>
                    {REQUISICAO_STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>
            </FormField>
          )}
          {!isCreate && requisicao && (
            <p className="text-xs text-text-muted">
              Criada por {criadoPorNome} em {formatDatePtBr(requisicao.createdAt.slice(0, 10))}
            </p>
          )}
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
          {!fieldsLocked && (
            <Button variant="primary" onClick={handleSave} disabled={saving}>
              {isCreate ? 'Criar requisição' : 'Salvar'}
            </Button>
          )}
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
