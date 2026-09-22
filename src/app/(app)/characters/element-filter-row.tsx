"use client";

import Image from "next/image";
import { Element } from "@/generated/prisma/enums";
import { ELEMENT_ICON_URL } from "./element-icons";

const ELEMENTS = Object.values(Element);

export function ElementFilterRow({
  elementFilter,
  onToggle,
}: {
  elementFilter: ReadonlySet<Element>;
  onToggle: (element: Element) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {ELEMENTS.map((element) => (
        <button
          key={element}
          type="button"
          onClick={() => onToggle(element)}
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
  );
}
