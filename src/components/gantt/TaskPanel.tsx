import { useEffect, useState } from 'react';
import { AlertTriangle, Plus, Trash2, X } from 'lucide-react';
import { Button, Card, FormField, Input, LockBadge, Select, Textarea } from '../ui';
import { PersonSelect } from '../shared/PersonSelect';
import type { Category, CategoryEntry, DependencyType, Holiday, Person, Replanejamento, Task, TaskView } from '../../types';
import {
  addDays,
  computeCandidatePredecessors,
  computeDependencyRuleDate,
  diffDays,
  formatDatePtBr,
  formatPeriod,
  validateDateOrder,
} from '../../utils';
import type { DependencyValidation, ReplanValidation } from '../../utils';

// Base não é editável por aqui — congelada na criação da tarefa (Fase 2.5) e só existe pra dar
// sentido ao indicador de atraso; deixá-la editável abriria a mesma âncora que devia ser fixa pra
// mudar em silêncio junto do previsto. `replanejamentos.campo='base'`/`replanTask` continuam
// aceitando base no tipo (infra do banco não muda), só este painel parou de oferecer o caminho.
type ReplanPatch = Partial<Pick<Task, 'plannedStart' | 'plannedEnd'>>;

interface DependencyEntry {
  predecessorRowNumber: number;
  tipo: DependencyType;
  folgaDias: number;
}

const REPLAN_CAMPO_LABEL: Record<Replanejamento['campo'], string> = { previsto: 'Previsto', base: 'Linha de base' };
const REPLAN_CAMPO_DATA_LABEL: Record<Replanejamento['campoData'], string> = { inicio: 'início', fim: 'fim' };
const DEPENDENCY_TYPES: DependencyType[] = ['FS', 'SS', 'FF', 'SF'];

interface TaskPanelProps {
  task: TaskView | null;
  allTasks: TaskView[];
  categories: CategoryEntry[];
  people: Person[];
  replanejamentos: Replanejamento[];
  holidays: Holiday[];
  unit: string;
  /** Fase 5 — `undefined` enquanto o papel ainda não carregou, tratado como travado (não
   * `false`): ver `usePerfil`. */
  isAdmin: boolean | undefined;
  onCreatePerson: (name: string) => Promise<Person>;
  onClose: () => void;
  onSave: (taskId: string, patch: Partial<Omit<Task, 'id' | 'rowNumber' | 'activityId' | 'status'>>) => void;
  /** Fase 5, Commit 2 — "informar real" tem caminho de escrita próprio, isolado do resto de
   * `onSave` (que reescreve a árvore inteira do projeto). Só os dois campos "Início/Fim real"
   * usam isto. */
  onSaveActual: (taskId: string, patch: { actualStart?: string; actualEnd?: string }) => void;
  onSetPredecessors: (taskId: string, entries: DependencyEntry[]) => DependencyValidation;
  onReplan: (taskId: string, patch: ReplanPatch, motivo: string) => ReplanValidation;
  /** Fase 7 (Parte A) — quantas tarefas (em qualquer projeto do portfólio, não só as visíveis na
   * rota atual) têm esta tarefa como predecessora. > 0 trava a exclusão (spec: "não excluir
   * tarefa que seja predecessora de outra"). Calculado pelo pai porque só ele tem acesso ao
   * portfólio inteiro sem o filtro de rota que `allTasks` já carrega aqui. */
  dependentCount: number;
  /** Só PEDE a exclusão — quem decide bloquear (dependentCount > 0) ou confirmar antes de
   * remover de verdade é quem chama (`ProjectSchedulePage.tsx`, `ConfirmDialog` próprio). */
  onDelete: (taskId: string) => void;
}

export function TaskPanel({
  task,
  allTasks,
  categories,
  people,
  replanejamentos,
  holidays,
  unit,
  isAdmin,
  onCreatePerson,
  onClose,
  onSave,
  onSaveActual,
  onSetPredecessors,
  onReplan,
  dependentCount,
  onDelete,
}: TaskPanelProps) {
  // `undefined` (carregando) conta como travado — nunca libera por engano antes de saber o
  // papel de verdade (ver usePerfil.ts).
  const locked = isAdmin !== true;
  const [dependencyDrafts, setDependencyDrafts] = useState<
    { predecessorRowNumber: number | ''; tipo: DependencyType; folgaDias: number }[]
  >([]);
  const [dependencyErrors, setDependencyErrors] = useState<string[]>([]);
  const [draftPlannedStart, setDraftPlannedStart] = useState('');
  const [draftPlannedEnd, setDraftPlannedEnd] = useState('');
  const [motivo, setMotivo] = useState('');
  const [replanErrors, setReplanErrors] = useState<string[]>([]);
  const [draftActualStart, setDraftActualStart] = useState('');
  const [draftActualEnd, setDraftActualEnd] = useState('');
  const [actualErrors, setActualErrors] = useState<string[]>([]);

  // Rascunho reseta sempre que a tarefa selecionada muda — o painel não desmonta ao trocar de
  // tarefa (só ao fechar), então sem isso o rascunho da tarefa anterior vazaria pra próxima.
  useEffect(() => {
    if (!task) return;
    setDraftPlannedStart(task.plannedStart);
    setDraftPlannedEnd(task.plannedEnd);
    setMotivo('');
    setReplanErrors([]);
    setDraftActualStart(task.actualStart ?? '');
    setDraftActualEnd(task.actualEnd ?? '');
    setActualErrors([]);
    const idToRowNumber = new Map(allTasks.map((t) => [t.id, t.rowNumber]));
    setDependencyDrafts(
      task.dependencies.map((d) => ({
        predecessorRowNumber: idToRowNumber.get(d.predecessorId) ?? '',
        tipo: d.tipo,
        folgaDias: d.folgaDias,
      })),
    );
    setDependencyErrors([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só task?.id de propósito: allTasks
    // muda de referência a cada edição de qualquer tarefa do projeto, e resetar o rascunho no
    // meio de uma edição descartaria o que o usuário está digitando (mesmo raciocínio do reset
    // de previsto/base acima).
  }, [task?.id]);

  if (!task) return null;

  const hasReplanChanges = draftPlannedStart !== task.plannedStart || draftPlannedEnd !== task.plannedEnd;

  function resetReplanDraft() {
    if (!task) return;
    setDraftPlannedStart(task.plannedStart);
    setDraftPlannedEnd(task.plannedEnd);
    setMotivo('');
    setReplanErrors([]);
  }

  function handleConfirmReplan() {
    if (!task) return;
    const orderCheck = validateDateOrder(draftPlannedStart, draftPlannedEnd);
    if (!orderCheck.valid) {
      setReplanErrors(orderCheck.errors);
      return;
    }
    const patch: ReplanPatch = {};
    if (draftPlannedStart !== task.plannedStart) patch.plannedStart = draftPlannedStart;
    if (draftPlannedEnd !== task.plannedEnd) patch.plannedEnd = draftPlannedEnd;
    const result = onReplan(task.id, patch, motivo);
    if (result.valid) {
      setMotivo('');
      setReplanErrors([]);
    } else {
      setReplanErrors(result.errors);
    }
  }

  /** Fase 7 (Parte A) — "Início/Fim real" viraram controlados (eram `defaultValue`+`onBlur`
   * direto) pra poder comparar o par antes de gravar; só o campo que de fato mudou vai no patch
   * (mesmo formato que `onSaveActual` já espera), o outro fica de fora. */
  function handleBlurActualStart() {
    if (!task) return;
    if (draftActualStart && draftActualEnd) {
      const check = validateDateOrder(draftActualStart, draftActualEnd);
      if (!check.valid) {
        setActualErrors(check.errors);
        return;
      }
    }
    setActualErrors([]);
    if (draftActualStart !== (task.actualStart ?? '')) {
      onSaveActual(task.id, { actualStart: draftActualStart || undefined });
    }
  }

  function handleBlurActualEnd() {
    if (!task) return;
    if (draftActualStart && draftActualEnd) {
      const check = validateDateOrder(draftActualStart, draftActualEnd);
      if (!check.valid) {
        setActualErrors(check.errors);
        return;
      }
    }
    setActualErrors([]);
    if (draftActualEnd !== (task.actualEnd ?? '')) {
      onSaveActual(task.id, { actualEnd: draftActualEnd || undefined });
    }
  }

  /** "Aplicar" (Fase 4, Commit 7) — só popula o rascunho (mantendo a duração atual, desloca
   * início OU fim conforme o tipo), nunca grava sozinho: o rascunho já preenchido revela a faixa
   * de motivo obrigatório (acima), mesmo fluxo da Fase 2.5. Duração em dias corridos (não úteis)
   * — desloca a janela inteira, não recalcula quantos dias úteis cabem nela. */
  function applySuggestedDate(tipo: DependencyType, ruleDate: string) {
    const duration = diffDays(draftPlannedStart, draftPlannedEnd);
    if (tipo === 'FS' || tipo === 'SS') {
      setDraftPlannedStart(ruleDate);
      setDraftPlannedEnd(addDays(ruleDate, duration));
    } else {
      setDraftPlannedEnd(ruleDate);
      setDraftPlannedStart(addDays(ruleDate, -duration));
    }
  }

  const taskReplanHistory = replanejamentos
    .filter((r) => r.tarefaId === task.id)
    .sort((a, b) => b.quando.localeCompare(a.quando));

  function resolveQuemName(quemUserId: string): string {
    return people.find((p) => p.userId === quemUserId)?.name ?? 'Usuário';
  }

  /** Só linhas com número preenchido viram entrada de verdade — linha em branco (usuário ainda
   * digitando) não é enviada nem valida como erro. */
  function commitDependencyDrafts(
    drafts: { predecessorRowNumber: number | ''; tipo: DependencyType; folgaDias: number }[],
  ) {
    if (!task) return;
    const entries = drafts
      .filter((d): d is { predecessorRowNumber: number; tipo: DependencyType; folgaDias: number } => d.predecessorRowNumber !== '')
      .map((d) => ({ predecessorRowNumber: d.predecessorRowNumber, tipo: d.tipo, folgaDias: d.folgaDias }));
    const validation = onSetPredecessors(task.id, entries);
    setDependencyErrors(validation.errors);
  }

  function addDependencyDraft() {
    setDependencyDrafts((rows) => [...rows, { predecessorRowNumber: '', tipo: 'FS', folgaDias: 0 }]);
  }

  function removeDependencyDraft(index: number) {
    const next = dependencyDrafts.filter((_, i) => i !== index);
    setDependencyDrafts(next);
    commitDependencyDrafts(next);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20" onClick={onClose}>
      <Card
        className="h-full w-full max-w-md overflow-y-auto rounded-none rounded-l-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-text">Tarefa {task.rowNumber}</p>
            {!!task.replanCount && (
              <span
                title={`Previsto replanejado ${task.replanCount} ${task.replanCount === 1 ? 'vez' : 'vezes'}`}
                className="inline-flex items-center rounded-full bg-action/10 px-2.5 py-1 text-xs font-semibold text-action"
              >
                R{task.replanCount}
              </span>
            )}
          </div>
          <button type="button" onClick={onClose} className="text-text-muted hover:text-text" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <FormField label={<>Nome {locked && <LockBadge />}</>}>
            <Input
              defaultValue={task.name}
              onBlur={(e) => onSave(task.id, { name: e.target.value })}
              disabled={locked}
              className="w-full"
            />
          </FormField>

          <FormField label={<>Categoria {locked && <LockBadge />}</>}>
            <Select
              defaultValue={task.category}
              onChange={(e) => onSave(task.id, { category: e.target.value as Category })}
              disabled={locked}
              className="w-full"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label={<>Responsável {locked && <LockBadge />}</>}>
            <PersonSelect
              value={task.responsavelId}
              onChange={(id) => onSave(task.id, { responsavelId: id })}
              people={people}
              onCreatePerson={onCreatePerson}
              placeholder="Sem responsável"
              disabled={locked}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label={<>Início previsto {locked && <LockBadge />}</>}>
              <Input
                type="date"
                value={draftPlannedStart}
                onChange={(e) => setDraftPlannedStart(e.target.value)}
                disabled={locked}
                className="w-full"
              />
            </FormField>
            <FormField label={<>Fim previsto {locked && <LockBadge />}</>}>
              <Input
                type="date"
                value={draftPlannedEnd}
                onChange={(e) => setDraftPlannedEnd(e.target.value)}
                disabled={locked}
                className="w-full"
              />
            </FormField>
          </div>

          <FormField label="Linha de base">
            {/* Só leitura — congelada na criação da tarefa (Fase 2.5), não muda por aqui. É a
                âncora que dá sentido ao indicador de atraso; editável, deixaria de significar
                alguma coisa. */}
            <p className="rounded-[7px] border border-border bg-page px-3 py-2 text-sm text-text-muted">
              {formatPeriod(task.baseStart, task.baseEnd)}
            </p>
          </FormField>

          {hasReplanChanges && (
            <div className="space-y-2 rounded-md border border-action/30 bg-action/5 p-3">
              <FormField label="Motivo do replanejamento" required error={replanErrors[0]}>
                <Textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  rows={2}
                  className="w-full"
                  placeholder="Por que essa data mudou?"
                />
              </FormField>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={resetReplanDraft}>
                  Cancelar
                </Button>
                <Button variant="primary" onClick={handleConfirmReplan}>
                  Confirmar alteração
                </Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Início real">
              <Input
                type="date"
                value={draftActualStart}
                onChange={(e) => setDraftActualStart(e.target.value)}
                onBlur={handleBlurActualStart}
                className="w-full"
              />
            </FormField>
            <FormField label="Fim real" error={actualErrors[0]}>
              <Input
                type="date"
                value={draftActualEnd}
                onChange={(e) => setDraftActualEnd(e.target.value)}
                onBlur={handleBlurActualEnd}
                className="w-full"
              />
            </FormField>
          </div>

          <FormField label={<>Predecessora(s) {locked && <LockBadge />}</>}>
            <div className="space-y-2">
              {task.hasDependencyViolation && (
                <p className="flex items-center gap-1.5 text-xs font-medium text-status-delayed">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  Previsto em conflito com a regra de alguma dependência.
                </p>
              )}
              {dependencyDrafts.map((row, index) => {
                // Candidatas excluem a própria tarefa, quem criaria ciclo, e as predecessoras já
                // ligadas nas OUTRAS linhas deste mesmo editor (não a desta linha — senão trocar
                // de predecessora numa linha existente ficaria impossível).
                const alreadyLinkedElsewhere = dependencyDrafts
                  .filter((_, i) => i !== index)
                  .map((r) => r.predecessorRowNumber)
                  .filter((n): n is number => n !== '');
                const candidates = computeCandidatePredecessors(task.rowNumber, allTasks, alreadyLinkedElsewhere);
                const predecessorTask =
                  row.predecessorRowNumber === '' ? undefined : allTasks.find((t) => t.rowNumber === row.predecessorRowNumber);
                const ruleDate = predecessorTask
                  ? computeDependencyRuleDate({ tipo: row.tipo, folgaDias: row.folgaDias }, predecessorTask, holidays, unit)
                  : undefined;
                const campoLabel = row.tipo === 'FF' || row.tipo === 'SF' ? 'o fim' : 'o início';
                const successorDraftDate = row.tipo === 'FF' || row.tipo === 'SF' ? draftPlannedEnd : draftPlannedStart;
                const violated = Boolean(ruleDate && successorDraftDate < ruleDate);

                return (
                  <div key={index} className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Select
                        value={row.predecessorRowNumber}
                        onChange={(e) => {
                          const value: number | '' = e.target.value === '' ? '' : Number(e.target.value);
                          const next = dependencyDrafts.map((r, i) => (i === index ? { ...r, predecessorRowNumber: value } : r));
                          setDependencyDrafts(next);
                          commitDependencyDrafts(next);
                        }}
                        className="w-36"
                        disabled={locked}
                      >
                        <option value="">Selecione…</option>
                        {candidates.map((rowNumber) => {
                          const candidate = allTasks.find((t) => t.rowNumber === rowNumber);
                          return (
                            <option key={rowNumber} value={rowNumber}>
                              #{rowNumber} — {candidate?.name ?? ''}
                            </option>
                          );
                        })}
                      </Select>
                      <Select
                        value={row.tipo}
                        onChange={(e) => {
                          const tipo = e.target.value as DependencyType;
                          const next = dependencyDrafts.map((r, i) => (i === index ? { ...r, tipo } : r));
                          setDependencyDrafts(next);
                          commitDependencyDrafts(next);
                        }}
                        className="w-20"
                        disabled={locked}
                      >
                        {DEPENDENCY_TYPES.map((tipo) => (
                          <option key={tipo} value={tipo}>
                            {tipo}
                          </option>
                        ))}
                      </Select>
                      <Input
                        type="number"
                        value={row.folgaDias}
                        title="Folga (dias úteis)"
                        onChange={(e) => {
                          const folgaDias = Number(e.target.value) || 0;
                          const next = dependencyDrafts.map((r, i) => (i === index ? { ...r, folgaDias } : r));
                          setDependencyDrafts(next);
                          commitDependencyDrafts(next);
                        }}
                        disabled={locked}
                        className="w-16"
                      />
                      <span className="text-xs text-text-muted">du</span>
                      <button
                        type="button"
                        onClick={() => removeDependencyDraft(index)}
                        disabled={locked}
                        className="text-text-muted hover:text-status-delayed disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="Remover predecessora"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {ruleDate && (
                      <div
                        className={`flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-xs ${
                          violated
                            ? 'border-status-delayed/40 bg-status-delayed/10 text-status-delayed'
                            : 'border-border bg-page text-text-muted'
                        }`}
                      >
                        <span className="flex items-center gap-1">
                          {violated && <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />}
                          {violated ? 'Conflito' : 'Sugestão'}: pela regra, {campoLabel} deve ser a partir de{' '}
                          {formatDatePtBr(ruleDate)}.
                        </span>
                        <button
                          type="button"
                          onClick={() => applySuggestedDate(row.tipo, ruleDate)}
                          disabled={locked}
                          className="shrink-0 font-semibold text-action hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline"
                        >
                          Aplicar
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              <Button variant="ghost" icon={<Plus className="h-3.5 w-3.5" />} onClick={addDependencyDraft} disabled={locked}>
                Adicionar predecessora
              </Button>
              {dependencyErrors.map((error) => (
                <p key={error} className="text-xs text-status-delayed">
                  {error}
                </p>
              ))}
            </div>
          </FormField>
        </div>

        {!!task.replanCount && (
          <div className="mt-6 border-t border-border pt-4">
            <p className="mb-2 text-xs font-semibold text-text-muted">Histórico de replanejamento</p>
            <ul className="space-y-2">
              {taskReplanHistory.map((r) => (
                <li key={r.id} className="rounded-md border border-border p-2 text-xs">
                  <p className="font-medium text-text">
                    {REPLAN_CAMPO_LABEL[r.campo]} · {REPLAN_CAMPO_DATA_LABEL[r.campoData]}: {formatDatePtBr(r.de)} →{' '}
                    {formatDatePtBr(r.para)}
                  </p>
                  <p className="mt-0.5 text-text-muted">
                    {new Date(r.quando).toLocaleString('pt-BR')} — {resolveQuemName(r.quemUserId)}
                  </p>
                  <p className="mt-0.5 italic text-text-muted">“{r.motivo}”</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 flex justify-between border-t border-border pt-4">
          <Button
            variant="danger"
            icon={<Trash2 className="h-4 w-4" />}
            onClick={() => {
              onDelete(task.id);
              onClose();
            }}
            disabled={locked || dependentCount > 0}
            title={
              locked
                ? 'Somente administrador pode excluir tarefa.'
                : dependentCount > 0
                  ? `Não é possível excluir: ${dependentCount} ${dependentCount === 1 ? 'tarefa depende' : 'tarefas dependem'} desta como predecessora.`
                  : undefined
            }
          >
            Excluir tarefa
          </Button>
          <Button variant="primary" onClick={onClose}>
            Concluído
          </Button>
        </div>
      </Card>
    </div>
  );
}
