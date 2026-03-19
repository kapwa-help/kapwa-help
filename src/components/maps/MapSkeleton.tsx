export default function MapSkeleton() {
  return (
    <div
      role="status"
      className="flex h-[24rem] items-center justify-center rounded-lg bg-base/30"
    >
      <div className="flex flex-col items-center gap-2">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-400/20 border-t-primary" />
        <p className="text-sm text-neutral-400/60">Loading map…</p>
      </div>
    </div>
  );
}
