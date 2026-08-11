import { z } from "zod";

export const CreateBuildInputSchema = z.object({
  ownedCharacterId: z.number().int().positive(),
  name: z.string().trim().min(1, "Name is required.").max(50, "Name must be 50 characters or fewer."),
  ownedWeaponId: z.number().int().positive().nullable(),
  artifacts: z
    .array(
      z.object({
        slot: z.enum(["Flower", "Feather", "Sands", "Goblet", "Circlet"]),
        ownedArtifactId: z.number().int().positive(),
      })
    )
    .max(5),
});

export type CreateBuildInput = z.infer<typeof CreateBuildInputSchema>;

export type CreateBuildErrors = {
  ownedCharacterId?: string[];
  name?: string[];
};
