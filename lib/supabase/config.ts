export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      'Defina "NEXT_PUBLIC_SUPABASE_URL" e "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" para usar o Supabase Auth.',
    );
  }

  return {
    url,
    publishableKey,
  };
}
