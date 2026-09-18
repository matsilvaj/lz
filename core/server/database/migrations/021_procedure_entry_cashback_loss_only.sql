-- Regime do cashback por entrada. FALSE, o padrao, marca a promocao paga em
-- qualquer resultado: o credito vale em todos os cenarios. TRUE marca a
-- promocao que a casa so paga quando aquela aposta perde, e nesse caso o
-- cashback fica fora da divisao dos stakes e conta apenas nos cenarios das
-- outras casas.
ALTER TABLE IF EXISTS procedimentos_entradas
  ADD COLUMN IF NOT EXISTS cashback_apenas_perda BOOLEAN NOT NULL DEFAULT FALSE;
