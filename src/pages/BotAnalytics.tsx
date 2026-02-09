import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  ArrowLeft, BarChart3, Users, MessageSquare, TrendingUp, Clock, 
  AlertCircle, Phone, Activity, Calendar, RefreshCw, Star,
  CheckCircle2, XCircle, UserCheck, Timer, Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getAgentAnalytics, type AgentStats, type AnalyticsSummary } from "@/api/analytics";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { getAuthHeaders } from "@/utils/auth";

const BotAnalytics = () => {
  const { botId } = useParams<{ botId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<AgentStats[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [botName, setBotName] = useState<string>("");

  useEffect(() => {
    fetchBotDetails();
    fetchAnalytics();
  }, [botId]);

  const fetchBotDetails = async () => {
    try {
      if (!botId) return;
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/bots/${botId}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data?.result?.name) {
        setBotName(data.result.name);
      }
    } catch (err) {
      console.error("Error fetching bot details:", err);
    }
  };

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!botId) {
        throw new Error("Bot ID is required");
      }

      const response = await getAgentAnalytics(botId);
      
      if (response.result) {
        setAgents(response.result.agents || []);
        setSummary(response.result.summary || null);
      }
    } catch (err) {
      console.error("Error fetching analytics:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch analytics";
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ 
    icon: Icon, 
    title, 
    value, 
    subtitle,
  }: { 
    icon: any; 
    title: string; 
    value: string | number; 
    subtitle?: string;
  }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="p-2 bg-primary/10 rounded-lg">
            <Icon className="w-5 h-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const AgentCard = ({ agent }: { agent: AgentStats }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {agent.avatarUrl ? (
              <img
                src={agent.avatarUrl}
                alt={agent.displayName}
                className="w-10 h-10 rounded-full"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                {agent.displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base truncate">{agent.displayName}</CardTitle>
              <p className="text-sm text-muted-foreground truncate">{agent.email}</p>
            </div>
          </div>
          <div className="flex gap-1.5">
            <Badge variant={agent.isOnline ? "default" : "secondary"}>
              {agent.isOnline ? "Online" : "Offline"}
            </Badge>
            <Badge variant={agent.isActive ? "outline" : "destructive"}>
              {agent.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status Info */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Last Seen</p>
              <p className="font-medium">
                {agent.lastSeenAt ? new Date(agent.lastSeenAt).toLocaleDateString() : "N/A"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Phone className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Phone</p>
              <p className="font-medium truncate">{agent.phoneNumber || "N/A"}</p>
            </div>
          </div>
        </div>

        {/* Capacity */}
        <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-muted-foreground" />
              Chat Capacity
            </span>
            <span className="font-medium">
              {agent.currentActiveChats} / {agent.maxConcurrentChats}
            </span>
          </div>
          <Progress value={agent.loadPercentage} className="h-2" />
          <p className="text-xs text-muted-foreground text-right">{agent.loadPercentage}% loaded</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
              <MessageSquare className="w-3 h-3" /> Handoffs
            </p>
            <p className="text-lg font-bold">{agent.stats.totalHandoffs}</p>
            <p className="text-xs text-muted-foreground">
              {agent.stats.resolvedHandoffs} resolved
            </p>
          </div>

          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
              <TrendingUp className="w-3 h-3" /> Resolution
            </p>
            <p className="text-lg font-bold">{agent.stats.resolutionRate}%</p>
            <p className="text-xs text-muted-foreground">Success rate</p>
          </div>

          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
              <Clock className="w-3 h-3" /> Avg Response
            </p>
            <p className="text-lg font-bold">{agent.stats.avgResponseTimeInSeconds}s</p>
            <p className="text-xs text-muted-foreground">First reply</p>
          </div>

          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
              <AlertCircle className="w-3 h-3" /> Escalations
            </p>
            <p className="text-lg font-bold">{agent.stats.totalEscalations}</p>
            <p className="text-xs text-muted-foreground">{agent.stats.escalationRate}% rate</p>
          </div>
        </div>

        {/* Resolution Time */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Timer className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">Avg Resolution Time</span>
          </div>
          <span className="font-bold">
            {Math.floor(agent.stats.avgResolutionTimeInSeconds / 60)}m{" "}
            {agent.stats.avgResolutionTimeInSeconds % 60}s
          </span>
        </div>

        {/* Rating */}
        {agent.stats.totalRatingsReceived > 0 && (
          <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-lg">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span className="text-sm font-medium">User Rating</span>
            </div>
            <div className="text-right">
              <span className="font-bold">{agent.stats.avgUserRating.toFixed(1)} / 5.0</span>
              <p className="text-xs text-muted-foreground">{agent.stats.totalRatingsReceived} ratings</p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Shield className="w-3 h-3" />
            Password: {agent.isPasswordSet ? (
              <CheckCircle2 className="w-3 h-3 text-green-500" />
            ) : (
              <XCircle className="w-3 h-3 text-destructive" />
            )}
          </div>
          <Badge variant="outline" className="text-xs capitalize">
            {agent.availabilityStatus}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b bg-card">
          <div className="container mx-auto px-6 py-6">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/")}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </Button>
              <div className="h-6 w-px bg-border" />
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <BarChart3 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold">Analytics</h1>
                  <p className="text-sm text-muted-foreground">{botName || "Loading..."}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-6 py-6">
          <Card className="border-destructive/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-destructive" />
                <div>
                  <p className="font-semibold text-destructive">Error Loading Analytics</p>
                  <p className="text-sm text-muted-foreground">{error}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/")}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </Button>
              <div className="h-6 w-px bg-border" />
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <BarChart3 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold">Analytics</h1>
                  <p className="text-sm text-muted-foreground">{botName || "Loading..."}</p>
                </div>
              </div>
            </div>
            <Button 
              onClick={fetchAnalytics} 
              disabled={loading}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-6 space-y-6">
        {/* Summary Stats */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-7 w-16" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : summary ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard
              icon={Users}
              title="Total Agents"
              value={summary.totalAgents}
              subtitle={`${summary.activeAgents} active`}
            />
            <StatCard
              icon={UserCheck}
              title="Online Now"
              value={summary.onlineAgents}
              subtitle={`${summary.passwordSetAgents} verified`}
            />
            <StatCard
              icon={MessageSquare}
              title="Total Handoffs"
              value={summary.totalHandoffs}
              subtitle={`${summary.totalResolved} resolved`}
            />
            <StatCard
              icon={TrendingUp}
              title="Resolution Rate"
              value={`${summary.overallResolutionRate}%`}
              subtitle="All agents"
            />
            <StatCard
              icon={Clock}
              title="Avg Response"
              value={`${summary.avgResponseTimeInSeconds}s`}
              subtitle={`${summary.totalEscalations} escalations`}
            />
          </div>
        ) : null}

        {/* Agents Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Users className="w-5 h-5 text-muted-foreground" />
              Agent Performance ({agents.length})
            </h2>
            {agents.length > 0 && (
              <Badge variant="secondary">
                {agents.filter(a => a.isOnline).length} online
              </Badge>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                      <Skeleton className="w-10 h-10 rounded-full" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Skeleton className="h-16 w-full" />
                    <div className="grid grid-cols-2 gap-3">
                      <Skeleton className="h-20 w-full" />
                      <Skeleton className="h-20 w-full" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : agents.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {agents.map((agent) => (
                <AgentCard key={agent.agentId} agent={agent} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="w-12 h-12 mx-auto text-muted-foreground mb-3 opacity-50" />
                <p className="text-lg font-semibold text-muted-foreground">No Agents Found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  This bot doesn't have any assigned agents yet.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default BotAnalytics;
