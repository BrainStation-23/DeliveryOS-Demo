import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Navigation, RefreshCw } from 'lucide-react';
import adminApi, { AdminOrder, FleetRider } from '../../services/adminApi';
import { getSocket } from '../../services/socket';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import { PageHeader } from '../../components/common/PageHeader';
import { QueryErrorBanner } from '../../components/common/QueryErrorBanner';
import { extractApiError } from '../../utils/apiError';
import {
  FleetApprovalFilter,
  FleetStatusFilter,
  computeFleetStats,
  filterFleet,
} from './components/dispatch/fleetFilters';
import { FleetStatCards } from './components/dispatch/FleetStatCards';
import { FleetRadarPanel, EscalationAlert } from './components/dispatch/FleetRadarPanel';
import { FleetRosterPanel } from './components/dispatch/FleetRosterPanel';
import { UnassignedPoolPanel } from './components/dispatch/UnassignedPoolPanel';
import { CashLimitModal } from './components/dispatch/CashLimitModal';

export const AdminDispatchPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<FleetStatusFilter>('ALL');
  const [approvalFilter, setApprovalFilter] = useState<FleetApprovalFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRider, setSelectedRider] = useState<FleetRider | null>(null);
  const [isCashModalOpen, setIsCashModalOpen] = useState(false);
  const [escalationAlert, setEscalationAlert] = useState<EscalationAlert | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

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

  const safeFleet = Array.isArray(fleet) ? fleet : [];
  const unassignedOrders: AdminOrder[] = Array.isArray(unassignedData)
    ? unassignedData
    : (Array.isArray(unassignedData?.items) ? unassignedData.items : []);
  const safeUnassignedOrders = Array.isArray(unassignedOrders) ? unassignedOrders : [];

  const stats = computeFleetStats(safeFleet);
  const filteredFleet = filterFleet(safeFleet, { statusFilter, approvalFilter, searchQuery });

  const lastLocationPatchMapRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const socket = getSocket();

    const handleFleetAndOrderEvent = () => {
      queryClient.invalidateQueries({ queryKey: ['admin-fleet'] });
      queryClient.invalidateQueries({ queryKey: ['admin-unassigned-orders'] });
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

  const updateCashLimitMutation = useMutation({
    mutationFn: ({ id, limit }: { id: string; limit: number }) =>
      adminApi.updateRiderCashLimit(id, limit),
    onSuccess: () => {
      setMutationError(null);
      queryClient.invalidateQueries({ queryKey: ['admin-fleet'] });
      setIsCashModalOpen(false);
      setSelectedRider(null);
    },
    onError: (err) => setMutationError(extractApiError(err, 'Failed to update the cash safety limit.')),
  });

  const toggleApprovalMutation = useMutation({
    mutationFn: ({ id, isApproved }: { id: string; isApproved: boolean }) =>
      adminApi.setRiderApproval(id, isApproved),
    onSuccess: () => {
      setMutationError(null);
      queryClient.invalidateQueries({ queryKey: ['admin-fleet'] });
    },
    onError: (err) => setMutationError(extractApiError(err, 'Courier approval update failed.')),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live Fleet Radar & Dispatch"
        subtitle="Real-time courier GPS oversight, active trips, and COD cash safety thresholds"
        icon={Navigation}
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
        onToggleApplicantsFilter={() => setApprovalFilter(approvalFilter === 'PENDING' ? 'ALL' : 'PENDING')}
      />

      <FleetRadarPanel
        fleet={safeFleet}
        unassignedOrders={safeUnassignedOrders}
        onlineCount={stats.onlineCount}
        selectedRiderId={selectedRider?.id}
        onSelectRider={(riderId) => {
          const found = safeFleet.find((r) => r.id === riderId);
          if (found) setSelectedRider(found);
        }}
        escalation={escalationAlert}
        onDismissEscalation={() => setEscalationAlert(null)}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <FleetRosterPanel
            riders={filteredFleet}
            isLoading={isLoading}
            statusFilter={statusFilter}
            approvalFilter={approvalFilter}
            searchQuery={searchQuery}
            pendingApplicantsCount={stats.pendingApplicantsCount}
            approvalTogglePendingFor={
              toggleApprovalMutation.isPending ? toggleApprovalMutation.variables?.id ?? null : null
            }
            onStatusFilterChange={setStatusFilter}
            onApprovalFilterChange={setApprovalFilter}
            onSearchQueryChange={setSearchQuery}
            onSetCashLimit={(rider) => {
              setSelectedRider(rider);
              setIsCashModalOpen(true);
            }}
            onToggleApproval={(rider) =>
              toggleApprovalMutation.mutate({
                id: rider.id,
                isApproved: rider.isApproved === false ? true : false,
              })
            }
          />
        </div>

        <UnassignedPoolPanel
          orders={safeUnassignedOrders}
          idleCount={stats.idleCount}
          onlineCount={stats.onlineCount}
        />
      </div>

      {selectedRider && isCashModalOpen && (
        <CashLimitModal
          rider={selectedRider}
          isSubmitting={updateCashLimitMutation.isPending}
          onClose={() => setIsCashModalOpen(false)}
          onSubmit={(limit) => updateCashLimitMutation.mutate({ id: selectedRider.id, limit })}
        />
      )}
    </div>
  );
};
