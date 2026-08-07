"use client";

import { useActionState } from "react";
import { createProfile } from "./actions";

export function CreateProfileForm() {
  const [state, formAction, pending] = useActionState(createProfile, undefined);

  return (
    <form action={formAction} className="space-y-4 rounded border p-4">
      <h2 className="font-medium">Add a profile</h2>
      <div>
        <label htmlFor="name" className="block text-sm font-medium">
          Name
        </label>
        <input
          id="name"
          name="name"
          required
          placeholder="e.g. Main account"
          className="mt-1 w-full rounded border px-3 py-2"
        />
        {state?.errors?.name && <p className="mt-1 text-sm text-red-600">{state.errors.name[0]}</p>}
      </div>
      <div>
        <label htmlFor="uid" className="block text-sm font-medium">
          UID (optional)
        </label>
        <input id="uid" name="uid" className="mt-1 w-full rounded border px-3 py-2" />
        {state?.errors?.uid && <p className="mt-1 text-sm text-red-600">{state.errors.uid[0]}</p>}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
      >
        {pending ? "Adding..." : "Add profile"}
      </button>
    </form>
  );
}
