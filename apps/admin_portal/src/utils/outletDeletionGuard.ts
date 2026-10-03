/**
 * Guard utility governing outlet deletion prerequisites.
 *
 * Rule: An outlet cannot be deleted if it has tagged staff, categories, or items (products).
 * The delete button remains completely invisible until all three counts reach zero.
 */

export interface OutletDeletionCounts {
  staffCount: number;
  categoryCount: number;
  itemCount: number;
  orderCount?: number;
}

/**
 * Returns true only when tagged staff, categories, and items are all strictly 0.
 */
export function canDeleteOutlet(counts: OutletDeletionCounts): boolean {
  return (
    Number(counts.staffCount) === 0 &&
    Number(counts.categoryCount) === 0 &&
    Number(counts.itemCount) === 0
  );
}

/**
 * Summarizes human-readable reasons why an outlet cannot be deleted.
 */
export function getOutletDeletionBlockingReasons(counts: OutletDeletionCounts): string[] {
  const reasons: string[] = [];
  if (Number(counts.staffCount) > 0) {
    reasons.push(`${counts.staffCount} tagged staff assignment(s)`);
  }
  if (Number(counts.categoryCount) > 0) {
    reasons.push(`${counts.categoryCount} category/categories`);
  }
  if (Number(counts.itemCount) > 0) {
    reasons.push(`${counts.itemCount} item(s)`);
  }
  if (Number(counts.orderCount ?? 0) > 0) {
    reasons.push(`${counts.orderCount} historical order(s)`);
  }
  return reasons;
}
