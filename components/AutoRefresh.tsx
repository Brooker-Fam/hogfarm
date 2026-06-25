"use client";

import { useEffect } from "react";

// Reload the dashboard on an interval while it's still warming up. Seeded and real
// traffic can take a few minutes to become queryable (backdated events ride a
// throttled ingestion path), so we let the page fill itself in when the data lands
// instead of asking the visitor to refresh. Rendered only in the empty state, so it
// stops once there's data to show.
export function AutoRefresh({ seconds }: { seconds: number }) {
  useEffect(() => {
    const t = setTimeout(() => window.location.reload(), seconds * 1000);
    return () => clearTimeout(t);
  }, [seconds]);
  return null;
}
