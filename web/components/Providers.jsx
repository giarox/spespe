'use client';

import { ShoppingListProvider } from '@/components/ShoppingListContext'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes for mobile performance
      cacheTime: 10 * 60 * 1000, // 10 minutes cache
    },
  },
});

export default function Providers({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ShoppingListProvider>
        {children}
      </ShoppingListProvider>
    </QueryClientProvider>
  );
}