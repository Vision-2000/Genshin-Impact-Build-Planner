import { z } from "zod";
import { MIN_LEVEL, MAX_LEVEL, MAX_ASCENSION_PHASE, isValidLevelAscension } from "@/lib/ascension";

// level and ascensionPhase can't be validated independently -- a level can
// only be at one of at most two ascension phases (see
// src/lib/ascension.ts), so this cross-field .refine() is what actually
// enforces that instead of just bounds-checking each field alone.
export const UpdateWeaponProgressionInputSchema = z
  .object({
    level: z.number().int().min(MIN_LEVEL).max(MAX_LEVEL),
    ascensionPhase: z.number().int().min(0).max(MAX_ASCENSION_PHASE),
  })
  .refine((data) => isValidLevelAscension(data.level, data.ascensionPhase), {
    message: "This ascension phase isn't valid for this level.",
    path: ["ascensionPhase"],
  });

export type UpdateWeaponProgressionInput = z.infer<typeof UpdateWeaponProgressionInputSchema>;

export type UpdateWeaponProgressionErrors = {
  level?: string[];
  ascensionPhase?: string[];
};
