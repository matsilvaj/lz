# LZ Community

Aplicação web full-stack desenvolvida para centralizar a operação da LZ Community — uma comunidade voltada a estratégias de apostas esportivas (surebets, duplos e freebets). O sistema engloba desde o registro de operações e controle financeiro até monitores em tempo real de odds e uma calculadora de surebets integrada.

---

## Sumário

- [Visão Geral](#visão-geral)
- [Stack Técnica](#stack-técnica)
- [Funcionalidades](#funcionalidades)
- [Arquitetura](#arquitetura)
- [Requisitos](#requisitos)
- [Configuração Local](#configuração-local)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Scripts](#scripts)
- [Estrutura de Pastas](#estrutura-de-pastas)
- [Fluxo de Branches](#fluxo-de-branches)
- [Produção](#produção)
- [Notas de Manutenção](#notas-de-manutenção)

---

## Visão Geral

O projeto é uma plataforma SaaS multi-tenant com autenticação, workspaces por usuário, registro de procedimentos operacionais, controle de bancas e freebets, monitores de odds em tempo real e uma calculadora de surebets acessível também sem login. Toda a interface foi construída com foco em responsividade e usabilidade em mobile e desktop.

---

## Stack Técnica

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router, Server Components, Server Actions) |
| Linguagem | TypeScript |
| UI | React 19, Tailwind CSS 4, Recharts |
| Autenticação | Supabase Auth |
| Banco de dados | PostgreSQL (via Supabase + pool direto com `pg`) |
| ORM / Acesso | Repositório próprio em JS puro (sem ORM) |
| Rate Limit | Upstash Redis (produção) / memória local (desenvolvimento) |
| Deploy | Vercel |
| Testes | Node.js Test Runner nativo (`node --test`) |
| Linting | ESLint 9 com `eslint-config-next` |

---

## Funcionalidades

### Autenticação e Conta

- **Login e cadastro** com e-mail e senha via Supabase Auth.
- **Recuperação de senha** com fluxo completo: envio de e-mail, link de redefinição e atualização segura da senha.
- **Perfil do usuário**: alteração de nome, e-mail (com confirmação por e-mail) e senha.
- **Exclusão de conta**: remove a conta e todos os dados vinculados com confirmação via dialog.
- **Sessão persistente** gerenciada pelo `middleware.ts` com refresh automático via Supabase SSR.

### Workspaces

- Cada usuário pode ter múltiplos workspaces isolados (ex.: operações pessoais separadas por contexto).
- O workspace ativo é mantido no contexto da sessão e pode ser trocado pelo seletor no menu de navegação.
- Todos os dados de procedimentos, bancas e freebets são escopados por workspace e por usuário.

### Dashboard

- Visão consolidada das métricas operacionais com seletor de período flexível:
  - Dia atual, últimos 7 dias, mês a mês, por ano, período anual completo e intervalo personalizado (data início / fim).
- **Cards de métricas**: lucro diário, lucro no período, média diária/mensal, dias com operação, procedimentos pendentes (quantidade e valor em aberto) e freebets em aberto (prontas e aguardando, com valor total).
- **Gráficos interativos** (carregados com `dynamic` para evitar SSR):
  - Evolução mensal ou anual (linha).
  - Lucro por dia ou mês (barras verticais).
  - Volume por dia ou mês (barras verticais).
  - Métricas de freebets: quantidade coletada por dia e lucro de conversões por dia.
- Filtro de procedimentos por tipo aplicável aos gráficos de lucro e volume.

### Procedimentos

- **Registro de operações** com modal dedicado: tipo de procedimento, evento, casas envolvidas, entradas (odd, stake, tipo back/lay, comissão, cashback, aumento percentual, flag de freebet), data de operação e observação.
- **Tipos suportados**: Surebet, Tentativa de Duplo, Coletar Freebet, Converter Freebet, Cassino e variantes.
- **Listagem paginada** com layout em tabela (desktop) e cards (mobile).
- **Filtros combinados**: busca por texto livre (evento, tipo, casa), tipo de procedimento, status, casas envolvidas (seletor com busca) e intervalo de datas.
- **Status rápido**: botões de filtro direto por status na barra principal.
- **Compartilhamento de procedimento**: um procedimento pode ser compartilhado via URL codificada em base64; ao abrir o link, o modal abre pré-preenchido com os valores compartilhados.
- **Edição e ações por linha**: menu de ações acessível por clique no ícone ou menu de contexto (botão direito), com opções de editar, finalizar e excluir.
- Procedimentos de freebet exibem as datas de coleta e conversão separadamente.

### Histórico

- Tela de histórico de procedimentos finalizados com filtros e visualização de detalhes por entrada.

### Bancas

- Gerenciamento de casas de apostas (bookmakers) vinculadas ao workspace.
- Registro e acompanhamento de saldo por banca.
- Notas livres por banca para registro de observações operacionais.
- Listagem das bancas ativas com totais e ações de edição.

### Freebets

- **Fila de coleta**: lista as freebets ativas aguardando coleta, com valor, casa de destino e condição.
- **Conversão**: integração com o monitor de conversão de freebet e com a calculadora para calcular a entrada de conversão ideal.
- **Histórico de freebets**: registro de freebets coletadas e convertidas, com agrupamento por lote de conversão quando aplicável.

### Monitor de Odds

- Monitor ao vivo com atualização via SSE (Server-Sent Events) consumindo a API interna `/api/monitor-odds`.
- Exibe eventos disponíveis com suas odds em tempo real.
- Filtragem por casas e por classificação de oportunidade (PA, Sem PA etc.).
- **Navegação por fixture**: ao selecionar um evento, a rota `/monitor/odds/[fixtureId]` exibe as odds detalhadas daquele evento.
- Shell com estado de carregamento e reconexão automática em caso de queda do stream.

### Monitor de Duplos

- Lista oportunidades de duplos (tentativas de duplo green) detectadas automaticamente.
- **Filtros**: data (hoje / amanhã / todos), modo (Sem PA, PA um lado, PA dois lados, todos) e casas envolvidas.
- **Ordenação**: por lucro (maior/menor), por data (mais recente/mais antigo) e por proximidade de horário.
- Skeleton de carregamento durante o fetch inicial.
- **Seleção para calculadora**: cada linha do duplo pode ser adicionada à dock de seleção, que persiste a seleção enquanto o usuário navega; ao abrir a calculadora, as linhas selecionadas são injetadas automaticamente via parâmetros de URL.
- Dock de seleção flutuante com contador de linhas e botão para abrir a calculadora.

### Monitor de Conversão de Freebet

- Monitor especializado para identificar oportunidades de conversão de freebets ativas.
- Permite consulta com freebets já cadastradas no sistema ou com entrada manual de valores.
- Integrado à calculadora para preencher automaticamente a linha de freebet.

### Calculadora de Surebets

- Calculadora de surebet e média ponderada, acessível **com e sem login**:
  - Rota pública: `/calculadora` — não exige autenticação, útil para compartilhamento externo.
  - Rota protegida: `/[workspace]/calculadora` — integrada ao contexto do usuário logado, com acesso às bancas cadastradas.
- **Entradas por linha**: casa, odd, stake, tipo (Back/Lay), responsabilidade (lay), aumento percentual, comissão, cashback, flag de freebet (somente lucro).
- **Cálculo em tempo real**: lucro líquido, lucro percentual, stake de cada linha, custo efetivo e duplo calculado.
- **Compartilhamento por URL**: o estado da calculadora é codificado nos parâmetros de URL, permitindo compartilhar a configuração exata de um cálculo.
- **Integração com monitores**: o monitor de duplos e o monitor de conversão de freebet injetam linhas diretamente na calculadora via URL.
- **Criação de procedimento**: botão direto para registrar o procedimento a partir do resultado calculado, com o modal pré-preenchido.
- Autocomplete de casas a partir das bancas cadastradas.

### Perfil e Configurações

- Atualização de nome (primeiro e último nome).
- Alteração de e-mail com confirmação obrigatória por e-mail.
- Alteração de senha com verificação da senha atual.
- Encerramento de sessão.
- Exclusão de conta com confirmação por dialog (remove todos os dados vinculados).

---

## Arquitetura

O projeto é dividido em três camadas principais:

```
app/        Rotas, layouts, páginas e componentes (Next.js App Router)
core/       Domínio de negócio puro (sem banco, sem Next) e infraestrutura server-side
lib/        Integrações: Supabase, autenticação, monitor de odds, segurança, acesso a dados
```

### `core/` — Domínio reutilizável em JS puro

- `core/domain/calculadora/`: lógica de surebet e média ponderada.
- `core/domain/procedimentos/`: montagem, filtros e enriquecimento de procedimentos.
- `core/domain/freebets/`: agrupamento de freebets ativas e histórico de convertidas.
- `core/domain/shared/`: constantes e utilitários compartilhados.
- `core/server/database/`: pool PostgreSQL (`pg`), repositório e migrações SQL versionadas.

A separação entre `core/domain` (puro) e `core/server` (server-only) permite que componentes de UI importem regras de negócio sem arriscar vazar código de banco de dados para o cliente.

### `lib/` — Integrações no contexto Next.js

- `lib/supabase/`: cliente, servidor, admin e proxy de sessão.
- `lib/auth/`: sessão, redirecionamentos, recuperação de senha e contexto de workspace.
- `lib/monitor-odds/`: lógica de consumo, cache compartilhado e formatação dos dados de odds.
- `lib/security/`: headers CSP, validação de inputs e rate limiting.
- `lib/server/`: ponto oficial de acesso ao repositório PostgreSQL a partir do app Next.

### Banco de dados

Migrações SQL versionadas em `core/server/database/migrations/`. Cada arquivo é numerado sequencialmente e aplicado uma única vez pelo script `db:migrate`. O schema é multi-tenant com isolamento por usuário em todas as tabelas principais.

### Autenticação e sessão

O `middleware.ts` intercepta todas as requisições (exceto assets estáticos) e delega para `lib/supabase/proxy.ts`, que renova o token de sessão do Supabase quando necessário. Rotas protegidas verificam a sessão diretamente com `requireUser()` em Server Components e Server Actions.

### Rate limiting

Em produção, usa Upstash Redis para rate limit distribuído entre instâncias da Vercel. Em desenvolvimento, usa um Map em memória local (sem Redis necessário).

---

## Requisitos

- Node.js 20.9 ou superior
- npm
- Projeto Supabase com Auth habilitado e banco PostgreSQL
- Upstash Redis (opcional em desenvolvimento, recomendado em produção)

---

## Configuração Local

Instale as dependências:

```bash
npm install
```

Crie um arquivo `.env.local` na raiz do projeto:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
DATABASE_MIGRATION_URL=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Execute as migrações:

```bash
npm run db:migrate
```

Inicie o servidor de desenvolvimento:

```bash
npm run dev
```

A aplicação ficará disponível em `http://localhost:3000`.

---

## Variáveis de Ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Sim | URL pública da aplicação (HTTPS em produção) |
| `NEXT_PUBLIC_SUPABASE_URL` | Sim | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Sim | Chave pública (anon key) do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim (server) | Chave de service role — nunca exposta ao cliente |
| `DATABASE_URL` | Sim | URL de conexão em runtime (preferir Connection Pooler, porta 6543, modo Transaction) |
| `DATABASE_MIGRATION_URL` | Sim | Conexão direta usada para aplicar migrações de schema |
| `UPSTASH_REDIS_REST_URL` | Não (local) | URL REST do Upstash Redis para rate limit distribuído |
| `UPSTASH_REDIS_REST_TOKEN` | Não (local) | Token do Upstash Redis |

> Sem as variáveis do Upstash, o rate limit opera em memória local (adequado para desenvolvimento).

---

## Scripts

```bash
npm run dev          # Servidor de desenvolvimento Next.js
npm run build        # Build de produção
npm run start        # Inicia a build já compilada
npm run lint         # Executa o ESLint (não roda automaticamente no build)
npm run test         # Testes automatizados em tests/
npm run db:migrate   # Aplica migrações PostgreSQL pendentes
npm run check:prod   # Valida variáveis e pontos críticos antes de publicar
```

---

## Estrutura de Pastas

```
app/
├── (app)/              Rotas protegidas (exigem autenticação)
│   ├── dashboard/      Dashboard com métricas e gráficos
│   ├── procedimentos/  Registro, listagem e filtros de procedimentos
│   ├── historico/      Histórico de procedimentos finalizados
│   ├── bancas/         Gerenciamento de bancas e saldos
│   ├── freebets/       Fila e histórico de freebets
│   ├── monitor/        Monitores de odds em tempo real
│   │   ├── odds/       Monitor de odds (com rota por fixture)
│   │   ├── duplo/      Monitor de duplos com dock de seleção
│   │   └── converter-freebet/  Monitor de conversão de freebet
│   ├── calculadora/    Calculadora de surebets (contexto autenticado)
│   ├── workspaces/     Gerenciamento de workspaces
│   └── perfil/         Configurações de conta e perfil
├── calculadora/        Calculadora pública (sem autenticação)
├── auth/               Callbacks e ações de autenticação
├── login/              Página de login
├── cadastro/           Página de cadastro
├── esqueci-a-senha/    Formulário de recuperação de senha
├── redefinir-senha/    Formulário de nova senha
└── api/
    ├── monitor-odds/   SSE e endpoints de odds em tempo real
    └── dashboard/      Endpoint de dados do dashboard por período

core/
├── domain/             Regras de negócio puras (calculadora, procedimentos, freebets)
└── server/database/    Pool PostgreSQL, repositório e migrações SQL

lib/
├── auth/               Sessão, redirecionamentos e contexto de workspace
├── supabase/           Cliente, servidor, admin e proxy de sessão
├── monitor-odds/       Lógica e cache do monitor de odds
├── security/           CSP, validação de inputs e rate limit
└── server/             Repositórios acessíveis pelo app Next

scripts/
├── run-postgres-migrations.mjs   Aplica migrações SQL pendentes
└── check-production-readiness.mjs  Valida variáveis e configurações críticas

tests/                  Testes automatizados (Node.js Test Runner)
```

---

## Fluxo de Branches

O repositório mantém duas branches principais:

- `updates` — desenvolvimento, ajustes e preview deploys na Vercel.
- `master` — produção; a Vercel publica automaticamente a cada merge.

Fluxo recomendado:

```bash
git checkout updates
git pull

# desenvolver e validar localmente
npm run lint
npm run build
npm test

# quando estável, abrir PR de updates → master
```

---

## Produção

Antes de mergear para `master`, execute:

```bash
npm run check:prod
npm run lint
npm run build
npm test
```

Confirme também na Vercel:

- Todas as variáveis de ambiente configuradas, incluindo `NEXT_PUBLIC_APP_URL` com a URL HTTPS pública.
- `master` definida como Production Branch.
- Supabase Auth com confirmação de e-mail habilitada e política de senha configurada.
- `DATABASE_URL` apontando para o Connection Pooler em modo Transaction (porta 6543).
- `DATABASE_MIGRATION_URL` configurada para a conexão direta (usada apenas para migrações).
- Upstash Redis configurado para rate limit distribuído.

---

## Notas de Manutenção

- Consulte `AGENTS.md` antes de alterar qualquer código relacionado ao Next.js. Este projeto usa Next.js 16, que pode ter convenções diferentes do que você conhece. A atualização de sessão do Supabase é feita via `middleware.ts` padrão, que delega para `lib/supabase/proxy.ts`.
- Consulte `core/README.md` para detalhes da camada de domínio e dos exemplos de uso do repositório.
- Nunca versionar arquivos `.env*` com segredos.
- Mudanças na calculadora devem preservar o contrato de parâmetros de URL, pois o monitor de duplos e o monitor de conversão de freebet injetam linhas via esses parâmetros.
- Migrações SQL são irreversíveis em produção — revise com atenção antes de rodar `db:migrate` contra `DATABASE_MIGRATION_URL` de produção.
- Antes de qualquer merge em `master`, rode ao menos `npm run lint`, `npm run build` e `npm test`.
