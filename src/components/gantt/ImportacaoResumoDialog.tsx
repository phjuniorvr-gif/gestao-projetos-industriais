import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button, Card } from '../ui';

interface ImportacaoResumoDialogProps {
  open: boolean;
  text: string;
  cardCount: number;
  onClose: () => void;
}

/** Resumo pra copiar e enviar ao comprador (pedido do usuário, sessão de 2026-10-05) — só
 * exibição/cópia, sem edição; o texto já vem pronto de `buildImportacaoResumoText`. Mesmo padrão
 * de overlay dos outros diálogos do app (`RejectTaskDialog.tsx`: scrim, clique fora fecha). */
export function ImportacaoResumoDialog({ open, text, cardCount, onClose }: ImportacaoResumoDialogProps) {
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <Card className="flex max-h-[85vh] w-full max-w-lg flex-col p-5" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-semibold text-text">Resumo para o comprador</p>
        <p className="mt-1 text-sm text-text-muted">
          {cardCount === 0
            ? 'Nenhum processo atrasado ou não iniciado agora.'
            : `${cardCount} ${cardCount === 1 ? 'processo' : 'processos'} atrasado(s) ou não iniciado(s), agrupados por etapa.`}
        </p>
        <textarea
          readOnly
          value={text}
          className="mt-3 w-full flex-1 resize-none rounded-md border border-border bg-page p-3 font-mono text-xs text-text"
          rows={16}
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
          <Button
            variant="primary"
            icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            onClick={handleCopy}
            disabled={cardCount === 0}
          >
            {copied ? 'Copiado!' : 'Copiar'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
