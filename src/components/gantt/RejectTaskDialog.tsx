import { useState } from 'react';
import { Button, Card, FormField, Textarea } from '../ui';

interface RejectTaskDialogProps {
  open: boolean;
  taskName: string;
  onCancel: () => void;
  /** Devolve `{ valid: false, errors }` (motivo vazio, por exemplo) — o diálogo mostra o erro e
   * fica aberto; só fecha (`onCancel` implícito, quem chama decide) quando `valid: true`. */
  onConfirm: (motivo: string) => { valid: boolean; errors: string[] };
}

/**
 * "Tratativa" da reprovação (Fase 7+, pedido do usuário: "quando eu não aprovar quero uma
 * tratativa") — motivo obrigatório, mesmo padrão de `validateReplanMotivo`/o banner de
 * replanejamento no `TaskPanel.tsx`. Reaproveitado por `TaskPanel.tsx` (banner "Aguardando
 * confirmação") e `PendingConfirmationsPage.tsx` (fila dedicada) — mesmo fluxo nos dois lugares.
 */
export function RejectTaskDialog({ open, taskName, onCancel, onConfirm }: RejectTaskDialogProps) {
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');

  if (!open) return null;

  function handleCancel() {
    setMotivo('');
    setError('');
    onCancel();
  }

  function handleConfirm() {
    const result = onConfirm(motivo);
    if (!result.valid) {
      setError(result.errors[0] ?? '');
      return;
    }
    setMotivo('');
    setError('');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={handleCancel}>
      <Card className="w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-semibold text-text">Reprovar finalização</p>
        <p className="mt-1.5 text-sm text-text-muted">
          "{taskName}" volta a não ter fim real — a pessoa vai precisar informar de novo.
        </p>
        <div className="mt-3">
          <FormField label="Tratativa" required error={error}>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              className="w-full"
              placeholder="Por que essa finalização está sendo reprovada?"
              autoFocus
            />
          </FormField>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={handleConfirm}>
            Reprovar
          </Button>
        </div>
      </Card>
    </div>
  );
}
