export const CONVERTER_SELECTED_STORAGE_KEY = "lz:monitor-converter-freebet:selected";
export const CONVERTER_VIEW_STATE_STORAGE_KEY = "lz:monitor-converter-freebet:view";

export function isConverterFlowLocation(pathname: string, search: string) {
  if (pathname.startsWith("/monitor/converter-freebet")) {
    return true;
  }

  return (
    pathname.startsWith("/monitor/odds/") &&
    new URLSearchParams(search).get("mode") === "convert-freebet"
  );
}

export function clearConverterViewState() {
  try {
    window.sessionStorage.removeItem(CONVERTER_VIEW_STATE_STORAGE_KEY);
    window.sessionStorage.removeItem(CONVERTER_SELECTED_STORAGE_KEY);
  } catch {
    // Armazenamento indisponível: nada a limpar.
  }
}
