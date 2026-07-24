/**
 * MediaGrid.tsx — Enhancement #3
 * Distributes items into masonry columns AND assigns staggered aspect ratios
 * so the grid has visual variety even when all source images are the same ratio.
 * 
 * Pattern: we cycle through a curated set of aspect ratios across all cards
 * so the grid feels like an editorial photo spread.
 */
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { ParentMedia } from "../types";
import { ParentCard } from "./ParentCard";
import { EmptyState } from "./EmptyState";
import { SkeletonGrid } from "./SkeletonGrid";

interface MediaGridProps {
  items: ParentMedia[];
  isLoading: boolean;
  isMock: boolean;
  query?: string;
  onItemSelect?: (item: ParentMedia) => void;
}

// Curated aspect ratio cycle — creates rhythm without being too random
// Every 12 cards repeats the same sequence for visual consistency
const ASPECT_CYCLE = [
  "16 / 9",   // standard landscape
  "16 / 9",
  "4 / 3",    // slightly taller landscape
  "16 / 9",
  "3 / 2",    // classic photo ratio
  "16 / 9",
  "16 / 9",
  "4 / 3",
  "16 / 9",
  "3 / 2",
  "16 / 9",
  "16 / 9",
];

function ApertureDividerSVG() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="w-5 h-5 text-[--color-aesop-ink]">
      <circle cx="12" cy="12" r="10" />
      <path d="M 12 2 L 12 6" />
      <path d="M 12 18 L 12 22" />
      <path d="M 2 12 L 6 12" />
      <path d="M 18 12 L 22 12" />
      <path d="M 4.93 4.93 L 7.76 7.76" />
      <path d="M 16.24 16.24 L 19.07 19.07" />
      <path d="M 4.93 19.07 L 7.76 16.24" />
      <path d="M 16.24 7.76 L 19.07 4.93" />
    </svg>
  );
}

export function MediaGrid({ items, isLoading, query, onItemSelect }: MediaGridProps) {
  const [columnsCount, setColumnsCount] = useState(3);

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth < 640) setColumnsCount(1);
      else if (window.innerWidth < 1024) setColumnsCount(2);
      else setColumnsCount(3);
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (isLoading) return <SkeletonGrid count={14} />;
  if (!items.length) return <EmptyState query={query} />;

  // Distribute items into columns (masonry fill order)
  const columns: { item: ParentMedia; globalIndex: number }[][] = Array.from({ length: columnsCount }, () => []);
  items.forEach((item, i) => {
    columns[i % columnsCount].push({ item, globalIndex: i });
  });

  const gridKey = query ?? `${items.length}-${items[0]?.parent_id ?? "grid"}`;

  return (
    <div className="flex flex-col w-full">
      <motion.div
        key={gridKey}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="flex gap-5 w-full"
      >
        {columns.map((colItems, colIndex) => (
          <div key={colIndex} className="flex flex-col gap-5 flex-1 min-w-0">
            {colItems.map(({ item, globalIndex }, itemIndex) => (
              <ParentCard
                key={item.parent_id}
                item={item}
                index={itemIndex}
                // Stagger aspect ratios across ALL cards by their global position
                forcedAspect={ASPECT_CYCLE[globalIndex % ASPECT_CYCLE.length]}
                onClick={() => onItemSelect?.(item)}
              />
            ))}
          </div>
        ))}
      </motion.div>
      
      <div className="grid-end-ornament mt-8 mb-4">
        <ApertureDividerSVG />
      </div>
    </div>
  );
}
