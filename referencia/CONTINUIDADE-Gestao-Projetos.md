# Onde paramos — refatoração do Gestão de Projetos Industriais

> Cole isto na primeira mensagem de uma conversa nova para retomar sem perder contexto.
> Atualizado em 11/ago/2026.

## O projeto

App interno da Colorvisão/Colormaq para gestão de projetos industriais. Está em produção com dados reais (8 projetos, 14 atividades, 55 tarefas, 1 usuário).

**Stack:** Vite + React 19 + TypeScript + React Router v7 + Supabase + Vercel.
**Pasta:** `Desktop\Projetos DEV\Projeto-gestao-de-projetos`
**Projeto Supabase:** `dutiyrleyjysnxgkrbpn`

Estou refatorando com o Claude Code seguindo a especificação em `referencia/PROMPT-Claude-Code-Gestao-Projetos.md`, junto com três protótipos HTML na mesma pasta (`Gestao-Projetos-Redesign.html`, `Cronograma-Redesign.html`, `Gestao-Projetos-Mobile.html`).

**Regra de ouro do projeto:** nada que pode ser calculado deve ser campo digitado.

## Fases concluídas

**Fase 0 — Auditoria.** Mapeou o schema, criou `CLAUDE.md` e `vercel.json` (rewrite de SPA, que corrigiu o 404 em rota direta).

**Fase 1 — Design system.** Paleta azul institucional por remapeamento dos tokens Tailwind. Inter + JetBrains Mono self-hosted. Cards sem sombra, raio 7px/10px. `--mut2` (#94a3b8) só em ícone, borda e placeholder — nunca em texto.

**Fase 2.6 — Calendário de dias úteis.** `pascoa()` e `feriados_nacionais()` calculam 9 fixos + 3 móveis para qualquer ano. Tabela `feriados` só para o não-calculável (municipal, ponto facultativo, parada de fábrica), isolado por unidade. `dias_uteis(a, b, unidade)` e `soma_dias_uteis(base, n, unidade)`, espelhadas em TS (`src/utils/dates.ts`) com Vitest comparando SQL x TS. **Convenção fixada: `businessDaysBetween` é inclusiva nas duas pontas** — tarefa que começa e termina no mesmo dia útil conta 1.

**Fase 2.1 — Pessoas.** Tabela `pessoas` (com `active` e `user_id` opcional). `projects.gerente_id` e `tasks.responsavel_id` como FK. Criação inline em 4 telas. Lista em Configurações para renomear e inativar.

**Fase 2.3 — Status em 4 valores + selos derivados.** Status saiu do banco: `projects/activities/tasks.status` → `status_legacy` (rename, não drop — tinha dado real; `NOT NULL DEFAULT 'planned'` preservado, então linhas novas nascem com valor sem significado — documentado em `COMMENT ON COLUMN`). Taxonomia reduzida a `planned/in_progress/delayed/completed`, derivada das datas em TS. `blocked`, `completed_late` e a nova condição **"atraso no início"** viram selos ao lado do chip (ampulheta / "+Nd" em dias úteis / triângulo), com supressão de redundância (bloqueado esconde o triângulo). Em atividade/projeto, bloqueio e atraso-no-início viram **contagem** ("3 bloqueadas"), não booleano — `some()` satura com 55 tarefas. `rollUpStatus` com quantificadores explícitos (delayed se ALGUMA; completed se TODAS; in_progress se ALGUMA começou; coleção vazia → planned).

**Fase 2.4 — Roll-up de datas.** `plannedStart/plannedEnd/actualStart/actualEnd` saíram do tipo persistido de `Activity`/`Project` e do upsert; 8 colunas renomeadas para `_legacy` com comentário. Antes de renomear, comparação valor-armazenado x valor-calculado: **nenhuma divergência real**, só ausências — era cache velho, não baseline escondido. `rollUpDates` conferida: `actualStart` = mínimo entre as que já começaram (any); `actualEnd` só existe se TODAS terminaram.

**Fase 2.2 — Avanço ponderado.** `taskWeight(tarefa)` = dias úteis entre previsto início/fim, mínimo 1, isolada numa função só (trocar para custo/homem-hora depois muda um lugar). `computeProgress` = peso concluído ÷ peso total; **nunca retorna 100 sem tudo concluído** (arredondamento não pode dizer "acabou"). `ActivityView` ganhou `progress` pela primeira vez. `projects.progress` → `progress_legacy`. Projeto agrega via `flatMap` de todas as tarefas (equivalente a somar peso por peso; média de atividades seria errada com atividade vazia).

**Fase 3 — Tela de Projetos.** 7 commits. Faixa de saúde (hero + barra empilhada clicável) no lugar dos 5 cards de KPI; tabela com mini-gantt por linha no lugar da lista de cards, ordenada por criticidade (regra numérica explícita com desempate determinístico); toast de desfazer genérico + exclusão sem confirmação prévia; painel lateral no lugar do modal; edição inline da tarefa-foco (sem `%` bruto — só marca tarefa concluída, sempre trocável no seletor) + menu `⋯`; painéis "Atenção nos próximos 30 dias" e "Carga por pessoa" (só tarefas em aberto). `computeExpectedProgress` é curva S do plano (peso das tarefas vencidas ÷ peso total), **não** reta por tempo decorrido. `ProjectCard.tsx` mantido sem uso — o protótipo mobile usa card, a Fase 6 reusa.

**Fase 2.5 — Linha de base congelada.** 5 commits. `Task.baseStart/baseEnd` — seed = previsto no instante de criação da tarefa, nunca mais tocado sozinho (não existe "aprovação de cronograma" em lugar nenhum do app; resolvido copiando o comportamento do protótipo). Editar previsto/base virou rascunho comparado contra o valor salvo: mudança real revela textarea de motivo obrigatório + "Confirmar alteração", **inline no painel lateral, sem modal novo**. Log de replanejamento (tabela `replanejamentos`) cobre previsto **e** base (não só previsto, como o protótipo faz literalmente) — a âncora que dá sentido ao indicador de atraso não pode mudar em silêncio; colunas `campo`/`campo_data` discriminam o quê mudou; selo `R{n}` conta só previsto. Sem gating de admin ainda — não existe primitiva de papel em lugar nenhum do código, motivo obrigatório vale pra qualquer usuário logado; a Fase 5 restringe de verdade. Migração em duas partes (tabela+colunas nullable primeiro, `NOT NULL` só depois do deploy confirmado). **Gap pego via `get_advisors` depois da migração**: `replanejamentos` nasceu sem RLS habilitado; corrigido pra append-only de verdade (policy só de INSERT+SELECT, sem UPDATE/DELETE — nem um futuro admin vai poder reescrever histórico).

**Fase 2.7 — Dependências FS/SS/FF/SF.** 5 commits. `Task.predecessorRowNumbers` (FK por número de linha, coluna array) virou `Task.dependencies` (FK por `id`, tabela `dependencias` própria, tipo+folga por linha) — número de linha continua sendo só como o usuário escolhe/vê a predecessora, traduzido na borda UI↔dado persistido (`useProjects.ts`). `isBlocked` ficou **ciente do tipo**: pela própria tabela de regras da spec, só FS e SS restringem o *início* da sucessora, então só eles bloqueiam — usando a data REAL da predecessora (`actualEnd`/`actualStart`) + folga contada a partir dela; FF/SF nunca bloqueiam (bloqueio ali seria falso positivo), só entram em `hasDependencyViolation` (campo novo, checagem sobre PREVISTO, pros 4 tipos, sinaliza sem bloquear salvar — exatamente a regra "violação não bloqueia" da spec). Trocar a chave de `recomputeProject` de `tasksByRowNumber` (incremental, dependia de predecessora ter número menor) pra `tasksById` (direto, sem ordem) corrigiu um bug latente, não foi só refactor. Editor de linhas (tarefa · tipo · folga · remover) construído já nesta fase, dentro do `TaskPanel.tsx` — não esperado pra Fase 4 (sem ele não dava pra escolher tipo/folga nenhum). RLS da tabela nova (`dependencias`) já saiu certo desta vez — lição da 2.5 aplicada de propósito, checado via `get_advisors` antes de fechar o commit.

## Decisões de modelagem (estão no CLAUDE.md)

1. **Dois papéis:** `gerente_id` no projeto (1), `responsavel_id` na tarefa (1). Equipe é consulta, não campo. Atividade não tem responsável.
2. **Status derivado só em TS, sem espelho SQL** — diferente do padrão da 2.6. Consequência: nenhuma policy RLS da Fase 5 pode filtrar por status, nenhuma query server-side pode ordenar por ele. Dívida documentada: view `v_tasks_status`, sem fase alvo.
3. **Separação `Task` (persistido) x `TaskView` (computado).** O tipo raw não tem status nem campo derivado — assim ninguém consegue fabricar um status falso. Recompute mora só no `useProjects`, nunca no repo.
4. **Coluna com dado real não se apaga:** rename para `_legacy` + `COMMENT ON COLUMN`. Drop fica para a Fase 7.
5. **Ordem de migração:** código para de escrever → commit → **push confirmado** → deploy → dump completo e autônomo → migration. Vercel+Supabase sem staging.
6. **Avanço 100% automático.** Tarefa binária; atividade/projeto = peso concluído ÷ peso total, ponderado por dias úteis.
7. **Linha de base congelada (implementado na Fase 2.5):** seed = previsto na criação da tarefa, motivo obrigatório pra alterar previsto OU base, gravando em `replanejamentos` (cobre os dois campos, não só previsto). Sem gating de admin ainda — vale pra qualquer usuário logado; a Fase 5 restringe.
8. **Dependências (implementado na Fase 2.7):** 4 tipos (FS, SS, FF, SF) com folga em dias úteis, por `id` da tarefa (não número de linha). Violação de previsto sinaliza, não bloqueia. Bloqueio de início (`isBlocked`) só por FS/SS, usando data real. Anti-ciclo + duplicata validados no cliente (`useProjects.ts`), antes de gravar.
9. **Exclusão de atividade com tarefas:** bloqueada por padrão, com ação explícita de administrador + Desfazer de 6s.
10. **"Hoje" em America/Sao_Paulo**, injetável nas funções puras, recalculado em `visibilitychange`/foco. Comparação de atraso estrita (`today > plannedEnd`).

## O que falta

**2.5 e 2.7 concluídas.** Próxima: **Fase 4 (Tela de Cronograma)** — a mais pesada do roteiro, trata como sub-fases. Desenha o que 2.5/2.7 já modelaram mas não desenharam: barra tracejada de linha de base, setas de dependência (com rótulo tipo+folga, tracejada laranja quando violada, contador no rodapé), tooltip completo na barra, data sugerida pela regra com botão "Aplicar" no editor de predecessoras, zoom Dia/Semana/Mês, criação direto no cronograma (`+` no hover da linha).

**Depois:** Fase 5 (permissões com RLS por perfil), Fase 6 (mobile), Fase 7 (validações, QA e drop das colunas `_legacy`).

## Pendências anotadas

- Warning do Supabase: proteção contra senha vazada desligada. Trivial, não urgente com 1 usuário.
- Feriados municipais de Matriz, MEC e Feira ainda não cadastrados.
- Teste de `dias_uteis`/`soma_dias_uteis` depende de usuário de teste autenticado — hoje só `pascoa`/`feriados_nacionais` cobertas.
- Na Fase 7, `responsavel_id` vira obrigatório — precisa de preenchimento em massa nas 55 tarefas.
- Colunas `_legacy` a dropar na Fase 7: `status_legacy` (3 tabelas), 8 colunas de data em `activities`/`projects`, `progress_legacy`, `predecessor_row_numbers_legacy` (tasks).
- Rótulo "sem tarefas" quando atividade não tem tarefa — decisão de exibição adiada.
- Tooltip "2/5 tarefas · 22/114du" no Gantt — Fase 4, usando `taskWeight` exportada.
- Setas de dependência + data sugerida com botão "Aplicar" no editor de predecessoras — ficaram pra Fase 4 de propósito (2.7 entregou só o editor de linhas tipo/folga).

## Como trabalhamos

No Claude Code: **modo Plan (Shift+Tab) antes de cada fase nova**, aprovar o plano, e ele executa em "Edit automatically". Permissões em `.claude/settings.local.json`.

**Aprovo direto:** `select`, `git status/diff/log`, `tsc`, `build`, `npm test`, escrita em `src/`, migration que só cria coisa.

**Paro e confiro:** `drop column`, `delete` sem WHERE específico, `update` em massa, `git push`, qualquer coisa em `.env`.

**Em fase visual:** checkpoint a cada commit — ele para, eu rodo `npm run dev` e confiro na tela antes de liberar o próximo. Não encadeia commits de UI automaticamente.

O que eu quero de você: revisar os planos com olho crítico de modelagem e design, apontar o que está errado ou faltando, e me dar o texto pronto pra comentar no plano. Nada de commit sem push — eu reviso antes.

### O que a revisão tem pego com mais frequência

Vale pedir isso explicitamente em todo plano novo:

- **Regra escrita em prosa** ("atrasado > concluído > andamento") em vez de quantificador explícito (ALGUMA/TODAS) — foi o bug mais grave pego na 2.3.
- **Teste descrito por adjetivo** ("percentual bem menor", "o feriado é descontado") em vez de número literal travado. Sempre exigir o valor exato.
- **Suposição não medida** — "essa coluna sempre foi nula" precisa de `count(*)` antes de qualquer `drop`. Já mudou a decisão duas vezes.
- **Ordem migration x deploy** — quem para de escrever primeiro quebra produção se a coluna for `NOT NULL` sem default.
- **Convenção de intervalo** (inclusivo x meio-aberto) em qualquer cálculo de dias — origem de off-by-one silencioso.
- **Atributos de coluna** (`is_nullable`, `column_default`) não aparecem numa checagem de índices/constraints/triggers. Conferir à parte.
- **`apply_migration` não liga RLS sozinho em tabela nova** — `get_advisors(type: security)` depois de toda migração que cria tabela é o que pega isso (pegou na 2.5; aplicado de propósito já na criação da 2.7). Tabela de auditoria (`replanejamentos`) precisa de policy só INSERT+SELECT, sem UPDATE/DELETE — diferente de tabela de config editável (`dependencias`), que usa a policy `ALL` igual às demais.
