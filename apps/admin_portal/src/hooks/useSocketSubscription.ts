import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket } from '../services/socket';

export function useSocketQueryInvalidation(
  events: string[],
  queryKeys: (string | readonly unknown[])[]
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getSocket();

    const handler = () => {
      queryKeys.forEach((key) => {
        const queryKey = Array.isArray(key) ? key : [key];
        queryClient.invalidateQueries({ queryKey });
      });
    };

    events.forEach((event) => {
      socket.on(event, handler);
    });

    return () => {
      events.forEach((event) => {
        socket.off(event, handler);
      });
    };
  }, [events, queryKeys, queryClient]);
}
