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
- **Status continua em 4 valores** (`planejado`, `andamento`, `atrasado`, `concluido`). `blocked` (bloqueado por predecessora) e `completed_late` (concluído com atraso) não desaparecem da experiência — viram **condições derivadas exibidas como ícone/selo ao lado do status**, não um 5º/6º valor do status em si. O estado "à iniciar" do protótipo (token `--inic`) é ignorado — não faz parte do modelo novo.
- **Exclusão de atividade com tarefas**: bloqueada por padrão (resolve a divergência apontada na auditoria — `useProjects.removeActivity()` hoje cascateia). Administrador tem ação explícita "excluir atividade e suas N tarefas", com **Desfazer de 6s** depois de executar (mesmo padrão de exclusão sem confirmação prévia da Fase 3).
- **Toda migração de schema é precedida de um dump do banco**; o caminho onde o dump foi salvo é sempre informado ao usuário antes de aplicar a migração.

## Permissões

Configuradas em `.claude/settings.local.json` (local, fora do git) para não precisar aprovar comando por comando. Regras:

- **Liberado sem perguntar**: comandos só de leitura/verificação — `git status`, `git diff`, `git log`, `ls`, `cat` — e os comandos de checagem — `npx tsc --noEmit`, `npm run build`, `npm run lint`.
- **Escrita liberada** (criar/editar arquivo) em `src/**`, `referencia/**`, `CLAUDE.md` e `design.md`.
- **Sempre pergunta antes** (nunca liberar por padrão, mesmo que uma regra futura tente cobrir): `git push`, `git reset --hard`, `git checkout` que descarte alterações (`git checkout -- <arquivo>`, `git checkout .`), qualquer `rm`, qualquer migration ou SQL direto no Supabase (`apply_migration`, `execute_sql`), e escrita em `.env*`, `package.json`, `vercel.json` e `supabase/**`.

Se alguma dessas regras precisar mudar, atualizar `.claude/settings.local.json` e esta seção juntos.
