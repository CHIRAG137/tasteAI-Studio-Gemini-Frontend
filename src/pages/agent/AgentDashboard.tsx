import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Headphones, MessageSquare, Clock, LogOut, RefreshCw, Bot, CheckCircle,
  BarChart3, TrendingUp, Star, Zap, ArrowRight, Settings, Activity, Users,
  Timer, AlertTriangle, ArrowUpRight, History, X, ArrowDownRight, Bell
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { removeAgentAuthToken, removeAgentEmail, getAgentEmail, getAgentAuthHeaders, getAgentAuthToken } from "@/utils/agentAuth";
import { logoutAgentUser } from "@/api/auth";
import { useToast } from "@/hooks/use-toast";
import { getMeaningfulMessageCount } from "@/utils/flowSessionUtil";

interface EscalationInfo {
  wasEscalated: boolean;
  escalatedFrom: string;
  escalatedTo: string;
  escalatedAt: string;
  reason: string;
}

interface FlowHistoryItem {
  mode: "flow" | "handoff";
  type: string;
  content: any;
  timestamp: string;
  fromUser: boolean;
}

interface FlowSession {
  _id: string;
  currentNodeId?: string;
  currentMode: "flow" | "handoff";
  history: FlowHistoryItem[];
}

interface HandoffSession {
  _id: string;
  bot: {
    _id: string;
    name: string;
    description?: string;
  };
  status: "pending" | "active" | "resolved" | "abandoned";
  userQuestion: string;
  requestedAt: string;
  acceptedAt?: string;
  resolvedAt?: string;
  isCurrentAssignee: boolean;
  escalationInfo?: EscalationInfo;
  flowSession?: FlowSession;
  messages: Array<{
    sender: string;
    message: string;
    timestamp: string;
  }>;
}

interface AgentStats {
  agent: {
    email: string;
    isOnline: boolean;
    availabilityStatus: string;
    currentActiveChats: number;
    maxConcurrentChats: number;
    loadPercentage: number;
  };
  metrics: {
    totalChatsHandled: number;
    averageResponseTime: number;
    averageResolutionTime: number;
    averageRating: number;
    totalRatings: number;
  };
  sessions: {
    total: number;
    active: number;
    resolved: number;
    today: number;
  };
  escalations: {
    totalAssigned: number;
    currentlyActive: number;
    escalatedAway: number;
    escalatedTo: number;
    resolvedByAgent: number;
    byReason: {
      [key: string]: number;
    };
  };
}

interface BotInfo {
  _id: string;
  name: string;
  description?: string;
  isActive?: boolean;
  category?: string;
  enabled?: boolean;
  primary_purpose?: string;
}

interface EscalationNotification {
  id: string;
  type: 'escalated_away' | 'escalated_to';
  sessions: HandoffSession[];
  timestamp: string;
}

const ESCALATION_STORAGE_KEY = 'agent_escalation_notifications';

const AgentDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<HandoffSession[]>([]);
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [enabledBots, setEnabledBots] = useState<BotInfo[]>([]);
  const [disabledBots, setDisabledBots] = useState<BotInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingBots, setIsLoadingBots] = useState(true);
  const [activeTab, setActiveTab] = useState("active");
  const [botFilterTab, setBotFilterTab] = useState("enabled");
  const [escalationNotifications, setEscalationNotifications] = useState<EscalationNotification[]>([]);
  const [dismissedNotifications, setDismissedNotifications] = useState<Set<string>>(new Set());

  const agentEmail = getAgentEmail();

  // Load dismissed notifications from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(ESCALATION_STORAGE_KEY);
    if (stored) {
      try {
        const dismissedArray = JSON.parse(stored) as string[];
        const dismissed = new Set<string>(dismissedArray);
        setDismissedNotifications(dismissed);
      } catch (e) {
        console.error('Error loading dismissed notifications:', e);
      }
    }
  }, []);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Fetch bots on mount
  useEffect(() => {
    fetchBots();
  }, []);

  // Check for new escalations and create notifications
  useEffect(() => {
    if (sessions.length > 0) {
      checkForNewEscalations();
    }
  }, [sessions]);

  const checkForNewEscalations = () => {
    const now = new Date();
    const notifications: EscalationNotification[] = [];

    // Find sessions escalated away (not current assignee but in escalation history)
    const escalatedAwaySessions = sessions.filter(s =>
      !s.isCurrentAssignee && s.escalationInfo?.wasEscalated
    );

    // Find sessions escalated to this agent (current assignee with escalation info)
    const escalatedToSessions = sessions.filter(s =>
      s.isCurrentAssignee &&
      s.escalationInfo?.wasEscalated &&
      (s.status === 'pending' || s.status === 'active')
    );

    // Group escalated away sessions by time (within 1 minute)
    if (escalatedAwaySessions.length > 0) {
      const notificationId = `away_${escalatedAwaySessions.map(s => s._id).join('_')}`;
      if (!dismissedNotifications.has(notificationId)) {
        notifications.push({
          id: notificationId,
          type: 'escalated_away',
          sessions: escalatedAwaySessions,
          timestamp: now.toISOString()
        });
      }
    }

    // Group escalated to sessions
    if (escalatedToSessions.length > 0) {
      const notificationId = `to_${escalatedToSessions.map(s => s._id).join('_')}`;
      if (!dismissedNotifications.has(notificationId)) {
        notifications.push({
          id: notificationId,
          type: 'escalated_to',
          sessions: escalatedToSessions,
          timestamp: now.toISOString()
        });
      }
    }

    setEscalationNotifications(notifications);
  };

  const dismissNotification = (notificationId: string) => {
    const newDismissed = new Set(dismissedNotifications);
    newDismissed.add(notificationId);
    setDismissedNotifications(newDismissed);
    localStorage.setItem(ESCALATION_STORAGE_KEY, JSON.stringify([...newDismissed]));

    setEscalationNotifications(prev =>
      prev.filter(n => n.id !== notificationId)
    );
  };

  const handleNotificationClick = (notification: EscalationNotification) => {
    // Navigate to escalated tab
    setActiveTab('escalated');
    // Dismiss after clicking
    dismissNotification(notification.id);
  };

  const fetchData = async () => {
    await Promise.all([fetchSessions(), fetchStats()]);
  };

  const fetchSessions = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/handoff/sessions?includeEscalated=true&status=all`,
        {
          headers: {
            "Content-Type": "application/json",
            ...getAgentAuthHeaders(),
          },
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch sessions");
      }
      setSessions(data.result.sessions || []);
    } catch (error: any) {
      console.error("Error fetching sessions:", error);
      if (!isLoading) {
        toast({
          title: "Error",
          description: error.message || "Failed to load sessions",
          variant: "destructive",
        });
      }
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/human-agent/stats`,
        {
          headers: {
            "Content-Type": "application/json",
            ...getAgentAuthHeaders(),
          },
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch stats");
      }
      setStats(data.result);
    } catch (error: any) {
      console.error("Error fetching stats:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBots = async () => {
    try {
      setIsLoadingBots(true);
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/human-agent/bots`,
        {
          headers: {
            "Content-Type": "application/json",
            ...getAgentAuthHeaders(),
          },
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch bots");
      }

      const botsData = data.result?.bots;
      if (botsData) {
        const enabled = (botsData.enabledBots || []).map((bot: any) => ({
          ...bot,
          enabled: true,
          category: bot.primary_purpose
        }));
        const disabled = (botsData.disabledBots || []).map((bot: any) => ({
          ...bot,
          enabled: false,
          category: bot.primary_purpose
        }));

        setEnabledBots(enabled);
        setDisabledBots(disabled);
      }
    } catch (error: any) {
      console.error("Error fetching bots:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to load bots",
        variant: "destructive",
      });
    } finally {
      setIsLoadingBots(false);
    }
  };

  const updateStatus = async (isOnline: boolean, availabilityStatus?: string) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/human-agent/status`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...getAgentAuthHeaders(),
          },
          body: JSON.stringify({
            isOnline,
            availabilityStatus: availabilityStatus || (isOnline ? "available" : "offline"),
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update status");
      }

      toast({
        title: "Status Updated",
        description: `You are now ${isOnline ? "online" : "offline"}`,
      });

      await fetchStats();
    } catch (error: any) {
      console.error("Error updating status:", error);
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      });
    }
  };

  const handleLogout = async () => {
    try {
      // First, set agent to offline
      await updateStatus(false, "offline");

      // Call logout API
      const token = getAgentAuthToken();
      if (token) {
        await logoutAgentUser(token);
      }

      // Clear tokens and email from localStorage
      removeAgentAuthToken();
      removeAgentEmail();

      toast({
        title: "Success",
        description: "Logged out successfully",
      });

      // Redirect to login page
      navigate("/agent/login", { replace: true });
    } catch (error) {
      console.error("Logout error:", error);
      // Clear tokens anyway even if API call fails
      removeAgentAuthToken();
      removeAgentEmail();
      navigate("/agent/login", { replace: true });
    }
  };

  const handleSessionClick = (sessionId: string) => {
    navigate(`/agent/chat/${sessionId}`);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const formatEscalationReason = (reason: string) => {
    const reasons: { [key: string]: string } = {
      'agent_removed_from_bot': 'Agent Removed',
      'no_response': 'No Response',
      'manual_transfer': 'Manual Transfer',
      'agent_offline': 'Agent Offline'
    };
    return reasons[reason] || reason;
  };

  // Filter sessions
  const activeSessions = sessions.filter(s =>
    s.isCurrentAssignee && (s.status === "pending" || s.status === "active")
  );
  const resolvedSessions = sessions.filter(s =>
    s.isCurrentAssignee && s.status === "resolved"
  );
  const escalatedAwaySessions = sessions.filter(s =>
    !s.isCurrentAssignee && s.escalationInfo?.wasEscalated
  );
  const escalatedToMeSessions = sessions.filter(s =>
    s.isCurrentAssignee && s.escalationInfo?.wasEscalated
  );
  const pendingSessions = sessions.filter(s =>
    s.isCurrentAssignee && s.status === "pending"
  );

  const isOnline = stats?.agent.isOnline && stats?.agent.availabilityStatus === "available";

  // Get current bots to display based on filter
  const displayBots = botFilterTab === "enabled" ? enabledBots :
    botFilterTab === "disabled" ? disabledBots :
      [...enabledBots, ...disabledBots];

  const totalBots = enabledBots.length + disabledBots.length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-primary shadow-medium">
                  <Headphones className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-foreground">
                    Agent Portal
                  </h1>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`} />
                    <span className="text-xs text-muted-foreground">
                      {isOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {escalationNotifications.length > 0 && (
                <div className="relative">
                  <Bell className="w-5 h-5 text-primary animate-pulse" />
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-white text-xs rounded-full flex items-center justify-center">
                    {escalationNotifications.length}
                  </span>
                </div>
              )}

              <Button
                size="sm"
                variant="ghost"
                onClick={fetchData}
                className="h-9 w-9 p-0"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>

              {stats && (
                <Button
                  size="sm"
                  onClick={() => updateStatus(!stats.agent.isOnline)}
                  variant={isOnline ? "outline" : "default"}
                  className={isOnline
                    ? "border-destructive/50 text-destructive hover:bg-destructive/10"
                    : "bg-success hover:bg-success/90 text-success-foreground"
                  }
                >
                  {isOnline ? "Go Offline" : "Go Online"}
                </Button>
              )}

              <Button
                size="sm"
                variant="ghost"
                onClick={() => navigate("/agent/profile")}
                className="h-9 w-9 p-0"
              >
                <Settings className="w-4 h-4" />
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={handleLogout}
                className="gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Welcome Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              Welcome back
            </h2>
            <p className="text-muted-foreground text-sm">
              {agentEmail}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Activity className="w-4 h-4" />
            <span>Auto-refreshing every 5s</span>
          </div>
        </div>

        {/* Escalation Notifications */}
        {escalationNotifications.map((notification) => (
          <EscalationNotificationBanner
            key={notification.id}
            notification={notification}
            onDismiss={dismissNotification}
            onClick={handleNotificationClick}
          />
        ))}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            icon={MessageSquare}
            label="Active Chats"
            value={stats?.agent.currentActiveChats || 0}
            variant="primary"
            animate={stats && stats.agent.currentActiveChats > 0}
          />
          <StatCard
            icon={Clock}
            label="Pending"
            value={pendingSessions.length}
            variant="warning"
            animate={pendingSessions.length > 0}
          />
          <StatCard
            icon={CheckCircle}
            label="Resolved Today"
            value={stats?.sessions.today || 0}
            variant="success"
          />
          <StatCard
            icon={ArrowUpRight}
            label="Escalated To Me"
            value={stats?.escalations.escalatedTo || 0}
            variant="info"
            animate={escalatedToMeSessions.length > 0}
          />
          <StatCard
            icon={Zap}
            label="Load"
            value={`${stats?.agent.loadPercentage || 0}%`}
            variant="accent"
            progress={stats?.agent.loadPercentage || 0}
          />
        </div>

        {/* Two Column Layout */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Sessions */}
          <div className="lg:col-span-2 space-y-6">
            {/* Support Queue */}
            <Card className="shadow-soft">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <MessageSquare className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Support Queue</CardTitle>
                      <CardDescription>Manage incoming requests</CardDescription>
                    </div>
                  </div>
                  {activeSessions.length > 0 && (
                    <Badge variant="default" className="text-xs">
                      {activeSessions.length} active
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="w-full grid grid-cols-4 mb-4">
                    <TabsTrigger value="active" className="text-sm">
                      Active
                      {activeSessions.length > 0 && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs bg-primary text-primary-foreground">
                          {activeSessions.length}
                        </span>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="escalated" className="text-sm">
                      Escalated
                      {(escalatedAwaySessions.length + escalatedToMeSessions.length) > 0 && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs bg-amber-500 text-white">
                          {escalatedAwaySessions.length + escalatedToMeSessions.length}
                        </span>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="resolved" className="text-sm">Resolved</TabsTrigger>
                    <TabsTrigger value="all" className="text-sm">All</TabsTrigger>
                  </TabsList>

                  <TabsContent value="active" className="mt-0">
                    {isLoading ? (
                      <LoadingState />
                    ) : activeSessions.length === 0 ? (
                      <EmptyState
                        icon={MessageSquare}
                        title="No active sessions"
                        description="You're all caught up! New requests will appear here."
                      />
                    ) : (
                      <ScrollArea className="h-[380px]">
                        <div className="space-y-3 pr-4">
                          {activeSessions.map((session) => (
                            <SessionCard
                              key={session._id}
                              session={session}
                              onClick={handleSessionClick}
                              formatTime={formatTime}
                              formatEscalationReason={formatEscalationReason}
                              showEscalationTag={true}
                              showInlineEscalation={true}
                            />
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </TabsContent>

                  <TabsContent value="escalated" className="mt-0">
                    {(escalatedAwaySessions.length + escalatedToMeSessions.length) === 0 ? (
                      <EmptyState
                        icon={History}
                        title="No escalated sessions"
                        description="Sessions escalated from or to other agents will appear here"
                      />
                    ) : (
                      <ScrollArea className="h-[380px]">
                        <div className="space-y-4 pr-4">
                          {/* Sessions Escalated Away */}
                          {escalatedAwaySessions.length > 0 && (
                            <div>
                              <div className="flex items-center gap-2 mb-3">
                                <ArrowDownRight className="w-4 h-4 text-rose-500" />
                                <h3 className="text-sm font-semibold text-foreground">
                                  Escalated Away ({escalatedAwaySessions.length})
                                </h3>
                              </div>
                              <div className="space-y-3">
                                {escalatedAwaySessions.map((session) => (
                                  <SessionCard
                                    key={session._id}
                                    session={session}
                                    onClick={handleSessionClick}
                                    formatTime={formatTime}
                                    formatEscalationReason={formatEscalationReason}
                                    showEscalationDetails={true}
                                    escalationType="away"
                                  />
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Sessions Escalated To Me */}
                          {escalatedToMeSessions.length > 0 && (
                            <div>
                              <div className="flex items-center gap-2 mb-3">
                                <ArrowUpRight className="w-4 h-4 text-blue-500" />
                                <h3 className="text-sm font-semibold text-foreground">
                                  Escalated To Me ({escalatedToMeSessions.length})
                                </h3>
                              </div>
                              <div className="space-y-3">
                                {escalatedToMeSessions.map((session) => (
                                  <SessionCard
                                    key={session._id}
                                    session={session}
                                    onClick={handleSessionClick}
                                    formatTime={formatTime}
                                    formatEscalationReason={formatEscalationReason}
                                    showEscalationDetails={true}
                                    escalationType="to"
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    )}
                  </TabsContent>

                  <TabsContent value="resolved" className="mt-0">
                    {resolvedSessions.length === 0 ? (
                      <EmptyState
                        icon={CheckCircle}
                        title="No resolved sessions"
                        description="Resolved conversations will appear here"
                      />
                    ) : (
                      <ScrollArea className="h-[380px]">
                        <div className="space-y-3 pr-4">
                          {resolvedSessions.map((session) => (
                            <SessionCard
                              key={session._id}
                              session={session}
                              onClick={handleSessionClick}
                              formatTime={formatTime}
                              formatEscalationReason={formatEscalationReason}
                            />
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </TabsContent>

                  <TabsContent value="all" className="mt-0">
                    {sessions.length === 0 ? (
                      <EmptyState
                        icon={MessageSquare}
                        title="No sessions yet"
                        description="Support sessions will appear here"
                      />
                    ) : (
                      <ScrollArea className="h-[380px]">
                        <div className="space-y-3 pr-4">
                          {sessions.map((session) => (
                            <SessionCard
                              key={session._id}
                              session={session}
                              onClick={handleSessionClick}
                              formatTime={formatTime}
                              formatEscalationReason={formatEscalationReason}
                            />
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Stats & Bots */}
          <div className="space-y-6">
            {/* Performance Card */}
            <Card className="shadow-soft">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-success/10">
                    <BarChart3 className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Performance</CardTitle>
                    <CardDescription>Your metrics</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <MetricRow
                  icon={Users}
                  label="Total Handled"
                  value={stats?.metrics.totalChatsHandled || 0}
                />
                <MetricRow
                  icon={Timer}
                  label="Avg Response"
                  value={stats?.metrics.averageResponseTime ? formatDuration(stats.metrics.averageResponseTime) : '0s'}
                />
                <MetricRow
                  icon={TrendingUp}
                  label="Avg Resolution"
                  value={stats?.metrics.averageResolutionTime ? formatDuration(stats.metrics.averageResolutionTime) : '0s'}
                />
                <MetricRow
                  icon={Star}
                  label="Rating"
                  value={stats?.metrics.averageRating ? `${stats.metrics.averageRating.toFixed(1)} ★` : 'N/A'}
                  highlight={stats?.metrics.averageRating >= 4}
                />
                <div className="pt-3 border-t">
                  <MetricRow
                    icon={ArrowDownRight}
                    label="Escalated Away"
                    value={stats?.escalations.escalatedAway || 0}
                    variant="warning"
                  />
                </div>
              </CardContent>
            </Card>

            {/* My Bots Card */}
            <Card className="shadow-soft">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-accent/10">
                      <Bot className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">My Bots</CardTitle>
                      <CardDescription>Assigned bots</CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {totalBots}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingBots ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : totalBots === 0 ? (
                  <div className="text-center py-8">
                    <Bot className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">No bots assigned</p>
                  </div>
                ) : (
                  <>
                    <Tabs value={botFilterTab} onValueChange={setBotFilterTab} className="w-full mb-4">
                      <TabsList className="w-full grid grid-cols-3">
                        <TabsTrigger value="enabled" className="text-xs">
                          Enabled
                          {enabledBots.length > 0 && (
                            <span className="ml-1 text-xs">({enabledBots.length})</span>
                          )}
                        </TabsTrigger>
                        <TabsTrigger value="disabled" className="text-xs">
                          Disabled
                          {disabledBots.length > 0 && (
                            <span className="ml-1 text-xs">({disabledBots.length})</span>
                          )}
                        </TabsTrigger>
                        <TabsTrigger value="all" className="text-xs">
                          All
                          <span className="ml-1 text-xs">({totalBots})</span>
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>

                    <ScrollArea className="max-h-[320px]">
                      <div className="space-y-2 pr-4">
                        {displayBots.length === 0 ? (
                          <div className="text-center py-8">
                            <Bot className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                            <p className="text-sm text-muted-foreground">
                              {botFilterTab === "enabled" ? "No enabled bots" : "No disabled bots"}
                            </p>
                          </div>
                        ) : (
                          displayBots.map((bot) => (
                            <div
                              key={bot._id}
                              className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                            >
                              <Avatar className="h-8 w-8 shrink-0">
                                <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                                  {bot.name.slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {bot.name}
                                </p>
                                {bot.category && (
                                  <p className="text-xs text-muted-foreground capitalize">
                                    {bot.category.replace('-', ' ')}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {bot.isActive && (
                                  <div
                                    className="w-2 h-2 rounded-full bg-success"
                                    title="Bot is active"
                                  />
                                )}
                                <Badge
                                  variant={bot.enabled ? "default" : "secondary"}
                                  className={`text-xs ${bot.enabled
                                    ? "bg-success/10 text-success border-success/20"
                                    : "bg-muted text-muted-foreground"
                                    }`}
                                >
                                  {bot.enabled ? "Enabled" : "Disabled"}
                                </Badge>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center pt-4 pb-6">
          <p className="text-xs text-muted-foreground">
            Powered by TasteAI Studio
          </p>
        </footer>
      </main>
    </div>
  );
};

// Escalation Notification Banner Component
const EscalationNotificationBanner = ({
  notification,
  onDismiss,
  onClick
}: {
  notification: EscalationNotification;
  onDismiss: (id: string) => void;
  onClick: (notification: EscalationNotification) => void;
}) => {
  const isEscalatedAway = notification.type === 'escalated_away';
  const sessionCount = notification.sessions.length;

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${isEscalatedAway
        ? 'border-rose-500/50 bg-rose-500/5'
        : 'border-blue-500/50 bg-blue-500/5'
        }`}
      onClick={() => onClick(notification)}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg mt-0.5 ${isEscalatedAway
            ? 'bg-rose-500/10'
            : 'bg-blue-500/10'
            }`}>
            {isEscalatedAway ? (
              <ArrowDownRight className="w-5 h-5 text-rose-600" />
            ) : (
              <ArrowUpRight className="w-5 h-5 text-blue-600" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className={`font-semibold text-sm mb-1 ${isEscalatedAway ? 'text-rose-700' : 'text-blue-700'
                  }`}>
                  {isEscalatedAway
                    ? `${sessionCount} Session${sessionCount > 1 ? 's' : ''} Escalated Away`
                    : `${sessionCount} New Escalated Session${sessionCount > 1 ? 's' : ''}`
                  }
                </h3>
                <p className="text-sm text-muted-foreground">
                  {isEscalatedAway ? (
                    <>
                      Your session{sessionCount > 1 ? 's have' : ' has'} been reassigned to{' '}
                      {notification.sessions.length === 1
                        ? notification.sessions[0].escalationInfo?.escalatedTo || 'another agent'
                        : `${sessionCount} other agents`
                      }
                      {'. '}
                      <span className="text-rose-600 font-medium">
                        Reason: {formatEscalationReason(notification.sessions[0].escalationInfo?.reason || '')}
                      </span>
                    </>
                  ) : (
                    <>
                      You've been assigned {sessionCount} session{sessionCount > 1 ? 's' : ''} from{' '}
                      {notification.sessions.length === 1
                        ? notification.sessions[0].escalationInfo?.escalatedTo || 'another agent'
                        : 'other agents'
                      }
                      {'. '}
                      <span className="text-blue-600 font-medium">
                        Click to view
                      </span>
                    </>
                  )}
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {notification.sessions.slice(0, 3).map(session => (
                    <Badge key={session._id} variant="outline" className="text-xs">
                      {session.bot.name}
                    </Badge>
                  ))}
                  {notification.sessions.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{notification.sessions.length - 3} more
                    </Badge>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss(notification.id);
                }}
                className="h-7 w-7 p-0 shrink-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Helper function for formatting escalation reasons
const formatEscalationReason = (reason: string) => {
  const reasons: { [key: string]: string } = {
    'agent_removed_from_bot': 'Agent Removed from Bot',
    'no_response': 'No Response',
    'manual_transfer': 'Manual Transfer',
    'agent_offline': 'Agent Offline'
  };
  return reasons[reason] || reason;
};

// Stat Card Component
const StatCard = ({
  icon: Icon,
  label,
  value,
  variant,
  animate = false,
  progress
}: {
  icon: any;
  label: string;
  value: string | number;
  variant: 'primary' | 'success' | 'warning' | 'accent' | 'info';
  animate?: boolean;
  progress?: number;
}) => {
  const variantStyles = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-success/10 text-success',
    warning: 'bg-amber-500/10 text-amber-600',
    accent: 'bg-accent/10 text-accent',
    info: 'bg-blue-500/10 text-blue-600'
  };

  return (
    <Card className="shadow-soft hover:shadow-medium transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className={`p-2 rounded-lg ${variantStyles[variant]} ${animate ? 'animate-pulse' : ''}`}>
            <Icon className="w-4 h-4" />
          </div>
          <span className="text-2xl font-bold text-foreground">{value}</span>
        </div>
        <p className="text-sm text-muted-foreground mt-2">{label}</p>
        {progress !== undefined && (
          <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-500"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Metric Row Component
const MetricRow = ({
  icon: Icon,
  label,
  value,
  highlight = false,
  variant
}: {
  icon: any;
  label: string;
  value: string | number;
  highlight?: boolean;
  variant?: 'warning';
}) => (
  <div className="flex items-center justify-between py-2">
    <div className="flex items-center gap-2 text-muted-foreground">
      <Icon className="w-4 h-4" />
      <span className="text-sm">{label}</span>
    </div>
    <span className={`text-sm font-semibold ${highlight ? 'text-success' :
      variant === 'warning' ? 'text-amber-600' :
        'text-foreground'
      }`}>
      {value}
    </span>
  </div>
);

// Loading State Component
const LoadingState = () => (
  <div className="flex flex-col items-center justify-center py-12">
    <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground mb-3" />
    <p className="text-sm text-muted-foreground">Loading sessions...</p>
  </div>
);

// Empty State Component
const EmptyState = ({
  icon: Icon,
  title,
  description
}: {
  icon: any;
  title: string;
  description: string;
}) => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <div className="p-3 rounded-full bg-muted mb-3">
      <Icon className="w-6 h-6 text-muted-foreground" />
    </div>
    <p className="text-sm font-medium text-foreground">{title}</p>
    <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">{description}</p>
  </div>
);

// Session Card Component
const SessionCard = ({
  session,
  onClick,
  formatTime,
  formatEscalationReason,
  showEscalationTag = false,
  showEscalationDetails = false,
  showInlineEscalation = false,
  escalationType
}: {
  session: HandoffSession;
  onClick: (id: string) => void;
  formatTime: (date: string) => string;
  formatEscalationReason: (reason: string) => string;
  showEscalationTag?: boolean;
  showEscalationDetails?: boolean;
  showInlineEscalation?: boolean;
  escalationType?: 'away' | 'to';
}) => {
  const statusConfig = {
    pending: {
      badge: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
      dot: 'bg-amber-500',
      label: 'Pending'
    },
    active: {
      badge: 'bg-success/10 text-success border-success/20',
      dot: 'bg-success',
      label: 'Active'
    },
    resolved: {
      badge: 'bg-muted text-muted-foreground border-border',
      dot: 'bg-muted-foreground',
      label: 'Resolved'
    },
    abandoned: {
      badge: 'bg-destructive/10 text-destructive border-destructive/20',
      dot: 'bg-destructive',
      label: 'Abandoned'
    }
  };

  const config = statusConfig[session.status];
  const isEscalated = session.escalationInfo?.wasEscalated;
  const isEscalatedToMe = session.isCurrentAssignee && isEscalated;

  return (
    <Card
      className={`group cursor-pointer border hover:border-primary/30 hover:shadow-soft transition-all ${escalationType === 'away' ? 'border-rose-500/30 bg-rose-500/5' :
        escalationType === 'to' ? 'border-blue-500/30 bg-blue-500/5' :
          (isEscalatedToMe && showInlineEscalation) ? 'border-blue-500/20 bg-blue-500/5' : ''
        }`}
      onClick={() => onClick(session._id)}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
              {session.bot.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-semibold text-sm text-foreground truncate">
                {session.bot.name}
              </span>
              <Badge variant="outline" className={`text-xs ${config.badge}`}>
                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${config.dot} ${session.status === 'active' ? 'animate-pulse' : ''}`} />
                {config.label}
              </Badge>
              {session.status === "pending" && session.isCurrentAssignee && !isEscalatedToMe && (
                <Badge className="bg-destructive text-destructive-foreground text-xs animate-pulse">
                  New
                </Badge>
              )}
              {isEscalatedToMe && showEscalationTag && (
                <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-xs">
                  <ArrowUpRight className="w-3 h-3 mr-1" />
                  From Escalation
                </Badge>
              )}
            </div>

            {session.userQuestion && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                "{session.userQuestion}"
              </p>
            )}

            {/* Show escalation details inline for active/pending escalated sessions */}
            {showInlineEscalation && isEscalatedToMe && session.escalationInfo && (
              <div className="mb-2 p-2 rounded-md bg-blue-500/10 border border-blue-500/20">
                <p className="text-xs text-blue-700">
                  <span className="font-medium">⚡ Escalated from:</span> {session.escalationInfo.escalatedTo}
                  {' • '}
                  <span className="font-medium">Previous status:</span> {session.escalationInfo.escalatedFrom}
                  {' • '}
                  <span className="font-medium">Reason:</span> {formatEscalationReason(session.escalationInfo.reason)}
                </p>
              </div>
            )}

            {/* Show escalation details for escalated tab */}
            {showEscalationDetails && isEscalated && session.escalationInfo && (
              <div className={`mb-2 p-2 rounded-md border ${escalationType === 'away'
                ? 'bg-rose-500/10 border-rose-500/20'
                : 'bg-blue-500/10 border-blue-500/20'
                }`}>
                <p className={`text-xs ${escalationType === 'away' ? 'text-rose-700' : 'text-blue-700'
                  }`}>
                  {escalationType === 'away' ? (
                    <>
                      <span className="font-medium">Escalated to:</span> {session.escalationInfo.escalatedTo}
                      {' • '}
                      <span className="font-medium">From status:</span> {session.escalationInfo.escalatedFrom}
                      {' • '}
                      <span className="font-medium">Reason:</span> {formatEscalationReason(session.escalationInfo.reason)}
                    </>
                  ) : (
                    <>
                      <span className="font-medium">Escalated from:</span> {session.escalationInfo.escalatedTo}
                      {' • '}
                      <span className="font-medium">Previous status:</span> {session.escalationInfo.escalatedFrom}
                      {' • '}
                      <span className="font-medium">Reason:</span> {formatEscalationReason(session.escalationInfo.reason)}
                    </>
                  )}
                </p>
              </div>
            )}

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                {getMeaningfulMessageCount(
                session.flowSession?.history
                )}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTime(session.requestedAt)}
              </span>
            </div>
          </div>

          <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
        </div>
      </CardContent>
    </Card>
  );
};

export default AgentDashboard;
