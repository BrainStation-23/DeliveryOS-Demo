import React from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Pencil,
  Plus,
  Store,
  Tags,
  Trash2,
} from 'lucide-react';
import { AdminOutletType } from '../../../../services/adminApi';
import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { EmptyState } from '../../../../components/common/EmptyState';
import { LoadingSpinner } from '../../../../components/ui/LoadingSpinner';
import { canDeleteOutletType, OutletTypeStatusFilter } from './outletTypeHelpers';
import { cn } from '../../../../utils/cn';

export interface OutletTypesTableProps {
  displayedTypes: AdminOutletType[];
  isLoading: boolean;
  search: string;
  statusFilter: OutletTypeStatusFilter;
  reorderingId: string | null;
  togglingId: string | null;
  onReorder: (type: AdminOutletType, direction: 'up' | 'down') => void;
  onToggleVisibility: (type: AdminOutletType) => void;
  onOpenEdit: (type: AdminOutletType) => void;
  onRequestDelete: (type: AdminOutletType) => void;
  onViewAssignedOutlets: (type: AdminOutletType) => void;
  onClearFilters: () => void;
  onCreateNew: () => void;
}

export const OutletTypesTable: React.FC<OutletTypesTableProps> = ({
  displayedTypes,
  isLoading,
  search,
  statusFilter,
  reorderingId,
  togglingId,
  onReorder,
  onToggleVisibility,
  onOpenEdit,
  onRequestDelete,
  onViewAssignedOutlets,
  onClearFilters,
  onCreateNew,
}) => {
  return (
    <div
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900"
      data-testid="outlet-type-list"
    >
      <div className="overflow-x-auto">
        <table className="min-w-full w-full text-left text-sm text-slate-600 dark:text-slate-300">
          <thead className="border-b border-slate-200 bg-slate-50/75 text-xs uppercase font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              <th scope="col" className="px-4 py-3 whitespace-nowrap w-24">
                Rank / Order
              </th>
              <th scope="col" className="px-4 py-3 whitespace-nowrap">
                Business Type
              </th>
              <th scope="col" className="px-4 py-3 whitespace-nowrap">
                Assigned Outlets
              </th>
              <th scope="col" className="px-4 py-3 whitespace-nowrap text-center">
                Customer Discovery
              </th>
              <th scope="col" className="px-4 py-3 whitespace-nowrap text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="py-10 text-center">
                  <LoadingSpinner size="md" label="Loading outlet business types..." />
                </td>
              </tr>
            ) : displayedTypes.length > 0 ? (
              displayedTypes.map((type, index) => {
                const deleteGuard = canDeleteOutletType(type);
                const isTop = index === 0;
                const isBottom = index === displayedTypes.length - 1;
                const isBusyReorder = reorderingId === type.id;
                const isBusyToggle = togglingId === type.id;

                return (
                  <tr
                    key={type.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Sort Order & Reorder Arrows */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-1.5 rounded-md bg-slate-100 text-slate-700 text-xs font-mono font-semibold dark:bg-slate-800 dark:text-slate-300">
                          #{type.sortOrder}
                        </span>
                        <div className="inline-flex flex-col gap-0.5">
                          <button
                            type="button"
                            onClick={() => onReorder(type, 'up')}
                            disabled={isTop || isBusyReorder}
                            className="p-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
                            title={isTop ? 'Already at top' : 'Move up in carousel'}
                            aria-label={`Move ${type.name} up`}
                          >
                            <ArrowUp className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onReorder(type, 'down')}
                            disabled={isBottom || isBusyReorder}
                            className="p-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
                            title={isBottom ? 'Already at bottom' : 'Move down in carousel'}
                            aria-label={`Move ${type.name} down`}
                          >
                            <ArrowDown className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* Business Type */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {type.name}
                        </span>
                        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-400 font-mono">
                          {type.slug}
                        </code>
                      </div>
                    </td>

                    {/* Assigned Outlets */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {deleteGuard.assignedCount > 0 ? (
                          <button
                            type="button"
                            onClick={() => onViewAssignedOutlets(type)}
                            className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/60 border border-indigo-200/80 dark:border-indigo-800/60 transition-all cursor-pointer hover:shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            title={`View ${deleteGuard.assignedCount} outlet(s) assigned to ${type.name}`}
                            aria-label={`View ${deleteGuard.assignedCount} outlets assigned to ${type.name}`}
                          >
                            <Store className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform" />
                            <span>
                              {deleteGuard.assignedCount} outlet{deleteGuard.assignedCount === 1 ? '' : 's'} assigned
                            </span>
                            <ChevronRight className="h-3 w-3 text-indigo-400 group-hover:translate-x-0.5 transition-transform" />
                          </button>
                        ) : (
                          <Badge variant="default" size="sm">
                            0 outlets (Safe to delete)
                          </Badge>
                        )}
                      </div>
                    </td>

                    {/* Customer Discovery Toggle Switch */}
                    <td className="px-4 py-3.5 whitespace-nowrap text-center">
                      <div className="inline-flex items-center justify-center gap-2">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={type.isActive}
                            disabled={isBusyToggle}
                            onChange={() => onToggleVisibility(type)}
                          />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600"></div>
                        </label>

                        {type.isActive ? (
                          <Badge variant="success" size="sm">
                            Visible
                          </Badge>
                        ) : (
                          <Badge variant="warning" size="sm">
                            Hidden
                          </Badge>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 whitespace-nowrap text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onOpenEdit(type)}
                          leftIcon={<Pencil className="h-3.5 w-3.5 text-slate-500" />}
                          aria-label={`Edit ${type.name}`}
                        >
                          Edit
                        </Button>

                        <div title={deleteGuard.reason}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onRequestDelete(type)}
                            disabled={!deleteGuard.canDelete}
                            className={cn(
                              'text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40',
                              !deleteGuard.canDelete && 'opacity-40 cursor-not-allowed text-slate-400',
                            )}
                            leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                            aria-label={`Delete ${type.name}`}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="py-8 text-center">
                  {search || statusFilter !== 'all' ? (
                    <EmptyState
                      title="No matching outlet types"
                      message={`No categories found matching "${search || statusFilter}". Try adjusting your search keyword or active filters.`}
                      action={
                        <Button variant="outline" size="sm" onClick={onClearFilters}>
                          Clear Filters
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState
                      icon={Tags}
                      title="No outlet types configured"
                      message="Get started by creating your first business category (e.g., Restaurant, Super Shop, Pharmacy)."
                      action={
                        <Button
                          size="sm"
                          onClick={onCreateNew}
                          leftIcon={<Plus className="h-3.5 w-3.5" />}
                        >
                          Create First Type
                        </Button>
                      }
                    />
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
