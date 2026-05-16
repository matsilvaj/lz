import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let monitorSupabaseClient: SupabaseClient | null = null;

function getMonitorSupabaseConfig() {
  const url = process.env.MONITOR_SUPABASE_URL;
  const publishableKey = process.env.MONITOR_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      'Defina "MONITOR_SUPABASE_URL" e "MONITOR_SUPABASE_PUBLISHABLE_KEY" para ler o feed do monitor-odds.',
    );
  }

  return {
    url,
    publishableKey,
  };
}

export function getMonitorSupabaseClient() {
  if (!monitorSupabaseClient) {
    const { url, publishableKey } = getMonitorSupabaseConfig();

    monitorSupabaseClient = createClient(url, publishableKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return monitorSupabaseClient;
}
