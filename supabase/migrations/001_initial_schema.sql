-- ============================================================
-- TennisMatchTrack — Migration 001: Initial Schema
-- Run this in Supabase SQL Editor (Database > SQL Editor)
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Table: players ───────────────────────────────────────────
CREATE TABLE public.players (
  id             UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  name           TEXT         NOT NULL CHECK (char_length(name) <= 100),
  image_url      TEXT,
  ntrp_rating    NUMERIC(3,1) CHECK (ntrp_rating >= 0.0 AND ntrp_rating <= 7.0),
  utr_rating     NUMERIC(5,2) CHECK (utr_rating >= 0.0 AND utr_rating <= 16.5),
  hitting_arm    TEXT         CHECK (hitting_arm IN ('Left', 'Right')),
  backhand_type  TEXT         CHECK (backhand_type IN ('One-hand', 'Two-hand')),
  creator_id     UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  _modified      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  _deleted       BOOLEAN      NOT NULL DEFAULT FALSE
);

-- ── points_log JSONB entry shape (v2 — updated schema):
-- { server_id, winner_id, shot_type(Winner|UE|FE), side(FH|BH|Serve),
--   shot_category(Regular|Return|...|Ace|Double Fault), location(CC|ML|DTL|T|Wide|Body|Net),
--   serve_number(1|2), rally_length(int), momentum_index, set_number, game_number, point_number }

-- ── Table: matches ───────────────────────────────────────────
CREATE TABLE public.matches (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  date            DATE        NOT NULL,
  time            TIME,
  location_city   TEXT        CHECK (char_length(location_city) <= 100),
  scoring_rules   JSONB       NOT NULL,
  player1_id      UUID        REFERENCES public.players(id) ON DELETE SET NULL,
  player2_id      UUID        REFERENCES public.players(id) ON DELETE SET NULL,
  points_log      JSONB       NOT NULL DEFAULT '[]'::JSONB,
  status          TEXT        NOT NULL DEFAULT 'setup'
                              CHECK (status IN ('setup', 'in_progress', 'complete', 'abandoned')),
  weather         JSONB,
  creator_id      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  _modified       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  _deleted        BOOLEAN     NOT NULL DEFAULT FALSE
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX idx_players_modified  ON public.players(_modified);
CREATE INDEX idx_players_name      ON public.players(name);
CREATE INDEX idx_players_creator   ON public.players(creator_id);

CREATE INDEX idx_matches_creator   ON public.matches(creator_id);
CREATE INDEX idx_matches_modified  ON public.matches(_modified);
CREATE INDEX idx_matches_status    ON public.matches(status);
CREATE INDEX idx_matches_date      ON public.matches(date DESC);

-- ── Auto-update _modified trigger ────────────────────────────
-- Required by rxdb-supabase: every UPDATE must refresh _modified
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW._modified = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER players_set_modified
  BEFORE UPDATE ON public.players
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER matches_set_modified
  BEFORE UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- ── Row Level Security (RLS) ─────────────────────────────────
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- Players: any authenticated user can read (shared player pool)
CREATE POLICY "Authenticated users can read players"
  ON public.players FOR SELECT
  TO authenticated
  USING (true);

-- Players: only creator can insert / update (soft-delete via _deleted flag)
CREATE POLICY "Creator can insert player"
  ON public.players FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creator can update player"
  ON public.players FOR UPDATE
  TO authenticated
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

-- Matches: only creator can read, insert, update
CREATE POLICY "Creator can read matches"
  ON public.matches FOR SELECT
  TO authenticated
  USING (auth.uid() = creator_id);

CREATE POLICY "Creator can insert match"
  ON public.matches FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creator can update match"
  ON public.matches FOR UPDATE
  TO authenticated
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

-- ── Supabase Realtime ─────────────────────────────────────────
-- Enables live push events to rxdb-supabase replication stream
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;

-- ── Verify ───────────────────────────────────────────────────
-- Run these SELECT statements to confirm everything was created:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
-- SELECT policyname, tablename, cmd FROM pg_policies WHERE schemaname = 'public';
-- SELECT trigger_name, event_object_table FROM information_schema.triggers WHERE trigger_schema = 'public';
