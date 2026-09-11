"use client";

import { useState } from "react";
import Image from "next/image";
import { WeaponType } from "@/generated/prisma/enums";
import { rarityGradientClasses } from "@/lib/rarity-colors";
import { WEAPON_TYPE_ICON_URL } from "@/lib/weapon-type-icons";
import { Modal } from "@/components/modal";
import type { OwnedWeaponOption } from "./filter-sort";

// Replaces a plain <select> -- a dropdown only has room for a weapon's name
// and refinement, which is enough to tell weapons apart, but the slot+modal
// pattern here exists mainly for parity with ArtifactSlotPicker (a select
// genuinely isn't enough there) and to give both a consistent feel.
export function WeaponSlotPicker({
  weaponType,
  weapons,
  value,
  onChange,
}: {
  weaponType: WeaponType;
  weapons: OwnedWeaponOption[];
  value: number | null;
  onChange: (ownedWeaponId: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const options = weapons.filter((w) => w.weaponType === weaponType);
  const selected = value !== null ? options.find((w) => w.ownedWeaponId === value) : undefined;
  const filtered = options.filter((w) => w.name.toLowerCase().includes(search.trim().toLowerCase()));

  function select(ownedWeaponId: number | null) {
    onChange(ownedWeaponId);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={selected ? `${selected.name} (R${selected.refinement})` : "Choose weapon"}
        className={`relative flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 border-white p-1 hover:opacity-90 ${
          selected ? rarityGradientClasses(selected.rarity) : "bg-foreground/10"
        }`}
      >
        {selected ? (
          selected.iconUrl && <Image src={selected.iconUrl} alt="" width={104} height={104} />
        ) : (
          <>
            <Image
              src={WEAPON_TYPE_ICON_URL[weaponType]}
              alt=""
              fill
              className="object-contain p-1 opacity-30"
            />
            <svg
              viewBox="0 0 16 16"
              width={64}
              height={64}
              className="relative text-foreground [animation:blink_2.5s_ease-in-out_infinite]"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M8 2v12M2 8h12" />
            </svg>
          </>
        )}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Choose weapon">
        <div className="space-y-3">
          <input
            type="text"
            autoFocus
            placeholder="Search by name..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded border bg-white px-3 py-2 text-sm text-black"
          />
          <ul className="max-h-96 space-y-1 overflow-y-auto">
            <li>
              <button
                type="button"
                onClick={() => select(null)}
                className="flex w-full items-center gap-3 rounded p-2 text-left text-sm hover:bg-black/5"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-foreground/10 text-gray-400">
                  —
                </div>
                None
              </button>
            </li>
            {filtered.map((weapon) => (
              <li key={weapon.ownedWeaponId}>
                <button
                  type="button"
                  onClick={() => select(weapon.ownedWeaponId)}
                  className="flex w-full items-center gap-3 rounded p-2 text-left hover:bg-black/5"
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded p-1 ${rarityGradientClasses(weapon.rarity)}`}
                  >
                    {weapon.iconUrl && <Image src={weapon.iconUrl} alt="" width={32} height={32} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{weapon.name}</p>
                    <p className="text-xs text-gray-500">
                      {weapon.rarity}★ · R{weapon.refinement}
                    </p>
                  </div>
                </button>
              </li>
            ))}
            {filtered.length === 0 && <p className="p-2 text-sm text-gray-500">No weapons match this search.</p>}
          </ul>
        </div>
      </Modal>
    </>
  );
}
