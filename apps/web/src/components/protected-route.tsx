// Prevent protected pages from rendering without a valid session.
import { Navigate, Outlet } from "react-router-dom";
import { ApiError } from "../services/api";
import { useCurrentUser } from "../services/queries";
import { ErrorState, Loading } from "./ui";
/** Check the session before showing the authenticated application. */
export function ProtectedRoute() {
  const user = useCurrentUser();
  if (user.isLoading) return <Loading label="Checking your session..." />;
  if (user.error instanceof ApiError && user.error.status === 401)
    return <Navigate to="/login" replace />;
  if (user.error)
    return (
      <ErrorState
        message={user.error.message}
        retry={() => void user.refetch()}
      />
    );
  return <Outlet />;
}
