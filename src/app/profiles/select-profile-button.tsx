"use client";

import { selectProfile } from "./actions";

export function SelectProfileButton({ profileId }: { profileId: number }) {
  return (
    <form action={selectProfile.bind(null, profileId)}>
      <button type="submit" className="text-sm underline">
        Use this profile
      </button>
    </form>
  );
}
