import { Navigate, useLocation } from "react-router-dom";
import { getAgentAuthToken, removeAgentAuthToken } from "@/utils/agentAuth";
import { isTokenExpired } from "@/utils/tokenValidator";

interface AgentProtectedRouteProps {
  children: React.ReactNode;
}

export const AgentProtectedRoute = ({ children }: AgentProtectedRouteProps) => {
  const location = useLocation();
  const token = getAgentAuthToken();

  // Check if token exists
  if (!token) {
    return <Navigate to="/agent/login" state={{ from: location }} replace />;
  }

  // Check if token is expired
  if (isTokenExpired(token)) {
    // Clear the expired token from localStorage
    removeAgentAuthToken();
    // Redirect to agent login page
    return <Navigate to="/agent/login" state={{ from: location, expired: true }} replace />;
  }

  return <>{children}</>;
};
