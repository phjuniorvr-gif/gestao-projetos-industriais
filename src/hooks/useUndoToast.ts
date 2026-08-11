import { useCallback, useRef, useState } from 'react';

export interface UndoToastState {
  message: string;
  onUndo?: () => void;
}

/**
 * Toast de "ação executada, desfazer em N segundos" — genérico, não sabe nada de "projeto".
 * Nasce pra exclusão de projeto (Fase 3) mas é reusado sem alteração pra exclusão de atividade
 * (já prevista no CLAUDE.md: "excluir atividade e suas N tarefas" com Desfazer de 6s).
 */
export function useUndoToast() {
  const [toast, setToast] = useState<UndoToastState | null>(null);
  const timerRef = useRef<number | undefined>(undefined);

  const show = useCallback((message: string, onUndo?: () => void, durationMs = 6000) => {
    window.clearTimeout(timerRef.current);
    setToast({ message, onUndo });
    timerRef.current = window.setTimeout(() => setToast(null), durationMs);
  }, []);

  const dismiss = useCallback(() => {
    window.clearTimeout(timerRef.current);
    setToast(null);
  }, []);

  return { toast, show, dismiss };
}
