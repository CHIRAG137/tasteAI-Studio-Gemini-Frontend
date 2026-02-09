export const BotCardSkeleton = () => {
  return (
    <div className="relative rounded-xl border bg-card p-6 space-y-4 overflow-hidden">
      {/* Shimmer overlay */}
      <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-muted/40 to-transparent" />

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 bg-muted rounded" />
          <div className="h-3 w-1/2 bg-muted rounded" />
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <div className="h-3 w-full bg-muted rounded" />
        <div className="h-3 w-5/6 bg-muted rounded" />
      </div>

      {/* Features */}
      <div className="space-y-3 pt-2">
        <div className="h-3 w-1/3 bg-muted rounded" />
        <div className="flex gap-2">
          <div className="h-5 w-14 bg-muted rounded-full" />
          <div className="h-5 w-14 bg-muted rounded-full" />
        </div>
      </div>

      {/* Button */}
      <div className="pt-3">
        <div className="h-9 w-full bg-muted rounded-md" />
      </div>
    </div>
  );
};
