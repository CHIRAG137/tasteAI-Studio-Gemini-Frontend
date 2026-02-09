import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, MessageSquare, Clock, User, Search, X, Filter, Sparkles, Loader2, ArrowLeft, MapPin, Monitor, Bot, Headphones } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { getAuthHeaders } from "@/utils/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  mode?: "flow" | "qa" | "handoff";
  type?: string; // Added to preserve the original type
  isConfirmation?: boolean; // For showing Yes/No buttons
  confirmationResponse?: string; // The selected confirmation value
  isSystemMessage?: boolean; // For handoff system messages
  isAgentMessage?: boolean; // For agent messages in handoff
}

interface Session {
  id: string;
  userId: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
  messages: Message[];
  duration?: string;
  currentMode?: "flow" | "qa" | "handoff" | "idle";
}

export default function Sessions() {
  const { botId } = useParams();
  const navigate = useNavigate();
  const [botName, setBotName] = useState("");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [minMessages, setMinMessages] = useState<number | undefined>(undefined);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Summarizer states
  const [summary, setSummary] = useState<string>("");
  const [summarizing, setSummarizing] = useState(false);
  const [summarizerAvailable, setSummarizerAvailable] = useState<boolean | null>(null);
  const [summarizerError, setSummarizerError] = useState<string>("");
  const [showSummary, setShowSummary] = useState(false);

  const parseBrowser = (userAgent: string | undefined) => {
    if (!userAgent || userAgent === 'Unknown') return 'Unknown Browser';
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    if (userAgent.includes('Opera')) return 'Opera';
    return 'Unknown Browser';
  };

  const parseOS = (userAgent: string | undefined) => {
    if (!userAgent || userAgent === 'Unknown') return 'Unknown OS';
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Mac OS')) return 'macOS';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iOS')) return 'iOS';
    return 'Unknown OS';
  };

  const getModeColor = (mode?: string) => {
    switch (mode) {
      case 'flow':
        return 'bg-blue-100 text-blue-800';
      case 'qa':
        return 'bg-green-100 text-green-800';
      case 'handoff':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getModeLabel = (mode?: string) => {
    switch (mode) {
      case 'flow':
        return 'Flow';
      case 'qa':
        return 'QA';
      case 'handoff':
        return 'Handoff';
      default:
        return 'Unknown';
    }
  };

  // Helper function to format history entry into readable message
  const formatHistoryEntry = (h: any): string => {
    let content = "";
    
    // Handle based on mode
    if (h.mode === "qa") {
      // QA mode is handled separately in mapHistoryToMessages
      content = h.answer || "No match found";
    } else if (h.mode === "handoff") {
      // Handle handoff system messages
      if (h.systemMessage || h.type?.startsWith("handoff_")) {
        // Special handling for each handoff event type
        switch (h.type) {
          case "handoff_connecting":
            content = h.content || "Connecting you with a human agent...";
            break;
          case "handoff_initiated":
            content = h.content || "User requested assistance";
            break;
          case "handoff_agent_assigned":
            content = h.content || "Your request has been received. An agent will respond as soon as possible.";
            break;
          case "handoff_agent_offline":
            content = h.content || "The agent is currently offline but will respond as soon as possible.";
            break;
          case "handoff_accepted":
            content = h.content || "A human agent has accepted your request.";
            break;
          case "handoff_resolved":
            content = h.content || "This conversation has been marked resolved by the agent.";
            break;
          case "handoff_resolved_by_client":
            content = "This conversation was marked resolved by the user.";
            break;
          case "handoff_reopened":
            content = "This conversation was reopened by the user.";
            break;
          default:
            content = h.content || "(handoff system message)";
        }
      } else if (h.sender === "agent" || (!h.fromUser && h.messageText)) {
        content = `${h.messageText || h.content || "(message)"}`;
      } else if (h.fromUser) {
        content = `${h.messageText || h.content || "(message)"}`;
      } else {
        content = `${h.messageText || h.content || "(handoff event)"}`;
      }
    } else if (h.mode === "flow") {
      // Handle all flow types
      switch (h.type) {
        case "branch_select":
          content = h.content?.selected 
            ? `Selected: ${h.content.selected}` 
            : `Branch selected`;
          break;
        case "user_input":
          content = h.content || "(user input)";
          break;
        case "code":
          if (h.content?.success !== undefined) {
            const status = h.content.success ? '✓ Success' : '✗ Failed';
            const result = h.content.result ? `: ${JSON.stringify(h.content.result)}` : "";
            content = `Code executed (${status})${result}`;
          } else {
            content = `Code executed`;
          }
          break;
        case "confirmation":
          content = h.content 
            ? `${h.content}` 
            : `Confirmation requested`;
          break;
        case "question":
          if (h.awaitingInput) {
            content = h.content 
              ? `${h.content}` 
              : `Question presented (awaiting response)`;
          } else {
            content = h.content || `Question`;
          }
          break;
        case "message":
          content = h.content || "[Empty message]";
          break;
        case "redirect":
          content = h.content 
            ? `Redirected to: ${h.content}` 
            : `Redirected`;
          break;
        default:
          // Fallback for unknown types
          if (h.content) {
            content = typeof h.content === "object" 
              ? JSON.stringify(h.content) 
              : h.content;
          } else {
            content = `[${h.type || "System event"}]`;
          }
      }
    } else {
      // Legacy/default handling
      if (h.type === "branch_select" && h.content?.selected) {
        content = `Selected: ${h.content.selected}`;
      } else if (typeof h.content === "object" && h.content !== null) {
        content = JSON.stringify(h.content);
      } else {
        content = h.content || `[${h.type || "Event"}]`;
      }
    }
    
    return content;
  };

  // Map history to messages with special handling for QA and confirmation
  const mapHistoryToMessages = (history: any[]): Message[] => {
    const messages: Message[] = [];
    
    for (let i = 0; i < history.length; i++) {
      const h = history[i];
      
      // Skip duplicate handoff events - only show system message version
      // For handoff_resolved, handoff_accepted, etc., there are often two entries:
      // 1. The actual event (without systemMessage flag)
      // 2. The system message notification (with systemMessage flag)
      // We only want to show the system message version
      if (h.mode === "handoff" && h.type?.startsWith("handoff_") && !h.systemMessage && h.type !== "handoff_initiated") {
        // Check if there's a corresponding system message for this event
        const hasSystemMessage = history.some((item, idx) => 
          idx > i && 
          item.type === h.type && 
          item.systemMessage === true &&
          item.handoffSessionId === h.handoffSessionId
        );
        
        // Skip if there's a system message version coming
        if (hasSystemMessage) {
          continue;
        }
      }
      
      // Handle all handoff system messages (including resolved, resolved_by_client, reopened)
      if (h.systemMessage || (h.mode === "handoff" && h.type?.startsWith("handoff_") && h.type !== "handoff_initiated")) {
        messages.push({
          role: "assistant",
          content: formatHistoryEntry(h),
          timestamp: h.timestamp,
          mode: "handoff",
          type: h.type,
          isSystemMessage: true,
        });
        continue;
      }
      
      // Handle handoff_resolved_by_client specifically (user action, but shown as system message)
      if (h.type === "handoff_resolved_by_client") {
        messages.push({
          role: "assistant",
          content: "This conversation was marked resolved by the user.",
          timestamp: h.timestamp,
          mode: "handoff",
          type: h.type,
          isSystemMessage: true,
        });
        continue;
      }
      
      // Handle handoff_reopened specifically (user action, but shown as system message)
      if (h.type === "handoff_reopened") {
        messages.push({
          role: "assistant",
          content: "This conversation was reopened by the user.",
          timestamp: h.timestamp,
          mode: "handoff",
          type: h.type,
          isSystemMessage: true,
        });
        continue;
      }
      
      // Handle agent messages in handoff
      if (h.mode === "handoff" && h.sender === "agent") {
        messages.push({
          role: "assistant",
          content: h.messageText || h.content || "(agent message)",
          timestamp: h.timestamp,
          mode: "handoff",
          type: "agent_message",
          isAgentMessage: true,
        });
        continue;
      }
      
      // Handle QA mode - split into question (user) and answer (assistant)
      if (h.mode === "qa") {
        // Add question as user message (right side)
        if (h.question) {
          messages.push({
            role: "user",
            content: h.question,
            timestamp: h.timestamp,
            mode: "qa",
            type: "question",
          });
        }
        // Add answer as assistant message (left side)
        if (h.answer) {
          messages.push({
            role: "assistant",
            content: h.answer,
            timestamp: h.timestamp,
            mode: "qa",
            type: "answer",
          });
        }
        continue;
      }
      
      // Handle confirmation - look ahead for the response
      if (h.mode === "flow" && h.type === "confirmation" && !h.fromUser) {
        // Find the next user_input that corresponds to this confirmation
        let confirmationResponse: string | undefined;
        for (let j = i + 1; j < history.length; j++) {
          const nextH = history[j];
          if (nextH.mode === "flow" && nextH.type === "user_input" && nextH.fromUser && nextH.nodeId === h.nodeId) {
            confirmationResponse = nextH.content?.toLowerCase() === "yes" || nextH.content?.toLowerCase() === "no" 
              ? nextH.content 
              : undefined;
            break;
          }
          // Stop if we hit a different node type that's not user input
          if (nextH.nodeId !== h.nodeId && nextH.type !== "user_input") {
            break;
          }
        }
        
        messages.push({
          role: "assistant",
          content: formatHistoryEntry(h),
          timestamp: h.timestamp,
          mode: h.mode,
          type: h.type,
          isConfirmation: true,
          confirmationResponse,
        });
        continue;
      }
      
      // Skip user_input that was a confirmation response (already handled above)
      if (h.mode === "flow" && h.type === "user_input" && h.fromUser) {
        const prevConfirmation = history.slice(0, i).reverse().find(
          (ph: any) => ph.nodeId === h.nodeId && ph.type === "confirmation"
        );
        if (prevConfirmation && (h.content?.toLowerCase() === "yes" || h.content?.toLowerCase() === "no")) {
          continue; // Skip, already shown as buttons
        }
      }
      
      // Default handling for other message types
      messages.push({
        role: h.fromUser ? "user" : "assistant",
        content: formatHistoryEntry(h),
        timestamp: h.timestamp,
        mode: h.mode,
        type: h.type,
      });
    }
    
    return messages;
  };

  // Check summarizer availability on mount
  useEffect(() => {
    const checkAvailability = async () => {
      if ('Summarizer' in self) {
        try {
          const availability = await (self as any).Summarizer.availability();
          setSummarizerAvailable(availability !== 'unavailable');
        } catch (error) {
          console.error('Error checking summarizer availability:', error);
          setSummarizerAvailable(false);
        }
      } else {
        setSummarizerAvailable(false);
      }
    };
    checkAvailability();
  }, []);

  // Fetch bot info and sessions
  useEffect(() => {
    if (!botId) return;

    const fetchBotInfo = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/bots/${botId}`, {
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const bot = await res.json();
          if (bot) setBotName(bot.name);
        }
      } catch (error) {
        console.error("Error fetching bot info:", error);
      }
    };

    fetchBotInfo();
    fetchSessions();
  }, [botId]);

  const fetchSessions = async () => {
    if (!botId) return;
    setLoading(true);

    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/bots/${botId}/history`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data?.status === "success" && Array.isArray(data.result?.sessions)) {
        const mappedSessions: Session[] = data.result.sessions.map((s: any) => ({
          id: s._id,
          userId: s.ipAddress || s.variables?.username || "Unknown User",
          ipAddress: s.ipAddress,
          userAgent: s.userAgent,
          timestamp: s.createdAt,
          duration: s.duration,
          currentMode: s.currentMode,
          messages: mapHistoryToMessages(s.history),
        }));
        setSessions(mappedSessions);
      }
    } catch (error) {
      console.error("Error fetching sessions:", error);
    } finally {
      setLoading(false);
    }
  };

  const selectSession = async (sessionId: string) => {
    setLoading(true);
    setSummary("");
    setShowSummary(false);
    setSummarizerError("");

    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/bots/${botId}/history/${sessionId}`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data?.status === "success" && data.result) {
        const s = data.result;
        const mappedSession: Session = {
          id: s.sessionId,
          userId: s.ipAddress || "Unknown User",
          ipAddress: s.ipAddress,
          userAgent: s.userAgent,
          timestamp: s.createdAt,
          messages: mapHistoryToMessages(s.history),
        };
        setSelectedSession(mappedSession);
      }
    } catch (error) {
      console.error("Error fetching session:", error);
    } finally {
      setLoading(false);
    }
  };

  const summarizeSession = async () => {
    if (!selectedSession || selectedSession.messages.length === 0) return;

    setSummarizing(true);
    setSummarizerError("");
    setSummary("");

    try {
      const conversationText = selectedSession.messages
        .map(msg => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
        .join("\n\n");

      if (summarizerAvailable) {
        // Use Chrome built-in API
        const summarizer = await (self as any).Summarizer.create({
          type: "key-points",
          format: "markdown",
          length: "medium",
        });

        const result = await summarizer.summarize(conversationText, {
          context: "Provide a concise summary of this chat in just 4 points max.",
        });

        setSummary(result);
        summarizer.destroy();
      } else {
        // Fallback to Gemini API
        const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/summarize`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            messages: selectedSession.messages,
            botName,
          }),
        });

        const data = await res.json();
        if (data.status === "success") {
          setSummary(data.result.summary);
        } else {
          throw new Error(data.message || "Gemini summarization failed");
        }
      }

      setShowSummary(true);
    } catch (error: any) {
      console.error("Error summarizing session:", error);
      setSummarizerError(error.message || "Failed to summarize conversation");
    } finally {
      setSummarizing(false);
    }
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const formatTime = (timestamp: string) =>
    new Date(timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  const filteredSessions = sessions.filter((session) => {
    if (searchFilter) {
      const searchLower = searchFilter.toLowerCase();
      const matchesUserId = session.userId.toLowerCase().includes(searchLower);
      const matchesIp = session.ipAddress?.toLowerCase().includes(searchLower);
      const matchesMessages = session.messages.some((msg) => msg.content.toLowerCase().includes(searchLower));
      if (!matchesUserId && !matchesIp && !matchesMessages) return false;
    }

    const sessionDate = new Date(session.timestamp);
    if (startDate && sessionDate < startDate) return false;
    if (endDate && sessionDate > endDate) return false;
    if (minMessages && session.messages.length < minMessages) return false;

    return true;
  });

  const clearAllFilters = () => {
    setSearchFilter("");
    setStartDate(undefined);
    setEndDate(undefined);
    setMinMessages(undefined);
  };

  const hasActiveFilters = searchFilter || startDate || endDate || minMessages;

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
                  <MessageSquare className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold">Sessions</h1>
                  <p className="text-sm text-muted-foreground">{botName}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-180px)]">
          {/* Sessions List */}
          <Card className="lg:col-span-1 flex flex-col overflow-hidden">
            <CardHeader className="pb-4 space-y-4 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by IP, user, or message..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
                <div className="flex items-center gap-2">
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" size="sm" className="flex-1">
                      <Filter className="w-4 h-4 mr-2" />
                      Advanced Filters
                      {hasActiveFilters && (
                        <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                          {[searchFilter, startDate, endDate, minMessages].filter(Boolean).length}
                        </Badge>
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearAllFilters} className="px-2">
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                <CollapsibleContent className="space-y-3 mt-3">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Date Range</label>
                    <div className="grid grid-cols-2 gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                              "justify-start text-left font-normal",
                              !startDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-1 h-3 w-3" />
                            {startDate ? format(startDate, "MMM dd") : "Start"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus className="pointer-events-auto" />
                        </PopoverContent>
                      </Popover>

                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                              "justify-start text-left font-normal",
                              !endDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-1 h-3 w-3" />
                            {endDate ? format(endDate, "MMM dd") : "End"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus className="pointer-events-auto" />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Min Messages</label>
                    <Input
                      type="number"
                      placeholder="e.g., 5"
                      value={minMessages ?? ""}
                      onChange={(e) => setMinMessages(e.target.value ? parseInt(e.target.value) : undefined)}
                      min={1}
                      className="h-8"
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardHeader>

            <ScrollArea className="flex-1">
              <div className="px-6 pb-4 space-y-3">
                {loading && <p className="text-center text-muted-foreground py-8">Loading sessions...</p>}
                {!loading && filteredSessions.map((session) => (
                  <Card
                    key={session.id}
                    className={cn(
                      "cursor-pointer transition-all hover:shadow-md hover:border-primary/50",
                      selectedSession?.id === session.id && "border-primary shadow-md bg-primary/5"
                    )}
                    onClick={() => selectSession(session.id)}
                  >
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <span className="text-sm font-medium block truncate">
                              {session.ipAddress || session.userId}
                            </span>
                            {session.userAgent && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <Monitor className="w-3 h-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground truncate">
                                  {parseBrowser(session.userAgent)} • {parseOS(session.userAgent)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                          <Badge variant="secondary" className="text-xs">
                            {session.messages.length} msgs
                          </Badge>
                          {session.currentMode && (
                            <Badge className={cn("text-xs h-5", getModeColor(session.currentMode))}>
                              {getModeLabel(session.currentMode)}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 space-y-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {formatDate(session.timestamp)}
                        {session.duration && ` • ${session.duration}`}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                        {session.messages[0]?.content}
                      </p>
                    </CardContent>
                  </Card>
                ))}

                {!loading && filteredSessions.length === 0 && sessions.length > 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No sessions match your filters</p>
                  </div>
                )}

                {!loading && sessions.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No sessions yet</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </Card>

          {/* Session Replay */}
          <Card className="lg:col-span-2 flex flex-col overflow-hidden">
            {selectedSession ? (
              <>
                <CardHeader className="pb-4 shrink-0 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-lg">Session Replay</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          {selectedSession.ipAddress || selectedSession.userId}
                        </p>
                        <span className="text-muted-foreground">•</span>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(selectedSession.timestamp)} at {formatTime(selectedSession.timestamp)}
                        </p>
                      </div>
                      {selectedSession.userAgent && (
                        <div className="flex items-center gap-2 mt-1">
                          <Monitor className="w-3.5 h-3.5 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">
                            {parseBrowser(selectedSession.userAgent)} on {parseOS(selectedSession.userAgent)}
                          </p>
                        </div>
                      )}
                      {selectedSession.currentMode && (
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={cn("text-xs h-5", getModeColor(selectedSession.currentMode))}>
                            Current Mode: {getModeLabel(selectedSession.currentMode)}
                          </Badge>
                        </div>
                      )}
                    </div>
                    {selectedSession.duration && (
                      <Badge variant="outline">
                        <Clock className="w-3 h-3 mr-1" />
                        {selectedSession.duration}
                      </Badge>
                    )}
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Showing all {selectedSession.messages.length} entries from session history
                  </div>

                  {/* Summarizer Button */}
                  <div className="flex gap-2">
                    <Button
                      onClick={summarizeSession}
                      disabled={summarizing || selectedSession.messages.length === 0}
                      size="sm"
                      variant="secondary"
                      className="flex-1"
                    >
                      {summarizing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Generating Summary...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Summarize Conversation
                        </>
                      )}
                    </Button>

                    {showSummary && (
                      <Button
                        onClick={() => setShowSummary(!showSummary)}
                        size="sm"
                        variant="outline"
                      >
                        {showSummary ? "Hide" : "Show"}
                      </Button>
                    )}
                  </div>

                  {summarizerAvailable === false && (
                    <Alert>
                      <AlertDescription className="text-xs">
                        Using TasteAI fallback summarization (Gemini-based) — Chrome built-in summarizer not supported on this device.
                      </AlertDescription>
                    </Alert>
                  )}

                  {summarizerError && (
                    <Alert variant="destructive">
                      <AlertDescription className="text-xs">
                        {summarizerError}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Summary Display */}
                  {showSummary && summary && (
                    <div className="p-4 bg-muted rounded-lg border">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <h4 className="font-semibold text-sm">AI Summary</h4>
                      </div>
                      <div className="text-sm prose prose-sm max-w-none">
                        {summary.split('\n').map((line, i) => (
                          <p key={i} className="mb-1">{line}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </CardHeader>

                <ScrollArea className="flex-1 bg-white dark:bg-gray-900">
                  <div className="px-6 pb-6 pt-4 space-y-4">
                    {selectedSession.messages.map((message, index) => (
                      <div key={index} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                        {/* Avatar for assistant/bot/agent messages */}
                        {message.role === "assistant" && (
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarFallback className={cn(
                              message.isAgentMessage
                                ? "bg-gradient-to-r from-emerald-600 to-teal-500 text-white"
                                : "bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                            )}>
                              {message.isAgentMessage ? (
                                <Headphones className="h-4 w-4" />
                              ) : (
                                <Bot className="h-4 w-4" />
                              )}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        
                        <div className={`flex flex-col gap-1 ${message.role === "user" ? "items-end" : "items-start"} max-w-[75%]`}>
                          <div className={cn(
                            "rounded-lg px-4 py-3",
                            message.role === "user"
                              ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                              : message.isAgentMessage
                              ? "bg-gradient-to-r from-emerald-600 to-teal-500 text-white"
                              : message.isSystemMessage
                              ? "bg-orange-100 text-orange-900 border border-orange-200 dark:bg-orange-950 dark:text-orange-100 dark:border-orange-800"
                              : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                          )}>
                            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                            {/* Confirmation Yes/No buttons */}
                            {message.isConfirmation && (
                              <div className="flex gap-2 mt-3">
                                <Button
                                  size="sm"
                                  variant={message.confirmationResponse?.toLowerCase() === "yes" ? "default" : "outline"}
                                  className={cn(
                                    "h-7 px-3 text-xs",
                                    message.confirmationResponse?.toLowerCase() === "yes" 
                                      ? "bg-green-600 hover:bg-green-600 text-white border-green-600" 
                                      : "opacity-60 cursor-default bg-white/20 border-gray-300"
                                  )}
                                  disabled
                                >
                                  Yes
                                </Button>
                                <Button
                                  size="sm"
                                  variant={message.confirmationResponse?.toLowerCase() === "no" ? "default" : "outline"}
                                  className={cn(
                                    "h-7 px-3 text-xs",
                                    message.confirmationResponse?.toLowerCase() === "no" 
                                      ? "bg-red-600 hover:bg-red-600 text-white border-red-600" 
                                      : "opacity-60 cursor-default bg-white/20 border-gray-300"
                                  )}
                                  disabled
                                >
                                  No
                                </Button>
                              </div>
                            )}
                          </div>
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            {message.isAgentMessage && <Headphones className="h-3 w-3" />}
                            {formatTime(message.timestamp)}
                          </span>
                        </div>
                        
                        {/* Avatar for user messages */}
                        {message.role === "user" && (
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarFallback className="bg-gray-300">
                              <User className="h-4 w-4" />
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Select a session to view the replay</p>
                  <p className="text-sm mt-1">Choose from the sessions list on the left</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}