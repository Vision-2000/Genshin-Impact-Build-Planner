// Verification after a genshin-db -> hand-maintained-JSON reseed (see
// CLAUDE.md's Key decisions), now also reused as the actual gate behind
// the master-data-verify/master-data-sync GitHub Actions workflows --
// see their own comments for how. Checks three things against the LIVE db:
//   1. data-export/{characters,weapons,artifact-sets,stat-types}.json (a
//      fresh dump, produced by export-master-data.mts) is identical to
//      data-source/{same}.json EXCEPT at fields that were literally
//      "UNKNOWN" in the source -- those must now be a real resolved
//      integer id, and nothing else may differ.
//   2. Every resolved id is sane: unique within its own table, and strictly
//      greater than every previously-known id for that same table (i.e. a
//      genuinely fresh autoincrement value, not an accidental reuse).
//   3. Every table's autoincrement sequence is currently positioned so the
//      NEXT value it hands out won't collide with any row that already
//      exists -- read-only (pg_sequences), never calls nextval().
// Exits non-zero if any of the three fails -- a CI gate needs a real exit
// code, not just console output a human would otherwise have to read.
import "dotenv/config";
import fs from "fs";
import path from "path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const dataSourceDir = path.join(process.cwd(), "data-source");
const dataExportDir = path.join(process.cwd(), "data-export");

// Walking genuinely dynamic, ad hoc JSON shapes; precise typing would just
// be a wall of casts with no real safety benefit for a one-off diagnostic.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readJson(dir: string, fileName: string): any {
  return JSON.parse(fs.readFileSync(path.join(dir, fileName), "utf-8"));
}

type Issue = { path: string; src: unknown; exp: unknown };
type Resolved = { group: string; id: number };

const issues: Issue[] = [];
const resolved: Resolved[] = [];

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// Deep-compares one subtree, given which table's id-space it (and any "id"
// field found inside it) belongs to. `group` is passed down explicitly by
// the per-entity walkers below, which know the schema's actual shape --
// simpler and less error-prone than trying to infer it generically from
// key names alone.
function compare(src: unknown, exp: unknown, path: string, group: string | null) {
  if (src === "UNKNOWN") {
    if (typeof exp !== "number" || !Number.isInteger(exp)) {
      issues.push({ path, src, exp });
      return;
    }
    if (group) resolved.push({ group, id: exp });
    return;
  }

  if (Array.isArray(src)) {
    if (!Array.isArray(exp) || src.length !== exp.length) {
      issues.push({ path, src: `array(${Array.isArray(src) ? src.length : "?"})`, exp: Array.isArray(exp) ? `array(${exp.length})` : exp });
      return;
    }
    for (let i = 0; i < src.length; i++) compare(src[i], exp[i], `${path}[${i}]`, group);
    return;
  }

  if (isPlainObject(src)) {
    if (!isPlainObject(exp)) { issues.push({ path, src: "object", exp }); return; }
    const keys = new Set([...Object.keys(src), ...Object.keys(exp)]);
    for (const key of keys) {
      if (!(key in src)) { issues.push({ path: `${path}.${key}`, src: undefined, exp: (exp as Record<string, unknown>)[key] }); continue; }
      if (!(key in exp)) { issues.push({ path: `${path}.${key}`, src: (src as Record<string, unknown>)[key], exp: undefined }); continue; }
      // Only the object's OWN "id" belongs to `group` -- every other key
      // (notably FK-mirror fields like "characterId"/"talentId", which echo
      // the PARENT's not-yet-resolved id, not this row's own) must NOT be
      // tracked as a resolved id for this table, or it contaminates the
      // sanity check below with a different table's id range entirely.
      compare((src as Record<string, unknown>)[key], (exp as Record<string, unknown>)[key], `${path}.${key}`, key === "id" ? group : null);
    }
    return;
  }

  if (src !== exp) issues.push({ path, src, exp });
}

function compareCharacters() {
  const src = readJson(dataSourceDir, "characters.json");
  const exp = readJson(dataExportDir, "characters.json");
  if (src.length !== exp.length) { issues.push({ path: "characters.json (row count)", src: src.length, exp: exp.length }); return; }
  for (let i = 0; i < src.length; i++) {
    const s = src[i], e = exp[i];
    if (s.name !== e.name) { issues.push({ path: `characters.json[${i}] (name)`, src: s.name, exp: e.name }); continue; }
    for (const key of Object.keys(s)) {
      if (key === "talents") {
        for (let t = 0; t < s.talents.length; t++) {
          const st = s.talents[t], et = e.talents[t];
          for (const tk of Object.keys(st)) {
            if (tk === "attributes") compare(st.attributes, et.attributes, `characters[${i}].talents[${t}].attributes`, "talent_attributes");
            else if (tk === "statBonuses") compare(st.statBonuses, et.statBonuses, `characters[${i}].talents[${t}].statBonuses`, "talent_stat_bonuses");
            else compare(st[tk], et[tk], `characters[${i}].talents[${t}].${tk}`, tk === "id" ? "talents" : null);
          }
        }
      } else if (key === "constellations") {
        for (let c = 0; c < s.constellations.length; c++) {
          const sc = s.constellations[c], ec = e.constellations[c];
          for (const ck of Object.keys(sc)) {
            if (ck === "statBonuses") compare(sc.statBonuses, ec.statBonuses, `characters[${i}].constellations[${c}].statBonuses`, "constellation_stat_bonuses");
            else compare(sc[ck], ec[ck], `characters[${i}].constellations[${c}].${ck}`, ck === "id" ? "constellations" : null);
          }
        }
      } else if (key === "ascensionStat") {
        compare(s.ascensionStat, e.ascensionStat, `characters[${i}].ascensionStat`, "stat_types");
      } else {
        compare(s[key], e[key], `characters[${i}].${key}`, key === "id" ? "characters" : null);
      }
    }
  }
}

function compareWeapons() {
  const src = readJson(dataSourceDir, "weapons.json");
  const exp = readJson(dataExportDir, "weapons.json");
  if (src.length !== exp.length) { issues.push({ path: "weapons.json (row count)", src: src.length, exp: exp.length }); return; }
  for (let i = 0; i < src.length; i++) {
    const s = src[i], e = exp[i];
    if (s.name !== e.name) { issues.push({ path: `weapons.json[${i}] (name)`, src: s.name, exp: e.name }); continue; }
    for (const key of Object.keys(s)) {
      if (key === "refinementEffects") compare(s.refinementEffects, e.refinementEffects, `weapons[${i}].refinementEffects`, "weapon_refinement_effects");
      else if (key === "refinementValues") compare(s.refinementValues, e.refinementValues, `weapons[${i}].refinementValues`, "weapon_refinement_values");
      else if (key === "statBonuses") compare(s.statBonuses, e.statBonuses, `weapons[${i}].statBonuses`, "weapon_stat_bonuses");
      else if (key === "secondaryStat") compare(s.secondaryStat, e.secondaryStat, `weapons[${i}].secondaryStat`, "stat_types");
      else compare(s[key], e[key], `weapons[${i}].${key}`, key === "id" ? "weapons" : null);
    }
  }
}

function compareArtifactSets() {
  const src = readJson(dataSourceDir, "artifact-sets.json");
  const exp = readJson(dataExportDir, "artifact-sets.json");
  if (src.length !== exp.length) { issues.push({ path: "artifact-sets.json (row count)", src: src.length, exp: exp.length }); return; }
  for (let i = 0; i < src.length; i++) {
    const s = src[i], e = exp[i];
    if (s.name !== e.name) { issues.push({ path: `artifact-sets.json[${i}] (name)`, src: s.name, exp: e.name }); continue; }
    for (const key of Object.keys(s)) {
      if (key === "statBonuses") compare(s.statBonuses, e.statBonuses, `artifact-sets[${i}].statBonuses`, "artifact_set_stat_bonuses");
      else compare(s[key], e[key], `artifact-sets[${i}].${key}`, key === "id" ? "artifact_sets" : null);
    }
  }
}

function compareStatTypes() {
  const src = readJson(dataSourceDir, "stat-types.json");
  const exp = readJson(dataExportDir, "stat-types.json");
  if (src.length !== exp.length) { issues.push({ path: "stat-types.json (row count)", src: src.length, exp: exp.length }); return; }
  for (let i = 0; i < src.length; i++) {
    const s = src[i], e = exp[i];
    if (s.name !== e.name) { issues.push({ path: `stat-types.json[${i}] (name)`, src: s.name, exp: e.name }); continue; }
    compare(s.id, e.id, `stat-types[${i}].id`, "stat_types");
  }
}

compareCharacters();
compareWeapons();
compareArtifactSets();
compareStatTypes();

console.log("=== Part 1: JSON fidelity (source vs fresh DB export) ===");
console.log(`Unexpected differences: ${issues.length}`);
for (const iss of issues.slice(0, 40)) {
  console.log(`  ${iss.path}: src=${JSON.stringify(iss.src)} exp=${JSON.stringify(iss.exp)}`);
}
if (issues.length > 40) console.log(`  ... and ${issues.length - 40} more`);

console.log();
console.log("=== Part 2: resolved (previously UNKNOWN) id sanity ===");
const byGroup = new Map<string, number[]>();
for (const r of resolved) {
  if (!byGroup.has(r.group)) byGroup.set(r.group, []);
  byGroup.get(r.group)!.push(r.id);
}

// Previously-known max id per group, walked straight from source (skipping
// "UNKNOWN" entries), using the exact same per-entity shape knowledge as
// the comparers above.
const knownIds = new Map<string, number[]>();
function addKnown(group: string, id: unknown) {
  if (typeof id === "number") { if (!knownIds.has(group)) knownIds.set(group, []); knownIds.get(group)!.push(id); }
}
{
  const characters = readJson(dataSourceDir, "characters.json");
  for (const c of characters) {
    addKnown("characters", c.id);
    for (const t of c.talents) {
      addKnown("talents", t.id);
      for (const a of t.attributes) addKnown("talent_attributes", a.id);
      for (const sb of t.statBonuses) addKnown("talent_stat_bonuses", sb.id);
    }
    for (const con of c.constellations) {
      addKnown("constellations", con.id);
      for (const sb of con.statBonuses) addKnown("constellation_stat_bonuses", sb.id);
    }
  }
  const weapons = readJson(dataSourceDir, "weapons.json");
  for (const w of weapons) {
    addKnown("weapons", w.id);
    for (const re of w.refinementEffects) addKnown("weapon_refinement_effects", re.id);
    for (const rv of w.refinementValues) addKnown("weapon_refinement_values", rv.id);
    for (const sb of w.statBonuses) addKnown("weapon_stat_bonuses", sb.id);
  }
  const artifactSets = readJson(dataSourceDir, "artifact-sets.json");
  for (const a of artifactSets) {
    addKnown("artifact_sets", a.id);
    for (const sb of a.statBonuses) addKnown("artifact_set_stat_bonuses", sb.id);
  }
  const statTypes = readJson(dataSourceDir, "stat-types.json");
  for (const s of statTypes) addKnown("stat_types", s.id);
}

let idSanityOk = true;
for (const [group, ids] of byGroup) {
  const uniqueIds = new Set(ids);
  const dupes = ids.length - uniqueIds.size;
  const known = knownIds.get(group) ?? [];
  const maxKnown = known.length ? Math.max(...known) : 0;
  const minNew = Math.min(...ids);
  const maxNew = Math.max(...ids);
  const allAboveKnownMax = minNew > maxKnown;
  const ok = dupes === 0 && allAboveKnownMax;
  if (!ok) idSanityOk = false;
  console.log(
    `  ${group}: ${ids.length} newly-resolved ids, range [${minNew}, ${maxNew}], previous known max ${maxKnown}` +
      `${dupes > 0 ? ` -- DUPLICATES: ${dupes}` : ""}${!allAboveKnownMax ? " -- OVERLAPS PREVIOUS RANGE" : ""}`
  );
}
if (byGroup.size === 0) console.log("  (no previously-UNKNOWN ids found anywhere)");
console.log(idSanityOk ? "All resolved ids look sane." : "ISSUES FOUND in resolved id ranges -- see above.");

console.log();
console.log("=== Part 3: autoincrement sequence health (read-only) ===");

const TABLES = [
  "users", "game_profiles", "characters", "talents", "talent_attributes",
  "talent_stat_bonuses", "constellations", "constellation_stat_bonuses",
  "weapons", "weapon_refinement_effects", "weapon_refinement_values",
  "weapon_stat_bonuses", "artifact_sets", "artifact_set_stat_bonuses",
  "stat_types", "owned_characters", "owned_weapons", "owned_artifacts",
  "owned_artifact_substats", "builds", "build_artifacts", "teams",
  // rosters/roster_builds/lineups/lineup_teams renamed to
  // collections/collection_builds/groups/group_teams (see CLAUDE.md's Key
  // decisions on the Roster->Collection/Lineup->Group rename).
  "team_builds", "collections", "collection_builds", "groups", "group_teams",
];

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  let sequenceOk = true;
  for (const table of TABLES) {
    // pg_sequences (the system VIEW) has no is_called column -- only the
    // sequence relation itself, selected directly, exposes it. The
    // sequence's qualified name comes from Postgres itself (via a
    // hardcoded, not user-supplied, table name), so interpolating it into
    // the next query is safe.
    const nameRows = await prisma.$queryRawUnsafe<{ seqname: string }[]>(
      `SELECT pg_get_serial_sequence($1, 'id') as seqname`,
      table
    );
    const seqname = nameRows[0]?.seqname;
    const maxRows = await prisma.$queryRawUnsafe<{ max: bigint | null }[]>(`SELECT MAX(id) as max FROM "${table}"`);
    const maxId = maxRows[0]?.max === null || maxRows[0]?.max === undefined ? 0 : Number(maxRows[0].max);

    if (!seqname) {
      console.log(`  ${table}: NO SEQUENCE FOUND (unexpected)`);
      sequenceOk = false;
      continue;
    }
    const seqRows = await prisma.$queryRawUnsafe<{ last_value: bigint; is_called: boolean }[]>(
      `SELECT last_value, is_called FROM ${seqname}`
    );
    const { last_value, is_called } = seqRows[0];
    const nextVal = is_called ? Number(last_value) + 1 : Number(last_value);
    const safe = nextVal > maxId;
    if (!safe) sequenceOk = false;
    console.log(`  ${table}: max(id)=${maxId}, next sequence value=${nextVal}${safe ? "" : "  -- UNSAFE: would collide or has already collided"}`);
  }

  console.log();
  console.log(sequenceOk ? "All sequences are positioned safely ahead of their table's current max id." : "SEQUENCE ISSUES FOUND -- see above.");

  await prisma.$disconnect();

  console.log();
  console.log("=== Overall ===");
  console.log(`JSON fidelity issues: ${issues.length}`);
  console.log(`Resolved-id sanity: ${idSanityOk ? "OK" : "ISSUES"}`);
  console.log(`Sequence health: ${sequenceOk ? "OK" : "ISSUES"}`);

  if (issues.length > 0 || !idSanityOk || !sequenceOk) {
    console.log();
    console.log("FAILED -- see above.");
    process.exitCode = 1;
  }
}

main();
