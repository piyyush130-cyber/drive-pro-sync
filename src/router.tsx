import { QueryCache, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    queryCache: new QueryCache({
      // Central safety net so a failed fetch is never silent — individual
      // pages can still show their own inline error state on top of this.
      onError: (error, query) => {
        if (query.meta?.silent) return;
        toast.error(error instanceof Error ? error.message : "Something went wrong loading data.");
      },
    }),
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
