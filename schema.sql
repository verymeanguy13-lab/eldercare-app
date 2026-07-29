-- ============================================================
-- schema.sql
-- Eldercare Coordination App — Database Schema
-- Source of truth for all tables. Updated every session.
-- Run statements manually in Neon's SQL console.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- One row per family circle
CREATE TABLE circles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'paid')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per real person (not the cared-for elder themselves)
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per elderly parent/relative being cared for.
-- A circle can have MULTIPLE cared_for_profiles (e.g. both parents).
CREATE TABLE cared_for_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  birthdate DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Join table: connects members to circles, with a role per connection.
-- A member can belong to more than one circle (one row per circle).
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
-- Seed data (test data only — not for production use)
-- ============================================================
-- 1 circle: 'Chen Family' (id 11111111-1111-1111-1111-111111111111)
-- 2 cared_for_profiles: 陳媽媽, 陳爸爸
-- 3 members with roles: admin, family_member, caregiver