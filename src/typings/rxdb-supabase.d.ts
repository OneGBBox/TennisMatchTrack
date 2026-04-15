// rxdb-supabase's package.json exports field does not expose its type declarations,
// so we redirect TypeScript to the correct .d.ts location manually.
declare module 'rxdb-supabase' {
  export { SupabaseReplication, SupabaseReplicationOptions, SupabaseReplicationCheckpoint } from '../../node_modules/rxdb-supabase/build/src/supabase-replication';
}
