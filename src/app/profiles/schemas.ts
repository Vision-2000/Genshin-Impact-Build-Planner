import { z } from "zod";

export const CreateProfileSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(50, "Name must be 50 characters or fewer."),
  uid: z.string().trim().max(20, "UID must be 20 characters or fewer.").optional(),
});

export type CreateProfileFormState =
  | {
      errors?: { name?: string[]; uid?: string[] };
    }
  | undefined;
