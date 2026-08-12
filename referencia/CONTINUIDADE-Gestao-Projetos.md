# Onde paramos — refatoração do Gestão de Projetos Industriais

> Cole isto na primeira mensagem de uma conversa nova para retomar sem perder contexto.
> Atualizado em 12/ago/2026.

## O projeto

App interno da Colorvisão/Colormaq para gestão de projetos industriais. Está em produção com dados reais (8 projetos, 14 atividades, 66 tarefas, 2 usuários — 1 administrador real + 1 de teste criado pra validar a Fase 5).

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

**Fase 4 — Tela de Cronograma.** 7 commits de entrega + 1 de fechamento. Sem migração — tudo derivado/desenhado em cima do que 2.5/2.7 já modelaram. Painel esquerdo com colunas somadas de uma lista única (`ganttColumns.ts`, corrige o bug que a spec avisava) e 4 colunas de data separadas (não intervalo único — pedido do usuário no checkpoint). Barras: previsto e real **sempre os dois visíveis** por tarefa (diverge da spec/protótipo, que mesclava numa só), excesso vermelho sólido não hachurado, barra-resumo de atividade/projeto colorida por status. Zoom Dia/Semana/Mês (24/8/3 px/dia) com grade vertical e sombreamento de fim de semana; piso de barra fixo em 6px (12/66 tarefas reais têm 1 dia de duração, sumiriam no zoom mês sem isso); `getUTCDay()` sempre, nunca `getDay()` (mesma pegadinha de fuso da 2.6). Setas de dependência por tipo, ancorando na linha visível mais próxima quando a ponta está recolhida, deduplicadas por (origem/destino/tipo resolvidos), contador de arestas violadas no rodapé. Tooltip completo na barra. Criação direto no cronograma (`+` sempre visível no hover da linha + botão "Novo item" com seletor). Editor de predecessoras virou `<select>` de candidatas seguras (exclui auto-dependência, ciclo e duplicata na mesma tarefa) com data sugerida + "Aplicar". **Marco (losango) fora de escopo** — medido 12/66 tarefas com `plannedStart===plannedEnd`, provando que "marco = duração zero" seria errado; sem campo `isMilestone` no modelo. **Reverteu uma decisão da 2.5**: linha de base deixou de ser editável na UI (só previsto replaneja) — pedido explícito do usuário, a âncora do indicador de atraso não devia ter sido editável desde o início; infraestrutura de banco (`replanejamentos.campo='base'`) não mudou, só ficou sem UI que a acione. Bug real pego no meio da fase: cabeçalho/linha-de-hoje reservavam 40px de um prefixo de texto que as barras já tinham parado de usar desde o Commit 2 — corrigido no Commit 3.

**Fase 5 — Permissões (RLS por perfil).** 4 commits de entrega + 1 de fechamento. Dois perfis (`perfis.papel ∈ {'usuario','administrador'}`, tabela própria — não coluna em `pessoas`, não JWT claim, escolhida entre 3 opções com o usuário) com RLS de verdade, não só esconder botão. **Achado que mudou tudo**: `saveProjectTree()` é o único caminho de gravação do app — toda mudança reescreve o projeto inteiro (atividades + delete/reinsert de dependências), então travar `activities`/`dependencias` no banco sem separar um caminho de escrita pro usuário comum quebraria a única ação que a spec libera pra ele ("informar real"). Resolvido com dois caminhos isolados: `updateTaskActual` (update de 1 coluna) e a RPC `replanejar_tarefa()` (tarefa + log de replanejamento na MESMA transação — antes eram duas chamadas independentes, não atômicas; o mesmo gap existia também na tela de Projetos, corrigido junto). Trigger de proteção de coluna em `tasks` por DIFERENÇA (`to_jsonb` menos `actual_start`/`actual_end`), não por lista de nomes — protege coluna futura por padrão. `replanejamentos.INSERT` também virou admin-only (fecha uma falsificação que a RPC atômica sozinha não fechava). UI trava com `LockBadge` + `disabled`, tratando `isAdmin === undefined` (carregando) como travado, nunca liberado por engano. **Reafirma a decisão da Fase 4**: base continua travada pra todos, inclusive administrador — não reabriu. Migration restritiva (a arriscada) testada em duas camadas antes de confiar nela: SQL simulando cada papel (`set local role`/`request.jwt.claims`, sempre dentro de `begin/rollback`) e depois navegador de verdade com um segundo usuário criado só pra isso — só depois disso confirmado que a conta real continuou com acesso total. Script de reversão salvo em `supabase/backups/` antes de aplicar.

## Decisões de modelagem (estão no CLAUDE.md)

1. **Dois papéis:** `gerente_id` no projeto (1), `responsavel_id` na tarefa (1). Equipe é consulta, não campo. Atividade não tem responsável.
2. **Status derivado só em TS, sem espelho SQL** — diferente do padrão da 2.6. Consequência: nenhuma policy RLS pode filtrar por status, nenhuma query server-side pode ordenar por ele — a Fase 5 confirmou isso na prática (nenhuma das policies novas precisou filtrar por status). Dívida ainda registrada, sem fase alvo: view `v_tasks_status`, se algum dia precisar.
3. **Separação `Task` (persistido) x `TaskView` (computado).** O tipo raw não tem status nem campo derivado — assim ninguém consegue fabricar um status falso. Recompute mora só no `useProjects`, nunca no repo.
4. **Coluna com dado real não se apaga:** rename para `_legacy` + `COMMENT ON COLUMN`. Drop fica para a Fase 7.
5. **Ordem de migração:** código para de escrever → commit → **push confirmado** → deploy → dump completo e autônomo → migration. Vercel+Supabase sem staging.
6. **Avanço 100% automático.** Tarefa binária; atividade/projeto = peso concluído ÷ peso total, ponderado por dias úteis.
7. **Linha de base congelada (implementado na Fase 2.5, revisado na 4 e na 5):** seed = previsto na criação da tarefa. Base **não é editável por ninguém** desde a Fase 4 (reversão do "com motivo" original, pedido do usuário) — a Fase 5 reafirmou isso, não reabriu. Só previsto replaneja, com motivo obrigatório, gravando em `replanejamentos`; desde a Fase 5, só administrador pode replanejar (RLS de verdade, não só UI) e a escrita é atômica (RPC `replanejar_tarefa()`, tarefa + log na mesma transação).
8. **Dependências (implementado na Fase 2.7):** 4 tipos (FS, SS, FF, SF) com folga em dias úteis, por `id` da tarefa (não número de linha). Violação de previsto sinaliza, não bloqueia. Bloqueio de início (`isBlocked`) só por FS/SS, usando data real. Anti-ciclo + duplicata validados no cliente (`useProjects.ts`), antes de gravar.
9. **Exclusão de atividade com tarefas:** bloqueada por padrão, com ação explícita de administrador + Desfazer de 6s.
10. **"Hoje" em America/Sao_Paulo**, injetável nas funções puras, recalculado em `visibilitychange`/foco. Comparação de atraso estrita (`today > plannedEnd`).
11. **Permissões (implementado na Fase 5):** dois perfis, tabela `perfis` própria (`user_id`→`auth.users`, `papel`). RLS de verdade: usuário comum só informa `actual_start`/`actual_end`; todo o resto (criar/editar/excluir atividade/tarefa/projeto, previsto, dependências) é admin-only, aplicado tanto na UI (cadeado) quanto no banco (trigger de coluna em `tasks` + policies). Gerenciar quem é administrador é manual, via SQL Editor — sem tela no app ainda.

## O que falta

**Fase 5 concluída.** Próxima: **Fase 6 (Mobile)** — referência `referencia/Gestao-Projetos-Mobile.html`, tabela vira card (`ProjectCard.tsx`, reservado desde a Fase 3 sem uso, é pra reusar aqui), painel lateral vira bottom sheet, 4 abas (Resumo/Projetos/Cronograma/Equipe), mini-gantt sobrevive em 22px.

**Depois:** Fase 7 (validações, QA e drop das colunas `_legacy`).

## Pendências anotadas

- Warning do Supabase: proteção contra senha vazada desligada. Trivial, não urgente.
- Feriados municipais de Matriz, MEC e Feira ainda não cadastrados.
- Teste de `dias_uteis`/`soma_dias_uteis` depende de usuário de teste autenticado — hoje só `pascoa`/`feriados_nacionais` cobertas.
- Na Fase 7, `responsavel_id` vira obrigatório — precisa de preenchimento em massa nas tarefas.
- Colunas `_legacy` a dropar na Fase 7: `status_legacy` (3 tabelas), 8 colunas de data em `activities`/`projects`, `progress_legacy`, `predecessor_row_numbers_legacy` (tasks).
- Rótulo "sem tarefas" quando atividade não tem tarefa — decisão de exibição adiada.
- Marco (losango) no Gantt: fora de escopo da Fase 4, precisa de campo `isMilestone` novo + decisão de produto (medido: 12/66 tarefas reais têm duração de 1 dia, então "duração zero" não seria a regra certa de inferência).
- Gerenciar papel (`perfis.papel`) é manual via SQL Editor — sem tela no app. Se a lista de usuários crescer, vale uma tela simples de administração (fora de escopo da Fase 5, não pedida).
- Usuário de teste da Fase 5 (`dorival.junior@colormaq.com.br`) continua no banco, sem `perfis` — decidir se apaga ou promove quando alguém de verdade precisar desse acesso.

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
