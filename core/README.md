# Core reutilizável em JS

O projeto agora está separado em duas camadas para escalar melhor no Next:

- `core/domain/`: regra de negócio pura, sem banco e sem dependências de ambiente
- `core/server/`: infraestrutura server-side, como PostgreSQL e repositórios
- `core/index.js`: entrada segura para importar só o domínio
- `lib/server/`: ponto oficial de acesso ao repositório dentro do app Next

## Como usar cada camada

- UI e componentes podem reaproveitar regra pura por `@/core`
- Pages, Server Components, Server Actions e Route Handlers devem acessar o banco por `@/lib/server`
- Evite importar `@/core/server` direto na UI; essa camada é marcada como server-only

## Estrutura atual

- `domain/calculadora/`: regras da surebet e média ponderada
- `domain/procedimentos/`: montagem, filtros e enriquecimento dos procedimentos
- `domain/freebets/`: agrupamento de freebets ativas e histórico das convertidas
- `domain/shared/`: constantes e funções utilitárias
- `server/database/`: pool PostgreSQL, repositório e migrações SQL

## Exemplo de domínio

```js
import { buildProcedureData, calculateSurebet } from "@/core";

const result = calculateSurebet([
  { odd: 2.1, stake: 100, tipo: "B" },
  { odd: 2.05, stake: 0, tipo: "B" },
]);

const procedure = buildProcedureData({
  procedureType: "SureBet",
  entryValue: result.lucro_liquido,
});
```

## Exemplo server-side no Next

```js
import { getProceduresRepository } from "@/lib/server";

export default async function Page() {
  const repository = getProceduresRepository();
  const procedures = await repository.listProcedures();

  return <pre>{JSON.stringify(procedures, null, 2)}</pre>;
}
```

## Dependência de banco

Para usar o adaptador pronto com PostgreSQL, instale:

```bash
npm install pg
```

As tabelas ficam versionadas em `core/server/database/migrations/`.
Para `Vercel + Supabase`, use:

- `DATABASE_URL`: URL de runtime da aplicação, preferencialmente a URL do Connection Pooler em modo Transaction
- `DATABASE_MIGRATION_URL`: URL direta usada para migrações

No deploy, rode `npm run db:migrate` antes de subir a aplicação, com `DATABASE_MIGRATION_URL` definida.
