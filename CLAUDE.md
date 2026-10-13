# Project: Genshin Impact build tracker

## What this is
A personal portfolio project (job-hunting for entry-level software engineer roles).
Solves a real problem: Genshin Impact has no in-game way to save character builds,
so this app tracks owned characters/weapons/artifacts, saves builds, assembles teams
and rosters, and flags resource conflicts across a multi-team lineup.

Unofficial fan project. Not affiliated with or endorsed by HoYoverse. Don't imply
official affiliation anywhere in the UI or README.

## Tech stack
- PostgreSQL hosted on Neon
- Deploy target: Vercel

## Data model overview
Grouped by domain. Master/reference tables are static game data, shared across all
users, never user-editable. Sourced from `data-source/{characters,weapons,
artifact-sets,stat-types}.json` — hand-maintained master data curated directly
against Lunaris, Project Amber, and HoYoWiki by a separate Claude session for each
game update (see Key decisions below and `data-source/master-data-formulas.txt`).
`prisma/seed.ts` only imports this JSON into Postgres; it no longer talks to
genshin-db or any live data source, and does zero re-derivation, filtering, or
text-fixing of its own — all of that now happens upstream, in the JSON itself.
`data-export/` is reserved for the opposite direction — ad hoc dumps of the
current DB's master data, written by `data-export/export-master-data.mts`, for
diffing against `data-source/` or debugging; nothing in it is ever read back by
the app or the seed script.

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
  `iconUrl`, `splashUrl`, `exclusivityGroup`, and `ascensionStatId` — a nullable FK to
  StatType for the fixed special stat this character's ascension unlocks,
  e.g. Bennett's is Energy Recharge%). Base HP/ATK/DEF (level 1, ascension
  phase 0) and each stat's own max-ascension bonus are stored directly on
  this row (`baseHp`/`baseAttack`/`baseDefense`/`maxAscensionHp`/
  `maxAscensionAttack`/`maxAscensionDefense`) rather than a separate
  per-level table — the value at any (level, phase) is computed from these
  via a small set of shared level/ascension multiplier tables in
  `src/lib/character-scaling.ts` (see Key decisions on why this replaced
  the original per-level snapshot design). `baseElementalMastery` is a
  flat EM floor outside the ascension system entirely, 0 for nearly every
  character except a couple of wiki-documented exceptions (see Key
  decisions). Seed excludes Manekin/Manekina (non-buildable, no real
  loadout). `exclusivityGroup` is nullable and null for nearly every
  character — see Traveler handling below for the one exception.
- Talent — one row per character per talent slot: Normal Attack, Skill,
  Burst, and each Passive. Just name, icon, and the level-independent flavor
  `description` — the level-scaling numbers live in TalentAttribute, not here.
- TalentAttribute — child rows (talentId, label, formatCode, hitCount, prefix,
  suffix) for combat talents only (Normal Attack/Skill/Burst have levels;
  Passives don't). One row per labeled stat (e.g. "1-Hit DMG", "Charged
  Attack Stamina Cost"). Rather than storing all 15 per-level values, each
  row is classified into one of a small set of named level-scaling curves
  and stored as `curveType` + `baseValue` (plus `linearSlope`/`capLevel` for
  the Linear family, or `customValues` as a raw fallback for genuine
  one-offs) — the classification itself happens upstream, in the JSON (see
  Key decisions), not at seed time in this repo; the value at any talent
  level is reconstructed via `src/lib/talent-scaling.ts`. `hitCount`
  (default 1) covers multi-hit attributes like Aino's 3-hit Normal Attack;
  `prefix`/`suffix` are optional display affixes. `formatCode` is
  display-only string formatting (e.g. `F1P` = one decimal, shown as a
  percentage), never fed into any damage formula (see Key decisions on
  calculation scope).
- TalentStatBonus — optional child rows (talentId, statTypeId, value) for
  the subset of Passive talents whose effect is an unconditional bonus that
  actually appears on the in-game character stat screen. Zero rows is the
  default/common case; conditional or proc-based effects (most passives)
  stay text-only and are excluded from any computed total.
- Constellation — one row per character per constellation (1-6): name,
  icon, description. Modeled separately from Talent (not as extra talent
  slots) since it's a structurally distinct concept — no levels, no
  attributes, always a fixed effect once unlocked.
- ConstellationStatBonus — same idea and same rarity as TalentStatBonus,
  for the subset of constellations (a bit more common than passives, e.g.
  "increases Elemental Mastery by X") that are unconditional stat bonuses.
- Weapon — all weapons (name, type, rarity, secondary stat, `passiveName`,
  `iconUrl`). Same kind of compact scaling fields as Character: `baseAttack`
  (level 1, ascension phase 0), `attackTier` (which rarity-tier ATK curve
  to use — inferred at seed time by matching level-1 ATK, almost always the
  weapon's own `rarity`), `attackCurveRarity` (nullable override for the
  one documented exception, Sword of Descension — see Key decisions), and
  `baseSecondaryStatValue`; the value at any (level, phase) is computed via
  `src/lib/weapon-scaling.ts`, not stored per level. `maxRefinement`
  (default 5) and `passiveDescriptionTemplate` handle the passive text
  itself — see Key decisions and WeaponRefinementEffect/
  WeaponRefinementValue below. Seed excludes 1★/2★ weapons (no meaningful
  build relevance) and the Prized Isshin Blade (story-quest-only, never
  obtainable as a real player weapon).
- WeaponRefinementEffect — child rows (weaponId, refinement, description)
  holding the raw passive text for one refinement level. Barely used now:
  almost every weapon's passive is instead represented by
  `Weapon.passiveDescriptionTemplate` + WeaponRefinementValue (see Key
  decisions), and this table only holds rows for the rare weapon whose
  refinement text can't be templated at all (currently just Exaiphanes
  Blade, whose passive gains an entire extra clause starting at R2 that R1
  doesn't have — a genuine structural difference, not a reworded number).
- WeaponRefinementValue — one row per `{n}` placeholder in a weapon's
  `passiveDescriptionTemplate`: `curveType` (Linear or Custom, see Key
  decisions), `baseValue`, `slope` (Linear only, added per refinement
  step), `customValues` (Custom only, the raw known values). A number that
  never changes across refinements gets no row at all — it's baked into
  the template as plain text.
- WeaponStatBonus — same idea as TalentStatBonus, for the subset of weapon
  passives that grant an unconditional stat-screen bonus, plus a
  `refinement` column since that bonus (when one exists) almost always
  scales by refinement too, same as the passive text does.
- ArtifactSet — all artifact sets (name, fixed rarity, 2-piece/4-piece effect
  text, one icon URL column per slot: `flowerIconUrl`, `featherIconUrl`,
  `sandsIconUrl`, `gobletIconUrl`, `circletIconUrl` — not one column per set,
  since each slot has visually distinct art within the same set and these
  render on the build page). Sets with only a 1-piece effect, and sets that
  never drop above 3★ (Adventurer, Lucky Dog, Traveling Doctor — same "no
  meaningful build relevance" reasoning as the weapon rarity cutoff), are
  simply absent from artifact-sets.json; this repo's seed.ts does no
  filtering of its own (see Key decisions).
- ArtifactSetStatBonus — optional child rows (artifactSetId, piece: TWO |
  FOUR, statTypeId, value) for the subset of 2pc/4pc effects that are
  unconditional stat bonuses. Almost always true for 2pc effects; rarely
  true for 4pc, since most 4pc effects are conditional/proc-based and stay
  text-only, excluded from any computed total — same reasoning as
  TalentStatBonus/WeaponStatBonus/ConstellationStatBonus, applied to
  artifacts.
- StatType — shared pool of stat types: the full wiki-documented attribute
  list (Crit Rate%, Crit DMG%, ATK%/HP%/DEF% and flat, EM, Energy Recharge%,
  Healing Bonus%/Incoming Healing Bonus%, elemental + Physical DMG Bonus%,
  RES% (all 8), Shield Strength%, Cooldown Reduction%), not just what's
  currently summed into a computed total — see Key decisions. Used by
  weapon secondary stats, artifact main/substats, and the various
  `*StatBonus` child tables above.

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
- Master data (Character, Weapon, ArtifactSet, StatType and all their child
  tables) is sourced entirely from `data-source/{characters,weapons,
  artifact-sets,stat-types}.json` — hand-maintained JSON that a separate
  Claude session curates directly against Lunaris, Project Amber, and HoYoWiki
  for each game update (handoff notes and the full curve/formula reference
  live in `data-source/`, e.g. `master-data-formulas.txt`). `prisma/seed.ts`
  only imports this JSON into Postgres; genshin-db is no longer a dependency
  anywhere in this project, and the script does zero re-derivation, filtering,
  rarity-cutoff logic, or text-fixing of its own — all of that already
  happened upstream, in the JSON. Top-level tables (Character, Weapon,
  ArtifactSet, StatType) are upserted BY ID, never by name — critical because
  a row can be renamed in place (e.g. the Traveler gender split below), and a
  name-keyed upsert would miss that and create a duplicate instead of
  recognizing the rename. Child tables (Talent, TalentAttribute,
  TalentStatBonus, Constellation, ConstellationStatBonus,
  WeaponRefinementEffect, WeaponRefinementValue, WeaponStatBonus,
  ArtifactSetStatBonus) are deleted and recreated fresh, scoped to their
  parent, each time — but this does NOT mean every child row gets a new id.
  The recreate step passes each row's known id explicitly, and Postgres
  honors that on insert regardless of the preceding delete, so a row that
  already had a known id comes back with that EXACT same id (verified
  directly: a pre-existing character's talent/attribute/constellation ids
  were unchanged after a reseed). Only a genuinely new row's `id` is marked
  `"UNKNOWN"` in the JSON (the curating session has no way to know what
  Postgres will assign); `resolveId()` turns that into `id: undefined` on
  create, which Prisma treats as "field not specified" and falls through to
  the real autoincrement default — verified live before trusting it
  broadly. Every table seeded with
  explicit ids gets its sequence reset
  (`setval(pg_get_serial_sequence(...), MAX(id))`) after import, so a later
  autoincrement-assigned id can't collide with one of these explicit inserts.
  Foreign keys into StatType (`ascensionStatId`, `secondaryStatId`, every
  `*StatBonus.statTypeId`) are resolved via the JSON's nested `{id, name}`
  object's `name`, through a name→id map built from stat-types.json — not
  the raw numeric id, to avoid assuming cross-file id consistency. None of
  this ever touches owned-side tables (OwnedCharacter/OwnedWeapon/
  OwnedArtifact/Build/...), which point at master data by plain foreign key
  with no cascade — safe by construction, since master-data ids are
  preserved across reseeds rather than dropped and recreated.
- Traveler is modeled as one `Character` row per (element, gender) combination
  — 14 rows total (7 elements × 2 genders) — reversing an earlier decision to
  collapse gender into element-only rows. That earlier collapse assumed gender
  affects only appearance/voice, never stats, talents, or kit; the
  hand-maintained master data surfaced a real, confirmed counterexample —
  Aether's and Lumine's Normal Attack "Charged Attack DMG (Part 2)" talent
  value genuinely differs (0.60716 vs 0.7224) — so gender is now a
  first-class axis, not folded away. Names: `"Traveler (<Female|Male>)
  (<Element>)"`.
  The catch this exists to solve: only one Traveler can ever be in a party
  regardless of element or gender, and the base uniqueness constraint doesn't
  know all 14 rows are related. Fixed with a nullable `exclusivityGroup`
  field on `Character`: null for every normal character (no behavior change),
  set to the single shared value `"traveler"` for all 14 rows. Team/Roster
  composition checks (both the live warning during build selection and full
  validation) must also block on a shared non-null `exclusivityGroup` between
  builds already present, not just on owned_character_id. If a future
  character rework ever needs the same mechanic, reuse this field rather
  than adding a special case — it's intentionally not named after Traveler
  specifically.
- Level, ascension phase, and ownership belong to the Traveler protagonist
  as a whole, not to any one elemental form — there's only one adventurer
  with one growth state, who happens to have 7 elemental kits layered on
  top. `setCharacterOwnership`/`updateCharacterProgression`
  (characters/actions.ts) resolve the editing character's shared name
  prefix (`travelerGenderGroup()` in character-scaling.ts — "Traveler
  (Female)"/"Traveler (Male)") and fan level/ascensionPhase/isOwned out to
  every `OwnedCharacter` row sharing it, in one transaction. Constellation
  and the 3 combat-talent levels stay per-element on purpose (each element
  really does have its own kit, unlocked/leveled independently in-game) —
  only `level`/`ascensionPhase`/`isOwned` sync.
  Weapon and artifacts need no equivalent mechanism: `OwnedWeapon`/
  `OwnedArtifact` are already account-wide (keyed by `gameProfileId`, never
  by `characterId`) and only become associated with a specific element
  once placed into that element's own `Build` — nothing stops a user from
  putting the same owned weapon/artifacts into multiple elements' Builds
  manually today, which already matches the real mechanic without needing
  enforced syncing.
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
  set per piece when adding it) to `ArtifactSet` (fixed, part of the
  hand-maintained master data). Real in-game sets have a fixed max rarity — Instructor, The
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
- StatType's vocabulary covers the full wiki-documented attribute list
  (https://genshin-impact.fandom.com/wiki/Attribute), not just the stats
  currently summed into a computed total — RES% (all 8: Physical + 7
  elements), Shield Strength%, Cooldown Reduction%, and Incoming Healing
  Bonus% are real, seeded StatType rows even though nothing sums them into
  a final-stats total yet (that module doesn't exist yet — see build order
  step 8). Stamina is the one wiki "Basic Stat" deliberately excluded: it's
  a global player resource raised only by world exploration, never by any
  character/weapon/artifact/talent/constellation, so no row here could ever
  reference it. RES%/Shield Strength% already have real ArtifactSetStatBonus
  rows from current 2pc effects (Lavawalker/Thundersoother's elemental RES,
  Retracing Bolide's Shield Strength); Cooldown Reduction%/Incoming Healing
  Bonus% don't yet — nothing currently seeded happens to grant either.
- A small number of characters have a constant, always-on Elemental Mastery
  floor outside the normal ascension system entirely, confirmed on the wiki
  (Attribute page): "Elemental Mastery starts at 0 for most playable
  characters, excluding Lauma and Nefer whose Elemental Mastery begin at
  200 and 100 respectively." Modeled as a single scalar column,
  `Character.baseElementalMastery` (default 0), not a general "innate
  constant stat" mechanism — the wiki only documents this exception for
  Elemental Mastery specifically, so a narrower, single-stat column matches
  what's actually confirmed rather than speculatively generalizing.
  Additive with any ascension-stat EM bonus (Lauma's own ascension stat IS
  Elemental Mastery, so she has both at once). Now just a plain field in
  characters.json like any other — no seed-time special-casing.
- Character/weapon base HP/ATK/DEF and secondary/ascension stat values are
  computed on demand from a small set of base + max-ascension scalars
  (`Character.baseHp`/`baseAttack`/`baseDefense`/`maxAscensionHp`/etc.,
  `Weapon.baseAttack`/`baseSecondaryStatValue`) plus a small set of shared
  level/ascension multiplier tables (`src/lib/character-scaling.ts`,
  `src/lib/weapon-scaling.ts`) — not stored as a per-level lookup table.
  This replaced an earlier design (one row per character/weapon per
  (level, ascension phase), sampled from genshin-db's own `stats(level,
  ascension)` at seed time — the original CharacterLevelStat/
  WeaponLevelStat tables, since dropped) once wiki research showed the
  game's real internal architecture already works this way: a small number
  of shared curves keyed by rarity/tier, not unique data per character/
  weapon. Verified to 100% agreement against an independently wiki-sourced
  formula (12,192 character rows, 23,232 weapon rows, 0 mismatches) before
  the per-level tables were dropped; see data-source/ for the wiki source
  reports and verification scripts kept alongside the master-data JSON
  exports. Two real, previously-undetected exceptions surfaced by this
  cross-checking are now explicitly modeled rather than worked around:
  Traveler's stored rarity (5, for banner/catalog purposes) differs from
  its actual stat-growth curve (4★, since it's a free character) —
  `characterScalingRarity()` in character-scaling.ts; and Sword of
  Descension (a real, player-obtainable PS4/5-exclusive weapon, not
  story-exclusive) draws its ATK curve from a different rarity tier than
  its own stored rarity, via `Weapon.attackCurveRarity`.
- Combat talent numbers need our own display logic: each labeled attribute
  (e.g. "1-Hit DMG") is classified into one of a small set of named
  level-scaling curves (the same kind of curve-based compaction as the stat
  values above) and stored as `curveType` + `baseValue` (plus
  `linearSlope`/`capLevel` for the Linear family, or `customValues` as a raw
  fallback for the handful of genuine one-off curves, e.g. Beidou/Zhongli/
  Yoimiya) rather than all 15 raw per-level values. That classification
  happens upstream now, in characters.json itself (see Key decisions
  above on the JSON-import architecture) — `src/lib/talent-scaling.ts` only
  reconstructs a value from the already-classified curve at display time,
  alongside `formatCode` saying how to render it (e.g. one decimal, as a
  percentage). Neither of these numbers is ever used in a stat or damage
  total, only rendered as text.
- Weapon passive text originally stored genshin-db's own fully-rendered
  description per refinement level directly (`r1..r5`, one
  WeaponRefinementEffect row each) on the theory that no templating was
  needed since genshin-db already did the rendering. Wiki/anecdotal
  research suggested otherwise: the numbers that change between
  refinements usually do so in simple, evenly-spaced steps, meaning most
  of that text is actually a single shared template repeated 5 times with
  only a few numbers swapped. Verified directly against all 242 seeded
  weapons' real refinement text before switching: of 974 numeric tokens
  across weapons with consistent wording, 525 never change at all (no row
  needed, just baked into the template as plain text), 444 scale perfectly
  linearly, and only 5 are genuine irregular exceptions (kept via a
  `Custom` raw-value fallback, same treatment as TalentAttribute's own
  `Custom`) — verified once against every seeded weapon's real text, the
  one-off verification scripts since removed (their job was superseded by
  the JSON-import architecture above). A further 13 weapons have pure
  copy-editing inconsistencies between refinement tiers that don't affect
  any number (e.g. "an opponent" vs "an enemy", a missing "the") — the
  template's wording is always taken from the LAST known refinement rather
  than the first, which loses nothing since the drift is never a meaning
  change (verified per-weapon the same way). Only 1
  weapon (Exaiphanes Blade) is a genuine structural exception — an entire
  clause exists starting at R2 that R1 doesn't have at all — and keeps the
  original per-refinement WeaponRefinementEffect rows instead of a
  template. Separately, 3 weapons (Kagotsurube Isshin, Predator, Sword of
  Descension) turned out to only have R1 text in genshin-db's data at all
  (not an in-game restriction — a genshin-db gap); rather than silently
  showing no passive text past R1 (the previous, undetected behavior),
  `Weapon.maxRefinement` caps what the app lets a player set/see for these
  3 specifically. This template/value-curve split now happens upstream too,
  in weapons.json itself (see Key decisions above) — `src/lib/
  weapon-refinement-scaling.ts` only reconstructs display text from the
  already-classified template + curves at read time.
- Levels 95 and 100 exist for characters (not weapons — `src/lib/
  weapon-scaling.ts`'s level-multiplier table stops at 90, confirmed
  character-only), both reachable only at the final ascension phase (there's
  no phase 7 to require re-ascending past 90); levels 91-94 and 96-99 don't
  exist at all. Deliberately NOT implemented by changing `src/lib/
  ascension.ts`'s shared `MAX_LEVEL`/`validAscensionPhasesForLevel`/
  `maxLevelForAscensionPhase` in place — those are shared with weapons (see
  `owned-weapon-manager.tsx` and `weapons/schemas.ts`), which must stay
  capped at exactly 90. Instead, a parallel set of character-only exports
  (`CHARACTER_MAX_LEVEL`, `isValidCharacterLevel`,
  `validAscensionPhasesForCharacterLevel`, `isValidCharacterLevelAscension`,
  `characterMaxLevelForAscensionPhase`) extends only phase 6's ceiling from
  90 to 100, leaving every weapon-facing export byte-for-byte unchanged. The
  character level editor's `<input type="range">` can't represent the 90→95
  gap on its own, so it stays capped at 90 and two separate buttons (shown
  only at ascension phase 6) jump straight to 95/100.
- Traveler's permanent story-quest buff (+50 flat base HP / +10 flat base
  ATK / +15 flat base Elemental Mastery, confirmed real but with values as
  given by the user rather than independently verified against a game
  source) is NOT stored in `characters.json` and never added to
  `baseHp`/`baseAttack` themselves (which get multiplied by the level
  curve) — it's applied as a flat addition after `computeCharacterMainStat`/
  `computeCharacterBonusStat`, in `travelerStoryBuffBonus()`
  (`src/lib/character-scaling.ts`), wired into the one place base stats are
  currently displayed (`owned-character-manager.tsx`'s `BaseStatsSection`).
  Applied unconditionally for every Traveler row rather than gated behind a
  quest-completion flag — this app models no other quest state anywhere,
  and the quest itself is early and effectively unmissable for any player
  with a build worth tracking.
- Exaiphanes Blade has a special leveling mechanic tied to an in-game
  "statues unlocked" counter — level, ascension phase, and refinement
  aren't independently settable for this one weapon, only 7 specific
  combinations are valid (a theoretical state 7 exists but its values are
  still unknown, so it's deliberately not offered). Not a stored field,
  same treatment as the Traveler buff: `EXAIPHANES_BLADE_STATES` and
  `isExaiphanesBlade()` in `src/lib/weapon-scaling.ts`. In
  `owned-weapon-manager.tsx`'s progression editor, this one weapon swaps
  its normal independent level slider / ascension diamonds / refinement
  slider for a single "Statues Unlocked" diamond selector (0-6) that sets
  all three together — ATK, secondary stat, and passive text still come
  from the ordinary formulas at whichever state is picked, nothing else
  about this weapon is special.
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
3. Master/reference data: Character, Weapon, ArtifactSet, StatType — seed from
   hand-maintained master-data JSON (`data-source/`)
4. Owned inventory CRUD: character roster toggle, weapon add (with refinement),
   artifact add (with substats) — establishes reusable list/filter/sort/search
   patterns for all three pages
5. Builds — compose owned character + weapon + artifacts
6. Master data completeness: per-level character/weapon stats (originally
   CharacterLevelStat/WeaponLevelStat snapshot tables, later compacted into
   base+ascension scalars — see Key decisions), Talent + TalentAttribute,
   Constellation, WeaponRefinementEffect, and the four `*StatBonus` tables —
   master data only, no owned-side fields yet
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
  and Fischl are reported to have their own equivalents). Originally shelved
  because genshin-db (the project's only data source at the time) had zero
  coverage of these, and wiring in a second live source for a handful of
  characters wasn't worth it. That blocker no longer applies: master data
  now comes from a Claude session reading Lunaris/Project Amber/HoYoWiki
  directly (see Key decisions), and characters.json already contains
  "Witch's Eve Rite"/Hexerei text, confirmed present. Still not verified:
  whether it's modeled with the right conditional-unlock semantics
  (quest-gated, party-composition-gated) or just imported as an ordinary
  Passive talent row, which may not be enough to represent "active only
  with 2+ Hexerei party members." Revisit before treating this as done.

## Priorities for this project
- Portfolio piece for job interviews: prefer code that's easy to explain over
  clever abstractions or black-box magic.
- Build incrementally, one phase at a time, reviewed before moving to the next.
- The overlap-detection logic and the master-vs-owned data split are the most
  interesting, most-likely-to-come-up-in-interviews parts of this project —
  worth extra care in implementation.