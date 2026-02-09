import { Navigate, useLocation } from "react-router-dom";
import { getAuthToken } from "@/utils/auth";

interface PublicRouteProps {
  children: React.ReactNode;
}

export const PublicRoute = ({ children }: PublicRouteProps) => {
  const location = useLocation();
  const token = getAuthToken();

  if (token) {
    // If user is authenticated and tries to access login/register, redirect to home
    // Check if there's a saved location they were trying to access before
    const from = (location.state as any)?.from?.pathname || "/";
    return <Navigate to={from} replace />;
  }

  return <>{children}</>;
};
