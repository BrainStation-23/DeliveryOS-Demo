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
