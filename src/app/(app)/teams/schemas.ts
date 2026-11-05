import { z } from "zod";

export const CreateTeamSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(50, "Name must be 50 characters or fewer."),
});

export type CreateTeamErrors = {
  name?: string[];
};

// Same rule as CreateTeamSchema -- a group's own name field is the same
// kind of plain, user-typed label.
export const CreateGroupSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(50, "Name must be 50 characters or fewer."),
});

export type CreateGroupErrors = {
  name?: string[];
};
