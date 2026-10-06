import { AdminOutletType } from '../../../../services/adminApi';

export type OutletTypeStatusFilter = 'all' | 'visible' | 'hidden';

export interface OutletTypeStats {
  total: number;
  visibleCount: number;
  hiddenCount: number;
  totalAssignedOutlets: number;
}

export interface OutletTypeDeleteGuard {
  canDelete: boolean;
  assignedCount: number;
  reason?: string;
}

export interface ReorderUpdate {
  id: string;
  sortOrder: number;
}

/**
 * Converts a raw name into a URL-safe lowercase kebab-case slug.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Computes high-level platform stats for outlet types.
 */
export function calculateOutletTypeStats(types: AdminOutletType[]): OutletTypeStats {
  const safeTypes = Array.isArray(types) ? types : [];
  let visibleCount = 0;
  let hiddenCount = 0;
  let totalAssignedOutlets = 0;

  for (const t of safeTypes) {
    if (t.isActive) {
      visibleCount += 1;
    } else {
      hiddenCount += 1;
    }
    totalAssignedOutlets += t._count?.outlets ?? 0;
  }

  return {
    total: safeTypes.length,
    visibleCount,
    hiddenCount,
    totalAssignedOutlets,
  };
}

/**
 * Evaluates whether an outlet type can be deleted safely according to backend FK constraints.
 * Refuses deletion when one or more outlets are currently assigned.
 */
export function canDeleteOutletType(type: AdminOutletType): OutletTypeDeleteGuard {
  const assignedCount = type._count?.outlets ?? 0;
  if (assignedCount > 0) {
    return {
      canDelete: false,
      assignedCount,
      reason: `Cannot delete "${type.name}" because ${assignedCount} outlet${
        assignedCount === 1 ? ' is' : 's are'
      } currently assigned. Reassign them first or hide this type instead.`,
    };
  }

  return {
    canDelete: true,
    assignedCount: 0,
  };
}

/**
 * Filters and orders outlet types deterministically (by sortOrder ascending, then name ascending).
 */
export function filterAndSortOutletTypes(
  types: AdminOutletType[],
  search: string,
  filter: OutletTypeStatusFilter,
): AdminOutletType[] {
  const safeTypes = Array.isArray(types) ? types : [];
  const normalizedQuery = search.trim().toLowerCase();

  return safeTypes
    .filter((type) => {
      // Visibility filter
      if (filter === 'visible' && !type.isActive) return false;
      if (filter === 'hidden' && type.isActive) return false;

      // Text search
      if (normalizedQuery) {
        const nameMatch = type.name.toLowerCase().includes(normalizedQuery);
        const slugMatch = type.slug.toLowerCase().includes(normalizedQuery);
        if (!nameMatch && !slugMatch) return false;
      }

      return true;
    })
    .sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }
      return a.name.localeCompare(b.name);
    });
}

/**
 * Computes sort order updates to swap an item with its adjacent neighbor in the ordered list.
 */
export function getAdjacentReorderSwap(
  orderedTypes: AdminOutletType[],
  currentIndex: number,
  direction: 'up' | 'down',
): ReorderUpdate[] | null {
  if (!Array.isArray(orderedTypes) || orderedTypes.length < 2) return null;

  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= orderedTypes.length) return null;

  const current = orderedTypes[currentIndex];
  const neighbor = orderedTypes[targetIndex];
  if (!current || !neighbor) return null;

  // If their sortOrder values are different, swap them.
  if (current.sortOrder !== neighbor.sortOrder) {
    return [
      { id: current.id, sortOrder: neighbor.sortOrder },
      { id: neighbor.id, sortOrder: current.sortOrder },
    ];
  }

  // If sortOrder values collide, assign distinct consecutive values based on new intended order
  const currentNewOrder = direction === 'up' ? neighbor.sortOrder : neighbor.sortOrder + 1;
  const neighborNewOrder = direction === 'up' ? neighbor.sortOrder + 1 : neighbor.sortOrder;

  return [
    { id: current.id, sortOrder: currentNewOrder },
    { id: neighbor.id, sortOrder: neighborNewOrder },
  ];
}
