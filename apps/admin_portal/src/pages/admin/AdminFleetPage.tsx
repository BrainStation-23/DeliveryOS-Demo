import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bike, RefreshCw } from 'lucide-react';
import adminApi, { AdminOrder, FleetRider } from '../../services/adminApi';
import { getSocket } from '../../services/socket';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import { PageHeader } from '../../components/common/PageHeader';
import { QueryErrorBanner } from '../../components/common/QueryErrorBanner';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { computeFleetStats } from './components/dispatch/fleetFilters';
import { FleetStatCards } from './components/dispatch/FleetStatCards';
import { FleetRadarPanel, EscalationAlert } from './components/dispatch/FleetRadarPanel';
import { UnassignedPoolPanel } from './components/dispatch/UnassignedPoolPanel';
import {
  FleetRosterTable,
  FleetRosterStatusFilter,
  FleetRosterApprovalFilter,
} from './components/dispatch/FleetRosterTable';
import { RiderDetailsDrawer } from './components/dispatch/RiderDetailsDrawer';

const ROSTER_PAGE_SIZE = 20;

/**
 * Unified Rider Fleet command centre: live reflection cards, geographic radar,
 * the dispatch unassigned pool, and a server-paginated searchable roster with
 * the unified courier details drawer.
 */
export const AdminFleetPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<FleetRosterStatusFilter>('ALL');
  const [approvalFilter, setApprovalFilter] = useState<FleetRosterApprovalFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [rosterPage, setRosterPage] = useState(1);
  const [detailsRiderId, setDetailsRiderId] = useState<string | null>(null);
  const [escalationAlert, setEscalationAlert] = useState<EscalationAlert | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(searchQuery);

  const { data: fleet = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-fleet'],
    queryFn: adminApi.getFleet,
    refetchInterval: 30000,
  });

  const { data: unassignedData } = useQuery({
    queryKey: ['admin-unassigned-orders'],
    queryFn: () => adminApi.getOrders('PLACED', 1, 50),
    refetchInterval: 30000,
  });

  const { data: roster, isLoading: isRosterLoading } = useQuery({
    queryKey: ['admin-riders', rosterPage, debouncedSearch, statusFilter, approvalFilter],
    queryFn: () =>
      adminApi.getRiderRoster({
        page: rosterPage,
        limit: ROSTER_PAGE_SIZE,
        search: debouncedSearch,
        approvalStatus: approvalFilter,
        ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
      }),
    refetchInterval: 30000,
    placeholderData: (previous) => previous,
  });

  const safeFleet = Array.isArray(fleet) ? fleet : [];
  const unassignedOrders: AdminOrder[] = Array.isArray(unassignedData)
    ? unassignedData
    : (Array.isArray(unassignedData?.items) ? unassignedData.items : []);
  const safeUnassignedOrders = Array.isArray(unassignedOrders) ? unassignedOrders : [];

  const stats = computeFleetStats(safeFleet);

  const lastLocationPatchMapRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const socket = getSocket();

    const handleFleetAndOrderEvent = () => {
      queryClient.invalidateQueries({ queryKey: ['admin-fleet'] });
      queryClient.invalidateQueries({ queryKey: ['admin-unassigned-orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-riders'] });
    };

    // GPS events stream continuously — patch the cached fleet rows directly
    // throttled to once per 5s per courier instead of refetching per beacon.
    const handleRiderLocation = (payload: {
      data?: {
        riderId: string;
        latitude: number;
        longitude: number;
        speed?: number;
        hasActiveOrder?: boolean;
        activeOrderId?: string | null;
      };
    }) => {
      const fix = payload?.data;
      if (!fix?.riderId) return;
      const now = Date.now();
      const lastTime = lastLocationPatchMapRef.current.get(fix.riderId) ?? 0;
      if (now - lastTime < 5000) return;
      lastLocationPatchMapRef.current.set(fix.riderId, now);

      queryClient.setQueryData<FleetRider[]>(['admin-fleet'], (current) =>
        (current ?? []).map((rider) =>
          rider.id === fix.riderId
            ? {
                ...rider,
                latitude: fix.latitude,
                longitude: fix.longitude,
                activeOrder:
                  fix.hasActiveOrder && fix.activeOrderId && rider.activeOrder?.id === fix.activeOrderId
                    ? rider.activeOrder
                    : rider.activeOrder,
              }
            : rider,
        ),
      );
    };

    const handleEscalated = (payload: { data?: EscalationAlert }) => {
      if (payload?.data) {
        setEscalationAlert(payload.data);
      }
      handleFleetAndOrderEvent();
    };

    socket.on('order:new', handleFleetAndOrderEvent);
    socket.on('order:status:changed', handleFleetAndOrderEvent);
    socket.on('dispatch:broadcast', handleFleetAndOrderEvent);
    socket.on('rider:location', handleRiderLocation);
    socket.on('dispatch:escalated', handleEscalated);

    return () => {
      socket.off('order:new', handleFleetAndOrderEvent);
      socket.off('order:status:changed', handleFleetAndOrderEvent);
      socket.off('dispatch:broadcast', handleFleetAndOrderEvent);
      socket.off('rider:location', handleRiderLocation);
      socket.off('dispatch:escalated', handleEscalated);
    };
  }, [queryClient]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rider Fleet"
        subtitle="Live courier GPS radar, fleet reflection cards, dispatch pool, and per-courier governance"
        icon={Bike}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            leftIcon={<RefreshCw className="h-4 w-4" />}
          >
            Refresh Fleet
          </Button>
        }
      />

      {mutationError && (
        <Alert type="error" message={mutationError} onDismiss={() => setMutationError(null)} />
      )}

      {isError && <QueryErrorBanner error={error} onRetry={() => refetch()} />}

      <FleetStatCards
        stats={stats}
        totalRiders={fleet.length}
        isLoading={isLoading}
        applicantsFilterActive={approvalFilter === 'PENDING'}
        onToggleApplicantsFilter={() => {
          setRosterPage(1);
          // Entering the applicant queue clears the duty-status dimension —
          // applicants can never hold duty, so the two filters never compose.
          setStatusFilter('ALL');
          setApprovalFilter(approvalFilter === 'PENDING' ? 'ALL' : 'PENDING');
        }}
      />

      <FleetRadarPanel
        fleet={safeFleet}
        unassignedOrders={safeUnassignedOrders}
        onlineCount={stats.onlineCount}
        selectedRiderId={detailsRiderId ?? undefined}
        onSelectRider={(riderId) => setDetailsRiderId(riderId)}
        escalation={escalationAlert}
        onDismissEscalation={() => setEscalationAlert(null)}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <FleetRosterTable
            rows={roster?.items ?? []}
            total={roster?.total ?? 0}
            page={roster?.page ?? rosterPage}
            totalPages={roster?.totalPages ?? 1}
            isLoading={isRosterLoading}
            searchQuery={searchQuery}
            statusFilter={statusFilter}
            approvalFilter={approvalFilter}
            pendingApplicantsCount={stats.pendingApplicantsCount}
            onSearchQueryChange={(value) => {
              setSearchQuery(value);
              setRosterPage(1);
            }}
            onStatusFilterChange={(status) => {
              setStatusFilter(status);
              setRosterPage(1);
            }}
            onApprovalFilterChange={(approval) => {
              setStatusFilter('ALL');
              setApprovalFilter(approval);
              setRosterPage(1);
            }}
            onPageChange={setRosterPage}
            onOpenDetails={setDetailsRiderId}
          />
        </div>

        <UnassignedPoolPanel
          orders={safeUnassignedOrders}
          idleCount={stats.idleCount}
          onlineCount={stats.onlineCount}
        />
      </div>

      <RiderDetailsDrawer
        riderId={detailsRiderId}
        onClose={() => setDetailsRiderId(null)}
        onError={setMutationError}
      />
    </div>
  );
};
