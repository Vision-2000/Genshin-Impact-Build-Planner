import { z } from "zod";

export const CreateProfileSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(50, "Name must be 50 characters or fewer."),
  uid: z
    .string()
    .trim()
    .regex(/^\d{9,10}$/, "UID must be 9-10 digits.")
    .optional(),
});

export type CreateProfileFormState =
  | {
      errors?: { name?: string[]; uid?: string[] };
    }
  | undefined;
