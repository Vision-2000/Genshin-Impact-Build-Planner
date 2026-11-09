# Genshin Impact Build Planner

A full-stack web app for tracking owned Genshin Impact characters, weapons, and
artifacts, assembling builds and teams, and catching conflicts (shared
weapons/artifacts, duplicate characters) before they happen in-game.

Genshin Impact has no in-game way to save a character build, so switching a
character between roles —e.g. a DPS set for one team, a support set for another —
means re-equipping its artifacts from memory every time, which gets tedious
fast for any player who keeps multiple builds per character. If weapons and 
artifacts are shared across characters, the player might not notice until 
actually trying to equip for an upcoming Spiral Abyss or Imaginarium Theater run. 
This project solves these problems: builds are saved per character and reused
instead of rebuilt from scratch, Teams/Groups/Collections flag shared-
resource conflicts live while you're assembling them instead of after you've
already committed. You can also make your daily farming easier to plan by looking
at the teams/builds and finding out which part needs improvements.

**Live demo:** _to be added_

> Unofficial fan project. Not affiliated with or endorsed by HoYoverse.

## Features

- **Owned inventory** — track every character, weapon, and artifact you own,
  with full level/ascension/refinement/substat detail
- **Builds** — pair an owned character with a weapon and up to 5 artifacts,
  see computed final stats
- **Collections** — save a combination of builds with conflict detection, useful 
  for planning builds for Imaginarium Theater runs
- **Teams** — assemble up to 4 builds per team with conflict detection while 
  you pick
- **Groups** — save a combination of teams meant to be run together, meant for 
  Spiral Abyss and Stygian Onslaught 

## Planned features

- **Per-content validation rules** — e.g. Imaginarium Theater's seasonal
  3-element and guest-character restrictions, enforced automatically on a Group
- **Home page dashboard** — an at-a-glance task/reminder list instead of
  landing straight on Characters

## Tech stack

- **Next.js** (App Router, Server Components/Actions) + **React** + **TypeScript**
- **PostgreSQL** (hosted on [Neon](https://neon.tech)) via **Prisma ORM**
- **Tailwind CSS v4**
- **Vitest** for unit tests
- Deployed on **Vercel**

## Getting started

```bash
git clone https://github.com/Vision-2000/Genshin-Impact-Build-Planner.git
cd Genshin-Impact-Build-Planner
npm install
cp .env.example .env   # fill in your own DATABASE_URL (e.g. a free Neon project)
npx prisma migrate dev
npx prisma db seed     # imports the master data into your db
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) and create an account.

### Scripts

| Command                 | Description                                  |
| ------------------------ | --------------------------------------------- |
| `npm run dev`            | Start the dev server                          |
| `npm run build`          | Production build                              |
| `npm test`               | Run the test suite (Vitest)                   |
| `npm run lint`           | Lint the codebase (ESLint)                    |
| `npx tsc --noEmit`       | Type-check without emitting output            |

## Notable implementation details

- **`src/lib/overlap.ts`** — one generic conflict-detection function shared
  across Teams, Groups, and Collections, rather than reimplementing
  duplicate-character/shared-weapon/shared-artifact checks per screen.
- **Master vs. owned data split** — `Character`/`Weapon`/`ArtifactSet` are
  static, shared reference data seeded once from hand-maintained JSON
  (`data-source/`); `OwnedCharacter`/`OwnedWeapon`/`OwnedArtifact` are the
  per-user data that actually changes. Per-level/per-refinement stat and
  talent values are computed on demand from a small set of shared curves
  (`src/lib/character-scaling.ts`, `weapon-scaling.ts`, `talent-scaling.ts`)
  rather than stored as one row per level — see `CLAUDE.md` for the full
  reasoning and the formula reference in `data-source/master-data-formulas.txt`.
- **`prisma/seed.ts`** imports already-classified JSON, with a verification script
  (`data-export/verify-reseed.mts`) confirming every reseed is lossless.
