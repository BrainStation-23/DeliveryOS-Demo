import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import kdsApi, { normalizeKDSOrder, RawBackendOrder } from '../services/kdsApi';
import { getSocket } from '../services/socket';
import { KDSOrder, KDSOrderStatus } from '../types/kds';
import { soundEngine } from '../utils/sound';
import { extractApiError } from '../utils/apiError';

interface SocketOrderPayload {
  data?: RawBackendOrder;
}

interface SocketStatusChangedPayload {
  data?: {
    orderId?: string;
    id?: string;
    newStatus?: KDSOrderStatus;
    status?: KDSOrderStatus;
    prepTime?: number;
    prepTimeMinutes?: number;
  };
  orderId?: string;
  id?: string;
  newStatus?: KDSOrderStatus;
  status?: KDSOrderStatus;
  prepTime?: number;
  prepTimeMinutes?: number;
}

interface SocketOrderCancelledPayload {
  data?: {
    orderId?: string;
    id?: string;
  };
  orderId?: string;
  id?: string;
}

export const useKDSOrders = (vendorId?: string) => {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ['kds-live-orders', vendorId], [vendorId]);
  const [isSocketConnected, setIsSocketConnected] = useState<boolean>(getSocket().connected);

  const { data: orders = [], isLoading, isError, error, refetch } = useQuery<KDSOrder[]>({
    queryKey,
    queryFn: () => kdsApi.getLiveOrders(vendorId),
    refetchInterval: 15000, // Background poll every 15s as fallback
  });

  // A kitchen tablet must never silently run on a stale board: surface the
  // realtime connection state so staff notice a dropped socket.
  useEffect(() => {
    const socket = getSocket();

    const handleConnect = () => setIsSocketConnected(true);
    const handleDisconnect = () => setIsSocketConnected(false);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    setIsSocketConnected(socket.connected);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, []);

  useEffect(() => {
    const socket = getSocket();

    const handleNewOrder = (incoming: SocketOrderPayload | RawBackendOrder) => {
      soundEngine.startOrderAlarm();

      const raw = 'data' in incoming && incoming.data ? incoming.data : (incoming as RawBackendOrder);
      const newOrder = normalizeKDSOrder(raw);
      if (!newOrder || !newOrder.id) return;

      queryClient.setQueryData<KDSOrder[]>(queryKey, (old = []) => {
        const safeOld = Array.isArray(old) ? old : [];
        const exists = safeOld.some((o) => o.id === newOrder.id);
        if (exists) {
          return safeOld.map((o) => (o.id === newOrder.id ? { ...o, ...newOrder } : o));
        }
        return [newOrder, ...safeOld];
      });
    };

    const handleStatusChanged = (payload: SocketStatusChangedPayload) => {
      const data = payload?.data || payload;
      const orderId = data?.orderId || data?.id;
      const newStatus = data?.newStatus || data?.status;
      const prepTime = data?.prepTime ?? data?.prepTimeMinutes;

      if (!orderId) return;

      if (newStatus === 'CANCELLED') {
        queryClient.setQueryData<KDSOrder[]>(queryKey, (old = []) => {
          const safeOld = Array.isArray(old) ? old : [];
          return safeOld.filter((o) => o.id !== orderId);
        });
      } else {
        queryClient.setQueryData<KDSOrder[]>(queryKey, (old = []) => {
          const safeOld = Array.isArray(old) ? old : [];
          return safeOld.map((o) => {
            if (o.id === orderId) {
              return {
                ...o,
                status: (newStatus || o.status) as KDSOrder['status'],
                prepTimeMinutes: prepTime ?? o.prepTimeMinutes,
                acceptedAt: newStatus === 'PREPARING' ? new Date().toISOString() : o.acceptedAt,
              };
            }
            return o;
          });
        });
      }

      // Check if any unaccepted new orders remain; if none, silence alarm
      const currentOrders = queryClient.getQueryData<KDSOrder[]>(queryKey) || [];
      const hasUnaccepted = Array.isArray(currentOrders) && currentOrders.some(
        (o) => (o.status === 'PLACED' || o.status === 'RIDER_ASSIGNED') && o.id !== orderId
      );
      if (!hasUnaccepted) {
        soundEngine.stopOrderAlarm();
      }
    };

    const handleOrderCancelled = (payload: SocketOrderCancelledPayload) => {
      const data = payload?.data || payload;
      const orderId = data?.orderId || data?.id;
      if (!orderId) return;

      queryClient.setQueryData<KDSOrder[]>(queryKey, (old = []) => {
        const safeOld = Array.isArray(old) ? old : [];
        return safeOld.filter((o) => o.id !== orderId);
      });

      const currentOrders = queryClient.getQueryData<KDSOrder[]>(queryKey) || [];
      const hasUnaccepted = Array.isArray(currentOrders) && currentOrders.some(
        (o) => (o.status === 'PLACED' || o.status === 'RIDER_ASSIGNED') && o.id !== orderId
      );
      if (!hasUnaccepted) {
        soundEngine.stopOrderAlarm();
      }
    };

    socket.on('order:new', handleNewOrder);
    socket.on('order:status:changed', handleStatusChanged);
    socket.on('order:cancelled', handleOrderCancelled);

    return () => {
      socket.off('order:new', handleNewOrder);
      socket.off('order:status:changed', handleStatusChanged);
      socket.off('order:cancelled', handleOrderCancelled);
    };
  }, [queryClient, queryKey]);

  // Kitchen staff must see (and hear) when an action fails — silent failures
  // on the KDS board leave orders stuck in the wrong lane.
  const [actionError, setActionError] = useState<string | null>(null);

  const silenceAlarmIfAllAccepted = (next: KDSOrder[]) => {
    const remainingUnaccepted = next.some((o) => o.status === 'PLACED' || o.status === 'RIDER_ASSIGNED');
    if (!remainingUnaccepted) {
      soundEngine.stopOrderAlarm();
    }
  };

  const acceptMutation = useMutation({
    mutationFn: ({ orderId, prepTimeMinutes }: { orderId: string; prepTimeMinutes?: number }) =>
      kdsApi.acceptOrder(orderId, prepTimeMinutes),
    onMutate: async ({ orderId }) => {
      setActionError(null);
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<KDSOrder[]>(queryKey);
      queryClient.setQueryData<KDSOrder[]>(queryKey, (old = []) => {
        const next = old.map((o) => (o.id === orderId ? { ...o, status: 'PREPARING' as const } : o));
        silenceAlarmIfAllAccepted(next);
        return next;
      });
      return { previous };
    },
    onSuccess: (updatedOrder) => {
      queryClient.setQueryData<KDSOrder[]>(queryKey, (old = []) =>
        old.map((o) => (o.id === updatedOrder.id ? { ...o, ...updatedOrder, status: 'PREPARING' as const } : o)),
      );
    },
    onError: (error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      setActionError(extractApiError(error, 'Accept failed. The order may have been cancelled or claimed — board refreshed.'));
      void refetch();
    },
    onSettled: () => {
      void refetch();
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({
      orderId,
      reasonCode,
      reasonNotes,
    }: {
      orderId: string;
      reasonCode: string;
      reasonNotes?: string;
    }) => kdsApi.rejectOrder(orderId, reasonCode, reasonNotes),
    onMutate: async ({ orderId }) => {
      setActionError(null);
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<KDSOrder[]>(queryKey);
      queryClient.setQueryData<KDSOrder[]>(queryKey, (old = []) => {
        const next = old.filter((o) => o.id !== orderId);
        silenceAlarmIfAllAccepted(next);
        return next;
      });
      return { previous };
    },
    onSuccess: (updatedOrder) => {
      queryClient.setQueryData<KDSOrder[]>(queryKey, (old = []) =>
        old.filter((o) => o.id !== updatedOrder.id),
      );
    },
    onError: (error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      setActionError(extractApiError(error, 'Reject failed — the order has been restored. Please retry.'));
      void refetch();
    },
    onSettled: () => {
      void refetch();
    },
  });

  const readyMutation = useMutation({
    mutationFn: (orderId: string) => kdsApi.markOrderReady(orderId),
    onMutate: async (orderId) => {
      setActionError(null);
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<KDSOrder[]>(queryKey);
      queryClient.setQueryData<KDSOrder[]>(queryKey, (old = []) =>
        old.map((o) => (o.id === orderId ? { ...o, status: 'READY_FOR_PICKUP' as const } : o)),
      );
      return { previous };
    },
    onSuccess: (updatedOrder) => {
      queryClient.setQueryData<KDSOrder[]>(queryKey, (old = []) =>
        old.map((o) => (o.id === updatedOrder.id ? { ...o, ...updatedOrder, status: 'READY_FOR_PICKUP' } : o)),
      );
    },
    onError: (error, _orderId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      setActionError(extractApiError(error, 'Could not mark the order ready — it has been restored. Please retry.'));
      void refetch();
    },
    onSettled: () => {
      void refetch();
    },
  });

  const handoverMutation = useMutation({
    mutationFn: (orderId: string) => kdsApi.handoverOrder(orderId),
    onMutate: async (orderId) => {
      setActionError(null);
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<KDSOrder[]>(queryKey);
      queryClient.setQueryData<KDSOrder[]>(queryKey, (old = []) => old.filter((o) => o.id !== orderId));
      return { previous };
    },
    onSuccess: (updatedOrder) => {
      queryClient.setQueryData<KDSOrder[]>(queryKey, (old = []) =>
        old.filter((o) => o.id !== updatedOrder.id),
      );
    },
    onError: (error, _orderId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      setActionError(extractApiError(error, 'Handover failed — the order has been restored. Please retry.'));
      void refetch();
    },
    onSettled: () => {
      void refetch();
    },
  });

  // Errors are handled inside the mutations (rollback + banner); wrappers never
  // reject so fire-and-forget click handlers can't produce unhandled rejections.
  const safeMutate = async <TArgs, TFn extends (args: TArgs) => Promise<unknown>>(fn: TFn, args: TArgs) => {
    try {
      await fn(args);
    } catch {
      // handled by the mutation's onError
    }
  };

  const safeOrders = useMemo(() => (Array.isArray(orders) ? orders : []), [orders]);

  const newOrders = useMemo(
    () => safeOrders.filter((o) => o && (o.status === 'PLACED' || o.status === 'RIDER_ASSIGNED')),
    [safeOrders]
  );

  const inPreparationOrders = useMemo(
    () => safeOrders.filter((o) => o && (o.status === 'ACCEPTED' || o.status === 'PREPARING')),
    [safeOrders]
  );

  const readyOrders = useMemo(
    () => safeOrders.filter((o) => o && o.status === 'READY_FOR_PICKUP'),
    [safeOrders]
  );

  return {
    orders: safeOrders,
    isLoading,
    isError,
    error,
    refetch,
    isSocketConnected,
    actionError,
    dismissActionError: () => setActionError(null),
    newOrders,
    inPreparationOrders,
    readyOrders,
    acceptOrder: (orderId: string, prepTimeMinutes?: number) =>
      safeMutate((v: { orderId: string; prepTimeMinutes?: number }) => acceptMutation.mutateAsync(v), { orderId, prepTimeMinutes }),
    rejectOrder: (orderId: string, reasonCode: string, reasonNotes?: string) =>
      safeMutate((v: { orderId: string; reasonCode: string; reasonNotes?: string }) => rejectMutation.mutateAsync(v), { orderId, reasonCode, reasonNotes }),
    markOrderReady: (orderId: string) => safeMutate((id: string) => readyMutation.mutateAsync(id), orderId),
    handoverOrder: (orderId: string) => safeMutate((id: string) => handoverMutation.mutateAsync(id), orderId),
    isAccepting: acceptMutation.isPending,
    isRejecting: rejectMutation.isPending,
    isMarkingReady: readyMutation.isPending,
    isHandingOver: handoverMutation.isPending,
  };
};
