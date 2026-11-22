// React Query hooks for the current user and authentication lifecycle.
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "./api";
import type { User } from "./types";
/** Load the authenticated user's profile without retrying expired sessions. */
export function useCurrentUser() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => apiRequest<User>("/users/me"),
    retry: false,
    staleTime: 60000,
  });
}
