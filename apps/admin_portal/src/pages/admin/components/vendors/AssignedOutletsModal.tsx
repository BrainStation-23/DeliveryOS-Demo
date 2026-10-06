import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  ChevronRight,
  MapPin,
  Phone,
  Store,
  ShoppingBag,
} from 'lucide-react';
import adminApi, { AdminOutletType, AssignedOutletRow } from '../../../../services/adminApi';
import { Modal } from '../../../../components/ui/Modal';
import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { LoadingSpinner } from '../../../../components/ui/LoadingSpinner';
import { SearchInput } from '../../../../components/common/SearchInput';
import { EmptyState } from '../../../../components/common/EmptyState';
import { resolveMediaUrl } from '../../../../utils/mediaUrl';
import { extractApiError } from '../../../../utils/apiError';
import { cn } from '../../../../utils/cn';
import { filterAssignedOutlets, formatOutletRowTitle } from './assignedOutletsHelpers';

export interface AssignedOutletsModalProps {
  isOpen: boolean;
  onClose: () => void;
  outletType: AdminOutletType | null;
  onOpenOutlet?: (outletId: string) => void;
}

/**
 * Dialog displaying all physical store outlets currently classified under a business category.
 * Clicking any outlet row navigates directly to that outlet's master management page.
 */
export const AssignedOutletsModal: React.FC<AssignedOutletsModalProps> = ({
  isOpen,
  onClose,
  outletType,
  onOpenOutlet,
}) => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin-outlet-type-outlets', outletType?.id],
    queryFn: () => adminApi.getOutletTypeOutlets(outletType!.id),
    enabled: isOpen && !!outletType?.id,
  });

  const outlets: AssignedOutletRow[] = data?.outlets ?? [];

  const filteredOutlets = useMemo(() => {
    return filterAssignedOutlets(outlets, search);
  }, [outlets, search]);

  const handleSelectOutlet = (outletId: string) => {
    onClose();
    if (onOpenOutlet) {
      onOpenOutlet(outletId);
    } else {
      navigate(`/outlets/${outletId}`);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        outletType
          ? `Outlets Assigned to "${outletType.name}"`
          : 'Assigned Store Outlets'
      }
      description={`Review all store outlets categorized under this business type. Click any outlet to open full details.`}
      size="lg"
    >
      <div className="space-y-4">
        {/* Header Summary Ribbon */}
        {outletType && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/40">
            <div className="flex items-center gap-2">
              <Badge variant="indigo" size="sm" className="gap-1 font-semibold">
                <Store className="h-3 w-3" />
                {outletType.name}
              </Badge>
              <code className="rounded bg-slate-200/80 px-1.5 py-0.5 text-[11px] font-mono text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                {outletType.slug}
              </code>
            </div>

            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <span className="font-medium">
                {outlets.length} outlet{outlets.length === 1 ? '' : 's'} linked
              </span>
              <span>•</span>
              <span>Rank #{outletType.sortOrder}</span>
            </div>
          </div>
        )}

        {/* Search Bar */}
        {outlets.length > 0 && (
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Filter assigned outlets by name, brand, or address..."
            className="w-full"
          />
        )}

        {/* Content Area */}
        <div className="max-h-[60vh] min-h-[160px] overflow-y-auto space-y-2 pr-0.5">
          {isLoading ? (
            <div className="py-12 text-center">
              <LoadingSpinner size="md" label="Loading assigned outlets..." />
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-3 text-center">
              <p className="text-sm text-rose-600 dark:text-rose-400">
                {extractApiError(error, 'Failed to load assigned store outlets.')}
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          ) : filteredOutlets.length > 0 ? (
            <div className="space-y-2" data-testid="assigned-outlets-list">
              {filteredOutlets.map((outlet) => {
                const fullTitle = formatOutletRowTitle(outlet);

                return (
                  <div
                    key={outlet.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSelectOutlet(outlet.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelectOutlet(outlet.id);
                      }
                    }}
                    className={cn(
                      'group flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800',
                      'bg-white dark:bg-slate-900 hover:border-primary-400 hover:ring-2 hover:ring-primary-500/10 hover:bg-slate-50/80 dark:hover:bg-slate-800/60',
                      'transition-all cursor-pointer gap-3 shadow-2xs focus:outline-none focus:ring-2 focus:ring-primary-500',
                    )}
                    aria-label={`Open outlet details for ${fullTitle}`}
                  >
                    {/* Left: Brand Logo / Icon + Outlet & Brand Info */}
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 overflow-hidden mt-0.5">
                        {outlet.brandLogoUrl ? (
                          <img
                            src={resolveMediaUrl(outlet.brandLogoUrl)}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Building2 className="h-5 w-5 text-slate-400 group-hover:text-primary-600 transition-colors" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-slate-900 dark:text-slate-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                            {fullTitle}
                          </span>

                          {outlet.isActive ? (
                            <Badge variant="success" size="sm">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="danger" size="sm">
                              Suspended
                            </Badge>
                          )}

                          {outlet.isBusy ? (
                            <Badge variant="warning" size="sm">
                              Busy
                            </Badge>
                          ) : (
                            <Badge variant="indigo" size="sm">
                              Intake Active
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1 flex-wrap">
                          <span className="flex items-center gap-1 truncate max-w-sm" title={outlet.addressText}>
                            <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                            <span className="truncate">{outlet.addressText}</span>
                          </span>

                          {outlet.contactPhone && (
                            <span className="flex items-center gap-1 font-mono shrink-0">
                              <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                              {outlet.contactPhone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Metrics & Row Indicator */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                      {outlet.totalProducts !== undefined && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium text-xs">
                          <ShoppingBag className="h-3 w-3 text-slate-400" />
                          {outlet.totalProducts} item{outlet.totalProducts === 1 ? '' : 's'}
                        </span>
                      )}

                      <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={Store}
              title={search ? 'No matching outlets found' : 'No outlets assigned'}
              message={
                search
                  ? `No outlets match "${search}". Try searching by another keyword.`
                  : `There are currently no store outlets classified under "${outletType?.name ?? 'this category'}".`
              }
              action={
                search ? (
                  <Button variant="outline" size="sm" onClick={() => setSearch('')}>
                    Clear Search
                  </Button>
                ) : undefined
              }
            />
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
          <p className="text-[11px] text-slate-400">
            Tip: Click any store row to manage its catalog, hours, and live settings.
          </p>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
