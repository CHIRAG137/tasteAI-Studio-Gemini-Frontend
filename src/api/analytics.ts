import { getAuthHeaders } from "@/utils/auth";

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;

export const getAgentAnalytics = async (botId: string) => {
  const res = await fetch(
    `${API_BASE_URL}/api/human-agent/bot/${botId}/agents`,
    {
      headers: getAuthHeaders(),
    }
  );

  if (!res.ok) {
    throw new Error("Failed to fetch agent analytics");
  }

  return res.json();
};

export interface AgentStats {
  agentId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  phoneNumber: string | null;
  isActive: boolean;
  isPasswordSet: boolean;
  isOnline: boolean;
  availabilityStatus: string;
  lastSeenAt: string;
  lastLoginAt: string;
  totalChatsAssigned: number;
  currentActiveChats: number;
  maxConcurrentChats: number;
  loadPercentage: number;
  hasCapacity: boolean;
  averageResponseTime: number;
  averageResolutionTime: number;
  averageRating: number;
  totalRatings: number;
  stats: {
    totalHandoffs: number;
    resolvedHandoffs: number;
    activeHandoffs: number;
    pendingHandoffs: number;
    abandonedHandoffs: number;
    transferredHandoffs: number;
    resolutionRate: number;
    totalEscalations: number;
    escalationRate: number;
    avgResponseTimeInSeconds: number;
    avgResolutionTimeInSeconds: number;
    avgUserRating: number;
    totalRatingsReceived: number;
  };
  skills: string[];
  timezone: string;
  emailNotifications: boolean;
  soundNotifications: boolean;
  autoAcceptChats: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AnalyticsSummary {
  totalAgents: number;
  activeAgents: number;
  onlineAgents: number;
  passwordSetAgents: number;
  totalHandoffs: number;
  totalResolved: number;
  totalEscalations: number;
  overallResolutionRate: number;
  avgResponseTimeInSeconds: number;
}
