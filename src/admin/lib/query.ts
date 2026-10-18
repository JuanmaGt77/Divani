/**
 * Datos del panel con TanStack Query: caché compartida, recarga en segundo plano e
 * invalidación por tema.
 *   const { data, loading } = useData(['orders', from, to], () => api.orders.list(...), ['orders']);
 *   invalidate('orders')  → vuelve a pedir todas las consultas que dependen de pedidos.
 */
import { QueryCache, QueryClient, useQuery, type QueryKey } from '@tanstack/react-query';

export type Topic = 'orders' | 'products' | 'inventory' | 'taxonomy' | 'cash' | 'content' | 'settings';

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: (err) => console.error(err) }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

export interface DataState<T> {
  data: T | undefined;
  error: Error | null;
  /** Todavía no hay datos y se están pidiendo. */
  loading: boolean;
  /** Se están pidiendo de nuevo (ya hay datos en pantalla). */
  refreshing: boolean;
  refetch: () => void;
}

export function useData<T>(
  key: QueryKey,
  fetcher: () => Promise<T>,
  topics: Topic[] = [],
  { enabled = true }: { enabled?: boolean } = {},
): DataState<T> {
  const query = useQuery({
    queryKey: key,
    queryFn: fetcher,
    enabled,
    meta: { topics },
  });
  return {
    data: query.data,
    error: query.error,
    loading: query.isLoading,
    refreshing: query.isFetching,
    refetch: () => void query.refetch(),
  };
}

/** Vuelve a pedir las consultas de esos temas ('*' = todas). */
export function invalidate(...topics: (Topic | '*')[]): void {
  const everything = topics.includes('*');
  void queryClient.invalidateQueries({
    predicate: (q) => {
      if (everything) return true;
      const own = (q.meta?.topics as Topic[] | undefined) || [];
      return own.some((t) => topics.includes(t));
    },
  });
}

export function clearCache(): void {
  queryClient.clear();
}
