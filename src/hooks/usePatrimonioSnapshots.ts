"use client";

/**
 * src/hooks/usePatrimonioSnapshots.ts
 *
 * Lee el historico de fotos del patrimonio (tabla patrimonio_snapshots),
 * ordenadas por fecha. Lo escribe PatrimonioSnapshotTaker (una foto al dia).
 */

import { useQuery } from "@tanstack/react-query";
import { useRepos } from "@/contexts/DatabaseProvider";

export const PATRIMONIO_SNAPSHOTS_KEY = ["patrimonioSnapshots"] as const;

export function usePatrimonioSnapshots() {
  const repos = useRepos();
  const query = useQuery({
    queryKey: PATRIMONIO_SNAPSHOTS_KEY,
    queryFn: () => repos.patrimonioSnapshots.list(),
  });
  return {
    snapshots: query.data ?? [],
    isLoading: query.isLoading,
  };
}
