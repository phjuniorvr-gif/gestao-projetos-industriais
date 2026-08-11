# CLAUDE.md

Regras de processo para a refatoração em andamento neste repositório. Especificação completa em `referencia/PROMPT-Claude-Code-Gestao-Projetos.md`; protótipos visuais/funcionais em `referencia/*.html`.

## Regra de ouro

**Nada que pode ser calculado deve ser campo digitado.** Se um número ou data pode ser derivado de outro dado que já existe, ele é derivado — em view, função ou no servidor — e nunca é coluna editável. Aplicar isso em toda decisão de modelagem.

## Stack (manter, não migrar)

Vite + React + TypeScript, Supabase (Postgres + Auth + RLS), deploy na Vercel. Confirmar em `vite.config.ts`/`package.json`/`src/` antes de qualquer mudança — se a especificação mencionar outra stack, prevalece o que está no repositório.

## Como trabalhar

- **Construir em fases.** Uma fase por vez — não adiantar a fase seguinte.
- Antes de qualquer código, mostrar o **plano** e esperar aprovação.
- Commit ao fim de cada fase, mensagem clara (`feat/fix/refactor/chore`). **Não dar push sem revisão do usuário.**
- Explicar em português simples. Quando der erro, explicar antes de corrigir.
- Não alterar o que não foi pedido.
- Manter este arquivo e o `design.md` (a partir da Fase 1) atualizados a cada fase.
- Usar a versão mais recente de cada biblioteca; conferir documentação oficial antes de integrar.

## Roteiro das fases

0. Auditoria (concluída — ver commit de baseline).
1. Design system (`design.md` + tokens).
2. Modelo de dados e regras de derivação (responsabilidade, avanço, status, roll-up de datas, linha de base, calendário de dias úteis, dependências FS/SS/FF/SF, numeração).
3. Tela de Projetos.
4. Tela de Cronograma.
5. Permissões (RLS por perfil).
6. Mobile.
7. Validações, QA e fechamento.

## Decisões de modelagem (definidas antes da Fase 2)

- **Pessoas**: tabela nova `pessoas` (não é `auth.users` — `user_id` é opcional/nullable, porque responsável não precisa ter login no sistema). `gerente_id` (projeto) e `responsavel_id` (tarefa) são FK para `pessoas`, não mais texto livre. Migração: criar uma pessoa para cada valor distinto hoje presente em `projects.responsible`; **mostrar a lista de pessoas geradas antes de gravar**.
- **Status continua em 4 valores** (`planejado`, `andamento`, `atrasado`, `concluido`). `blocked` (bloqueado por predecessora) e `completed_late` (concluído com atraso) não desaparecem da experiência — viram **condições derivadas exibidas como ícone/selo ao lado do status**, não um 5º/6º valor do status em si. O estado "à iniciar" do protótipo (token `--inic`) é ignorado — não faz parte do modelo novo. Uma terceira condição derivada, "atraso no início" (deveria ter começado e não começou, independente de predecessora), também existe como selo próprio.
- **Status derivado só em TypeScript, sem espelho em SQL** (diferente do padrão de `dias_uteis`/`soma_dias_uteis` da Fase 2.6, que existem em TS *e* em função Postgres). `Task`/`Activity`/`Project` (forma persistida, `src/types/index.ts`) não têm campo `status`; `recomputeProject` (`src/utils/status.ts`), chamado só em `useProjects.ts`, produz a árvore hidratada (`TaskView`/`ActivityView`/`ProjectView`) que a UI consome. **Consequência para a Fase 5**: nenhuma policy de RLS e nenhuma query server-side vai poder filtrar/ordenar por status — ele só existe depois que o dado chega no cliente. **Dívida técnica registrada, sem fase alvo fixa**: se a Fase 4 ou 5 precisarem filtrar por status no servidor, criar uma view `v_tasks_status` que replique `computeTaskStatus`/`rollUpStatus` em SQL. As colunas antigas (`projects.status_legacy`, `activities.status_legacy`, `tasks.status_legacy`) foram renomeadas na Fase 2.3 (não dropadas — isso é Fase 7) e continuam `NOT NULL DEFAULT 'planned'`, gravando um valor sem significado em toda linha nova; documentado via `COMMENT ON COLUMN` no banco.
- **Datas de atividade/projeto são só roll-up, sem coluna própria** (Fase 2.4). `Activity`/`Project` (forma persistida) não têm `plannedStart`/`plannedEnd`/`actualStart`/`actualEnd` — só `Task` tem data própria. `ActivityView`/`ProjectView` recebem essas 4 datas via `rollUpDates` (`src/utils/status.ts`): previsto = extremos (mín/máx) dos filhos; `actualStart` = mínimo entre os filhos que já começaram (any); `actualEnd` só existe quando **todos** os filhos concluíram (assimetria proposital — evita mostrar atividade como concluída com tarefa pendente). As colunas Postgres equivalentes (`activities`/`projects` . `planned_start`/`planned_end`/`actual_start`/`actual_end`) foram **renomeadas** para `..._legacy` (não dropadas — tinham dado real gravado por uma versão anterior do app/seed, mesma lógica do `status_legacy` da Fase 2.3), documentado via `COMMENT ON COLUMN`.
- **Avanço é ponderado por dias úteis, não contagem de tarefas** (Fase 2.2). `peso(tarefa) = dias_uteis(previsto_início, previsto_fim)` (mínimo 1), isolado em `taskWeight` (`src/utils/status.ts`) — tarefa não tem percentual própria (binária: pesa a favor do numerador só quando `status === 'completed'`). `computeProgress` soma peso concluído ÷ peso total, tanto em `ActivityView` (ganhou `progress` pela primeira vez) quanto em `ProjectView` — nunca reporta 100% sem que todas as tarefas do nível estejam concluídas (arredondamento é sempre pra baixo nesse caso, `Math.min(99, ...)`). `progress` saiu do tipo persistido (`Project`) — não é mais campo digitável nem gravado. A coluna Postgres `projects.progress` foi **renomeada** para `progress_legacy` (não dropada — tinha valor real de uma fórmula anterior, contagem simples, confirmadamente diferente do avanço ponderado pros mesmos projetos), documentado via `COMMENT ON COLUMN`.
- **Exclusão de atividade com tarefas**: bloqueada por padrão (resolve a divergência apontada na auditoria — `useProjects.removeActivity()` hoje cascateia). Administrador tem ação explícita "excluir atividade e suas N tarefas", com **Desfazer de 6s** depois de executar (mesmo padrão de exclusão sem confirmação prévia da Fase 3).
- **Toda migração de schema é precedida de um dump do banco**; o caminho onde o dump foi salvo é sempre informado ao usuário antes de aplicar a migração.

## Decisões da Fase 3 (Tela de Projetos)

- **Criação de projeto continua no wizard de página cheia** (`NewProjectPage.tsx`) — o painel lateral novo (`ProjectDetailPanel.tsx`) é só pra visualizar/editar projeto já existente. O protótipo cria projeto dentro do próprio painel; a spec da Fase 3 só descreve os 3 caminhos de edição, não criação — não foi mudado.
- **Equipe/avatares derivados de `Task.responsavelId`, não de atividade** (`computeProjectTeam`/`computeActivityTeam`, `src/utils/portfolio.ts`) — o protótipo mostra por atividade, mas é anterior à decisão da Fase 2.1 (responsável é por tarefa; atividade nunca teve esse campo).
- **Sem `%` bruto editável em lugar nenhum da tela** (violaria a regra de ouro — avanço é sempre derivado, Fase 2.2). A edição inline ("caminho 1" da spec) marca uma tarefa como concluída: `computeFocusTask` sugere a tarefa não concluída com prazo mais vencido, mas o popover (`InlineTaskProgressEdit.tsx`) sempre deixa trocar antes de confirmar — nunca grava às cegas na tarefa escolhida pelo sistema.
- **Altura de linha da tabela de Projetos: ~64px, exceção documentada em `design.md`** — a régua de 34px (Fase 1) não cabe o mini-gantt de 2 trilhas + avanço com barra/delta que essa linha embute; 34px continua valendo pra linha de dado simples (ex.: Gantt da Fase 4).
- **Faixa de saúde (hero + barra empilhada) reflete o portfólio inteiro sempre**, imune a busca/unidade/ano — só o clique no chip filtra a tabela. Evita a faixa "esvaziar" quando alguém só busca um projeto específico.
- **"Carga por pessoa" conta só tarefas não concluídas**, não o histórico todo — é a medida de quem está afogado agora, não um contador que só cresce.
- **`ProjectCard.tsx` não foi apagado** mesmo sem uso em `ProjectsPage.tsx` (que virou tabela) — o protótipo mobile (`referencia/Gestao-Projetos-Mobile.html`) usa card, não tabela; fica reservado pra Fase 6 reusar em vez de reconstruir.
- **`useUndoToast`/`UndoToast.tsx` são genéricos** (mensagem + callback opcional) — nasceram pra exclusão de projeto, reusados sem alteração quando a exclusão de atividade com Desfazer (linha 41 acima) for implementada. Sem teste automatizado: este projeto não tem infraestrutura de teste de hook/componente React (`@testing-library/react`/`jsdom`), só função pura (Vitest) — decisão confirmada com o usuário de não adicionar essa dependência só por causa de um hook de 14 linhas; verificado manualmente.

## Permissões

Configuradas em `.claude/settings.local.json` (local, fora do git) para não precisar aprovar comando por comando. Regras:

- **Liberado sem perguntar**: comandos só de leitura/verificação — `git status`, `git diff`, `git log`, `ls`, `cat` — e os comandos de checagem — `npx tsc --noEmit`, `npm run build`, `npm run lint`.
- **Escrita liberada** (criar/editar arquivo) em `src/**`, `referencia/**`, `CLAUDE.md` e `design.md`.
- **Sempre pergunta antes** (nunca liberar por padrão, mesmo que uma regra futura tente cobrir): `git push`, `git reset --hard`, `git checkout` que descarte alterações (`git checkout -- <arquivo>`, `git checkout .`), qualquer `rm`, qualquer migration ou SQL direto no Supabase (`apply_migration`, `execute_sql`), e escrita em `.env*`, `package.json`, `vercel.json` e `supabase/**`.

Se alguma dessas regras precisar mudar, atualizar `.claude/settings.local.json` e esta seção juntos.
