# LZ Community

Aplicação web em Next.js para centralizar a gestão da LZ Community: dashboard, procedimentos, freebets, bancas, calculadora, histórico e áreas em preparação para monitoramento de odds.

## Visão geral

O projeto usa Next.js 16 com App Router, React 19, TypeScript, Tailwind CSS 4, Supabase Auth, PostgreSQL e, em produção, Upstash Redis para rate limit distribuído.

Pontos principais:

- autenticação com Supabase;
- workspaces por usuário;
- registro e consulta de procedimentos;
- controle de bancas e freebets;
- calculadora para apoio às entradas;
- migrações SQL versionadas em `core/server/database/migrations`;
- headers de segurança configurados em `next.config.ts`;
- `proxy.ts` para atualização de sessão, conforme a convenção do Next.js 16.

## Requisitos

- Node.js 20.9 ou superior;
- npm;
- projeto Supabase com Auth e banco PostgreSQL;
- Upstash Redis para produção, caso queira rate limit compartilhado entre instâncias.

## Configuração local

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

## Scripts úteis

```bash
npm run dev
npm run db:migrate
npm run check:prod
npm run lint
npm run build
npm run start
```

- `dev`: inicia o servidor local do Next.js.
- `db:migrate`: aplica migrações PostgreSQL ainda não executadas.
- `check:prod`: valida variáveis e pontos básicos antes de publicar.
- `lint`: executa ESLint. No Next.js 16, o build não roda o lint automaticamente.
- `build`: gera a versão de produção.
- `start`: inicia a aplicação já compilada.

## Estrutura

```txt
app/       Rotas, layouts, páginas e componentes do App Router.
core/      Regras de domínio, adaptadores server-side e migrações.
lib/       Integrações de autenticação, Supabase, segurança e acesso a dados.
public/    Arquivos estáticos.
scripts/   Scripts operacionais, como migração e checagem de produção.
```

Dentro de `app/(app)`, ficam as telas protegidas após login. A raiz `app/page.tsx` concentra a página pública de entrada, com links para login e cadastro.

## Produção

Antes de publicar:

```bash
npm run check:prod
npm run lint
npm run build
```

Também confirme:

- variáveis de ambiente configuradas na Vercel;
- `NEXT_PUBLIC_APP_URL` apontando para a URL HTTPS pública;
- Supabase Auth com confirmação de e-mail, política de senha e limites adequados;
- usuário de banco com menor privilégio para `DATABASE_URL`;
- `DATABASE_MIGRATION_URL` separada para migrações;
- Redis configurado para rate limit distribuído;
- headers de segurança ativos no domínio final.

## Notas para manutenção

- Consulte `AGENTS.md` antes de alterar código de Next.js. Este projeto usa Next.js 16, que traz mudanças de convenção, incluindo `proxy.ts` no lugar de Middleware.
- Consulte `core/README.md` para detalhes da camada reutilizável de domínio e infraestrutura.
- Não versionar arquivos `.env*` com segredos.
