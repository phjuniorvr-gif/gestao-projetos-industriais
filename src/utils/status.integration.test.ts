import { describe, expect, it } from 'vitest';
import { recomputeProject, shouldShowStartDelayedBadge } from './status';
import type { Project } from '../types';

// Substituto programático do teste manual no navegador (sem credenciais de login nesta sessão
// pra abrir o app de verdade) — exercita `recomputeProject` de ponta a ponta com um projeto
// realista, cobrindo os 5 cenários da seção "Verificação" do plano da Fase 2.3:
//   1. tarefa bloqueada dentro do prazo → Planejado + ampulheta, SEM triângulo (suprimido)
//   2. tarefa não-bloqueada que devia ter começado → Planejado + triângulo
//   3. tarefa concluída 3du depois do previsto → Concluído + "+3d"
//   4. atividade com várias tarefas não iniciadas → CONTAGEM, não ícone fixo
//   5. projeto com tarefas concluídas e não-concluídas → não vira "Concluído" à toa
const TODAY = '2026-08-10'; // segunda-feira, mesma data de referência usada em toda a Fase 2.6

const project: Project = {
  id: 'p1',
  code: 'P01',
  name: 'Projeto de teste',
  unit: 'Matriz',
  sector: '',
  progress: 0,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  activities: [
    {
      id: 'a1',
      projectId: 'p1',
      name: 'Atividade A — tem a predecessora atrasada e a tarefa bloqueada por ela',
      tasks: [
        {
          // predecessora: nunca começou e já passou do prazo — status vira 'delayed' por
          // conta própria, não por bloqueio.
          id: 't1',
          rowNumber: 1,
          activityId: 'a1',
          name: 'Predecessora atrasada',
          category: 'eletrica',
          predecessorRowNumbers: [],
          plannedStart: '2026-07-01',
          plannedEnd: '2026-07-15',
        },
        {
          // cenário 1: dentro do prazo, mas bloqueada pela predecessora (t1) ainda não concluída.
          id: 't2',
          rowNumber: 2,
          activityId: 'a1',
          name: 'Bloqueada pela predecessora',
          category: 'eletrica',
          predecessorRowNumbers: [1],
          plannedStart: '2026-08-01',
          plannedEnd: '2026-08-20',
        },
      ],
    },
    {
      id: 'a2',
      projectId: 'p1',
      name: 'Atividade B — mistura tarefa atrasada-pra-começar, concluída com atraso e no prazo',
      tasks: [
        {
          // cenário 2: devia ter começado, sem nenhuma predecessora — não é bloqueio, é atraso
          // de execução mesmo.
          id: 't3',
          rowNumber: 3,
          activityId: 'a2',
          name: 'Deveria ter começado, sem predecessora',
          category: 'eletrica',
          predecessorRowNumbers: [],
          plannedStart: '2026-08-01',
          plannedEnd: '2026-08-20',
        },
        {
          // cenário 3: concluída 3 dias úteis depois do previsto (Tiradentes descontado — ver
          // status.test.ts / computeLateCompletionDays).
          id: 't4',
          rowNumber: 4,
          activityId: 'a2',
          name: 'Concluída com atraso',
          category: 'eletrica',
          predecessorRowNumbers: [],
          plannedStart: '2026-04-01',
          plannedEnd: '2026-04-17',
          actualStart: '2026-04-01',
          actualEnd: '2026-04-23',
        },
        {
          id: 't5',
          rowNumber: 5,
          activityId: 'a2',
          name: 'Concluída no prazo',
          category: 'eletrica',
          predecessorRowNumbers: [],
          plannedStart: '2026-05-01',
          plannedEnd: '2026-05-10',
          actualStart: '2026-05-01',
          actualEnd: '2026-05-08',
        },
      ],
    },
  ],
};

describe('recomputeProject — cenários de ponta a ponta (substitui o teste manual no navegador)', () => {
  const view = recomputeProject(project, TODAY, []);
  const [activityA, activityB] = view.activities;
  const [t1, t2] = activityA.tasks;
  const [t3, t4, t5] = activityB.tasks;

  it('cenário 1 — bloqueada dentro do prazo: Planejado, isBlocked true, selo de atraso-no-início suprimido', () => {
    expect(t2.status).toBe('planned');
    expect(t2.isBlocked).toBe(true);
    expect(t2.isStartDelayed).toBe(true); // dado calculado certo...
    expect(shouldShowStartDelayedBadge(t2)).toBe(false); // ...mas o selo não aparece (redundante)
  });

  it('cenário 2 — atraso no início sem bloqueio: Planejado + triângulo aparece', () => {
    expect(t3.status).toBe('planned');
    expect(t3.isBlocked).toBe(false);
    expect(t3.isStartDelayed).toBe(true);
    expect(shouldShowStartDelayedBadge(t3)).toBe(true);
  });

  it('cenário 3 — concluída com atraso: Concluído + "+3d" (feriado de Tiradentes descontado)', () => {
    expect(t4.status).toBe('completed');
    expect(t4.isLateCompletion).toBe(true);
    expect(t4.lateCompletionDays).toBe(3);
  });

  it('concluída no prazo não carrega selo de atraso', () => {
    expect(t5.status).toBe('completed');
    expect(t5.isLateCompletion).toBe(false);
  });

  it('predecessora sem bloqueio próprio, mas atrasada por conta própria', () => {
    expect(t1.status).toBe('delayed');
    expect(t1.isBlocked).toBe(false); // não tem predecessora — quem bloqueia é ela, não o contrário
  });

  it('cenário 4 — atividade A: contagem (não booleano fixo) de bloqueadas/atraso-no-início', () => {
    expect(activityA.status).toBe('delayed'); // alguma filha (t1) é delayed
    expect(activityA.blockedCount).toBe(1); // só t2
    expect(activityA.startDelayedCount).toBe(2); // t1 e t2, os dois nunca começaram
  });

  it('atividade B: em andamento (nem tudo completed), com 1 late completion e 1 start-delayed', () => {
    expect(activityB.status).toBe('in_progress');
    expect(activityB.blockedCount).toBe(0);
    expect(activityB.startDelayedCount).toBe(1); // só t3
    expect(activityB.isLateCompletion).toBe(true); // t4
  });

  it('cenário 5 — projeto com tarefas concluídas e não-concluídas não vira "Concluído" à toa', () => {
    expect(view.status).toBe('delayed'); // atividade A está delayed — precedência mais alta
    expect(view.blockedCount).toBe(1);
    expect(view.startDelayedCount).toBe(3);
    expect(view.isLateCompletion).toBe(true);
  });
});
