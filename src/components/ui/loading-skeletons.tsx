import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="border-b p-3 flex gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, ri) => (
          <div key={ri} className="border-b last:border-0 p-3 flex gap-4">
            {Array.from({ length: cols }).map((_, ci) => (
              <Skeleton key={ci} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16 mb-2" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4 flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-8 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function PlanningGridSkeleton() {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="border-b p-3 flex gap-2">
          <Skeleton className="h-4 w-20" />
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-8 flex-1" />
          ))}
          <Skeleton className="h-4 w-12" />
        </div>
        {Array.from({ length: 4 }).map((_, ri) => (
          <div key={ri} className="border-b last:border-0 p-3 flex gap-2">
            <Skeleton className="h-6 w-20" />
            {Array.from({ length: 7 }).map((_, ci) => (
              <div key={ci} className="flex-1 space-y-1">
                <Skeleton className="h-6 w-full rounded-md" />
              </div>
            ))}
            <Skeleton className="h-6 w-12" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
