import type { Prisma } from "@prisma/client";

export function buildSearchWhere(q: string | null): Prisma.PoTrackingRowWhereInput {
  const term = q?.trim();
  if (!term) return {};
  const contains = { contains: term, mode: "insensitive" as const };
  return {
    OR: [
      { jobNo: contains },
      { chPo: contains },
      { ssPo: contains },
      { vendor: contains },
      { assetType: contains },
      { jobType: contains },
    ],
  };
}
