import { createClient } from '@supabase/supabase-js';

// Vercel serverless function — called by the cron schedule in vercel.json.
// Purpose: keep the Supabase project active by running a lightweight read.
// No data is inserted, updated, or deleted.

export default async function handler(
  req: { method: string; headers: Record<string, string | string[] | undefined> },
  res: {
    status: (code: number) => {
      json: (body: Record<string, unknown>) => void;
    };
  }
) {
  const startedAt = new Date().toISOString();
  console.log(`[keep-alive] Starting health check at ${startedAt}`);

  // ── Optional: protect the endpoint with CRON_SECRET ──────────────────────
  // Vercel sets Authorization: Bearer <CRON_SECRET> on cron-triggered calls.
  // Set CRON_SECRET in your Vercel project environment variables to enable.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers['authorization'];
    const token = Array.isArray(auth) ? auth[0] : auth;
    if (token !== `Bearer ${cronSecret}`) {
      console.warn('[keep-alive] Unauthorized request rejected');
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
  }

  // ── Build Supabase client ─────────────────────────────────────────────────
  // Supports both VITE_-prefixed vars (already set for the frontend build)
  // and plain SUPABASE_URL / SUPABASE_ANON_KEY if you prefer to keep them
  // separate. Falls back gracefully.
  const supabaseUrl =
    process.env.SUPABASE_URL ??
    process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_ANON_KEY ??
    process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('[keep-alive] Missing Supabase environment variables');
    return res.status(500).json({
      ok: false,
      error: 'Supabase environment variables not configured',
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // ── Run the minimal read query ────────────────────────────────────────────
  // Reads at most 1 row from `profiles` — no writes, no deletes.
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .limit(1);

  const finishedAt = new Date().toISOString();

  if (error) {
    console.error('[keep-alive] Query failed:', error.message, '| code:', error.code);
    return res.status(500).json({
      ok: false,
      error: error.message,
      startedAt,
      finishedAt,
    });
  }

  const rowCount = data?.length ?? 0;
  console.log(
    `[keep-alive] Health check passed — got ${rowCount} row(s) from profiles`,
    `| finished at ${finishedAt}`
  );

  return res.status(200).json({
    ok: true,
    rows: rowCount,
    startedAt,
    finishedAt,
  });
}
