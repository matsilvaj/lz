# LZ Community

Aplicação web em Next.js para centralizar a operação da LZ Community: dashboard, monitoramento de odds, duplos, conversão de freebets, procedimentos, bancas, calculadora e histórico.

## Estado atual

Status do projeto em 04/06/2026:

- Branch de atualizações: `updates`.
- Branch de produção: `master`.
- Vercel configurada para usar `master` como branch de produção.
- Preview deployments devem sair da branch `updates`.
- Build de produção validado localmente com `npm run build`.
- Lint validado com `npm run lint`.
- Testes automatizados validados com `npm test`.

O fluxo recomendado é desenvolver e testar em `updates`, abrir PR para `master` quando estiver estável e deixar a Vercel publicar produção a partir da `master`.

## Visão Geral

O projeto usa Next.js 16 com App Router, React 19, TypeScript, Tailwind CSS 4, Supabase Auth, PostgreSQL e, em produção, Upstash Redis para rate limit distribuído.

Funcionalidades principais:

- autenticação com Supabase;
- workspaces por usuário;
- dashboard com métricas por período;
- registro, consulta e finalização de procedimentos;
- histórico com detalhes de procedimentos;
- controle de bancas e saldos;
- fila de freebets com coleta, conversão e histórico;
- monitor de odds por evento;
- monitor de duplos com filtros, skeleton de carregamento e seleção para calculadora;
- monitor de conversão de freebet com freebets cadastradas ou consulta manual;
- calculadora integrada com odds selecionadas, payload por URL e fluxo específico de conversão de freebet;
- filtros por casas, PA, Sem PA e classes de oportunidade onde aplicável;
- migrações SQL versionadas em `core/server/database/migrations`;
- headers de segurança configurados em `next.config.ts`;
- `proxy.ts` para atualização de sessão, conforme a convenção do Next.js 16.

## Requisitos

- Node.js 20.9 ou superior;
- npm;
- projeto Supabase com Auth e banco PostgreSQL;
- Upstash Redis para produção, caso queira rate limit compartilhado entre instâncias.

## Configuração Local

Instale as dependências:

```bash
npm install
```

Crie um arquivo `.env.local` ou ajuste o `.env` local com as principais variáveis do projeto:

```env
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
DATABASE_MIGRATION_URL=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Observações:

- `DATABASE_URL` é usada em runtime. Em produção serverless com Supabase, prefira a URL do Connection Pooler em modo Transaction, na porta `6543`.
- `DATABASE_MIGRATION_URL` é usada para aplicar migrações. Mantenha aqui a conexão direta quando precisar executar alterações de schema.
- `SUPABASE_SERVICE_ROLE_KEY` só deve existir em ambientes seguros do servidor.
- As variáveis da Upstash são opcionais localmente; sem elas, o rate limit usa memória local.

Rode as migrações:

```bash
npm run db:migrate
```

Inicie o servidor de desenvolvimento:

```bash
npm run dev
```

A aplicação ficará disponível em `http://localhost:3000`.

## Scripts Úteis

```bash
npm run dev
npm run db:migrate
npm run check:prod
npm run lint
npm run build
npm run test
npm run start
```

- `dev`: inicia o servidor local do Next.js.
- `db:migrate`: aplica migrações PostgreSQL ainda não executadas.
- `check:prod`: valida variáveis e pontos básicos antes de publicar.
- `lint`: executa ESLint. No Next.js 16, o build não roda o lint automaticamente.
- `build`: gera a versão de produção.
- `test`: executa os testes automatizados em `tests/`.
- `start`: inicia a aplicação já compilada.

## Estrutura

```txt
app/       Rotas, layouts, páginas e componentes do App Router.
core/      Regras de domínio, adaptadores server-side e migrações.
lib/       Integrações de autenticação, Supabase, segurança e acesso a dados.
public/    Arquivos estáticos.
scripts/   Scripts operacionais, como migração e checagem de produção.
tests/     Testes automatizados do domínio e integrações principais.
```

Dentro de `app/(app)`, ficam as telas protegidas após login. A rota pública `app/calculadora` mantém a calculadora acessível fora do layout protegido e usa `Suspense` para manter o build da Vercel compatível com os parâmetros de URL usados pela integração.

## Fluxo de Branches

O repositório deve manter apenas duas branches principais no remoto:

- `updates`: desenvolvimento, ajustes e preview na Vercel.
- `master`: produção.

Fluxo sugerido:

```bash
git checkout updates
git pull

# desenvolver e validar
npm run lint
npm run build
npm test

# abrir PR de updates para master quando estiver pronto
```

Depois do merge em `master`, a Vercel deve gerar o deploy de produção.

## Produção

Antes de publicar:

```bash
npm run check:prod
npm run lint
npm run build
npm test
```

Também confirme:

- variáveis de ambiente configuradas na Vercel;
- `NEXT_PUBLIC_APP_URL` apontando para a URL HTTPS pública;
- `master` configurada como Production Branch na Vercel;
- Supabase Auth com confirmação de e-mail, política de senha e limites adequados;
- usuário de banco com menor privilégio para `DATABASE_URL`;
- `DATABASE_MIGRATION_URL` separada para migrações;
- Redis configurado para rate limit distribuído;
- headers de segurança ativos no domínio final.

## Notas para Manutenção

- Consulte `AGENTS.md` antes de alterar código de Next.js. Este projeto usa Next.js 16, que traz mudanças de convenção, incluindo `proxy.ts` no lugar de Middleware.
- Consulte `core/README.md` para detalhes da camada reutilizável de domínio e infraestrutura.
- Não versionar arquivos `.env*` com segredos.
- Mudanças na calculadora devem preservar os fluxos por URL usados pelo monitor de odds, monitor de duplos e conversão de freebet.
- Antes de enviar para `master`, rode pelo menos `npm run lint`, `npm run build` e `npm test`.
