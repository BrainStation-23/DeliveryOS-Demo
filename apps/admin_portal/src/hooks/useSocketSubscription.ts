import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket } from '../services/socket';

// Call sites pass inline array literals, so depending on the raw arrays would
// resubscribe on every render. Serializing both into one primitive key keeps
// the subscription stable for identical (events, queryKeys) combinations while
// staying collision-free (JSON escaping distinguishes 'a' from ['a']).
export function buildSubscriptionKey(
  events: readonly string[],
  queryKeys: readonly (string | readonly unknown[])[],
): string {
  const normalizedKeys = queryKeys.map((key) => (Array.isArray(key) ? [...key] : [key]));
  return JSON.stringify([events, normalizedKeys]);
}

export function useSocketQueryInvalidation(
  events: string[],
  queryKeys: (string | readonly unknown[])[]
) {
  const queryClient = useQueryClient();
  const subscriptionKey = buildSubscriptionKey(events, queryKeys);

  const latestRef = useRef({ events, queryKeys, queryClient });

  useEffect(() => {
    latestRef.current = { events, queryKeys, queryClient };
  });

  useEffect(() => {
    const socket = getSocket();

    const handler = () => {
      const { queryKeys: currentKeys, queryClient: currentClient } = latestRef.current;
      currentKeys.forEach((key) => {
        const queryKey = Array.isArray(key) ? key : [key];
        currentClient.invalidateQueries({ queryKey });
      });
    };

    const currentEvents = latestRef.current.events;
    currentEvents.forEach((event) => {
      socket.on(event, handler);
    });

    return () => {
      currentEvents.forEach((event) => {
        socket.off(event, handler);
      });
    };
  }, [subscriptionKey]);
}
