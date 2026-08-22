import { Skeleton } from "@/components/ui/skeleton";

/* ------------------------------------------------------------------ */
/*  Dashboard skeletons                                                */
/* ------------------------------------------------------------------ */

export function DashboardStatsSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-3 shadow-card">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="mt-1 h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

export function WalletCardSkeleton() {
  return (
    <div className="it-note-success rounded-xl border p-3">
      <div className="flex items-center gap-2">
        <Skeleton className="size-4 rounded-full" />
        <div className="space-y-1">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-5 w-20" />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Task card skeletons                                                */
/* ------------------------------------------------------------------ */

export function TaskCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-6 w-20 rounded-md" />
      </div>
      <div className="mt-2 flex gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-12 rounded-full" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <div className="flex items-center gap-2">
          <Skeleton className="size-6 rounded-full" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="mt-2 h-3 w-48" />
    </div>
  );
}

export function TaskFeedSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <TaskCardSkeleton key={i} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Active task skeleton (student dashboard)                           */
/* ------------------------------------------------------------------ */

export function ActiveTaskSkeleton() {
  return (
    <div className="rounded-2xl border border-border/80 bg-card/90 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-5 w-20 rounded-md" />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Skeleton className="size-6 rounded-full" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="ml-auto h-5 w-24 rounded-full" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Skeleton className="h-9 rounded-lg" />
        <Skeleton className="h-9 rounded-lg" />
      </div>
    </div>
  );
}

export function ActiveTasksSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-28" />
      {[0, 1].map((i) => (
        <ActiveTaskSkeleton key={i} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Application row skeleton                                           */
/* ------------------------------------------------------------------ */

export function ApplicationRowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-card">
      <Skeleton className="size-9 rounded-full" />
      <div className="min-w-0 flex-1 space-y-1">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-5 w-16 rounded-full" />
    </div>
  );
}

export function ApplicationsSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-32" />
      {[0, 1, 2].map((i) => (
        <ApplicationRowSkeleton key={i} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Profile skeleton                                                   */
/* ------------------------------------------------------------------ */

export function ProfileSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-8 pt-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-6">
        <Skeleton className="size-20 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      {/* Tabs */}
      <div className="flex gap-4 border-b border-border pb-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
      </div>
      {/* Bio */}
      <div className="space-y-2 pt-6">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      {/* Info cards */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-1 h-4 w-28" />
          </div>
        ))}
      </div>
      {/* Skills */}
      <div className="mt-6 flex flex-wrap gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-6 w-20 rounded-full" />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Browse / Talent skeletons                                          */
/* ------------------------------------------------------------------ */

export function BrowsePageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-8 pt-5 lg:px-8 lg:pt-6">
      {/* Search bar */}
      <Skeleton className="mb-4 h-12 w-full rounded-xl" />
      {/* Filter chips */}
      <div className="mb-4 flex gap-2 overflow-hidden">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-8 w-20 shrink-0 rounded-full" />
        ))}
      </div>
      {/* Grid */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <TaskCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function TalentCardSkeleton() {
  return (
    <div className="rounded-[14px] border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <Skeleton className="size-12 rounded-full" />
        <div className="space-y-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-5 w-16 rounded-full" />
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

export function TalentSearchSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-8 pt-5 lg:px-8 lg:pt-6">
      {/* Filters */}
      <div className="mb-4 flex gap-2">
        <Skeleton className="h-10 w-48 rounded-lg" />
        <Skeleton className="h-10 w-36 rounded-lg" />
        <Skeleton className="h-10 w-36 rounded-lg" />
      </div>
      {/* Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <TalentCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Messages skeleton                                                  */
/* ------------------------------------------------------------------ */

export function ConversationListSkeleton() {
  return (
    <div className="space-y-1 p-2">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-10" />
            </div>
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChatMessagesSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 px-6 py-6">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
          <div className={`max-w-[70%] space-y-1 rounded-2xl px-4 py-3 ${i % 2 === 0 ? "bg-muted" : "bg-primary/20"}`}>
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Notifications skeleton                                             */
/* ------------------------------------------------------------------ */

export function NotificationsSkeleton() {
  return (
    <div className="space-y-2 pt-4">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-start gap-3 rounded-xl border border-border bg-card p-3">
          <Skeleton className="size-9 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Wallet skeleton                                                    */
/* ------------------------------------------------------------------ */

export function WalletSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 pb-10 pt-8 sm:px-8 lg:px-12">
      {/* Header */}
      <div className="mb-7 flex items-center gap-2.5">
        <Skeleton className="size-9 rounded-full" />
        <Skeleton className="h-8 w-32" />
      </div>
      {/* Tabs */}
      <div className="mb-6 flex gap-2">
        <Skeleton className="h-10 w-28 rounded-lg" />
        <Skeleton className="h-10 w-28 rounded-lg" />
      </div>
      {/* Balance card */}
      <div className="mb-6 rounded-2xl border border-[#E2E8F0] bg-white p-6">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mt-2 h-10 w-40" />
        <div className="mt-4 flex gap-3">
          <Skeleton className="h-10 flex-1 rounded-xl" />
          <Skeleton className="h-10 flex-1 rounded-xl" />
        </div>
      </div>
      {/* Bank accounts */}
      <div className="mb-4">
        <Skeleton className="h-5 w-36" />
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="mb-3 flex items-center gap-3 rounded-xl border border-[#E2E8F0] bg-white p-4">
          <Skeleton className="size-10 rounded-lg" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
      ))}
      {/* Transactions */}
      <div className="mt-6">
        <Skeleton className="mb-3 h-5 w-32" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 border-b border-[#E2E8F0]/50 py-3">
            <Skeleton className="size-9 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Task detail skeleton                                               */
/* ------------------------------------------------------------------ */

export function TaskDetailSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-8 pt-6">
      <Skeleton className="mb-4 h-8 w-48" />
      <div className="rounded-2xl border border-border bg-card p-6">
        <Skeleton className="h-6 w-3/4" />
        <div className="mt-4 flex gap-3">
          <Skeleton className="h-6 w-24 rounded-md" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="mt-6 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-28" />
          </div>
          <div className="space-y-1">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-5 w-24" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Referrals skeleton                                                 */
/* ------------------------------------------------------------------ */

export function ReferralsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-8 pt-6">
      <Skeleton className="mb-6 h-8 w-40" />
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <Skeleton className="mx-auto size-16 rounded-full" />
        <Skeleton className="mx-auto mt-4 h-6 w-48" />
        <Skeleton className="mx-auto mt-2 h-4 w-64" />
        <Skeleton className="mx-auto mt-4 h-12 w-48 rounded-xl" />
      </div>
      <div className="mt-6 grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 text-center">
            <Skeleton className="mx-auto h-8 w-16" />
            <Skeleton className="mx-auto mt-1 h-3 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Admin skeleton (enhanced)                                          */
/* ------------------------------------------------------------------ */

export function AdminStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-2 h-8 w-16" />
          <Skeleton className="mt-1 h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

export function AdminTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex gap-4 rounded-lg bg-muted/50 px-4 py-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16 ml-auto" />
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3">
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <div className="ml-auto flex gap-2">
            <Skeleton className="h-8 w-16 rounded-lg" />
            <Skeleton className="h-8 w-16 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}
