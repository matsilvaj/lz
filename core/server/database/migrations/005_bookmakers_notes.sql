CREATE TABLE IF NOT EXISTS usuarios_observacoes_bancas (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  texto TEXT NOT NULL DEFAULT ''
);
