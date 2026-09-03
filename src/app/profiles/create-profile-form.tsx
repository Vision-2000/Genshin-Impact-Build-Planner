"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createProfile } from "./actions";

export function CreateProfileForm() {
  const [state, formAction, pending] = useActionState(createProfile, undefined);

  // React resets every uncontrolled field in the form once the action
  // promise resolves -- including on a validation failure, since the action
  // itself didn't throw, it just returned errors. Keeping `name` controlled
  // opts it out of that reset; `uid` stays uncontrolled since resetting it
  // on every submit (success or failure) is the behavior we want.
  const [name, setName] = useState("");
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state?.errors) {
      setName("");
    }
    wasPending.current = pending;
  }, [pending, state]);

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
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Main account"
          className="mt-1 w-full rounded border px-3 py-2"
        />
        {state?.errors?.name && <p className="mt-1 text-sm text-red-600">{state.errors.name[0]}</p>}
      </div>
      <div>
        <label htmlFor="uid" className="block text-sm font-medium">
          UID (optional)
        </label>
        <input
          id="uid"
          name="uid"
          inputMode="numeric"
          maxLength={10}
          placeholder="e.g. 800000001"
          className="mt-1 w-full rounded border px-3 py-2"
        />
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
