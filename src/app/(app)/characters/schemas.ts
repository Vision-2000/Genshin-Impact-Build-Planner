import { z } from "zod";
import { TalentSlot } from "@/generated/prisma/enums";
import { MIN_LEVEL, CHARACTER_MAX_LEVEL, MAX_ASCENSION_PHASE, isValidCharacterLevelAscension } from "@/lib/ascension";

export const MIN_CONSTELLATION = 0;
export const MAX_CONSTELLATION = 6;

// The in-game cap for a combat talent's level via normal talent materials.
// TalentAttribute (see prisma/schema.prisma) stores values up to level 15
// since genshin-db includes the (rarely relevant) boosted levels used for
// Trial/Abyss characters, but a real owned character can't invest past 10
// through ordinary play.
export const MIN_TALENT_LEVEL = 1;
export const MAX_TALENT_LEVEL = 10;

// Constellations 3 and 5 always grant +3 to whichever combat talent their
// own boostedTalentSlot says (resolved per-character at seed time -- see
// prisma/seed.ts's findBoostedTalentSlot) -- shifts both ends of that one
// talent's valid range up by 3 once the relevant constellation is unlocked.
export const TALENT_LEVEL_CONSTELLATION_BOOST = 3;

export type TalentLevelBounds = { min: number; max: number };

// Computes the valid level range for each of the 3 combat talents given how
// many constellations are unlocked and which (if any) of this character's
// constellations boost which talent. Used both server-side (to validate a
// submitted level actually falls in range) and client-side (so the editor's
// sliders reflect the real range as the constellation selector changes).
export function computeTalentLevelBounds(
  constellation: number,
  constellations: { number: number; boostedTalentSlot: TalentSlot | null }[]
): { normalAttackLevel: TalentLevelBounds; skillLevel: TalentLevelBounds; burstLevel: TalentLevelBounds } {
  const boostedSlots = new Set(
    constellations
      .filter((c) => c.number <= constellation && c.boostedTalentSlot !== null)
      .map((c) => c.boostedTalentSlot)
  );

  function bounds(slot: TalentSlot): TalentLevelBounds {
    const boost = boostedSlots.has(slot) ? TALENT_LEVEL_CONSTELLATION_BOOST : 0;
    return { min: MIN_TALENT_LEVEL + boost, max: MAX_TALENT_LEVEL + boost };
  }

  return {
    normalAttackLevel: bounds(TalentSlot.NormalAttack),
    skillLevel: bounds(TalentSlot.Skill),
    burstLevel: bounds(TalentSlot.Burst),
  };
}

// level/ascensionPhase can't be validated independently (see the matching
// weapon schema for why), and the 3 talent levels' valid ranges depend on
// the submitted constellation count -- so this is a factory rather than a
// fixed schema, built fresh per request from bounds computed server-side
// (never trust client-computed bounds).
export function createUpdateCharacterProgressionSchema(talentLevelBounds: {
  normalAttackLevel: TalentLevelBounds;
  skillLevel: TalentLevelBounds;
  burstLevel: TalentLevelBounds;
}) {
  return z
    .object({
      level: z.number().int().min(MIN_LEVEL).max(CHARACTER_MAX_LEVEL),
      ascensionPhase: z.number().int().min(0).max(MAX_ASCENSION_PHASE),
      constellation: z.number().int().min(MIN_CONSTELLATION).max(MAX_CONSTELLATION),
      normalAttackLevel: z
        .number()
        .int()
        .min(talentLevelBounds.normalAttackLevel.min)
        .max(talentLevelBounds.normalAttackLevel.max),
      skillLevel: z.number().int().min(talentLevelBounds.skillLevel.min).max(talentLevelBounds.skillLevel.max),
      burstLevel: z.number().int().min(talentLevelBounds.burstLevel.min).max(talentLevelBounds.burstLevel.max),
    })
    .refine((data) => isValidCharacterLevelAscension(data.level, data.ascensionPhase), {
      message: "This ascension phase isn't valid for this level.",
      path: ["ascensionPhase"],
    });
}

export type UpdateCharacterProgressionInput = {
  level: number;
  ascensionPhase: number;
  constellation: number;
  normalAttackLevel: number;
  skillLevel: number;
  burstLevel: number;
};

export type UpdateCharacterProgressionErrors = {
  level?: string[];
  ascensionPhase?: string[];
  constellation?: string[];
  normalAttackLevel?: string[];
  skillLevel?: string[];
  burstLevel?: string[];
};
