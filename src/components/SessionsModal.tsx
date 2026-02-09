import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, MessageSquare, Clock, User, Search, X, Filter, Sparkles, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { getAuthHeaders } from "@/utils/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface Session {
  id: string;
  userId: string;
  timestamp: string;
  messages: Message[];
  duration?: string;
}

interface SessionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  botId: string;
  botName: string;
}

export const SessionsModal = ({ isOpen, onClose, botId, botName }: SessionsModalProps) => {
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

  // Fetch all sessions
  useEffect(() => {
    if (!botId) return;
    setLoading(true);

    fetch(`${import.meta.env.VITE_BACKEND_URL}/api/bots/${botId}/history`, { headers: getAuthHeaders(), })
      .then(res => res.json())
      .then(data => {
        if (data?.status === "success" && Array.isArray(data.result?.sessions)) {
          const mappedSessions: Session[] = data.result.sessions.map((s: any) => ({
            id: s._id,
            userId: s.variables?.username || "Unknown User",
            timestamp: s.createdAt,
            duration: s.duration,
            messages: s.history.map((h: any) => {
              let content = "";

              if (h.type === "branch_select" && h.content?.selected) {
                content = `✅ Selected Branch: ${h.content.selected}`;
              } else if (typeof h.content === "object") {
                content = JSON.stringify(h.content);
              } else {
                content = h.content;
              }

              return {
                role: h.fromUser ? "user" : "assistant",
                content,
                timestamp: h.timestamp,
              };
            }),

          }));
          setSessions(mappedSessions);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [botId]);

  // Fetch single session
  const selectSession = async (sessionId: string) => {
    setLoading(true);
    setSummary("");
    setShowSummary(false);
    setSummarizerError("");
    
    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/bots/${botId}/history/${sessionId}`, { headers: getAuthHeaders(), });
      const data = await res.json();
      if (data?.status === "success" && data.result) {
        const s = data.result;
        const mappedSession: Session = {
          id: s.sessionId,
          userId: s.history.find(h => h.fromUser)?.content || "Unknown User",
          timestamp: s.createdAt,
          messages: s.history.map((h: any) => {
            let content = "";

            if (h.type === "branch_select" && h.content?.selected) {
              content = `Selected Branch: ${h.content.selected}`;
            } else if (typeof h.content === "object") {
              content = JSON.stringify(h.content);
            } else {
              content = h.content;
            }

            return {
              role: h.fromUser ? "user" : "assistant",
              content,
              timestamp: h.timestamp,
            };
          }),
        };
        setSelectedSession(mappedSession);
      }
    } catch (error) {
      console.error("Error fetching session:", error);
    } finally {
      setLoading(false);
    }
  };

  // Summarize the selected session
  const summarizeSession = async () => {
    if (!selectedSession || selectedSession.messages.length === 0) return;

    setSummarizing(true);
    setSummarizerError("");
    setSummary("");

    try {
      // Check for user activation
      if (!navigator.userActivation.isActive) {
        throw new Error("User activation required. Please click the button again.");
      }

      // Prepare the conversation text
      const conversationText = selectedSession.messages
        .map(msg => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
        .join("\n\n");

      // Create summarizer with options
      const options = {
        sharedContext: `This is a chat conversation between a user and a chatbot named ${botName}`,
        type: 'key-points',
        format: 'markdown',
        length: 'medium',
        monitor(m: any) {
          m.addEventListener('downloadprogress', (e: any) => {
            console.log(`Downloaded ${e.loaded * 100}%`);
          });
        }
      };

      const summarizer = await (self as any).Summarizer.create(options);

      // Use streaming summarization for real-time updates
      const stream = summarizer.summarizeStreaming(conversationText, {
        context: 'Provide a concise summary of the key points discussed in this conversation.',
      });

      let fullSummary = "";
      for await (const chunk of stream) {
        fullSummary = chunk;
        setSummary(chunk);
      }

      setShowSummary(true);
      
      // Clean up
      summarizer.destroy();
    } catch (error: any) {
      console.error('Error summarizing session:', error);
      setSummarizerError(error.message || 'Failed to generate summary. Please try again.');
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
      const matchesMessages = session.messages.some((msg) => msg.content.toLowerCase().includes(searchLower));
      if (!matchesUserId && !matchesMessages) return false;
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl h-[80vh] p-0 flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="text-2xl font-semibold flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-primary" />
            Sessions for {botName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Sessions List */}
          <div className="w-1/3 border-r flex flex-col overflow-hidden">
            <div className="p-4 pb-2 space-y-2 border-b shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by user or message..."
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
            </div>

            <ScrollArea className="flex-1">
              <div className="p-4 space-y-3">
                {loading && <p className="text-center text-muted-foreground">Loading sessions...</p>}
                {!loading && filteredSessions.map((session) => (
                  <Card
                    key={session.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${selectedSession?.id === session.id ? "border-primary shadow-md" : ""}`}
                    onClick={() => selectSession(session.id)}
                  >
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{session.userId}</span>
                        </div>
                        <Badge variant="secondary" className="text-xs">{session.messages.length} msgs</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 space-y-1">
                      {session.duration && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {session.duration}
                        </div>
                      )}
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                        {session.messages[0]?.content}
                      </p>
                    </CardContent>
                  </Card>
                ))}

                {!loading && filteredSessions.length === 0 && sessions.length > 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No sessions match your search</p>
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
          </div>

          {/* Session Replay */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedSession ? (
              <>
                <div className="p-6 pb-4 border-b shrink-0">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-lg">Session Replay</h3>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(selectedSession.timestamp)} at {formatTime(selectedSession.timestamp)}
                      </p>
                    </div>
                    {selectedSession.duration && (
                      <Badge variant="outline">
                        <Clock className="w-3 h-3 mr-1" />
                        {selectedSession.duration}
                      </Badge>
                    )}
                  </div>

                  {/* Summarizer Button */}
                  {summarizerAvailable && (
                    <div className="flex gap-2">
                      <Button
                        onClick={summarizeSession}
                        disabled={summarizing || selectedSession.messages.length === 0}
                        size="sm"
                        variant="secondary"
                        className="w-full"
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
                  )}

                  {summarizerAvailable === false && (
                    <Alert>
                      <AlertDescription className="text-xs">
                        AI summarization is not available in your browser. Please use Chrome 138+ on supported platforms.
                      </AlertDescription>
                    </Alert>
                  )}

                  {summarizerError && (
                    <Alert variant="destructive" className="mt-2">
                      <AlertDescription className="text-xs">
                        {summarizerError}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Summary Display */}
                  {showSummary && summary && (
                    <div className="mt-3 p-4 bg-muted rounded-lg border">
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
                </div>

                <ScrollArea className="flex-1">
                  <div className="p-6 space-y-4">
                    {selectedSession.messages.map((message, index) => (
                      <div key={index} className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}>
                        <div className={`flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-lg ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                          {message.role === "user" ? <User className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
                        </div>
                        <div className={`flex flex-col gap-1 ${message.role === "user" ? "items-end" : "items-start"}`}>
                          <div className={`rounded-lg px-4 py-2 max-w-[80%] break-words ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          </div>
                          <span className="text-xs text-muted-foreground">{formatTime(message.timestamp)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>Select a session to view the replay</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
