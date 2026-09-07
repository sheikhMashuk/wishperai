export function AudioBars({ active, level }: { active: boolean; level: number }) {
  const bars = [0.4, 0.75, 1, 0.6];
  return (
    <div className="flex h-3.5 items-center gap-[3px]">
      {bars.map((weight, i) => {
        const h = active ? Math.max(3, Math.min(14, level * 40 * weight + (i % 2 ? 4 : 2))) : 3;
        return (
          <span
            key={i}
            className="w-[3px] rounded-full bg-[var(--accent)] transition-[height] duration-100"
            style={{ height: `${h}px`, opacity: active ? 0.9 : 0.3 }}
          />
        );
      })}
    </div>
  );
}
