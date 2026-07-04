"use client";

import { useQuery } from "@tanstack/react-query";

export type Me = { id: string; email: string; role: string };

export function useMe() {
  const { data, isLoading } = useQuery<Me | null>({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me");
      if (res.status === 401) {
        return null;
      }
      if (!res.ok) {
        throw new Error("Failed to fetch user data");
      }
      return res.json();
    },
  });

  return { user: data, isAdmin: data?.role === "ADMIN", isLoading };
}
