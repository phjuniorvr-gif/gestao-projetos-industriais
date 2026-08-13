import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Primitivo genérico de bottom sheet (Fase 6/mobile) — mesma estrutura de overlay que
 * `TaskPanel.tsx`/`ProjectDetailPanel.tsx` usam pro painel lateral (scrim, clique-fora fecha,
 * Esc fecha), adaptada pra entrar de baixo. Nenhum dos dois painéis existentes tem transição CSS;
 * este ganha `transition-transform` de verdade. Sem arrastar-pra-fechar (nem o protótipo tem).
 */
export function BottomSheet({ open, onClose, children }: BottomSheetProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, [open]);

  useEffect(() => {
    if (!open) setVisible(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className={`flex max-h-[86vh] w-full flex-col overflow-y-auto rounded-t-2xl bg-card shadow-xl transition-transform duration-[270ms] ease-out ${
          visible ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pb-1 pt-2.5">
          <span className="h-1 w-9 rounded-full bg-border" />
        </div>
        {children}
      </div>
    </div>
  );
}
