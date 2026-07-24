/**
 * SkeletonGrid.tsx — Enhancement #9
 * Replaces the sila-pulse opacity flicker with a travelling shimmer gradient
 * that sweeps left-to-right across each card with a staggered delay per index.
 */

interface SkeletonGridProps {
  count?: number;
}

const heights = [
  "aspect-[4/5]",
  "aspect-[16/10]",
  "aspect-square",
  "aspect-[4/3]",
  "aspect-[3/4]",
  "aspect-[16/9]",
];

export function SkeletonGrid({ count = 12 }: SkeletonGridProps) {
  return (
    <div className="columns-1 gap-5 sm:columns-2 lg:columns-3 xl:columns-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`mb-5 break-inside-avoid overflow-hidden border border-aesop-ink/8 bg-aesop-ink/[0.04] sila-shimmer ${heights[i % heights.length]}`}
          style={{
            // Stagger the shimmer start per card so they don't all pulse in sync
            animationDelay: `${(i * 0.12) % 1.8}s`,
          }}
        >
          {/* Faint detail lines at the bottom */}
          <div className="flex h-full flex-col justify-end p-4">
            <div className="h-[5px] w-2/5 rounded-full bg-aesop-ink/[0.06]" />
            <div className="mt-2 h-[3px] w-1/4 rounded-full bg-aesop-ink/[0.04]" />
          </div>
        </div>
      ))}
    </div>
  );
}
