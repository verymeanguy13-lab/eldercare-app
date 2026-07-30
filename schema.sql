-- ============================================================
-- schema.sql
-- Eldercare Coordination App — Database Schema
-- Source of truth for all tables. Updated every session.
-- Run statements manually in Neon's SQL console.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE circles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'paid')),
  invite_code TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE members ADD CONSTRAINT members_email_unique UNIQUE (email);

CREATE TABLE cared_for_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  birthdate DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE circle_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'family_member', 'caregiver', 'viewer')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (circle_id, member_id)
);

CREATE INDEX idx_circle_memberships_circle_id ON circle_memberships(circle_id);
CREATE INDEX idx_circle_memberships_member_id ON circle_memberships(member_id);
CREATE INDEX idx_cared_for_profiles_circle_id ON cared_for_profiles(circle_id);

-- ============================================================
-- Auth (Session 3)
-- ============================================================
CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE magic_link_tokens (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Posts / shared feed (Session 4)
-- ============================================================
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  author_member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  text TEXT,
  photo_url TEXT, -- stores a Vercel Blob PATHNAME, not a public URL —
                   -- private storage; resolved only via the authenticated
                   -- /api/circles/[circleId]/posts/photo route.
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_posts_circle_id_created_at ON posts(circle_id, created_at DESC);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY posts_isolation ON posts
FOR ALL
USING (circle_id IN (SELECT my_circle_ids()))
WITH CHECK (circle_id IN (SELECT my_circle_ids()));

GRANT SELECT, INSERT, UPDATE, DELETE ON posts TO app_user;

-- ============================================================
-- Row-Level Security (Session 2.5)
-- ============================================================
-- CREATE ROLE app_user LOGIN PASSWORD '<see password manager>';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON circles, members,
--   cared_for_profiles, circle_memberships TO app_user;
-- GRANT app_user TO neondb_owner;
-- (one-time statement, commented out — kept for reference only)

ALTER TABLE circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cared_for_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION my_circle_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT circle_id FROM circle_memberships
  WHERE member_id = current_setting('app.current_member_id', true)::uuid
$$;

GRANT EXECUTE ON FUNCTION my_circle_ids() TO app_user;

CREATE POLICY circles_isolation ON circles
FOR ALL
USING (id IN (SELECT my_circle_ids()))
WITH CHECK (id IN (SELECT my_circle_ids()));

CREATE POLICY cared_for_profiles_isolation ON cared_for_profiles
FOR ALL
USING (circle_id IN (SELECT my_circle_ids()))
WITH CHECK (circle_id IN (SELECT my_circle_ids()));

CREATE POLICY circle_memberships_isolation ON circle_memberships
FOR ALL
USING (
  member_id = current_setting('app.current_member_id', true)::uuid
  OR circle_id IN (SELECT my_circle_ids())
)
WITH CHECK (
  member_id = current_setting('app.current_member_id', true)::uuid
  OR circle_id IN (SELECT my_circle_ids())
);

CREATE POLICY members_isolation ON members
FOR ALL
USING (
  id = current_setting('app.current_member_id', true)::uuid
  OR id IN (
    SELECT member_id FROM circle_memberships
    WHERE circle_id IN (SELECT my_circle_ids())
  )
)
WITH CHECK (true);

-- ============================================================
-- Seed data (test data only — not for production use)
-- ============================================================
-- 1 circle: 'Chen Family' (id 11111111-1111-1111-1111-111111111111)
-- 1 control-group circle: 'Wang Family' (id 99999999-9999-9999-9999-999999999999)
-- 2 cared_for_profiles: 陳媽媽, 陳爸爸
-- 3 members with roles: admin, family_member, caregiver
-- Plus real data created via the actual app: 'Test Family' circle with
-- real posts (text + private photo) created by a real magic-link-
-- authenticated user.