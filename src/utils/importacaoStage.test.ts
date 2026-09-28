import { describe, expect, it } from 'vitest';
import { computeImportacaoStage } from './importacaoStage';

// Fixture mínima (não TaskView completo) — mesma técnica já usada em outros testes de função pura
// genérica deste projeto (ex.: sortProjectsByCriticality).
type FixtureTask = { name: string; status: 'planned' | 'in_progress' | 'delayed' | 'completed' };

describe('computeImportacaoStage', () => {
  it('todas concluídas — null (processo some do Kanban)', () => {
    const tasks: FixtureTask[] = [
      { name: 'Fabricação do Equipamento', status: 'completed' },
      { name: 'Transit Time', status: 'completed' },
      { name: 'Entrega', status: 'completed' },
    ];
    expect(computeImportacaoStage(tasks)).toBeNull();
  });

  it('nenhuma tarefa — null', () => {
    expect(computeImportacaoStage([] as FixtureTask[])).toBeNull();
  });

  it('1ª não concluída é Fabricação — etapa fabricacao', () => {
    const tasks: FixtureTask[] = [
      { name: 'Fabricação do Equipamento', status: 'delayed' },
      { name: 'Transit Time', status: 'planned' },
      { name: 'Entrega', status: 'planned' },
    ];
    const result = computeImportacaoStage(tasks);
    expect(result?.stage).toBe('fabricacao');
    expect(result?.task.name).toBe('Fabricação do Equipamento');
  });

  it('Fabricação concluída, Transit Time não — etapa transit', () => {
    const tasks: FixtureTask[] = [
      { name: 'Fabricação do Equipamento', status: 'completed' },
      { name: 'Transit Time', status: 'in_progress' },
      { name: 'Entrega', status: 'planned' },
    ];
    const result = computeImportacaoStage(tasks);
    expect(result?.stage).toBe('transit');
  });

  it('só falta Entrega — etapa entrega', () => {
    const tasks: FixtureTask[] = [
      { name: 'Fabricação do Equipamento', status: 'completed' },
      { name: 'Transit Time', status: 'completed' },
      { name: 'Entrega', status: 'planned' },
    ];
    const result = computeImportacaoStage(tasks);
    expect(result?.stage).toBe('entrega');
  });

  it('atividade fora do padrão — só 1 tarefa "Transit Time" — etapa transit, não fabricacao por posição', () => {
    const tasks: FixtureTask[] = [{ name: 'Transit Time', status: 'in_progress' }];
    const result = computeImportacaoStage(tasks);
    expect(result?.stage).toBe('transit');
  });

  it('nome que não bate com nenhuma etapa conhecida — outras', () => {
    const tasks: FixtureTask[] = [{ name: 'Embarque da Parafusadeira da China', status: 'delayed' }];
    const result = computeImportacaoStage(tasks);
    expect(result?.stage).toBe('outras');
  });

  it('nome com maiúsculas variadas continua batendo (case-insensitive)', () => {
    const tasks: FixtureTask[] = [{ name: 'FABRICAÇÃO DO EQUIPAMENTO', status: 'planned' }];
    expect(computeImportacaoStage(tasks)?.stage).toBe('fabricacao');
  });
});
