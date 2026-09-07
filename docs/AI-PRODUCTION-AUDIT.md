
## Supabase Edge Function deployment

Function path: `supabase/functions/ai/index.ts`.

From the Supabase project dashboard: **Project Settings → Edge Functions → Secrets**, add `OPENAI_API_KEY` and optionally `OPENAI_MODEL` (for example `gpt-4o-mini`). Or, with the Supabase CLI linked to the intended project, run `supabase secrets set OPENAI_API_KEY=... OPENAI_MODEL=gpt-4o-mini` locally in your terminal. Never paste the key into chat, commit it, or add it to a `VITE_` variable.

Deploy with `supabase functions deploy ai --no-verify-jwt` only if the runtime must perform its own verification; this function verifies the bearer token itself. The included `supabase/functions/config.toml` uses `verify_jwt = true`, which is the preferred configuration because the gateway rejects missing/invalid JWTs before invocation. Configure the function's production origin allowlist for `https://aaru1yg.github.io`; localhost origins are included for local development.

The browser adapter is `createSupabaseAiProvider({ supabase })`; it obtains the current session access token and calls `${supabase.supabaseUrl}/functions/v1/ai`. No token or key is persisted by this adapter.

This environment does not have the production Supabase project credentials, an OpenAI secret, or a configured deployment target available to this coding session. The function is implemented and locally testable with mocks, but it has **not** been deployed or real-provider verified. AI must not be reported live until those manual deployment and browser checks succeed.

Release validation note: deterministic local Coach is the production default; external AI remains off.
