import { QueryClient } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    const message = errorData?.message || errorData?.error?.message || (await res.text()) || res.statusText;
    throw new Error(message);
  }
}

export async function apiRequest(
  urlOrOptions: string | { url: string; method?: string; headers?: Record<string, string>; body?: any },
  options?: RequestInit
): Promise<any> {
  let url: string;
  let requestOptions: RequestInit;

  if (typeof urlOrOptions === 'string') {
    url = urlOrOptions;
    requestOptions = options || {};
  } else {
    url = urlOrOptions.url;
    requestOptions = {
      method: urlOrOptions.method || 'GET',
      headers: {
        ...(urlOrOptions.body && !(urlOrOptions.body instanceof FormData)
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...urlOrOptions.headers,
      },
      body: urlOrOptions.body
        ? (urlOrOptions.body instanceof FormData || typeof urlOrOptions.body === 'string'
            ? urlOrOptions.body
            : JSON.stringify(urlOrOptions.body))
        : undefined,
      ...options,
    };
  }

  const res = await fetch(url, {
    ...requestOptions,
    credentials: 'include',
  });

  await throwIfResNotOk(res);
  return await res.json();
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        const url = queryKey[0] as string;
        const res = await fetch(url, { credentials: "include" });
        await throwIfResNotOk(res);
        return await res.json();
      },
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 60 * 1000,
      retry: false,
    },
  },
});
