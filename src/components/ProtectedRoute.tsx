import { Navigate, useLocation } from "react-router-dom";
import { getAuthToken, removeAuthToken } from "@/utils/auth";
import { isTokenExpired } from "@/utils/tokenValidator";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const location = useLocation();
  const token = getAuthToken();

  // Check if token exists
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if token is expired
  if (isTokenExpired(token)) {
    // Clear the expired token from localStorage
    removeAuthToken();
    // Redirect to login page
    return <Navigate to="/login" state={{ from: location, expired: true }} replace />;
  }

  return <>{children}</>;
};