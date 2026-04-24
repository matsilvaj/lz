export const CREATE_BOOKMAKERS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS Casas_de_Apostas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE
  )
`;

export const CREATE_PROCEDURES_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS Procedimentos_Historico (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data_operacao DATE NOT NULL,
    tipo_procedimento TEXT NOT NULL,
    casas_envolvidas TEXT,
    jogo_time_pa TEXT,
    lucro_final REAL NOT NULL,
    bateu_duplo BOOLEAN,
    condicao_freebet TEXT,
    valor_freebet_coletada REAL,
    observacao TEXT,
    mes_referencia TEXT NOT NULL
  )
`;

export const PROCEDURES_TABLE_MIGRATIONS = [
  {
    column: "casa_destino_freebet",
    sql: "ALTER TABLE Procedimentos_Historico ADD COLUMN casa_destino_freebet TEXT",
  },
  {
    column: "status_freebet",
    sql: "ALTER TABLE Procedimentos_Historico ADD COLUMN status_freebet TEXT DEFAULT 'Pendente'",
  },
  {
    column: "id_freebet_origem",
    sql: "ALTER TABLE Procedimentos_Historico ADD COLUMN id_freebet_origem INTEGER",
  },
  {
    column: "valor_da_freebet",
    sql: "ALTER TABLE Procedimentos_Historico ADD COLUMN valor_da_freebet REAL DEFAULT 0.0",
  },
  {
    column: "ganhou_freebet",
    sql: "ALTER TABLE Procedimentos_Historico ADD COLUMN ganhou_freebet TEXT DEFAULT ''",
  },
];

export const BOOKMAKERS_TABLE_MIGRATIONS = [
  {
    column: "saldo",
    sql: "ALTER TABLE Casas_de_Apostas ADD COLUMN saldo REAL DEFAULT 0.0",
  },
];
