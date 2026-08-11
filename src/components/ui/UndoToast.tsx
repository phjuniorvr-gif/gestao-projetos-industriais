import { X } from 'lucide-react';
import type { UndoToastState } from '../../hooks/useUndoToast';

interface UndoToastProps {
  toast: UndoToastState | null;
  onDismiss: () => void;
}

/** Apresentação pura do toast de desfazer — a lógica de mostrar/expirar vive em `useUndoToast`. */
export function UndoToast({ toast, onDismiss }: UndoToastProps) {
  if (!toast) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg bg-sidebar px-4 py-3 text-sm text-white shadow-lg">
      <span>{toast.message}</span>
      {toast.onUndo && (
        <button
          type="button"
          onClick={() => {
            toast.onUndo?.();
            onDismiss();
          }}
          className="font-semibold text-action-2 hover:underline"
        >
          Desfazer
        </button>
      )}
      <button type="button" onClick={onDismiss} aria-label="Fechar aviso" className="text-white/60 hover:text-white">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
