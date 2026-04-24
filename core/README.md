# Core reutilizavel em JS

O projeto agora esta separado em duas camadas para escalar melhor no Next:

- `core/domain/`: regra de negocio pura, sem banco e sem dependencias de ambiente
- `core/server/`: infraestrutura server-side, como SQLite e repositorios
- `core/index.js`: entrada segura para importar so o dominio
- `lib/server/`: ponto oficial de acesso ao repositorio dentro do app Next

## Como usar cada camada

- UI e componentes podem reaproveitar regra pura por `@/core`
- Pages, Server Components, Server Actions e Route Handlers devem acessar o banco por `@/lib/server`
- Evite importar `@/core/server` direto na UI; essa camada e marcada como server-only

## Estrutura atual

- `domain/calculadora/`: regras da surebet e media ponderada
- `domain/procedimentos/`: montagem, filtros e enriquecimento dos procedimentos
- `domain/freebets/`: agrupamento de freebets ativas e historico das convertidas
- `domain/shared/`: constantes e funcoes utilitarias
- `server/database/`: schema, adaptador SQLite e repositorio

## Exemplo de dominio

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
  const procedures = repository.listProcedures();

  return <pre>{JSON.stringify(procedures, null, 2)}</pre>;
}
```

## Dependencia de banco

Para usar o adaptador pronto com SQLite, instale:

```bash
npm install better-sqlite3
```

Se essa dependencia ainda nao estiver instalada, o factory do banco vai falhar com uma mensagem explicando o que falta.
