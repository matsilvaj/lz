// Tipos de procedimento usados nos filtros (procedimentos e histórico).

import { CASINO_PROCEDURE_TYPES, PROCEDURE_TYPES } from "@/core";

const PROCEDURE_TYPE_LABELS: Record<string, string> = {
  "Tentativa de Duplo": "Tentativa de DG",
  "Coletar Freebet": "Freebet",
  "Converter Freebet": "Freebet",
};
const FREEBET_FILTER_TYPES = ["Coletar Freebet", "Converter Freebet"];
const PROCEDURE_TYPE_FILTER_OPTIONS = PROCEDURE_TYPES.reduce<
  Array<{ key: string; label: string; values: string[] }>
>((options, type) => {
  if (FREEBET_FILTER_TYPES.includes(type)) {
    if (!options.some((option) => option.key === "freebet")) {
      options.push({
        key: "freebet",
        label: "Freebet",
        values: FREEBET_FILTER_TYPES,
      });
    }

    return options;
  }

  if (type === "Cassino") {
    options.push({
      key: "casino",
      label: "Cassino",
      values: [...CASINO_PROCEDURE_TYPES],
    });
    return options;
  }

  options.push({
    key: type,
    label: PROCEDURE_TYPE_LABELS[type] ?? type,
    values: [type],
  });

  return options;
}, []);

export { PROCEDURE_TYPE_FILTER_OPTIONS, PROCEDURE_TYPE_LABELS };

export function getProcedureTypeLabel(type: string) {
  return PROCEDURE_TYPE_LABELS[type] ?? type;
}
