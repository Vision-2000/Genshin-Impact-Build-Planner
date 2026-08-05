# Project: Genshin Impact build tracker

## What this is
A personal portfolio project (job-hunting for entry-level software engineer roles).
Solves a real problem: Genshin Impact has no in-game way to save character builds,
so this app tracks owned characters/weapons/artifacts, saves builds, assembles teams
and rosters, and flags resource conflicts across a multi-team lineup.

Unofficial fan project. Not affiliated with or endorsed by HoYoverse. Don't imply
official affiliation anywhere in the UI or README.

## Tech stack
- Next.js, App Router, TypeScript, Tailwind CSS
- PostgreSQL hosted on Neon
- Prisma ORM
- Zod for input validation on Server Actions
- Deploy target: Vercel

## Data model overview
Grouped by domain. Master/reference tables are static game data, shared across all
users, seeded once from an external community dataset (e.g. genshin-db) — never
user-editable.

**Accounts**
- User — app account, email/password
- GameProfile — a Genshin account/region belonging to a User (players commonly run
  several regional accounts). Optional UID (cosmetic only, not used for any API
  call). Optional avatar, settable to any playable character in the master catalog
  whether owned or not — scoped to playable characters only in v1, NPCs/animals
  out of scope (no reliable free data source for them)

**Master/reference data (shared, static, seeded once)**
- Character — all playable characters (name, element, weapon type, rarity)
- Weapon — all weapons (name, type, rarity, secondary stat, passive text)
- ArtifactSet — all artifact sets (name, 2-piece/4-piece effect text)
- StatType — shared pool of stat types (Crit Rate, Crit DMG, ATK%, EM, elemental
  DMG bonus, etc.) — used by both weapon secondary stats and artifact main/substats

**Owned inventory (profile-scoped)**
- OwnedCharacter — links GameProfile to Character, with an `is_owned` boolean flag
- OwnedWeapon — one row per physical copy owned, each with its own refinement
  (never a quantity field)
- OwnedArtifact — one row per physical piece: slot, rarity, level, main stat
- OwnedArtifactSubstat — child table, up to 4 rows per artifact (stat type + value)

**Builds**
- Build — 1 owned character (required) + 1 owned weapon (optional) + name, unique
  per character
- BuildArtifact — join table, up to 5 rows per build (one per artifact slot)

**Grouping**
- Team — up to 4 builds (cap enforced in app code, not the DB)
- TeamBuild — join table; denormalizes owned_character_id so the DB can enforce
  UNIQUE(team_id, owned_character_id) directly
- Roster — same shape as Team, no build cap
- RosterBuild — same denormalization pattern as TeamBuild
- Lineup — a saved combination of Teams only (Rosters are always validated alone,
  never combined)
- LineupTeam — join table

## Key decisions — these were deliberated, don't re-derive or second-guess them
- All data is private per user. No sharing/social features of any kind.
- Character ownership is a persistent flag (`is_owned`), never create/delete on
  toggle — this is what lets builds hide and reappear as ownership is toggled,
  instead of being destroyed and losing data.
- Weapons and artifacts have no "unowned" concept — deleting an OwnedWeapon or
  OwnedArtifact is permanent. `Build.owned_weapon_id` is nullable and set to null
  on weapon deletion; the matching `BuildArtifact` row is removed on artifact
  deletion. The Build itself always survives, just with a gap.
- Artifact main stat is stored explicitly on OwnedArtifact even for flower/feather
  (fixed in-game) — simpler than deriving it from slot at query time.
- Artifact filters are boolean only ("has a Crit Rate substat"), never range-based.
  "Highest X" is handled by sorting, not filtering.
- "Main stat X excludes substat X" is frontend validation, not a DB constraint.
- Deleting a Build cascades out of any Team/Roster it's in — but show a
  confirmation first, naming the affected teams/rosters (and any Lineups built on
  top of them).
- Editing a Build that would break a Team/Roster gives the user two paths:
  (a) save as a copy, leaving the original and its team/roster memberships
  untouched, or (b) force-edit, which removes the build only from the specific
  teams/rosters where the edit actually creates a conflict — checked per
  container, not globally, since the same edit might be fine in one team and
  conflict in another.
- Team/Roster overlap checks default to ephemeral — nothing is saved by default.
  Saving as a named Lineup is optional, only allowed if the check currently
  passes, and always re-validated live when viewed later (never cached), since
  the underlying builds can change after a Lineup is saved.
- Overlap-detection (shared weapon/artifact reuse across a set of builds) is one
  generic function over "a set of builds" — reused for in-progress team/roster
  selection warnings, full validation, and saved Lineup display. Do not
  reimplement this per screen.
- A build can be reused across multiple teams/rosters simultaneously.
- A build can never contain the same character twice within one team/roster —
  this is what the denormalized owned_character_id + unique constraint enforces.

## Build order — follow this sequence, don't skip ahead
1. Scaffold project, connect Prisma to Neon, confirm first migration runs
2. Auth + profile switcher: User and GameProfile tables, plus a minimal
   create/select-profile flow (real session/password hardening can come later —
   every other table depends on GameProfile existing, so this has to come first)
3. Master/reference data: Character, Weapon, ArtifactSet, StatType — seed from an
   external Genshin dataset
4. Owned inventory CRUD: character roster toggle, weapon add (with refinement),
   artifact add (with substats) — establishes reusable list/filter/sort/search
   patterns for all three pages
5. Builds — compose owned character + weapon + artifacts
6. Teams — assemble builds, enforce per-character uniqueness, show overlap
   warnings live during selection
7. Rosters — same pattern as Teams, no build cap
8. Lineups — save Team combinations; ephemeral-vs-saved validation
9. Visual polish, deploy to Vercel, README

## Deferred / not designed yet — don't build ahead of these
- Home page task/reminder list
- Custom validation rules for Lineups (e.g. Imaginary Theatre's 3-element +
  guest-character restrictions per season)
- Damage simulation, elemental resonance display
- Extended character/weapon stats: levels, talents, ascension materials

## Priorities for this project
- Portfolio piece for job interviews: prefer code that's easy to explain over
  clever abstractions or black-box magic.
- Build incrementally, one phase at a time, reviewed before moving to the next.
- The overlap-detection logic and the master-vs-owned data split are the most
  interesting, most-likely-to-come-up-in-interviews parts of this project —
  worth extra care in implementation.
