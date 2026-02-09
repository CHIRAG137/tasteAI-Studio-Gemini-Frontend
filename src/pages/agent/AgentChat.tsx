import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  ArrowLeft, 
  Send, 
  User, 
  Headphones, 
  CheckCircle,
  RefreshCw,
  Clock,
  Bot,
  MessageSquare,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  ArrowDown,
  Info
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { getAgentAuthHeaders } from "@/utils/agentAuth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Message {
  sender: "user" | "agent";
  message: string;
  timestamp: string;
  agentId?: string;
}

interface PreHandoffMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  mode?: "flow" | "qa" | "handoff";
  type?: string;
  isConfirmation?: boolean;
  confirmationResponse?: string;
  isSystemMessage?: boolean;
  isAgentMessage?: boolean;
}

interface HandoffSession {
  _id: string;
  bot: {
    _id: string;
    name: string;
    description?: string;
  };
  sessionId?: string;
  flowSession?: {
    _id: string;
    history: any[];
    variables?: Record<string, any>;
  };
  status: "pending" | "active" | "resolved";
  userQuestion: string;
  requestedAt: string;
  acceptedAt?: string;
  messages: Message[];
}

interface ChatSummary {
  overview: string;
  userIntent: string;
  actionItems: string[];
  keyPoints: string[];
}

// Helper function to format history entry into readable message
const formatHistoryEntry = (h: any): string => {
  if (h.mode === "qa") {
    return h.answer || "No match found";
  }
  
  if (h.mode === "handoff") {
    // System messages
    if (h.systemMessage || h.type?.startsWith("handoff_")) {
      switch (h.type) {
        case "handoff_connecting":
          return h.content || "Connecting you with a human agent...";
        case "handoff_initiated":
          return h.content || "User requested assistance";
        case "handoff_agent_assigned":
          return h.content || "Your request has been received. An agent will respond as soon as possible.";
        case "handoff_agent_offline":
          return h.content || "The agent is currently offline but will respond as soon as possible.";
        case "handoff_accepted":
          return h.content || "A human agent has accepted your request.";
        case "handoff_resolved":
          return h.content || "This conversation has been marked resolved by the agent.";
        case "handoff_resolved_by_client":
          return "This conversation was marked resolved by the user.";
        case "handoff_reopened":
          return "This conversation was reopened by the user.";
        default:
          return h.content || "(handoff system message)";
      }
    }
    // User/agent handoff messages
    return h.messageText || h.content || "(message)";
  }
  
  if (h.mode === "flow") {
    switch (h.type) {
      case "message":
        return h.content || "[Empty message]";
      case "code":
        if (h.content?.success !== undefined) {
          const status = h.content.success ? '✓ Success' : '✗ Failed';
          const result = h.content.result ? `: ${JSON.stringify(h.content.result)}` : "";
          return `Code executed (${status})${result}`;
        }
        return "Code executed";
      case "question":
        if (h.awaitingInput) {
          return typeof h.content === "string" ? h.content : (h.content?.prompt || "Question");
        }
        return "";
      case "confirmation":
        if (h.awaitingInput) {
          return typeof h.content === "string" ? h.content : (h.content?.prompt || "Confirmation");
        }
        return "";
      case "branch":
        return ""; // Branch prompts don't have text content
      case "branch_select":
        return h.content?.selected ? `Selected: ${h.content.selected}` : "Branch selected";
      case "user_input":
        return typeof h.content === "string" ? h.content : JSON.stringify(h.content);
      default:
        if (typeof h.content === "string") return h.content;
        if (h.content) return JSON.stringify(h.content);
        return `[${h.type || "Event"}]`;
    }
  }
  
  // Fallback
  if (typeof h.content === "string") return h.content;
  if (h.content) return JSON.stringify(h.content);
  return "[Event]";
};

// Determine if a history entry should be displayed as a message
const shouldDisplayHistoryEntry = (h: any): boolean => {
  // Always show handoff system messages
  if (h.mode === "handoff" && (h.systemMessage || h.type?.startsWith("handoff_"))) {
    return true;
  }
  
  // Show handoff user/agent messages
  if (h.mode === "handoff" && (h.sender === "user" || h.sender === "agent")) {
    return true;
  }
  
  // Flow mode messages
  if (h.mode === "flow") {
    // Message nodes - always show
    if (h.type === "message") return true;
    
    // Code nodes - always show
    if (h.type === "code") return true;
    
    // Question/Confirmation prompts (awaitingInput = true) - show as bot message
    if (["question", "confirmation"].includes(h.type) && h.awaitingInput === true) {
      return true;
    }
    
    // User inputs - show as user message
    if (h.type === "user_input" && h.fromUser === true) {
      return true;
    }
    
    // Branch prompts - show the options (awaitingInput = true)
    if (h.type === "branch" && h.awaitingInput === true) {
      return false; // Branch prompts don't have text, skip
    }
    
    // Branch selections - show as user message
    if (h.type === "branch_select" && h.fromUser === true) {
      return true;
    }
    
    // Skip answered question/confirmation objects (they have content as object with prompt/answer)
    if (["question", "confirmation"].includes(h.type) && !h.awaitingInput && !h.fromUser) {
      return false;
    }
    
    return false;
  }
  
  // QA mode - show both question and answer
  if (h.mode === "qa") {
    return true;
  }
  
  return false;
};

// Map history to pre-handoff messages with proper ordering by timestamp
const mapHistoryToPreHandoffMessages = (history: any[]): PreHandoffMessage[] => {
  const messages: PreHandoffMessage[] = [];
  
  // Sort history by timestamp first
  const sortedHistory = [...history].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  for (let i = 0; i < sortedHistory.length; i++) {
    const h = sortedHistory[i];
    
    // Skip entries that shouldn't be displayed
    if (!shouldDisplayHistoryEntry(h)) {
      continue;
    }
    
    const content = formatHistoryEntry(h);
    if (!content) continue; // Skip empty content
    
    // Handle QA mode - split into question and answer
    if (h.mode === "qa") {
      if (h.question) {
        messages.push({
          role: "user",
          content: h.question,
          timestamp: h.timestamp,
          mode: "qa",
          type: "question",
        });
      }
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
    
    // Handle handoff system messages
    if (h.mode === "handoff" && (h.systemMessage || h.type?.startsWith("handoff_"))) {
      messages.push({
        role: "assistant",
        content,
        timestamp: h.timestamp,
        mode: "handoff",
        type: h.type,
        isSystemMessage: true,
      });
      continue;
    }
    
    // Handle handoff user/agent messages (these will be shown in the main messages section)
    if (h.mode === "handoff" && (h.sender === "user" || h.sender === "agent")) {
      // Skip these as they're handled separately in the messages array from API
      continue;
    }
    
    // Handle flow mode confirmations
    if (h.mode === "flow" && h.type === "confirmation" && h.awaitingInput) {
      // Find if user responded to this confirmation
      let confirmationResponse: string | undefined;
      for (let j = i + 1; j < sortedHistory.length; j++) {
        const nextH = sortedHistory[j];
        if (nextH.mode === "flow" && nextH.type === "user_input" && nextH.fromUser && nextH.nodeId === h.nodeId) {
          const answer = typeof nextH.content === "string" ? nextH.content.toLowerCase() : "";
          if (answer === "yes" || answer === "no") {
            confirmationResponse = nextH.content;
          }
          break;
        }
        if (nextH.nodeId !== h.nodeId && nextH.type !== "user_input") {
          break;
        }
      }
      
      messages.push({
        role: "assistant",
        content,
        timestamp: h.timestamp,
        mode: h.mode,
        type: h.type,
        isConfirmation: true,
        confirmationResponse,
      });
      continue;
    }
    
    // Handle flow mode user inputs for confirmations (yes/no) - skip as we show buttons
    if (h.mode === "flow" && h.type === "user_input" && h.fromUser) {
      const answer = typeof h.content === "string" ? h.content.toLowerCase() : "";
      // Check if this is a confirmation response
      const prevConfirmation = sortedHistory.slice(0, i).reverse().find(
        (ph: any) => ph.nodeId === h.nodeId && ph.type === "confirmation" && ph.awaitingInput
      );
      if (prevConfirmation && (answer === "yes" || answer === "no")) {
        continue; // Skip - shown as button state
      }
    }
    
    // Standard flow messages
    messages.push({
      role: h.fromUser ? "user" : "assistant",
      content,
      timestamp: h.timestamp,
      mode: h.mode,
      type: h.type,
    });
  }
  
  // Sort final messages by timestamp to ensure proper order
  return messages.sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
};

// Extract handoff system messages from history (for merging with agent messages timeline)
const extractHandoffSystemMessages = (history: any[]): PreHandoffMessage[] => {
  const messages: PreHandoffMessage[] = [];
  
  const sortedHistory = [...history].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  for (const h of sortedHistory) {
    // Only include handoff system messages
    if (h.mode === "handoff" && (h.systemMessage || h.type?.startsWith("handoff_"))) {
      const content = formatHistoryEntry(h);
      if (content) {
        messages.push({
          role: "assistant",
          content,
          timestamp: h.timestamp,
          mode: "handoff",
          type: h.type,
          isSystemMessage: true,
        });
      }
    }
  }
  
  return messages;
};

// Merge agent/user messages with system messages into a unified timeline
const mergeHandoffMessagesWithSystem = (
  handoffMessages: Message[],
  systemMessages: PreHandoffMessage[]
): Array<Message | PreHandoffMessage> => {
  const allMessages: Array<(Message | PreHandoffMessage) & { timestamp: string }> = [
    ...handoffMessages.map(m => ({ ...m, _type: 'handoff' as const })),
    ...systemMessages.map(m => ({ ...m, _type: 'system' as const })),
  ];
  
  return allMessages.sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
};

const AgentChat = () => {
  const navigate = useNavigate();
  const { conversationId } = useParams<{ conversationId: string }>();
  const sessionId = conversationId;
  const { toast } = useToast();
  
  const [session, setSession] = useState<HandoffSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [preHandoffMessages, setPreHandoffMessages] = useState<PreHandoffMessage[]>([]);
  const [handoffSystemMessages, setHandoffSystemMessages] = useState<PreHandoffMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [resolveNotes, setResolveNotes] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Summarization states
  const [summary, setSummary] = useState<ChatSummary | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [summarizerAvailable, setSummarizerAvailable] = useState<boolean | null>(null);
  const [summarizerError, setSummarizerError] = useState<string>("");
  const [showSummary, setShowSummary] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const prevMessagesLengthRef = useRef(0);
  const scrollAreaViewportRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (scrollAreaViewportRef.current) {
      const viewport = scrollAreaViewportRef.current;
      viewport.scrollTop = viewport.scrollHeight;
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Monitor scroll position to detect if user scrolled up
  useEffect(() => {
    const viewport = document.querySelector('[data-radix-scroll-area-viewport]');
    if (!viewport) return;

    scrollAreaViewportRef.current = viewport as HTMLDivElement;

    const handleScroll = () => {
      if (!viewport) return;
      const isAtBottom = viewport.scrollHeight - viewport.scrollTop <= viewport.clientHeight + 100;
      setShouldAutoScroll(isAtBottom);
    };

    viewport.addEventListener('scroll', handleScroll);
    return () => viewport.removeEventListener('scroll', handleScroll);
  }, []);

  // Only scroll to bottom when new messages are added AND user is at bottom
  useEffect(() => {
    const newMessagesAdded = messages.length > prevMessagesLengthRef.current;
    prevMessagesLengthRef.current = messages.length;

    if (newMessagesAdded && shouldAutoScroll) {
      setTimeout(() => scrollToBottom(), 100);
    }
  }, [messages, shouldAutoScroll]);

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

  const fetchSession = async () => {
    if (!sessionId) return;
    
    try {
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/handoff/${sessionId}/messages`,
        {
          headers: {
            "Content-Type": "application/json",
            ...getAgentAuthHeaders(),
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch session");
      }

      const sessionResponse = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/handoff/sessions?status=all`,
        {
          headers: {
            "Content-Type": "application/json",
            ...getAgentAuthHeaders(),
          },
        }
      );

      const sessionData = await sessionResponse.json();
      const currentSession = sessionData.result?.sessions?.find(
        (s: any) => s._id === sessionId
      );

      if (currentSession) {
        setSession(currentSession);
      }

      setMessages(data.result?.messages || []);
    } catch (error: any) {
      console.error("Error fetching session:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to load session",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
    const interval = setInterval(fetchSession, 3000);
    return () => clearInterval(interval);
  }, [sessionId]);

  useEffect(() => {
    if (session?.flowSession?.history && session.flowSession.history.length > 0) {
      const mappedMessages = mapHistoryToPreHandoffMessages(session.flowSession.history);
      // Filter out system messages from pre-handoff (they'll be shown inline)
      const nonSystemMessages = mappedMessages.filter(m => !m.isSystemMessage);
      setPreHandoffMessages(nonSystemMessages);
      
      // Extract all handoff system messages for the unified timeline
      const systemMessages = extractHandoffSystemMessages(session.flowSession.history);
      setHandoffSystemMessages(systemMessages);
    }
  }, [session?.flowSession?.history]);

  // Summarize chat history
  const summarizeChatHistory = async () => {
    if (preHandoffMessages.length === 0) {
      toast({
        title: "No History",
        description: "There's no chat history to summarize",
        variant: "destructive",
      });
      return;
    }

    setSummarizing(true);
    setSummarizerError("");
    setSummary(null);

    try {
      const conversationText = preHandoffMessages
        .map(msg => `${msg.role === "user" ? "User" : "Bot"}: ${msg.content}`)
        .join("\n\n");

      if (summarizerAvailable) {
        const summarizer = await (self as any).Summarizer.create({
          type: "key-points",
          format: "markdown",
          length: "medium",
        });

        const result = await summarizer.summarize(conversationText, {
          context: "Provide a summary of this customer support chat focusing on: 1) What the chat was about, 2) What the user was looking for, 3) Action items for the agent. Format as markdown with clear sections.",
        });

        const parsedSummary: ChatSummary = {
          overview: result.split('\n')[0] || "Chat summary",
          userIntent: result.includes("looking for") ? result.split("looking for")[1].split('\n')[0] : "Not specified",
          actionItems: result.match(/[-]\s(.+)/g)?.map(item => item.replace(/[-]\s/, '')) || [],
          keyPoints: result.split('\n').filter(line => line.trim() && !line.startsWith('#'))
        };

        setSummary(parsedSummary);
        summarizer.destroy();
      } else {
        const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/summarize`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAgentAuthHeaders(),
          },
          body: JSON.stringify({
            messages: preHandoffMessages,
            botName: session?.bot.name || "Bot",
          }),
        });

        const data = await res.json();
        if (data.status === "success") {
          const summaryText = data.result.summary;
          const lines = summaryText.split('\n').filter((line: string) => line.trim());
          
          const parsedSummary: ChatSummary = {
            overview: lines[0] || "Chat summary",
            userIntent: session?.userQuestion || "User requested assistance",
            actionItems: lines.filter((line: string) => line.includes('•') || line.includes('-')).map((line: string) => line.replace(/[•\-]\s/, '').trim()),
            keyPoints: lines.slice(1, 5).filter((line: string) => line.length > 10)
          };
          
          setSummary(parsedSummary);
        } else {
          throw new Error(data.message || "Summarization failed");
        }
      }

      setShowSummary(true);
    } catch (error: any) {
      console.error("Error summarizing chat:", error);
      setSummarizerError(error.message || "Failed to summarize conversation");
      toast({
        title: "Summarization Failed",
        description: error.message || "Could not generate summary",
        variant: "destructive",
      });
    } finally {
      setSummarizing(false);
    }
  };

  const handleAccept = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/handoff/${sessionId}/accept`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAgentAuthHeaders(),
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to accept session");
      }

      toast({
        title: "Success",
        description: "Session accepted successfully",
      });

      fetchSession();
    } catch (error: any) {
      console.error("Error accepting session:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to accept session",
        variant: "destructive",
      });
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isSending) return;

    const messageContent = inputMessage.trim();
    setInputMessage("");
    setIsSending(true);

    const optimisticMessage: Message = {
      sender: "agent",
      message: messageContent,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimisticMessage]);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/handoff/${sessionId}/message`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAgentAuthHeaders(),
          },
          body: JSON.stringify({ message: messageContent }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to send message");
      }

      fetchSession();
    } catch (error: any) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
      setMessages(prev => prev.filter(m => m !== optimisticMessage));
    } finally {
      setIsSending(false);
    }
  };

  const handleResolve = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/handoff/${sessionId}/resolve`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAgentAuthHeaders(),
          },
          body: JSON.stringify({ notes: resolveNotes }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to resolve session");
      }

      toast({
        title: "Success",
        description: "Session resolved successfully",
      });

      navigate("/agent");
    } catch (error: any) {
      console.error("Error resolving session:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to resolve session",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "active":
        return "bg-green-100 text-green-800 border-green-200";
      case "resolved":
        return "bg-gray-100 text-gray-800 border-gray-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const inputDisabled = isSending || session?.status === "pending";
  const inputDisabledMessage = isSending
    ? "Message is sending — please wait."
    : session?.status === "pending"
    ? "Accept the session to start chatting"
    : "";

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-6">
          <p>Session not found</p>
          <Button onClick={() => navigate("/agent")} className="mt-4">
            Back to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 flex flex-col">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-emerald-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => navigate("/agent")}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-semibold">{session.bot.name}</h1>
                  <Badge className={`${getStatusColor(session.status)} text-xs`}>
                    {session.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {session.userQuestion}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchSession}
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              {session.status === "pending" && (
                <Button 
                  size="sm" 
                  onClick={handleAccept}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Accept
                </Button>
              )}
              {session.status === "active" && (
                <Button 
                  size="sm" 
                  onClick={() => setShowResolveDialog(true)}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Resolve
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-4 flex flex-col gap-4">
        {/* Summary Card */}
        {preHandoffMessages.length > 0 && (
          <Card className="bg-white/80 backdrop-blur-sm">
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  <h3 className="font-semibold">Chat Summary</h3>
                </div>
                <Button
                  onClick={summarizeChatHistory}
                  disabled={summarizing}
                  size="sm"
                  variant="outline"
                  className="gap-2"
                >
                  {summarizing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      {summary ? "Regenerate" : "Generate Summary"}
                    </>
                  )}
                </Button>
              </div>

              {summarizerAvailable === false && (
                <Alert className="mb-3">
                  <AlertDescription className="text-xs">
                    Using Gemini-based summarization — Chrome built-in summarizer not available
                  </AlertDescription>
                </Alert>
              )}

              {summarizerError && (
                <Alert variant="destructive" className="mb-3">
                  <AlertDescription className="text-xs">
                    {summarizerError}
                  </AlertDescription>
                </Alert>
              )}

              {summary && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-muted-foreground">Summary Details</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSummary(!showSummary)}
                      className="h-6 px-2"
                    >
                      {showSummary ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </Button>
                  </div>

                  {showSummary && (
                    <div className="space-y-3 pt-2 border-t">
                      <div>
                        <h5 className="text-xs font-semibold text-gray-700 mb-1">Overview</h5>
                        <p className="text-sm text-gray-600">{summary.overview}</p>
                      </div>

                      <div>
                        <h5 className="text-xs font-semibold text-gray-700 mb-1">What User Was Looking For</h5>
                        <p className="text-sm text-gray-600">{summary.userIntent}</p>
                      </div>

                      {summary.actionItems && summary.actionItems.length > 0 && (
                        <div>
                          <h5 className="text-xs font-semibold text-gray-700 mb-1">Action Items</h5>
                          <ul className="space-y-1">
                            {summary.actionItems.map((item, idx) => (
                              <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                                <span className="text-purple-600 mt-1">•</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {summary.keyPoints && summary.keyPoints.length > 0 && (
                        <div>
                          <h5 className="text-xs font-semibold text-gray-700 mb-1">Key Points</h5>
                          <ul className="space-y-1">
                            {summary.keyPoints.map((point, idx) => (
                              <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                                <span className="text-emerald-600 mt-1">•</span>
                                <span>{point}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Messages Card */}
        <Card className="flex-1 flex flex-col bg-white/80 backdrop-blur-sm overflow-hidden relative">
          <ScrollArea className="flex-1 p-4">
            {/* Jump to Latest Button */}
            {!shouldAutoScroll && (
              <button
                onClick={() => {
                  scrollToBottom();
                  setShouldAutoScroll(true);
                }}
                className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-all duration-200 animate-in fade-in slide-in-from-bottom-2"
              >
                <ArrowDown className="w-4 h-4" />
                <span className="text-sm font-medium">Jump to latest</span>
              </button>
            )}
            {preHandoffMessages.length === 0 && messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <Clock className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No messages yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Pre-handoff Chat History */}
                {preHandoffMessages.length > 0 && (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Previous Chat History
                      </span>
                    </div>
                    
                    {preHandoffMessages.map((msg, index) => (
                      <div
                        key={`pre-${index}`}
                        className={`flex gap-3 ${msg.isSystemMessage ? 'justify-center' : msg.role === "user" ? "flex-row-reverse" : ""}`}
                      >
                        {!msg.isSystemMessage && (
                          <Avatar className="w-8 h-8 flex-shrink-0">
                            <AvatarFallback className={
                              msg.role === "user"
                                ? "bg-gradient-to-br from-blue-500 to-purple-500"
                                : "bg-gradient-to-br from-emerald-500 to-teal-500"
                            }>
                              {msg.role === "user" ? (
                                <User className="w-4 h-4 text-white" />
                              ) : (
                                <Bot className="w-4 h-4 text-white" />
                              )}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        
                        <div className={`${msg.isSystemMessage ? 'max-w-[85%]' : 'max-w-[75%]'} ${msg.role === "user" && !msg.isSystemMessage ? "text-right" : ""}`}>
                          {!msg.isSystemMessage && (
                            <div className={`flex items-center gap-2 mb-1 ${msg.role === "user" ? "justify-end" : ""}`}>
                              <span className="text-xs font-medium capitalize text-muted-foreground">
                                {msg.role === "user" ? "User" : "Bot"}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(msg.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                          )}
                          
                          <div
                            className={cn(
                              "inline-block px-4 py-2 rounded-2xl shadow-sm",
                              msg.isSystemMessage
                                ? "bg-orange-100 text-orange-900 border border-orange-200 dark:bg-orange-950 dark:text-orange-100 dark:border-orange-800 w-full text-center"
                                : msg.role === "user"
                                ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-br-md"
                                : "bg-gray-100 dark:bg-gray-800 text-foreground rounded-bl-md"
                            )}
                          >
                            {msg.isSystemMessage && (
                              <div className="flex items-center justify-center gap-2 mb-1">
                                <Info className="w-3 h-3" />
                                <span className="text-xs font-medium">System Message</span>
                              </div>
                            )}
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          </div>
                          
                          {msg.isConfirmation && (
                            <div className="flex gap-2 mt-2">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled
                                className={`text-xs ${
                                  msg.confirmationResponse?.toLowerCase() === "yes"
                                    ? "bg-green-100 border-green-500 text-green-700"
                                    : ""
                                }`}
                              >
                                Yes
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled
                                className={`text-xs ${
                                  msg.confirmationResponse?.toLowerCase() === "no"
                                    ? "bg-red-100 border-red-500 text-red-700"
                                    : ""
                                }`}
                              >
                                No
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    <div className="flex items-center gap-3 py-4">
                      <Separator className="flex-1" />
                      <div className="flex items-center gap-2 px-3 py-1 bg-purple-100 rounded-full">
                        <Headphones className="w-3 h-3 text-purple-600" />
                        <span className="text-xs font-medium text-purple-600">
                          Agent Conversation Started
                        </span>
                      </div>
                      <Separator className="flex-1" />
                    </div>
                  </>
                )}
                
                {/* Handoff Messages (Agent-User conversation + System messages - merged timeline) */}
                {(() => {
                  // Merge messages and system messages into a unified timeline
                  const mergedTimeline = mergeHandoffMessagesWithSystem(messages, handoffSystemMessages);
                  
                  return mergedTimeline.map((item, index) => {
                    // Check if it's a system message (PreHandoffMessage with isSystemMessage)
                    const isSystemMessage = 'isSystemMessage' in item && item.isSystemMessage;
                    
                    if (isSystemMessage) {
                      const msg = item as PreHandoffMessage;
                      return (
                        <div key={`timeline-${index}`} className="flex justify-center">
                          <div className="max-w-[85%]">
                            <div
                              className="inline-block px-4 py-2 rounded-2xl shadow-sm bg-orange-100 text-orange-900 border border-orange-200 dark:bg-orange-950 dark:text-orange-100 dark:border-orange-800 w-full text-center"
                            >
                              <div className="flex items-center justify-center gap-2 mb-1">
                                <Info className="w-3 h-3" />
                                <span className="text-xs font-medium">System Message</span>
                              </div>
                              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(msg.timestamp).toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    
                    // It's a regular handoff message
                    const message = item as Message;
                    return (
                      <div
                        key={`timeline-${index}`}
                        className={`flex gap-3 ${
                          message.sender === "agent" ? "flex-row-reverse" : ""
                        }`}
                      >
                        <Avatar className="w-8 h-8 flex-shrink-0">
                          <AvatarFallback className={
                            message.sender === "agent"
                              ? "bg-gradient-to-br from-emerald-500 to-teal-500"
                              : "bg-gradient-to-br from-blue-500 to-purple-500"
                          }>
                            {message.sender === "agent" ? (
                              <Headphones className="w-4 h-4 text-white" />
                            ) : (
                              <User className="w-4 h-4 text-white" />
                            )}
                          </AvatarFallback>
                        </Avatar>
                        <div
                          className={`max-w-[75%] ${
                            message.sender === "agent" ? "text-right" : ""
                          }`}
                        >
                          <div className={`flex items-center gap-2 mb-1 ${message.sender === "agent" ? "justify-end" : ""}`}>
                            <span className="text-xs font-medium capitalize text-muted-foreground">
                              {message.sender === "agent" ? "You" : "User"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(message.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <div
                            className={`inline-block px-4 py-2 rounded-2xl shadow-sm ${
                              message.sender === "agent"
                                ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-br-md"
                                : "bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-bl-md"
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
                
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          {/* Scroll to Bottom Button */}
          {!shouldAutoScroll && (
            <div className="absolute bottom-24 right-8 z-10">
              <Button
                onClick={() => {
                  setShouldAutoScroll(true);
                  scrollToBottom();
                }}
                size="sm"
                className="rounded-full shadow-lg bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <ArrowDown className="w-4 h-4 mr-1" />
                New messages
              </Button>
            </div>
          )}

          {/* Input Area */}
          {session.status !== "resolved" && (
            <div className="p-4 border-t bg-white/50">
              <div className="flex gap-2">
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="w-full">
                        <Input
                          value={inputMessage}
                          onChange={(e) => setInputMessage(e.target.value)}
                          placeholder="Type your message..."
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleSendMessage();
                            }
                          }}
                          disabled={inputDisabled}
                        />
                      </div>
                    </TooltipTrigger>
                    {inputDisabled && (
                      <TooltipContent side="top" className="max-w-xs">
                        <p className="text-sm">{inputDisabledMessage}</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>

                <Button 
                  onClick={handleSendMessage} 
                  disabled={!inputMessage.trim() || isSending || session.status === "pending"}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              {session.status === "pending" && (
                <p className="text-xs text-center text-muted-foreground mt-2">
                  Accept the session to start chatting
                </p>
              )}
            </div>
          )}

          {session.status === "resolved" && (
            <div className="p-4 border-t bg-gray-50 text-center">
              <p className="text-sm text-muted-foreground">
                This session has been resolved
              </p>
            </div>
          )}
        </Card>
      </main>

      {/* Resolve Dialog */}
      {showResolveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md m-4 p-6">
            <h2 className="text-xl font-bold mb-4">Resolve Session</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Add any notes about this session (optional)
            </p>
            <Textarea
              value={resolveNotes}
              onChange={(e) => setResolveNotes(e.target.value)}
              placeholder="Resolution notes..."
              rows={4}
              className="mb-4"
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowResolveDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleResolve}
                className="bg-green-600 hover:bg-green-700"
              >
                Resolve Session
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AgentChat;