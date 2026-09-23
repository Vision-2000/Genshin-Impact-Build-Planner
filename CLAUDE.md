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
  `iconUrl`, `exclusivityGroup`, and `ascensionStatId` — a nullable FK to
  StatType for the fixed special stat this character's ascension unlocks,
  e.g. Bennett's is Energy Recharge%; the value at each phase lives on
  CharacterLevelStat, not here). Seed excludes Manekin/Manekina
  (non-buildable, no real loadout). `exclusivityGroup` is nullable and null
  for nearly every character — see Traveler handling below for the one
  exception.
- CharacterLevelStat — one row per character per (level, ascension phase)
  it can actually be at: hp, attack, defense, and the ascension-stat value
  (0 before that phase is reached). The 6 ascension-breakpoint levels
  (20/40/50/60/70/80) get two rows each (pre- and post-ascension), every
  other level gets one — sourced by sampling genshin-db's own
  `character.stats(level, ascension)` at seed time (see Key decisions on
  why this is a snapshot of genshin-db's output, not our own curve math).
- Talent — one row per character per talent slot: Normal Attack, Skill,
  Burst (normalized to these three regardless of genshin-db's per-character
  naming quirks like `combatsp`/`combatju`), and each Passive. Just name,
  icon, and the level-independent flavor `description` — the level-scaling
  numbers live in TalentAttribute, not here.
- TalentAttribute — child rows (talentId, label, formatCode,
  `values: Float[]`) for combat talents only (Normal Attack/Skill/Burst
  have levels; Passives don't). One row per labeled stat genshin-db
  reports (e.g. "1-Hit DMG", "Charged Attack Stamina Cost"), each holding
  all of that label's per-level values together (index 0 = talent level 1)
  — display-only string formatting (`formatCode` says how, e.g. `F1P` = one
  decimal, shown as a percentage), never fed into any damage formula (see
  Key decisions on calculation scope).
- TalentStatBonus — optional child rows (talentId, statTypeId, value) for
  the subset of Passive talents whose effect is an unconditional bonus that
  actually appears on the in-game character stat screen. Zero rows is the
  default/common case; conditional or proc-based effects (most passives)
  stay text-only and are excluded from any computed total.
- Constellation — one row per character per constellation (1-6): name,
  icon, description. Modeled separately from Talent (not as extra talent
  slots) since genshin-db treats them as a structurally distinct concept —
  no levels, no attributes, always a fixed effect once unlocked.
- ConstellationStatBonus — same idea and same rarity as TalentStatBonus,
  for the subset of constellations (a bit more common than passives, e.g.
  "increases Elemental Mastery by X") that are unconditional stat bonuses.
- Weapon — all weapons (name, type, rarity, secondary stat, `passiveName`,
  `iconUrl`). Seed excludes 1★/2★ weapons (no meaningful build relevance)
  and the Prized Isshin Blade (story-quest-only, never obtainable as a real
  player weapon). No `passiveText` column — genshin-db already provides a
  fully-rendered description per refinement rather than one template we'd
  need to fill in ourselves, so that text lives entirely in
  WeaponRefinementEffect instead.
- WeaponRefinementEffect — child rows (weaponId, refinement 1-5,
  description) holding genshin-db's own pre-rendered passive text for each
  refinement level — no templating needed on our side at all.
- WeaponLevelStat — same idea as CharacterLevelStat but for weapons: one
  row per (weaponId, level, ascension phase) with attack and the secondary
  stat's value at that point, sourced the same way (sampling
  `weapon.stats(level, ascension)` at seed time).
- WeaponStatBonus — same idea as TalentStatBonus, for the subset of weapon
  passives that grant an unconditional stat-screen bonus, plus a
  `refinement` column since that bonus (when one exists) almost always
  scales by refinement too, same as the passive text does.
- ArtifactSet — all artifact sets (name, fixed rarity, 2-piece/4-piece effect
  text, one icon URL column per slot: `flowerIconUrl`, `featherIconUrl`,
  `sandsIconUrl`, `gobletIconUrl`, `circletIconUrl` — not one column per set,
  since each slot has visually distinct art within the same set and these
  render on the build page). Seed excludes sets with only a 1-piece effect —
  these can't populate the required `twoPieceEffect` field, so excluding them
  isn't a workaround, it's the schema correctly rejecting data that doesn't
  fit the shape we defined. Seed also excludes sets that never drop above 3★
  (Adventurer, Lucky Dog, Traveling Doctor) — same "no meaningful build
  relevance" reasoning as the weapon rarity cutoff. `rarity` is
  `max(rarityList)` from genshin-db — the same value already computed for
  that exclusion check.
- ArtifactSetStatBonus — optional child rows (artifactSetId, piece: TWO |
  FOUR, statTypeId, value) for the subset of 2pc/4pc effects that are
  unconditional stat bonuses. Almost always true for 2pc effects; rarely
  true for 4pc, since most 4pc effects are conditional/proc-based and stay
  text-only, excluded from any computed total — same reasoning as
  TalentStatBonus/WeaponStatBonus/ConstellationStatBonus, applied to
  artifacts.
- StatType — shared pool of stat types (Crit Rate, Crit DMG, ATK%, EM, elemental
  DMG bonus, etc.) — used by both weapon secondary stats and artifact main/substats

**Owned inventory (profile-scoped)**
- OwnedCharacter — links GameProfile to Character, with an `is_owned`
  boolean flag, plus level, ascension phase, per-talent level, and
  constellation — needed to compute final stats and to substitute the right
  numbers into talent descriptions.
- OwnedWeapon — one row per physical copy owned, each with its own
  refinement (never a quantity field), plus level and ascension phase.
- OwnedArtifact — one row per physical piece: slot, level, main stat. No
  rarity column — rarity is fixed per ArtifactSet, not chosen per piece (see
  Key decisions below)
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
  own refinement), so "browse the catalog" and "manage what you own" are
  genuinely different interactions on different data, and deserve different
  views. (Characters got a similarly-shaped split once its own owned-side
  data grew past a plain ownership flag — see below — but via a differently
  named secondary route, since toggling a character's ownership isn't the
  same kind of action as adding a new weapon copy.)
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
- Artifacts got the same owned/catalog page split as Weapons
  (`/artifacts` + `/artifacts/add`), for the same reasons — but `/artifacts`
  is the one page that explicitly keeps pagination, since `OwnedArtifact` is
  the genuinely-unbounded case called out above (one row per physical piece,
  each with up to 4 individually-editable substats). `/artifacts/add`'s set
  catalog drops pagination like Characters/Weapons, since ArtifactSet itself
  is bounded/slow-growing (~55 sets).
  Owned artifacts deliberately did NOT get the big square icon-dominant grid
  card Characters/Weapons use: that treatment only works because there's
  almost nothing else to show per item. An owned artifact needs to display
  and let you edit a level dropdown plus up to 4 substat rows, which doesn't
  fit in a small square card without cramping the editing UI. The owned list
  stays row-based; only the icon gets the shared rarity-tinted treatment
  (`rarityGradientClasses`, `src/lib/rarity-colors.ts` — extracted once a
  third page needed rarity-based coloring, covering all 5 rarity tiers since
  artifacts can roll any of them, unlike Characters/Weapons which only ever
  reach 4-5★ / 3-5★). The catalog side (`/artifacts/add`, just picking a set
  to add a piece from) has nothing to edit yet at that stage, so its list
  entries stay simple like before (see below on why rarity isn't part of the
  add form). The multi-field creation form (slot/level/main stat/substats)
  stays an inline expand under the chosen set, not a separate step — it
  already worked and a second step would add navigation for no benefit here.
  Also extracted `useToast`/`Toast` (`src/components/toast.tsx`) once a
  second page (this one) needed the same "confirm an add via a temporary
  banner, since the created item lives on a different page's list" pattern
  Weapons' catalog introduced — Weapons' catalog was retrofitted to use it
  too instead of keeping its own copy.
- Characters got a page split too, once `OwnedCharacter` grew level/
  ascension/constellation/talent-level fields (build order step 7) — before
  that, a single page combining the ownership toggle and (nonexistent)
  editing was fine, since there was nothing to edit. `is_owned` is still
  exactly the same plain boolean it always was (see above); what changed is
  that there's now real per-owned state worth a dedicated view, the same
  trigger Weapons/Artifacts split on.
  The split isn't named the same way, though: `/characters` is the primary
  page (owned characters only, click a card to edit its progression) and
  `/characters/roster` is secondary (every character, click to toggle
  ownership) — not `/characters/add`, because toggling a character's
  ownership isn't creating a new row the way adding a weapon/artifact copy
  is; it's flipping the same boolean back and forth, and the character
  keeps its progression data across an accidental off/on either way (same
  "never delete on toggle" reasoning `is_owned` already had). `CharacterCard`
  (shared by both pages, mirroring `WeaponCard`/`ArtifactCard`) reflects
  this split in its own props: `showOwnershipBorder` (green/gray, roster
  page only) vs. `level`/`constellation` (shown as a second line under the
  name, owned page only) are mutually exclusive per page, never both.
- Artifact rarity moved from `OwnedArtifact` (originally a free-choice field
  set per piece when adding it) to `ArtifactSet` (fixed, seeded from
  genshin-db). Real in-game sets have a fixed max rarity — Instructor, The
  Exile, Berserker, and other old domain-drop sets top out at 4★, while most
  current sets top out at 5★ — so letting the add form offer any rarity for
  any set (including a 4-star pick on a 5-star-only set) was letting the UI
  represent combinations that can't actually happen. The add form no longer
  asks for rarity at all; it's shown read-only, and `addArtifact` no longer
  takes a rarity argument. `OwnedArtifact.rarity` was dropped outright rather
  than kept and auto-filled — with rarity now 100% derived from the set,
  keeping a per-piece copy would just be redundant, possibly-stale data for
  no benefit. This intentionally doesn't model that a 5-star set can in
  theory still drop lower-rarity copies in-game; not something this tracker
  represents.
- Final-stats calculation is scoped to aggregate stat totals (HP/ATK/DEF/EM/
  Crit Rate/Crit DMG/Energy Recharge/elemental DMG%) summed from character
  base + weapon + artifacts — not full damage-per-hit output. Actual damage
  needs talent multiplier tables classified by scaling stat/hit type, enemy
  stats/RES, and the elemental reaction system on top of this; that's a
  separate, much larger effort and stays under "Damage simulation" in
  Deferred, not folded into this work.
- Static/always-on stat bonuses from passive talents, constellations,
  weapon passives, and artifact 2pc/4pc effects are modeled as small
  relational child tables (TalentStatBonus, ConstellationStatBonus,
  WeaponStatBonus, ArtifactSetStatBonus), not a JSON column — consistent
  with the rest of this schema being fully relational (StatType is already
  a shared reference table these all point at), zero rows cleanly
  represents "no bonus" (the common case), and multiple rows handles the
  rare multi-stat effect without needing extra shape. Only the subset of
  effects that are unconditional and actually shown on the in-game stat
  screen get a row here; conditional/proc-based effects (most passives and
  4pc effects) stay descriptive text only and are excluded from any
  computed total.
- Character/weapon base HP/ATK/DEF and secondary/ascension stat values are
  stored as a precomputed per-level lookup table (CharacterLevelStat/
  WeaponLevelStat), sampled once at seed time directly from genshin-db's
  own `stats(level, ascension)` function, rather than reimplementing
  Genshin's internal growth-curve formulas ourselves. genshin-db's actual
  per-curve raw multiplier tables aren't part of its public API surface, so
  reproducing them would mean depending on undocumented internals for no
  benefit — the values are just official static reference data (no
  algorithm of our own to demonstrate here), consistent with how this
  schema already treats genshin-db as a data source, not something whose
  internals get reimplemented.
- Weapon refinement text needs no templating on our side: genshin-db
  already provides a fully-rendered description per refinement level
  (`r1..r5`), so WeaponRefinementEffect stores those 5 strings directly.
  Combat talent numbers work differently and do need our own display
  logic: genshin-db exposes them as a list of labeled attributes (e.g.
  "1-Hit DMG"), each with its own per-level value array and a format code
  saying how to render it (e.g. one decimal, as a percentage) — modeled as
  TalentAttribute, formatted at display time. Neither of these numbers is
  ever used in a stat or damage total, only rendered as text.
- Hover-card detail popovers (see build order) are sequenced after master
  data completeness, not before — the point of building them is to absorb
  the stats/talents/effects data landing on top of the current cards, so
  building the data first means the popover only needs to be built once,
  against real content, instead of guessing at its shape.

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
6. Master data completeness: CharacterLevelStat, WeaponLevelStat, Talent +
   TalentAttribute, Constellation, WeaponRefinementEffect, and the four
   `*StatBonus` tables — seeded from genshin-db, master data only, no
   owned-side fields yet
7. Owned-side leveling: OwnedCharacter/OwnedWeapon gain level, ascension
   phase, talent levels, and constellation, with UI to set them
8. Final-stats calculation module (pure function: build -> aggregate stat
   totals) + a "Final Stats" block on the build page
9. Hover-card UI: a shared hover-on-desktop/tap-on-touch detail popover,
   retrofitted into WeaponCard/ArtifactCard (and a future CharacterCard) so
   each card's always-visible face can shrink back down as more data lands
   on top of it
10. Teams — assemble builds, enforce per-character uniqueness, show overlap
    warnings live during selection
11. Rosters — same pattern as Teams, no build cap
12. Lineups — save Team combinations; ephemeral-vs-saved validation
13. Visual polish, deploy to Vercel, README

## Deferred / not designed yet — don't build ahead of these
- Build editing's copy-vs-force-edit prompt when an edit would break a Team
  it already belongs to (now that overlap checks are hard blocks, an
  unguarded edit could leave a team in a state full validation would reject).
  Editing a Build is a direct save for now. Revisit alongside or after
  Rosters.
- Home page task/reminder list
- Custom validation rules for Lineups (e.g. Imaginary Theatre's 3-element +
  guest-character restrictions per season)
- Damage simulation, elemental resonance display, and everything that
  requires (talent multiplier tables classified by scaling stat/hit type,
  enemy stats/RES, the elemental reaction system). The aggregate stat totals
  from build order step 8 are a prerequisite for this, not this itself.
- Unlockable "bonus" passives some characters get outside the normal kit
  (e.g. Nicole's Hexerei-only "Witch's Eve Rite: Light in the Darkness",
  unlocked via a quest, active only with 2+ Hexerei party members; Diona
  and Fischl are reported to have their own equivalents). Investigated and
  shelved: genshin-db (this project's only data source) has zero coverage
  of these anywhere in its dataset -- confirmed by grepping its entire raw
  JSON for the passive's name and for "faction passive", no matches. A
  community API (gi.yatta.moe/Project Amber) does expose at least Nicole's
  under an extra numbered `talent` key beyond the normal 3 passives, but
  that was only confirmed for one character via one ad hoc query -- not
  enough to build a real seed pipeline on (unknown whether the key is
  consistent across characters, no bulk listing endpoint found, other
  candidate sites like lunaris.moe are client-rendered SPAs with no
  fetchable static/API content found). Not worth wiring in a second live
  data source for a handful of characters. When this gets picked up again:
  a manual entry path (paste the character's wiki text, parse/store the
  bonus passive from it) is the intended approach, not automated seeding --
  and explicitly do NOT conflate this with flavor-only constellation text
  that reads like a buff but does nothing mechanically (called out
  specifically for Traveler; not actually observed as an issue in the
  currently-installed genshin-db version, but worth independently
  verifying whatever's pasted in actually corresponds to a real effect
  before it's treated as one).
- A small number of characters have a constant, always-on "innate" stat
  outside the normal ascension system entirely -- e.g. Nefer has a flat
  100 Elemental Mastery at every level/ascension, confirmed on the wiki as
  a separate "Base EM" column alongside her actual ascension-scaling stat
  (Crit DMG, which genshin-db does track correctly). Investigated and
  shelved for the same reason as the bonus-passive item above: dumped
  genshin-db's entire raw character object and full stats() output for
  Nefer, no field for this anywhere. Structurally this needs something new
  (today's schema has no "constant non-scaling stat" concept, only the
  per-level ascensionStatValue table) -- when this gets picked up again,
  treat it as the same manual-entry problem as the bonus-passive item
  rather than inventing a separate mechanism for it.

## Priorities for this project
- Portfolio piece for job interviews: prefer code that's easy to explain over
  clever abstractions or black-box magic.
- Build incrementally, one phase at a time, reviewed before moving to the next.
- The overlap-detection logic and the master-vs-owned data split are the most
  interesting, most-likely-to-come-up-in-interviews parts of this project —
  worth extra care in implementation.