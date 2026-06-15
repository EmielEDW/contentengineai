/**
 * Placeholder DB types. Generate the real ones from the canonical schema with:
 *   npm run db:types        (requires `supabase start` / a linked project)
 * which runs: supabase gen types typescript --local > src/lib/supabase/database.types.ts
 *
 * Until then this loose type keeps the Supabase clients compiling.
 */
// Loose placeholder so the Supabase clients compile before real types are
// generated. `any` makes all queries return `any` (the repo layer casts to its
// own row interfaces). Replace with the generated types via `npm run db:types`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
