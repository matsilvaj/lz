"use client";

import { useEffect, useState, type ReactNode } from "react";

import AppLoading from "../loading";

const WORKSPACE_PAGE_LOADING_EVENT = "lz:workspace-page-loading";

export function setWorkspacePageLoading(loading: boolean) {
  window.dispatchEvent(new CustomEvent(WORKSPACE_PAGE_LOADING_EVENT, { detail: loading }));
}

export function WorkspaceLoadingBoundary({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    function handleWorkspaceLoading(event: Event) {
      setLoading(Boolean((event as CustomEvent<boolean>).detail));
    }

    window.addEventListener(WORKSPACE_PAGE_LOADING_EVENT, handleWorkspaceLoading);

    return () => {
      window.removeEventListener(WORKSPACE_PAGE_LOADING_EVENT, handleWorkspaceLoading);
    };
  }, []);

  return loading ? <AppLoading /> : children;
}
