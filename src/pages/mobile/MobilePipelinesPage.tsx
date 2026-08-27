import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { Badge, Button, Card, ConfirmDialog, EmptyState } from '../../components/ui';
import { usePipelines } from '../../hooks';
import type { Pipeline } from '../../types';
import { formatDatePtBr } from '../../utils';

/** Aba Pipeline no mobile (a pedido do usuário) — lista em cards empilhados, mesmo padrão de
 * `MobileTeamPage.tsx`/`ProjectCard.tsx` (não é a tabela do desktop encolhida, Fase 6). Criar
 * ("Novo Pipeline") reaproveita `NewPipelinePage.tsx` sem variante própria — é só um formulário
 * de 3 campos, já responsivo de coluna única. */
export function MobilePipelinesPage() {
  const { pipelines, loaded, deletePipeline } = usePipelines();
  const [deletingPipeline, setDeletingPipeline] = useState<Pipeline | null>(null);

  return (
    <div className="space-y-3">
      <Link to="/pipeline/novo">
        <Button variant="primary" icon={<Plus className="h-4 w-4" />} className="min-h-11 w-full justify-center">
          Novo Pipeline
        </Button>
      </Link>

      {!loaded ? null : pipelines.length === 0 ? (
        <EmptyState title="Nenhum pipeline ainda" description="Cadastre um pipeline pra começar a lista." />
      ) : (
        pipelines.map((pipeline) => (
          <Card key={pipeline.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-text">{pipeline.name}</p>
                <Badge color="#64748B" className="mt-1.5">{pipeline.unit}</Badge>
              </div>
              <button
                type="button"
                onClick={() => setDeletingPipeline(pipeline)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-text-muted hover:bg-status-delayed/10 hover:text-status-delayed"
                title="Excluir pipeline"
                aria-label="Excluir pipeline"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {pipeline.description && <p className="mt-2 text-xs text-text-muted">{pipeline.description}</p>}

            <p className="mt-2 border-t border-border pt-2 text-[11px] text-text-muted2">
              Criado em {formatDatePtBr(pipeline.createdAt.slice(0, 10))}
            </p>
          </Card>
        ))
      )}

      <ConfirmDialog
        open={Boolean(deletingPipeline)}
        title="Excluir pipeline"
        message={`Tem certeza que deseja excluir o pipeline "${deletingPipeline?.name ?? ''}"? Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        danger
        onCancel={() => setDeletingPipeline(null)}
        onConfirm={() => {
          if (deletingPipeline) deletePipeline(deletingPipeline.id);
          setDeletingPipeline(null);
        }}
      />
    </div>
  );
}
