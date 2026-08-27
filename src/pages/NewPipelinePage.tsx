import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/layout';
import { Button, Card, FormField, Input, Select, Textarea } from '../components/ui';
import { usePipelines } from '../hooks';
import { UNIT_OPTIONS } from './NewProjectPage';

/** "Novo Pipeline" (Fase 7+, pedido do usuário) — mesmo padrão visual de `NewProjectPage.tsx`
 * (step 0), mas sem código, sem gerente, sem seleção de atividades: só nome/descrição/unidade,
 * cria e volta pra lista. Administrador OU visualizador chegam aqui (rota sob `RequireAdmin`) —
 * exceção deliberada, visualizador normalmente só lê. */
export function NewPipelinePage() {
  const navigate = useNavigate();
  const { createPipeline } = usePipelines();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState(UNIT_OPTIONS[0]);
  const [nameError, setNameError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) {
      setNameError('Informe o nome do projeto');
      return;
    }
    setNameError('');
    setSaving(true);
    try {
      await createPipeline({ name: name.trim(), description: description.trim() || undefined, unit });
      navigate('/pipeline');
    } catch (err) {
      setNameError(err instanceof Error ? err.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Novo Pipeline" subtitle="Informações gerais" />

      <Card className="max-w-3xl p-6">
        <div className="space-y-4">
          <FormField label="Nome do projeto" required error={nameError}>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="w-full" placeholder="Nome do projeto" />
          </FormField>

          <FormField label="Descrição ou observação">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full"
              placeholder="Descreva o objetivo, escopo ou observações do projeto"
            />
          </FormField>

          <FormField label="Unidade" required>
            <Select value={unit} onChange={(e) => setUnit(e.target.value)} className="w-full">
              {UNIT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </FormField>

          <div className="flex justify-between pt-2">
            <Button variant="ghost" onClick={() => navigate('/pipeline')}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={saving}>
              Salvar pipeline
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
