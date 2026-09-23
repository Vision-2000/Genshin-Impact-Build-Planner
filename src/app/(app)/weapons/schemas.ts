import { z } from "zod";
import { MIN_LEVEL, MAX_LEVEL, MAX_ASCENSION_PHASE, isValidLevelAscension } from "@/lib/ascension";

export const MIN_REFINEMENT = 1;
export const MAX_REFINEMENT = 5;

// level and ascensionPhase can't be validated independently -- a level can
// only be at one of at most two ascension phases (see
// src/lib/ascension.ts), so this cross-field .refine() is what actually
// enforces that instead of just bounds-checking each field alone.
// Refinement folded in here too (rather than staying its own
// updateWeaponRefinement action) now that the progression editor edits all
// three together, same as Characters' one combined save.
export const UpdateWeaponProgressionInputSchema = z
  .object({
    level: z.number().int().min(MIN_LEVEL).max(MAX_LEVEL),
    ascensionPhase: z.number().int().min(0).max(MAX_ASCENSION_PHASE),
    refinement: z.number().int().min(MIN_REFINEMENT).max(MAX_REFINEMENT),
  })
  .refine((data) => isValidLevelAscension(data.level, data.ascensionPhase), {
    message: "This ascension phase isn't valid for this level.",
    path: ["ascensionPhase"],
  });

export type UpdateWeaponProgressionInput = z.infer<typeof UpdateWeaponProgressionInputSchema>;

export type UpdateWeaponProgressionErrors = {
  level?: string[];
  ascensionPhase?: string[];
  refinement?: string[];
};
