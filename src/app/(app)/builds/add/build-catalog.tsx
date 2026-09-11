"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArtifactSlot, Element, WeaponType } from "@/generated/prisma/enums";
import { useToast, Toast } from "@/components/toast";
import { rarityGradientClasses } from "@/lib/rarity-colors";
import { WEAPON_TYPE_ICON_URL } from "@/lib/weapon-type-icons";
import { RarityFilterRow } from "@/components/rarity-filter-row";
import { SortDirectionToggle } from "@/components/sort-direction-toggle";
import type { SortDirection } from "@/lib/sort";
import { ELEMENT_ICON_URL } from "../../characters/element-icons";
import { createBuild } from "../actions";
import type { CreateBuildErrors } from "../schemas";
import type { OwnedArtifactOption, OwnedCharacterOption, OwnedWeaponOption } from "../filter-sort";

const SLOTS = Object.values(ArtifactSlot);
const ELEMENTS = Object.values(Element);
const WEAPON_TYPES = Object.values(WeaponType);
// Playable characters are only ever seeded at 4-5 star (see prisma/seed.ts).
const RARITIES = [5, 4];

type SlotSelections = Partial<Record<ArtifactSlot, number>>;

function toggleInSet<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function BuildCatalog({
  characters,
  weapons,
  artifacts,
}: {
  characters: OwnedCharacterOption[];
  weapons: OwnedWeaponOption[];
  artifacts: OwnedArtifactOption[];
}) {
  const [, startTransition] = useTransition();
  const { message, visible, showToast } = useToast();

  const [search, setSearch] = useState("");
  const [elementFilter, setElementFilter] = useState<Set<Element>>(new Set());
  const [weaponTypeFilter, setWeaponTypeFilter] = useState<Set<WeaponType>>(new Set());
  const [rarityFilter, setRarityFilter] = useState<Set<number>>(new Set());
  const [sortKey, setSortKey] = useState<"name" | "rarity">("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const query = search.trim().toLowerCase();
  const direction = sortDirection === "desc" ? -1 : 1;
  const filtered = characters
    .filter(
      (c) =>
        c.name.toLowerCase().includes(query) &&
        (elementFilter.size === 0 || elementFilter.has(c.element)) &&
        (weaponTypeFilter.size === 0 || weaponTypeFilter.has(c.weaponType)) &&
        (rarityFilter.size === 0 || rarityFilter.has(c.rarity))
    )
    .sort((a, b) => {
      if (sortKey === "rarity") {
        return direction * (a.rarity - b.rarity) || a.name.localeCompare(b.name);
      }
      return direction * a.name.localeCompare(b.name);
    });

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [weaponId, setWeaponId] = useState<number | null>(null);
  const [slots, setSlots] = useState<SlotSelections>({});
  const [errors, setErrors] = useState<CreateBuildErrors>({});

  function openForm(character: OwnedCharacterOption) {
    setExpandedId(character.ownedCharacterId);
    setName("");
    setWeaponId(null);
    setSlots({});
    setErrors({});
  }

  function closeForm() {
    setExpandedId(null);
  }

  function handleSubmit(character: OwnedCharacterOption) {
    const artifactEntries = SLOTS.map((slot) => ({ slot, ownedArtifactId: slots[slot] })).filter(
      (entry): entry is { slot: ArtifactSlot; ownedArtifactId: number } => entry.ownedArtifactId !== undefined
    );

    startTransition(async () => {
      const result = await createBuild({
        ownedCharacterId: character.ownedCharacterId,
        name,
        ownedWeaponId: weaponId,
        artifacts: artifactEntries,
      });

      if ("errors" in result) {
        setErrors(result.errors);
        return;
      }

      closeForm();
      showToast(
        <>
          Added <span className="font-bold">{result.build.name}</span> for {character.name}
        </>
      );
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search by character name..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="rounded border bg-white px-3 py-2 text-sm text-black"
        />
        <select
          value={sortKey}
          onChange={(event) => setSortKey(event.target.value as "name" | "rarity")}
          className="h-[38px] rounded border bg-white px-2 text-sm text-black"
        >
          <option value="name">Sort: Name</option>
          <option value="rarity">Sort: Rarity</option>
        </select>
        <SortDirectionToggle direction={sortDirection} onChange={setSortDirection} />
      </div>

      <p className="text-sm text-gray-500">
        Cannot find a character? Mark them owned on the{" "}
        <Link href="/characters" className="underline hover:text-foreground">
          Characters page
        </Link>
        .
      </p>

      <div className="flex flex-wrap gap-2">
        {ELEMENTS.map((element) => (
          <button
            key={element}
            type="button"
            onClick={() => setElementFilter((prev) => toggleInSet(prev, element))}
            aria-pressed={elementFilter.has(element)}
            title={element}
            className={`flex h-10 w-10 items-center justify-center rounded-full bg-black/40 p-1.5 ring-2 ${
              elementFilter.has(element) ? "ring-blue-500" : "ring-foreground"
            }`}
          >
            <Image src={ELEMENT_ICON_URL[element]} alt={element} width={24} height={24} />
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {WEAPON_TYPES.map((weaponType) => (
          <button
            key={weaponType}
            type="button"
            onClick={() => setWeaponTypeFilter((prev) => toggleInSet(prev, weaponType))}
            aria-pressed={weaponTypeFilter.has(weaponType)}
            title={weaponType}
            className={`h-10 w-10 rounded-full ring-2 ${
              weaponTypeFilter.has(weaponType) ? "ring-blue-500" : "ring-foreground"
            }`}
          >
            <Image
              src={WEAPON_TYPE_ICON_URL[weaponType]}
              alt={weaponType}
              width={40}
              height={40}
              className="rounded-full"
            />
          </button>
        ))}
      </div>

      <RarityFilterRow
        rarities={RARITIES}
        rarityFilter={rarityFilter}
        onToggle={(rarity) => setRarityFilter((prev) => toggleInSet(prev, rarity))}
      />

      {characters.length === 0 ? (
        <p className="text-sm text-gray-500">
          Own a character on the{" "}
          <Link href="/characters" className="underline hover:text-foreground">
            Characters page
          </Link>{" "}
          before creating a build.
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((character) => {
            const isExpanded = expandedId === character.ownedCharacterId;
            const weaponOptions = weapons.filter((w) => w.weaponType === character.weaponType);

            function toggleExpanded() {
              if (isExpanded) closeForm();
              else openForm(character);
            }

            return (
              <li key={character.ownedCharacterId} className="rounded border p-3">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={toggleExpanded}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    toggleExpanded();
                  }}
                  className="flex cursor-pointer items-center gap-3"
                >
                  <div
                    className={`relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg ${rarityGradientClasses(character.rarity)}`}
                  >
                    {character.iconUrl && <Image src={character.iconUrl} alt="" fill className="object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-2xl font-medium">{character.name}</p>
                    <div className="flex items-center gap-2">
                      <Image src={ELEMENT_ICON_URL[character.element]} alt={character.element} width={32} height={32} />
                      <Image
                        src={WEAPON_TYPE_ICON_URL[character.weaponType]}
                        alt={character.weaponType}
                        width={32}
                        height={32}
                      />
                    </div>
                  </div>
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center text-3xl font-semibold"
                  >
                    {isExpanded ? "−" : "+"}
                  </span>
                </div>

                {isExpanded && (
                  <div className="mt-3 max-w-2xl space-y-3 border-t pt-3">
                    <label className="block text-sm">
                      Name
                      <input
                        type="text"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        className="ml-1 h-8 rounded border bg-white px-2 text-sm text-black"
                      />
                    </label>
                    {errors.name && <p className="text-xs text-red-600">{errors.name[0]}</p>}
                    {errors.ownedCharacterId && (
                      <p className="text-xs text-red-600">{errors.ownedCharacterId[0]}</p>
                    )}

                    <label className="block text-sm">
                      Weapon
                      <select
                        value={weaponId ?? ""}
                        onChange={(event) => setWeaponId(event.target.value ? Number(event.target.value) : null)}
                        className="ml-1 h-8 w-56 rounded border bg-white px-2 text-sm text-black"
                      >
                        <option value="">None</option>
                        {weaponOptions.map((weapon) => (
                          <option key={weapon.ownedWeaponId} value={weapon.ownedWeaponId}>
                            {weapon.name} (R{weapon.refinement})
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="space-y-1">
                      <p className="text-sm font-medium">Artifacts</p>
                      {SLOTS.map((slot) => {
                        const options = artifacts.filter((a) => a.slot === slot);
                        return (
                          <label key={slot} className="flex items-center gap-2 text-sm">
                            <span className="w-16 shrink-0 text-gray-500">{slot}:</span>
                            <select
                              value={slots[slot] ?? ""}
                              onChange={(event) =>
                                setSlots((prev) => ({
                                  ...prev,
                                  [slot]: event.target.value ? Number(event.target.value) : undefined,
                                }))
                              }
                              className="h-8 w-72 rounded border bg-white px-2 text-sm text-black"
                            >
                              <option value="">None</option>
                              {options.map((option) => (
                                <option key={option.ownedArtifactId} value={option.ownedArtifactId}>
                                  {option.setName} ({option.mainStatName})
                                </option>
                              ))}
                            </select>
                          </label>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSubmit(character)}
                      className="rounded border border-white bg-black px-3 py-1 text-sm text-white"
                    >
                      Save build
                    </button>
                  </div>
                )}
              </li>
            );
          })}
          {filtered.length === 0 && <p className="text-sm text-gray-500">No characters match this search.</p>}
        </ul>
      )}

      <Toast message={message} visible={visible} />
    </div>
  );
}
