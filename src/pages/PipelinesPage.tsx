import { useState } from 'react';
import { ArrowRight, Plus, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/layout';
import { Button, Card, ConfirmDialog, EmptyState } from '../components/ui';
import { usePerfil, usePipelines } from '../hooks';
import type { Pipeline } from '../types';
import { formatDatePtBr } from '../utils';

/** "Pipeline" (Fase 7+, pedido do usuário) — lista de projetos em prospecção, ainda sem
 * atividades/cronograma. Administrador e visualizador criam (`NewPipelinePage.tsx`) e excluem
 * (exceção deliberada, mesmo grupo nos dois casos — ver CLAUDE.md); sem edição ainda.
 * "Transformar em projeto" é admin-only (criar projeto sempre foi, Fase 5) — diferente da
 * exceção de criar/excluir pipeline, essa ação vira um projeto de verdade. */
export function PipelinesPage() {
  const navigate = useNavigate();
  const isAdmin = usePerfil();
  const { pipelines, loaded, deletePipeline } = usePipelines();
  const [deletingPipeline, setDeletingPipeline] = useState<Pipeline | null>(null);

  function handleConvertToProject(pipeline: Pipeline) {
    navigate('/novo-projeto', {
      state: {
        fromPipeline: { id: pipeline.id, name: pipeline.name, description: pipeline.description, unit: pipeline.unit },
      },
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline"
        subtitle="Projetos em prospecção, antes de virarem um projeto de verdade"
        actions={
          <Link to="/pipeline/novo">
            <Button variant="primary" icon={<Plus className="h-4 w-4" />}>
              Novo Pipeline
            </Button>
          </Link>
        }
      />

      {!loaded ? null : pipelines.length === 0 ? (
        <EmptyState
          title="Nenhum pipeline ainda"
          description="Cadastre um pipeline pra começar a lista."
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-page/60 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                <th className="px-4 py-2.5">Nome</th>
                <th className="px-4 py-2.5">Unidade</th>
                <th className="px-4 py-2.5">Descrição</th>
                <th className="px-4 py-2.5 text-right">Criado em</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {pipelines.map((pipeline) => (
                <tr key={pipeline.id} className="border-b border-border last:border-0 hover:bg-page/40">
                  <td className="px-4 py-2.5 font-medium text-text">{pipeline.name}</td>
                  <td className="px-4 py-2.5 text-text-muted">{pipeline.unit}</td>
                  <td className="max-w-0 truncate px-4 py-2.5 text-text-muted">{pipeline.description ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right text-text-muted">{formatDatePtBr(pipeline.createdAt.slice(0, 10))}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {isAdmin === true && (
                        <button
                          type="button"
                          onClick={() => handleConvertToProject(pipeline)}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-action hover:bg-action/10"
                          title="Transformar em projeto"
                        >
                          Transformar em projeto
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setDeletingPipeline(pipeline)}
                        className="rounded-lg p-1.5 text-text-muted hover:bg-status-delayed/10 hover:text-status-delayed"
                        title="Excluir pipeline"
                        aria-label="Excluir pipeline"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
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
