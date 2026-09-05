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
- Session — DB-backed auth session: userId, opaque random token, expiresAt.
  Chosen over JWTs specifically so logout/revocation is a plain row delete, and
  the whole auth flow stays explainable end-to-end without crypto-library
  internals (relevant since the point of building auth at all was to
  demonstrate understanding it, not just wire up a library)
- GameProfile — a Genshin account/region belonging to a User (players commonly run
  several regional accounts). Optional UID (cosmetic only, not used for any API
  call). Optional avatar, settable to any playable character in the master catalog
  whether owned or not — scoped to playable characters only in v1, NPCs/animals
  out of scope (no reliable free data source for them)

**Master/reference data (shared, static, seeded once)**
- Character — all playable characters (name, element, weapon type, rarity,
  `iconUrl`, `exclusivityGroup`). Seed excludes Manekin/Manekina (non-buildable,
  no real loadout). `exclusivityGroup` is nullable and null for nearly every
  character — see Traveler handling below for the one exception.
- Weapon — all weapons (name, type, rarity, secondary stat, passive text,
  `iconUrl`). Seed excludes 1★/2★ weapons (no meaningful build relevance) and
  the Prized Isshin Blade (story-quest-only, never obtainable as a real player
  weapon).
- ArtifactSet — all artifact sets (name, 2-piece/4-piece effect text, one icon
  URL column per slot: `flowerIconUrl`, `featherIconUrl`, `sandsIconUrl`,
  `gobletIconUrl`, `circletIconUrl` — not one column per set, since each slot
  has visually distinct art within the same set and these render on the build
  page). Seed excludes sets with only a 1-piece effect — these can't populate
  the required `twoPieceEffect` field, so excluding them isn't a workaround,
  it's the schema correctly rejecting data that doesn't fit the shape we
  defined. Seed also excludes sets that never drop above 3★ (Adventurer, Lucky
  Dog, Traveling Doctor) — same "no meaningful build relevance" reasoning as
  the weapon rarity cutoff.
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
- Auth is hand-built, not Auth.js/NextAuth or a similar library — the entire
  reason for having auth at all is to demonstrate understanding it, so
  outsourcing it to a library would defeat the purpose. `bcryptjs` (not native
  `bcrypt`) for password hashing, chosen specifically for Vercel serverless
  compatibility. See the Session entity above for the session strategy.
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
  reimplement this per screen. All composition checks are hard blocks, not
  advisory warnings — shared weapon and shared artifact reuse across builds in
  the same team/roster are blocked exactly like duplicate-character and
  exclusivityGroup collisions are. "Warnings" above describes the UI moment
  (surfaced live during selection), not a lower severity.
- A build can be reused across multiple teams/rosters simultaneously.
- A build can never contain the same character twice within one team/roster —
  this is what the denormalized owned_character_id + unique constraint enforces.
- Traveler is modeled as one `Character` row per element (6 rows total), not one
  row with a variable element and not split by gender — this lets each element
  have its own real build, matching how the character actually plays. Gender is
  deliberately not modeled at all: it only affects appearance/voice, never stats,
  talents, or kit, so it carries no information relevant to anything this app
  tracks. (If genshin-db's raw data happens to split by gender, collapse it down
  to 6 rows during seeding — don't propagate a distinction upstream that doesn't
  matter here. If a field is ever sourced from the gendered raw data, default
  to the female variant, Lumine.)
  The catch this exists to solve: only one Traveler can ever be in a party
  regardless of element, and the base uniqueness constraint doesn't know the 6
  rows are related. Fixed with a nullable `exclusivityGroup` field on
  `Character`: null for every normal character (no behavior change), set to the
  single shared value `"traveler"` for all 6 elemental rows. Team/Roster
  composition checks (both the live warning during build selection and full
  validation) must also block on a shared non-null `exclusivityGroup` between
  builds already present, not just on owned_character_id. If a future character
  rework ever needs the same mechanic, reuse this field rather than adding a
  special case — it's intentionally not named after Traveler specifically.
- Pagination on Characters was removed in favor of a full scrollable list —
  it's bounded, slow-growing master data (~125 rows, only grows with game
  updates), and rendering all of it at once is well within normal browser
  capability. This is deliberately NOT a general pattern to copy onto every
  list page: Artifacts (and any page with genuinely unbounded per-user growth
  — `OwnedArtifact` is one row per physical piece, no consolidation, so a
  long-term player can accumulate hundreds+) keeps pagination for now. If a
  page like that ever needs to drop pagination too, the right answer is
  virtualization (e.g. `@tanstack/react-virtual`, virtualizing by row since
  the grid's column count is responsive) — not "render everything," which
  would degrade with real usage. Don't build that virtualized-grid component
  speculatively; wait for a concrete page that actually needs it.
- The Weapons page is split into `/weapons` (owned copies only) and
  `/weapons/add` (the full catalog, for adding new copies) rather than one
  page with both sections stacked together. This isn't just a layout choice —
  `OwnedWeapon` is its own entity (one row per physical copy, each with its
  own refinement), not a boolean flag on `Weapon` the way character ownership
  is, so "browse the catalog" and "manage what you own" are genuinely
  different interactions on different data, and deserve different views.
  A separate page was chosen over a modal/overlay for the add flow: it matches
  this app's existing one-Server-Component-per-route architecture (each route
  fetches only what it needs), and a searchable ~230-item catalog is too much
  content for the kind of small, focused overlay `DialogProvider` is designed
  for — building a second, heavier modal system just for this wasn't worth it.
  The sidebar's existing prefix-match active-link logic
  (`pathname.startsWith(item.href + "/")`) already keeps "Weapons" highlighted
  on `/weapons/add` and navigates back to `/weapons` for free — this is why
  the add route must stay nested under `/weapons`, not a sibling route.
  Same reasoning as Characters applies to pagination here too: both
  `/weapons` and `/weapons/add` render their full filtered list rather than
  paginating — the catalog is bounded/slow-growing master data (same
  reasoning as Characters), and an owned-weapon collection is nowhere near
  Artifacts-scale unbounded (a refinement is one value per copy, not a
  physical-piece entity with per-substat rows).

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
- Build editing's copy-vs-force-edit prompt when an edit would break a Team
  it already belongs to (now that overlap checks are hard blocks, an
  unguarded edit could leave a team in a state full validation would reject).
  Editing a Build is a direct save for now. Revisit alongside or after
  Rosters.
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