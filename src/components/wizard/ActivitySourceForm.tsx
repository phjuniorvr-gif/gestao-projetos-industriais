import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button, Card, Checkbox, FormField, Input, Select } from '../ui';
import type { ActivityTemplate, Category, CategoryEntry } from '../../types';
import type { DraftActivity } from './types';

interface ActivitySourceFormProps {
  catalog: ActivityTemplate[];
  categories: CategoryEntry[];
  onAddActivity: (draft: DraftActivity) => void;
}

type Mode = 'catalog' | 'manual';

interface ManualTaskRow {
  key: string;
  name: string;
  duration: number;
}

function uid(): string {
  return crypto.randomUUID();
}

export function ActivitySourceForm({ catalog, categories, onAddActivity }: ActivitySourceFormProps) {
  const categoryLabel = (id: string) => categories.find((c) => c.id === id)?.label ?? id;
  const [mode, setMode] = useState<Mode>('catalog');

  const technicalAreas = useMemo(
    () => Array.from(new Set(catalog.filter((t) => t.active).map((t) => t.category))),
    [catalog],
  );
  const [area, setArea] = useState<Category | ''>('');
  const currentArea = area || technicalAreas[0] || '';
  const templatesForArea = useMemo(
    () => catalog.filter((t) => t.active && t.category === currentArea),
    [catalog, currentArea],
  );
  const [templateId, setTemplateId] = useState('');
  const currentTemplate = templatesForArea.find((t) => t.id === templateId) ?? templatesForArea[0];
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const allChecked =
    !!currentTemplate && currentTemplate.tasks.length > 0 && currentTemplate.tasks.every((t) => checked[t.id]);

  const [manualArea, setManualArea] = useState<Category | ''>('');
  const [manualName, setManualName] = useState('');
  const [manualTasks, setManualTasks] = useState<ManualTaskRow[]>([{ key: uid(), name: '', duration: 1 }]);

  function toggleAllTasks() {
    if (!currentTemplate) return;
    if (allChecked) {
      setChecked({});
    } else {
      setChecked(Object.fromEntries(currentTemplate.tasks.map((t) => [t.id, true])));
    }
  }

  function handleAddFromCatalog() {
    if (!currentTemplate) return;
    const selectedTasks = currentTemplate.tasks.filter((t) => checked[t.id]);
    if (selectedTasks.length === 0) return;
    onAddActivity({
      key: uid(),
      name: currentTemplate.name,
      origin: 'catalog',
      expanded: false,
      tasks: selectedTasks.map((t) => ({
        key: uid(),
        name: t.name,
        category: currentTemplate.category,
        durationDays: t.durationDays,
        predecessorRowNumbers: [],
      })),
    });
    setChecked({});
  }

  function handleAddManualTaskRow() {
    setManualTasks((current) => [...current, { key: uid(), name: '', duration: 1 }]);
  }

  function updateManualTaskRow(key: string, patch: Partial<ManualTaskRow>) {
    setManualTasks((current) => current.map((t) => (t.key === key ? { ...t, ...patch } : t)));
  }

  function removeManualTaskRow(key: string) {
    setManualTasks((current) => current.filter((t) => t.key !== key));
  }

  function handleAddManual() {
    const area = manualArea || technicalAreas[0] || categories[0]?.id || '';
    const cleanTasks = manualTasks.filter((t) => t.name.trim());
    if (!manualName.trim() || cleanTasks.length === 0) return;
    onAddActivity({
      key: uid(),
      name: manualName.trim(),
      origin: 'manual',
      expanded: false,
      tasks: cleanTasks.map((t) => ({
        key: uid(),
        name: t.name.trim(),
        category: area as Category,
        durationDays: Math.max(1, t.duration),
        predecessorRowNumbers: [],
      })),
    });
    setManualName('');
    setManualTasks([{ key: uid(), name: '', duration: 1 }]);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setMode('catalog')}
          className={`rounded-lg border p-4 text-left text-sm font-semibold transition-colors ${
            mode === 'catalog' ? 'border-action bg-action/5 text-action' : 'border-border text-text hover:bg-page'
          }`}
        >
          Selecionar uma Atividade
          <p className="mt-1 text-xs font-normal text-text-muted">Use uma atividade com tarefas já padronizadas.</p>
        </button>
        <button
          type="button"
          onClick={() => setMode('manual')}
          className={`rounded-lg border p-4 text-left text-sm font-semibold transition-colors ${
            mode === 'manual' ? 'border-action bg-action/5 text-action' : 'border-border text-text hover:bg-page'
          }`}
        >
          Criar uma Atividade
          <p className="mt-1 text-xs font-normal text-text-muted">Crie uma atividade e cadastre suas tarefas.</p>
        </button>
      </div>

      {mode === 'catalog' ? (
        <Card className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Área técnica">
              <Select
                value={currentArea}
                onChange={(e) => {
                  setArea(e.target.value as Category);
                  setTemplateId('');
                  setChecked({});
                }}
                className="w-full"
              >
                {technicalAreas.map((c) => (
                  <option key={c} value={c}>
                    {categoryLabel(c)}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Atividade padronizada">
              <Select
                value={currentTemplate?.id ?? ''}
                onChange={(e) => {
                  setTemplateId(e.target.value);
                  setChecked({});
                }}
                className="w-full"
              >
                {templatesForArea.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-text-muted">Tarefas pré-definidas</p>
              {currentTemplate && currentTemplate.tasks.length > 0 && (
                <Button variant="secondary" onClick={toggleAllTasks}>
                  {allChecked ? 'Desmarcar todas' : 'Selecionar todas'}
                </Button>
              )}
            </div>
            {currentTemplate && currentTemplate.tasks.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {currentTemplate.tasks.map((t) => (
                  <Checkbox
                    key={t.id}
                    label={t.name}
                    checked={!!checked[t.id]}
                    onChange={(e) => setChecked((c) => ({ ...c, [t.id]: e.target.checked }))}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-muted">Nenhuma tarefa cadastrada para esta atividade no catálogo.</p>
            )}
          </div>

          <div className="flex justify-end">
            <Button
              variant="primary"
              icon={<Plus className="h-4 w-4" />}
              disabled={!Object.values(checked).some(Boolean)}
              onClick={handleAddFromCatalog}
            >
              Adicionar atividade
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="space-y-4 p-4">
          <FormField label="Área técnica">
            <Select
              value={manualArea || technicalAreas[0] || categories[0]?.id || ''}
              onChange={(e) => setManualArea(e.target.value as Category)}
              className="w-full"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Nome da atividade" required>
            <Input value={manualName} onChange={(e) => setManualName(e.target.value)} className="w-full" />
          </FormField>

          <div>
            <p className="mb-2 text-xs font-medium text-text-muted">Tarefas da atividade</p>
            <div className="space-y-2">
              {manualTasks.map((t) => (
                <div key={t.key} className="flex items-center gap-2">
                  <Input
                    value={t.name}
                    onChange={(e) => updateManualTaskRow(t.key, { name: e.target.value })}
                    placeholder="Nome da tarefa"
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    min={1}
                    value={t.duration}
                    onChange={(e) => updateManualTaskRow(t.key, { duration: Math.max(1, Number(e.target.value) || 1) })}
                    className="w-24"
                  />
                  <span className="text-xs text-text-muted">du</span>
                  <button
                    type="button"
                    onClick={() => removeManualTaskRow(t.key)}
                    className="rounded-md p-2 text-text-muted hover:bg-status-delayed/10 hover:text-status-delayed"
                    aria-label="Remover tarefa"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <Button variant="ghost" icon={<Plus className="h-4 w-4" />} className="mt-2" onClick={handleAddManualTaskRow}>
              Nova tarefa
            </Button>
          </div>

          <div className="flex justify-end">
            <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={handleAddManual}>
              Adicionar atividade
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
