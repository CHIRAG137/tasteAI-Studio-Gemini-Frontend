import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Send, Bot, User, X, Mic, MicOff, Loader2, Video, Phone, PhoneOff, Volume2, VolumeX, Headphones, Clock, ArrowDown } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Message {
  id: string;
  content: string | object;
  sender: "user" | "bot" | "agent";
  timestamp: Date;
  showConfirmationButtons?: boolean;
  showBranchOptions?: boolean;
  branchOptions?: string[];
  selectedBranch?: string;
  audioUrl?: string;
  isSystemMessage?: boolean;
}

interface ChatBotProps {
  bot: {
    id: string;
    name: string;
    description: string;
    websiteUrl: string;
    voiceEnabled: boolean;
    isVideoBot?: boolean;
    videoBotImageUrl?: string;
    languages: string[];
    primaryPurpose: string;
    conversationalTone: string;
    voiceId: string;
    humanHandoffEnabled?: boolean;
  };
  onClose: () => void;
}

export const ChatBot = ({ bot, onClose }: ChatBotProps) => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentPausedFor, setCurrentPausedFor] = useState<any>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [flowFinished, setFlowFinished] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showVideoAvatar, setShowVideoAvatar] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  // Human handoff state
  const [handoffRequested, setHandoffRequested] = useState(false);
  const [handoffSessionId, setHandoffSessionId] = useState<string | null>(null);
  const [isConnectedToAgent, setIsConnectedToAgent] = useState(false);
  const [assignedAgentEmail, setAssignedAgentEmail] = useState<string | null>(null);
  const [handoffStatus, setHandoffStatus] = useState<string | null>(null);
  const [isHandoffLoading, setIsHandoffLoading] = useState(false);
  const [isReopenLoading, setIsReopenLoading] = useState(false);
  const handoffStatusRef = useRef<string | null>(null);

  // Rating modal state
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingValue, setRatingValue] = useState<number>(0);
  const [ratingFeedback, setRatingFeedback] = useState<string>('');
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [previousRatingValue, setPreviousRatingValue] = useState<number | null>(null);
  const [previousRatingFeedback, setPreviousRatingFeedback] = useState<string>('');
  const [isLoadingRating, setIsLoadingRating] = useState(false);
  
  // IMPROVED: Jump to latest state with better tracking
  const [showJumpButton, setShowJumpButton] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const isAutoScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const userScrolledAwayRef = useRef(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const recognitionRef = useRef<any>(null);

  const speechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null);
  const ttsQueueRef = useRef<string[]>([]);
  const isProcessingTTSRef = useRef(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [showTtsPrompt, setShowTtsPrompt] = useState(false);

  // Human handoff keywords detection
  const detectHandoffIntent = (message: string): boolean => {
    const handoffKeywords = [
      'speak to human',
      'talk to agent',
      'live agent',
      'customer service',
      'representative',
      'real person',
      'human support',
      'talk to someone',
      'speak to someone',
      'human help',
      'agent',
      'representative',
    ];

    const lowerMessage = message.toLowerCase();
    return handoffKeywords.some(keyword => lowerMessage.includes(keyword));
  };

  // Add system message helper
  const addSystemMessage = (content: string) => {
    const systemMessage: Message = {
      id: `system-${Date.now()}`,
      content,
      sender: "bot",
      timestamp: new Date(),
      isSystemMessage: true,
    };
    setMessages((prev) => [...prev, systemMessage]);
  };

  // Request human handoff
  const requestHumanHandoff = async (userQuestion: string) => {
    if (!bot.humanHandoffEnabled) {
      const message = "Human support is not available for this bot.";
      addSystemMessage(message);
      // Save to flow session
      try {
        await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/api/flow/session/${sessionId}/system-message`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message,
              messageType: "handoff_unavailable",
            }),
          }
        );
      } catch (error) {
        console.error("Error saving message to flow session:", error);
      }
      return;
    }

    if (handoffRequested) {
      const message = "Your request for human support has already been submitted.";
      addSystemMessage(message);
      // Save to flow session
      try {
        await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/api/flow/session/${sessionId}/system-message`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message,
              messageType: "handoff_duplicate_request",
            }),
          }
        );
      } catch (error) {
        console.error("Error saving message to flow session:", error);
      }
      return;
    }

    setHandoffRequested(true);
    setIsHandoffLoading(true);
    const connectingMessage = "Connecting you with a human agent...";
    addSystemMessage(connectingMessage);
    
    // Save initial message to flow session
    try {
      await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/flow/session/${sessionId}/system-message`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: connectingMessage,
            messageType: "handoff_connecting",
          }),
        }
      );
    } catch (error) {
      console.error("Error saving message to flow session:", error);
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/handoff/request`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            botId: bot.id,
            flowSessionId: sessionId,
            userQuestion,
            userIpAddress: "",
            userAgent: navigator.userAgent,
          }),
        }
      );

      const data = await response.json();

      if (data.status === "success" && data.result) {
        setHandoffSessionId(data.result.handoffSession._id);
        setAssignedAgentEmail(data.result.agent.email);
        setIsConnectedToAgent(data.result.agent.isOnline);
        setIsHandoffLoading(false);

        const agentStatusMessage = data.result.message;
        addSystemMessage(agentStatusMessage);
        
        // Save agent status message to flow session
        try {
          await fetch(
            `${import.meta.env.VITE_BACKEND_URL}/api/flow/session/${sessionId}/system-message`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                message: agentStatusMessage,
                messageType: "handoff_agent_assigned",
                handoffSessionId: data.result.handoffSession._id,
              }),
            }
          );
        } catch (error) {
          console.error("Error saving agent status message to flow session:", error);
        }
        
        if (!data.result.agent.isOnline) {
          const offlineMessage = "The agent is currently offline but will respond as soon as possible. You can continue asking questions or close this chat.";
          addSystemMessage(offlineMessage);
          
          // Save offline message to flow session
          try {
            await fetch(
              `${import.meta.env.VITE_BACKEND_URL}/api/flow/session/${sessionId}/system-message`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  message: offlineMessage,
                  messageType: "handoff_agent_offline",
                  handoffSessionId: data.result.handoffSession._id,
                }),
              }
            );
          } catch (error) {
            console.error("Error saving offline message to flow session:", error);
          }
        }
      } else {
        throw new Error(data.message || "Failed to request human support");
      }
    } catch (error: any) {
      console.error("Handoff request error:", error);
      const errorMessage = "Failed to connect with a human agent. Please try again later.";
      addSystemMessage(errorMessage);
      setIsHandoffLoading(false);
      
      // Save error message to flow session
      try {
        await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/api/flow/session/${sessionId}/system-message`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: errorMessage,
              messageType: "handoff_error",
            }),
          }
        );
      } catch (saveError) {
        console.error("Error saving error message to flow session:", saveError);
      }
      
      setHandoffRequested(false);
    }
  };

  // Send message to agent when in handoff mode
  const sendMessageToAgent = async (message: string) => {
    if (!handoffSessionId) return;
    if (handoffStatusRef.current === 'resolved') {
      const msg = 'This conversation has been resolved. You cannot send more messages.';
      addSystemMessage(msg);
      return;
    }

    try {
      await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/handoff/${handoffSessionId}/client-message`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            message, 
            flowSessionId: sessionId 
          }),
        }
      );
    } catch (error) {
      console.error("Error sending message to agent:", error);
      toast({
        title: "Error",
        description: "Failed to send message to agent",
        variant: "destructive",
      });
    }
  };

  // Client resolves the handoff (user ends the chat)
  const clientResolveHandoff = async () => {
    if (!handoffSessionId || !sessionId) return;
    try {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/handoff/${handoffSessionId}/client-resolve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ flowSessionId: sessionId }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        setHandoffStatus('resolved');
        handoffStatusRef.current = 'resolved';
        setHandoffRequested(false);
        // show rating modal to the client after resolving
        showRatingModalWithData();
        addSystemMessage('You have ended this conversation.');
      } else {
        throw new Error(data.message || 'Failed to resolve session');
      }
    } catch (error) {
      console.error('Error resolving handoff (client):', error);
      toast({ title: 'Error', description: 'Failed to end chat', variant: 'destructive' });
    }
  };

  // Client reopens a resolved handoff session
  const clientReopenHandoff = async () => {
    if (!handoffSessionId || !sessionId || isReopenLoading) return;
    setIsReopenLoading(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/handoff/${handoffSessionId}/client-reopen`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ flowSessionId: sessionId }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        setHandoffRequested(true);
        setHandoffStatus('pending');
        handoffStatusRef.current = 'pending';
        addSystemMessage('You have reopened the conversation. Waiting for an agent to respond.');
      } else {
        throw new Error(data.message || 'Failed to reopen session');
      }
    } catch (error) {
      console.error('Error reopening handoff (client):', error);
      toast({ title: 'Error', description: 'Failed to reopen chat', variant: 'destructive' });
    } finally {
      setIsReopenLoading(false);
    }
  };

  // Fetch existing rating for the session
  const fetchExistingRating = async () => {
    if (!handoffSessionId || !sessionId) return;
    setIsLoadingRating(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/handoff/${handoffSessionId}/rating?flowSessionId=${sessionId}`
      );
      const data = await res.json();
      if (res.ok && data.result) {
        if (data.result.userRating) {
          setPreviousRatingValue(data.result.userRating);
          setRatingValue(data.result.userRating);
        }
        if (data.result.userFeedback) {
          setPreviousRatingFeedback(data.result.userFeedback);
          setRatingFeedback(data.result.userFeedback);
        }
      }
    } catch (error) {
      console.error('Error fetching existing rating:', error);
    } finally {
      setIsLoadingRating(false);
    }
  };

  // Show rating modal with previous rating data
  const showRatingModalWithData = async () => {
    // Reset rating submitted when reopening modal to allow re-rating
    setRatingSubmitted(false);
    setShowRatingModal(true);
    await fetchExistingRating();
  };

  // Submit rating to backend
  const submitRating = async () => {
    if (!handoffSessionId || !sessionId) {
      toast({ title: 'Error', description: 'Session information missing', variant: 'destructive' });
      return;
    }

    if (!ratingValue || ratingValue < 1) {
      toast({ title: 'Please rate', description: 'Select a rating between 1 and 5', variant: 'destructive' });
      return;
    }

    setSubmittingRating(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/handoff/${handoffSessionId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flowSessionId: sessionId, rating: ratingValue, feedback: ratingFeedback }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to submit rating');

      setRatingSubmitted(true);
      setShowRatingModal(false);
      toast({ title: 'Thanks', description: 'Your rating has been submitted' });
    } catch (err: any) {
      console.error('Rating submit error', err);
      toast({ title: 'Error', description: err.message || 'Failed to submit rating', variant: 'destructive' });
    } finally {
      setSubmittingRating(false);
    }
  };

  // Poll for agent messages when handoff is active
  useEffect(() => {
    if (!handoffSessionId) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/api/handoff/${handoffSessionId}/client-messages?flowSessionId=${sessionId}`
        );
        const data = await response.json();

        if (data.status === "success" && data.result?.messages) {
          const agentMessages = data.result.messages
            .filter((m: any) => m.sender === "agent")
            .map((m: any) => ({
              id: `agent-${m.timestamp || Date.now()}`,
              content: m.message,
              sender: "agent" as const,
              timestamp: new Date(m.timestamp),
            }));

          // Append any new agent messages
          setMessages((prev) => {
            const existingIds = new Set(prev.map(m => m.id));
            const newMessages = agentMessages.filter((m: Message) => !existingIds.has(m.id));
            return [...prev, ...newMessages];
          });

          // Handle session status updates (pending | active | resolved)
          const status = data.result.status;
          const assignedAgent = data.result.assignedAgent;

          // When agent accepts (active)
          if (status === 'active' && handoffStatusRef.current !== 'active') {
            setHandoffStatus('active');
            handoffStatusRef.current = 'active';
            setIsConnectedToAgent(true);
            if (assignedAgent?.email) setAssignedAgentEmail(assignedAgent.email);
            const agentMsg = `A human agent (${assignedAgent?.email || 'agent'}) has accepted your request.`;
            addSystemMessage(agentMsg);
            // persist system message to flow session (best-effort)
            try {
              await fetch(
                `${import.meta.env.VITE_BACKEND_URL}/api/flow/session/${sessionId}/system-message`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    message: agentMsg,
                    messageType: 'handoff_accepted',
                    handoffSessionId,
                  }),
                }
              );
            } catch (e) {
              // ignore
            }
          }

          // When agent resolves
          if (status === 'resolved' && handoffStatusRef.current !== 'resolved') {
            setHandoffStatus('resolved');
            handoffStatusRef.current = 'resolved';
            setHandoffRequested(false);
            // prompt the client to rate the agent/session
            setShowRatingModal(true);
            const resolvedMsg = 'This conversation has been marked resolved by the agent.';
            addSystemMessage(resolvedMsg);
            try {
              await fetch(
                `${import.meta.env.VITE_BACKEND_URL}/api/flow/session/${sessionId}/system-message`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    message: resolvedMsg,
                    messageType: 'handoff_resolved',
                    handoffSessionId,
                  }),
                }
              );
            } catch (e) {
              // ignore
            }
          }
        }
      } catch (error) {
        console.error("Error polling agent messages:", error);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [handoffSessionId, sessionId]);

  // Initialize browser's Speech Recognition API
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn("Speech Recognition not supported in this browser");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      setIsProcessing(false);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setIsProcessing(true);

      if (bot.isVideoBot && flowFinished) {
        handleVoiceQuestion(transcript);
      } else {
        setInputMessage(prev => {
          const newText = prev ? prev + " " + transcript : transcript;
          return newText.trim();
        });
      }

      setIsProcessing(false);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
      setIsProcessing(false);

      if (event.error !== 'no-speech') {
        toast({
          title: "Speech Error",
          description: `Error: ${event.error}`,
          variant: "destructive"
        });
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      setIsProcessing(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [bot.isVideoBot, flowFinished]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast({
        title: "Not Supported",
        description: "Speech recognition is not supported in your browser",
        variant: "destructive"
      });
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  const processTTSQueue = async () => {
    if (isProcessingTTSRef.current || ttsQueueRef.current.length === 0) {
      return;
    }

    if (!window.speechSynthesis) {
      console.warn("Speech Synthesis not supported in this browser");
      return;
    }

    if (!ttsEnabled) {
      setShowTtsPrompt(true);
      return;
    }

    isProcessingTTSRef.current = true;
    setIsSpeaking(true);

    while (ttsQueueRef.current.length > 0) {
      const text = ttsQueueRef.current.shift();
      if (!text) continue;

      try {
        await new Promise<void>((resolve, reject) => {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = 'en-US';
          utterance.rate = 1.0;
          utterance.pitch = 1.0;
          utterance.volume = 1.0;

          utterance.onend = () => {
            resolve();
          };

          utterance.onerror = (event) => {
            console.error("Speech synthesis error:", event);
            if (event.error === 'not-allowed') {
              setShowTtsPrompt(true);
              setTtsEnabled(false);
            }
            resolve();
          };

          speechSynthesisRef.current = utterance;
          window.speechSynthesis.speak(utterance);
        });

      } catch (error) {
        console.error("TTS error:", error);
      }
    }

    isProcessingTTSRef.current = false;
    setIsSpeaking(false);
  };

  const enableTTS = () => {
    setTtsEnabled(true);
    setShowTtsPrompt(false);
    if (ttsQueueRef.current.length > 0) {
      processTTSQueue();
    }
  };

  const disableTTS = () => {
    setTtsEnabled(false);
    setShowTtsPrompt(false);
    clearTTSQueue();
  };

  const queueTextToSpeech = (text: string) => {
    if (!bot.isVideoBot || !text.trim()) return;

    ttsQueueRef.current.push(text);
    processTTSQueue();
  };

  const clearTTSQueue = () => {
    ttsQueueRef.current = [];
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    isProcessingTTSRef.current = false;
    setIsSpeaking(false);
  };

  useEffect(() => {
    return () => {
      clearTTSQueue();
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const handleVoiceQuestion = async (question: string) => {
    if (!question.trim() || isLoading) return;

    // Check for handoff intent in voice mode too
    if (flowFinished && detectHandoffIntent(question) && bot.humanHandoffEnabled) {
      const userMessage: Message = {
        id: Date.now().toString(),
        content: question,
        sender: "user",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);
      await requestHumanHandoff(question);
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content: question,
      sender: "user",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    // If in handoff mode, send to agent
    if (handoffRequested && handoffSessionId) {
      await sendMessageToAgent(question);
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/bots/ask`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question,
            botId: bot.id,
            flowSessionId: sessionId,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to get answer");
      }

      const answerText = data.result.answer || "I couldn't find an answer to that question.";
      addBotMessage(answerText);

      queueTextToSpeech(answerText);
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Error",
        description: err.message || "Something went wrong",
        variant: "destructive"
      });
      addBotMessage("I'm having trouble answering that. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // IMPROVED: Check if user is near bottom with threshold (SAME AS EMBED)
  const checkIfNearBottom = () => {
    if (!scrollAreaRef.current) return true;
    const element = scrollAreaRef.current;
    const threshold = 150;
    const scrollTop = element.scrollTop;
    const scrollHeight = element.scrollHeight;
    const clientHeight = element.clientHeight;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    
    const isNear = distanceFromBottom < threshold;
    return isNear;
  };

  // IMPROVED: Smooth scroll to bottom with better state management (SAME AS EMBED)
  const scrollToBottom = (force = false) => {
    if (isAutoScrollingRef.current && !force) return;
    
    isAutoScrollingRef.current = true;
    userScrolledAwayRef.current = false;
    setShowJumpButton(false);
    
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    scrollTimeoutRef.current = setTimeout(() => {
      isAutoScrollingRef.current = false;
    }, 500);
  };

  // IMPROVED: Handle scroll events with better logic (SAME AS EMBED)
  const handleScrollAreaScroll = (e: React.UIEvent<HTMLDivElement>) => {
    // Ignore scroll events triggered by auto-scroll
    if (isAutoScrollingRef.current) return;
    
    const element = e.currentTarget;
    const isNearBottom = checkIfNearBottom();
    
    // User scrolled away from bottom
    if (!isNearBottom && element.scrollHeight > element.clientHeight) {
      userScrolledAwayRef.current = true;
      setShowJumpButton(true);
    } else {
      userScrolledAwayRef.current = false;
      setShowJumpButton(false);
    }
  };

  // IMPROVED: Auto-scroll when new messages arrive (SAME AS EMBED)
  useEffect(() => {
    if (userScrolledAwayRef.current || isLoading || isHandoffLoading) {
      return;
    }
    
    scrollToBottom();
  }, [messages.length]);

  // IMPROVED: Scroll to bottom after loading completes (SAME AS EMBED)
  useEffect(() => {
    if (!isLoading && !isHandoffLoading && !userScrolledAwayRef.current) {
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    }
  }, [isLoading, isHandoffLoading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const addBotMessage = (content: string, audioUrl?: string) => {
    const botMessage: Message = {
      id: Date.now().toString() + Math.random(),
      content,
      sender: "bot",
      timestamp: new Date(),
      audioUrl,
    };
    setMessages((prev) => [...prev, botMessage]);

    return botMessage;
  };

  useEffect(() => {
    const initFlow = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/api/flow/start/${bot.id}`,
          { method: "POST" }
        );
        const data = await res.json();

        if (data.sessionId) setSessionId(data.sessionId);

        const botMessages: Message[] = [];
        const textsToSpeak: string[] = [];

        (data.messages || []).forEach((msg: any) => {
          if (msg.type === "redirect") {
            const url = msg.content?.replace("Redirecting to: ", "") || msg.content;
            if (url) {
              window.open(url, '_blank');
            }
            return;
          }

          if (msg.type === "branch" && msg.awaitingInput) {
            botMessages.push({
              id: Date.now().toString() + Math.random(),
              content: "",
              sender: "bot",
              timestamp: new Date(),
              showBranchOptions: true,
              branchOptions: msg.options || [],
            });
            return;
          }

          const messageContent = msg.content || msg.message || "";
          botMessages.push({
            id: Date.now().toString() + Math.random(),
            content: messageContent,
            sender: "bot",
            timestamp: new Date(),
            showConfirmationButtons: msg.type === "confirmation" && msg.awaitingInput,
            showBranchOptions: false,
            branchOptions: msg.options || [],
          });

          if (bot.isVideoBot && messageContent) {
            textsToSpeak.push(messageContent);
          }
        });

        if (data.finished) {
          setFlowFinished(true);
          setCurrentPausedFor(null);
        } else {
          if (data.awaitingInput) {
            setCurrentPausedFor(data.awaitingInput);
          } else {
            setCurrentPausedFor(null);
          }
        }

        setMessages(botMessages);

        textsToSpeak.forEach(text => queueTextToSpeech(text));

      } catch (err) {
        console.error("Failed to start flow", err);
        toast({
          title: "Error",
          description: "Failed to start conversation",
          variant: "destructive"
        });
      }
    };

    initFlow();
  }, [bot.id]);

  const handleAskQuestion = async () => {
    const question = inputMessage.trim();
    if (!question || isLoading) return;

    // Check for handoff intent
    if (flowFinished && detectHandoffIntent(question) && bot.humanHandoffEnabled) {
      const userMessage: Message = {
        id: Date.now().toString(),
        content: question,
        sender: "user",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setInputMessage("");
      await requestHumanHandoff(question);
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content: question,
      sender: "user",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    // If in handoff mode, send to agent
    if (handoffRequested && handoffSessionId) {
      await sendMessageToAgent(question);
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/bots/ask`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question,
            botId: bot.id,
            flowSessionId: sessionId,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to get answer");
      }

      const answerText = data.result.answer || "I couldn't find an answer to that question.";
      addBotMessage(answerText);

      queueTextToSpeech(answerText);
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Error",
        description: err.message || "Something went wrong",
        variant: "destructive"
      });
      const errorMessage = {
        id: Date.now().toString() + Math.random(),
        content: "I'm having trouble answering that. Please try again.",
        sender: "bot" as const,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (overrideInput?: string, isBranchOption?: boolean) => {
    if (flowFinished) {
      handleAskQuestion();
      return;
    }

    const messageToSend = overrideInput || inputMessage.trim();
    if (!messageToSend || isLoading || !sessionId) return;

    setCurrentPausedFor(null);

    const userMessage: Message = {
      id: Date.now().toString(),
      content: messageToSend,
      sender: "user",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    try {
      let requestBody: any = {};

      if (currentPausedFor?.type === "branch" || isBranchOption) {
        requestBody.optionIndexOrLabel = messageToSend;
      } else {
        requestBody.input = messageToSend;
      }

      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/flow/session/${sessionId}/respond`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to send message");
      }

      const botMessages: Message[] = [];
      const textsToSpeak: string[] = [];

      (data.messages || []).forEach((msg: any) => {
        if (msg.type === "redirect") {
          const url = msg.content?.replace("Redirecting to: ", "") || msg.content;
          if (url) {
            window.open(url, '_blank');
          }
          return;
        }

        if (msg.type === "branch" && msg.awaitingInput) {
          botMessages.push({
            id: Date.now().toString() + Math.random(),
            content: "",
            sender: "bot",
            timestamp: new Date(),
            showBranchOptions: true,
            branchOptions: msg.options || [],
          });
          return;
        }

        const messageContent = msg.content || msg.message || "";
        botMessages.push({
          id: Date.now().toString() + Math.random(),
          content: messageContent,
          sender: "bot",
          timestamp: new Date(),
          showConfirmationButtons: msg.type === "confirmation" && msg.awaitingInput,
          showBranchOptions: false,
          branchOptions: msg.options || [],
        });

        if (bot.isVideoBot && messageContent) {
          textsToSpeak.push(messageContent);
        }
      });

      if (data.awaitingInput) {
        setCurrentPausedFor(data.awaitingInput);
      } else {
        setCurrentPausedFor(null);
      }

      if (data.finished) {
        setFlowFinished(true);
        setCurrentPausedFor(null);
      }

      setMessages((prev) => [...prev, ...botMessages]);

      textsToSpeak.forEach(text => queueTextToSpeech(text));

    } catch (err: any) {
      console.error(err);
      toast({
        title: "Error",
        description: err.message || "Something went wrong",
        variant: "destructive"
      });
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + Math.random(),
          content: "Something went wrong. Please try again.",
          sender: "bot",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmationClick = (answer: string) => {
    handleSendMessage(answer, false);
  };

  const handleBranchOptionClick = (option: string, messageId: string) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, selectedBranch: option } : msg
      )
    );
    handleSendMessage(option, true);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleVoiceInput = () => {
    toggleListening();
  };

  const handleMicToggle = () => {
    if (isMuted) {
      setIsMuted(false);
      toggleListening();
    } else {
      setIsMuted(true);
      if (isListening) {
        toggleListening();
      }
    }
  };

  const handleEndCall = () => {
    setShowVideoAvatar(false);
    setIsMuted(true);
    if (isListening) {
      toggleListening();
    }
    clearTTSQueue();
  };

  const handleBringBackAvatar = () => {
    setShowVideoAvatar(true);
  };

  const isAwaitingInput = currentPausedFor !== null;
  const canSendText =
    flowFinished ||
    (isAwaitingInput &&
      currentPausedFor?.type !== "branch" &&
      !currentPausedFor?.showConfirmationButtons);

  const shouldShowMicButton = bot.isVideoBot ? !flowFinished : (bot.voiceEnabled && canSendText);

  const videoBotAvatarUrl = bot.videoBotImageUrl || null;

  // Get appropriate placeholder text
  const getPlaceholderText = () => {
    if (isListening) return "Listening... Speak now";
    if (isProcessing) return "Processing speech...";
    if (handoffRequested && isConnectedToAgent) return "Message the agent...";
    if (handoffRequested && !isConnectedToAgent) return "Waiting for agent...";
    if (flowFinished) return "Ask me anything...";
    if (canSendText) return "Type your message...";
    return "Select an option above...";
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={`${bot.isVideoBot ? (showVideoAvatar ? 'max-w-6xl' : 'max-w-2xl') : 'max-w-2xl'} h-[600px] p-0 gap-0 flex flex-col bg-background/95 backdrop-blur-sm border shadow-2xl rounded-xl overflow-hidden transition-all duration-300`}>
        <DialogHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 flex-shrink-0 space-y-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <Avatar className="h-12 w-12 border-2 border-white flex-shrink-0 mt-1">
                <AvatarFallback className="bg-white text-blue-600">
                  {handoffRequested ? <Headphones className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-xl text-white">{bot.name}</DialogTitle>
                  <div className="flex gap-1.5 flex-wrap">
                    {/* Handoff Status Badge */}
                    {handoffRequested && (
                      <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700 border-orange-200 animate-pulse">
                        <Headphones className="h-3 w-3 mr-1" />
                        {isConnectedToAgent ? "Agent Connected" : "Waiting for Agent"}
                      </Badge>
                    )}

                    <Badge
                      variant="secondary"
                      className={`text-xs ${bot.voiceEnabled ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-700 border-gray-200'}`}
                    >
                      {bot.voiceEnabled ? (
                        <>
                          <Volume2 className="h-3 w-3 mr-1" />
                          Voice Enabled
                        </>
                      ) : (
                        <>
                          <VolumeX className="h-3 w-3 mr-1" />
                          Voice Disabled
                        </>
                      )}
                    </Badge>

                    <Badge
                      variant="secondary"
                      className={`text-xs ${bot.isVideoBot ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}
                    >
                      {bot.isVideoBot ? (
                        <>
                          <Video className="h-3 w-3 mr-1" />
                          Video Bot
                        </>
                      ) : (
                        <>
                          <Bot className="h-3 w-3 mr-1" />
                          Chat Bot
                        </>
                      )}
                    </Badge>

                    {flowFinished ? (
                      <Badge variant="secondary" className="text-xs bg-teal-100 text-teal-700 border-teal-200">
                        Q&A Mode
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs bg-cyan-100 text-cyan-700 border-cyan-200">
                        Flow Mode
                      </Badge>
                    )}
                  </div>
                </div>
                {bot.description && (
                  <p className="text-sm text-white/90 mt-1.5 line-clamp-2">
                    {bot.description}
                  </p>
                )}
                {handoffRequested && assignedAgentEmail && (
                  <p className="text-xs text-white/80 mt-1">
                    <Clock className="inline h-3 w-3 mr-1" />
                    Agent: {assignedAgentEmail}
                  </p>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-white hover:bg-white/20 flex-shrink-0"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </DialogHeader>

        {bot.isVideoBot ? (
          <div className="flex-1 flex overflow-hidden min-h-0">
            {showVideoAvatar && (
              <div className="w-1/2 relative overflow-hidden flex items-center justify-center">
                {videoBotAvatarUrl ? (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <img
                      src={videoBotAvatarUrl}
                      alt="Video Bot Avatar"
                      className="relative z-0 w-full h-full object-cover"
                    />

                    {(isLoading || isSpeaking) && (
                      <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-20 bg-black/50 text-white px-4 py-2 rounded-full flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">{isSpeaking ? "Speaking..." : "Thinking..."}</span>
                      </div>
                    )}

                    {flowFinished && (
                      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 pointer-events-none">
                        <div className="flex gap-3 pointer-events-auto">
                          <Button
                            onClick={ttsEnabled ? disableTTS : enableTTS}
                            size="lg"
                            className={`h-14 w-14 rounded-full shadow-xl transition-all hover:scale-110 ${
                              ttsEnabled
                                ? "bg-blue-500 hover:bg-blue-600"
                                : "bg-gray-400 hover:bg-gray-500"
                            }`}
                            title={ttsEnabled ? "Disable voice responses" : "Enable voice responses"}
                          >
                            {ttsEnabled ? (
                              <Volume2 className="h-6 w-6 text-white" />
                            ) : (
                              <VolumeX className="h-6 w-6 text-white" />
                            )}
                          </Button>

                          <Button
                            onClick={handleMicToggle}
                            size="lg"
                            className={`h-14 w-14 rounded-full shadow-xl transition-all hover:scale-110 ${!isMuted
                              ? isListening
                                ? "bg-red-500 hover:bg-red-600 animate-pulse"
                                : "bg-green-500 hover:bg-green-600"
                              : "bg-gray-400 hover:bg-gray-500"
                              }`}
                            disabled={isLoading || isProcessing || isSpeaking}
                            title={isMuted ? "Click to unmute and start speaking" : isListening ? "Listening..." : "Click to speak"}
                          >
                            {isProcessing ? (
                              <Loader2 className="h-6 w-6 animate-spin text-white" />
                            ) : isMuted ? (
                              <MicOff className="h-6 w-6 text-white" />
                            ) : (
                              <Mic className="h-6 w-6 text-white" />
                            )}
                          </Button>

                          <Button
                            onClick={handleEndCall}
                            size="lg"
                            className="h-14 w-14 rounded-full shadow-xl transition-all hover:scale-110 bg-red-600 hover:bg-red-700"
                            title="End call and hide avatar"
                          >
                            <PhoneOff className="h-6 w-6 text-white" />
                          </Button>
                        </div>

                        <p className="text-center text-xs text-white bg-black/50 backdrop-blur px-3 py-1 rounded-full">
                          {isSpeaking
                            ? "Bot speaking..."
                            : isProcessing
                              ? "Processing..."
                              : isMuted
                                ? "Microphone muted"
                                : isListening
                                  ? "Listening..."
                                  : "Microphone active"}
                          {" • "}
                          {ttsEnabled ? "Voice on" : "Voice off"}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center p-8 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 w-full h-full flex flex-col items-center justify-center">
                    <Video className="h-20 w-20 mx-auto mb-4 text-purple-400" />
                    <h3 className="text-2xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      Video Bot
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                      No avatar configured for this video bot
                    </p>

                    {flowFinished && (
                      <>
                        <div className="flex gap-3 justify-center">
                          <Button
                            onClick={ttsEnabled ? disableTTS : enableTTS}
                            size="lg"
                            className={`h-14 w-14 rounded-full shadow-xl transition-all hover:scale-110 ${
                              ttsEnabled
                                ? "bg-blue-500 hover:bg-blue-600"
                                : "bg-gray-400 hover:bg-gray-500"
                            }`}
                            title={ttsEnabled ? "Disable voice responses" : "Enable voice responses"}
                          >
                            {ttsEnabled ? (
                              <Volume2 className="h-6 w-6 text-white" />
                            ) : (
                              <VolumeX className="h-6 w-6 text-white" />
                            )}
                          </Button>

                          <Button
                            onClick={handleMicToggle}
                            size="lg"
                            className={`h-14 w-14 rounded-full shadow-xl transition-all hover:scale-110 ${!isMuted
                              ? isListening
                                ? "bg-red-500 hover:bg-red-600 animate-pulse"
                                : "bg-green-500 hover:bg-green-600"
                              : "bg-gray-400 hover:bg-gray-500"
                              }`}
                            disabled={isLoading || isProcessing || isSpeaking}
                          >
                            {isProcessing ? (
                              <Loader2 className="h-6 w-6 animate-spin text-white" />
                            ) : isMuted ? (
                              <MicOff className="h-6 w-6 text-white" />
                            ) : (
                              <Mic className="h-6 w-6 text-white" />
                            )}
                          </Button>

                          <Button
                            onClick={handleEndCall}
                            size="lg"
                            className="h-14 w-14 rounded-full shadow-xl transition-all hover:scale-110 bg-red-600 hover:bg-red-700"
                            title="End call and hide avatar"
                          >
                            <PhoneOff className="h-6 w-6 text-white" />
                          </Button>
                        </div>

                        <p className="text-center text-xs text-muted-foreground mt-4">
                          {isSpeaking
                            ? "Bot speaking..."
                            : isProcessing
                              ? "Processing..."
                              : isMuted
                                ? "Click to unmute and speak"
                                : isListening
                                  ? "Listening..."
                                  : "Click to speak"
                          }
                          {" • "}
                          {ttsEnabled ? "Voice on" : "Voice off"}
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className={`${showVideoAvatar ? 'w-1/2' : 'w-full'} flex flex-col bg-white dark:bg-gray-900 transition-all duration-300 relative min-h-0`}>
              <div 
                ref={scrollAreaRef}
                onScroll={handleScrollAreaScroll}
                className="flex-1 overflow-y-auto overflow-x-hidden p-4"
              >
                <div className="space-y-4">
                  {messages.length === 0 && (
                    <div className="text-center text-gray-400 py-8">
                      <p className="mb-2">Start a conversation!</p>
                      <p className="text-sm">{flowFinished ? "Type a message or use voice input" : "Follow the flow to continue"}</p>
                    </div>
                  )}
                  
                  {messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 mb-4 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {(msg.sender === "bot" || msg.sender === "agent") && (
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className={msg.sender === "agent" 
                          ? "bg-gradient-to-r from-emerald-600 to-teal-500 text-white"
                          : "bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                        }>
                          {msg.sender === "agent" ? <Headphones className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className={`flex flex-col gap-1 ${msg.sender === "user" ? "items-end" : "items-start"} max-w-[75%]`}>
                      {msg.content && (
                        <div
                          className={`rounded-lg p-3 ${
                            msg.sender === "user"
                              ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                              : msg.sender === "agent"
                              ? "bg-gradient-to-r from-emerald-600 to-teal-500 text-white"
                              : msg.isSystemMessage
                              ? "bg-orange-100 text-orange-900 border border-orange-200"
                              : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                          }`}
                        >
                          {typeof msg.content === "string"
                            ? msg.content
                            : JSON.stringify(msg.content)}
                        </div>
                      )}
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        {msg.sender === "agent" && <Headphones className="h-3 w-3" />}
                        {msg.timestamp.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </span>

                      {msg.showConfirmationButtons &&
                        isAwaitingInput &&
                        msg.sender === "bot" &&
                        !flowFinished && (
                          <div className="flex gap-2 mt-2">
                            <Button
                              size="sm"
                              onClick={() => handleConfirmationClick("yes")}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              Yes
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleConfirmationClick("no")}
                            >
                              No
                            </Button>
                          </div>
                        )}

                      {msg.showBranchOptions &&
                        msg.sender === "bot" &&
                        msg.branchOptions && (
                          <div className="flex flex-col gap-2 mt-2">
                            {msg.branchOptions.map((opt, idx) => (
                              <Button
                                key={idx}
                                size="sm"
                                variant="outline"
                                onClick={() => handleBranchOptionClick(opt, msg.id)}
                                disabled={!!msg.selectedBranch}
                                className={msg.selectedBranch === opt ? "bg-blue-500 text-white border-blue-600" : ""}
                              >
                                {opt}
                              </Button>
                            ))}
                          </div>
                        )}
                    </div>
                    {msg.sender === "user" && (
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-gray-300">
                          <User className="h-5 w-5" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-3 mb-4">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className={handoffRequested 
                        ? "bg-gradient-to-r from-emerald-600 to-teal-500 text-white"
                        : "bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                      }>
                        {handoffRequested ? <Headphones className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
                      </AvatarFallback>
                    </Avatar>
                    <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  </div>
                )}
                {isHandoffLoading && (
                  <div className="flex gap-3 mb-4">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-gradient-to-r from-emerald-600 to-teal-500 text-white">
                        <Headphones className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="bg-blue-100 dark:bg-blue-900 rounded-lg p-3 flex items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                      <span className="text-sm text-blue-700 font-medium">Connecting to an agent...</span>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
                </div>
              </div>

              <div className="p-4 border-t bg-white dark:bg-gray-900 flex-shrink-0">
                {/* IMPROVED: Jump to Latest Button - only shown when stable */}
                {showJumpButton && (
                  <div className="mb-3 flex justify-center">
                    <Button
                      onClick={() => scrollToBottom(true)}
                      variant="outline"
                      className="flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
                    >
                      <ArrowDown className="h-4 w-4" />
                      Jump to Latest Message
                    </Button>
                  </div>
                )}

                {handoffRequested && !isConnectedToAgent && (
                <Alert className={`mb-2 ${isHandoffLoading ? 'bg-blue-50 border-blue-200' : 'bg-yellow-50 border-yellow-200'}`}>
                  {isHandoffLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                      <AlertDescription className="text-blue-800">
                        Searching for an available agent...
                      </AlertDescription>
                    </>
                  ) : (
                    <>
                      <Clock className="h-4 w-4 text-yellow-600" />
                      <AlertDescription className="text-yellow-800">
                        Waiting for an agent to respond. You can continue sending messages.
                      </AlertDescription>
                    </>
                  )}
                  {!isHandoffLoading && (
                    <div className="mt-2">
                      <Button size="sm" variant="outline" onClick={clientResolveHandoff}>End chat</Button>
                    </div>
                  )}
                </Alert>
              )}

                {handoffRequested && isConnectedToAgent && (
                  <Alert className="mb-2 bg-green-50 border-green-200">
                    <Headphones className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      Connected to agent: {assignedAgentEmail}
                    </AlertDescription>
                    <div className="mt-2">
                      <Button size="sm" variant="outline" onClick={clientResolveHandoff}>End chat</Button>
                    </div>
                  </Alert>
                )}

                {showTtsPrompt && bot.isVideoBot && (
                  <Alert className="mb-2 bg-amber-50 border-amber-200">
                    <Volume2 className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="flex items-center justify-between">
                      <span className="text-amber-800">Enable voice responses from the bot?</span>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={enableTTS} className="bg-amber-600 hover:bg-amber-700">
                          Enable
                        </Button>
                        <Button size="sm" variant="outline" onClick={disableTTS}>
                          No thanks
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {handoffStatus === 'resolved' && (
                  <Alert className="mb-2 bg-gray-50 border-gray-200">
                    <AlertDescription className="text-gray-800">
                      This conversation has been resolved. You cannot send messages.
                    </AlertDescription>
                    <div className="mt-2">
                      <Button size="sm" onClick={clientReopenHandoff} disabled={isReopenLoading}>
                        {isReopenLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Reopening...
                          </>
                        ) : (
                          'Reopen chat'
                        )}
                      </Button>
                    </div>
                  </Alert>
                )}

                {flowFinished && isListening && (
                  <Alert className="mb-2 bg-blue-50 border-blue-200">
                    <Mic className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800">Listening... Speak now</AlertDescription>
                  </Alert>
                )}

                {isProcessing && !isHandoffLoading && (
                  <Alert className="mb-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <AlertDescription>Processing your speech...</AlertDescription>
                  </Alert>
                )}

                {!showVideoAvatar && (
                  <div className="mb-3">
                    <Button
                      onClick={handleBringBackAvatar}
                      variant="outline"
                      className="w-full border-2 border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
                    >
                      <Video className="h-4 w-4 mr-2" />
                      Show Video Avatar
                    </Button>
                  </div>
                )}

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      ref={inputRef}
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder={getPlaceholderText()}
                      disabled={isLoading || isHandoffLoading || (!canSendText && !handoffRequested) || handoffStatus === 'resolved' || isProcessing}
                      className="pr-12"
                    />
                    {shouldShowMicButton && !handoffRequested && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={handleVoiceInput}
                        className="absolute right-1 top-1/2 -translate-y-1/2"
                        disabled={isLoading || isProcessing}
                      >
                        {isProcessing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : isListening ? (
                          <MicOff className="h-4 w-4 text-red-500" />
                        ) : (
                          <Mic className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                  <Button
                    onClick={() => handleSendMessage()}
                    disabled={!inputMessage.trim() || isLoading || isHandoffLoading || (!canSendText && !handoffRequested) || handoffStatus === 'resolved' || isListening || isProcessing}
                    size="icon"
                    className={handoffRequested 
                      ? "bg-gradient-to-r from-emerald-600 to-teal-500 hover:opacity-90"
                      : "bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90"
                    }
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>

                <div className="text-center py-2 border-t mt-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Powered by{" "}
                    <span className="font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      TasteAI Studio
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div 
              ref={scrollAreaRef}
              onScroll={handleScrollAreaScroll}
              className="flex-1 overflow-y-auto overflow-x-hidden p-4 min-h-0"
            >
              <div className="space-y-4">
                {messages.length === 0 && (
                  <div className="text-center text-gray-400 py-8">
                    <p className="mb-2">Start a conversation!</p>
                    <p className="text-sm">{flowFinished ? "Type a message or use voice input" : "Follow the flow to continue"}</p>
                  </div>
                )}
                
                {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex gap-3 mb-4 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  {(msg.sender === "bot" || msg.sender === "agent") && (
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className={msg.sender === "agent" 
                        ? "bg-gradient-to-r from-emerald-600 to-teal-500 text-white"
                        : "bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                      }>
                        {msg.sender === "agent" ? <Headphones className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className={`flex flex-col gap-1 ${msg.sender === "user" ? "items-end" : "items-start"} max-w-[75%]`}>
                    {msg.content && (
                      <div
                        className={`rounded-lg p-3 ${
                          msg.sender === "user"
                            ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                            : msg.sender === "agent"
                            ? "bg-gradient-to-r from-emerald-600 to-teal-500 text-white"
                            : msg.isSystemMessage
                            ? "bg-orange-100 text-orange-900 border border-orange-200"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        }`}
                      >
                        {typeof msg.content === "string"
                          ? msg.content
                          : JSON.stringify(msg.content)}
                      </div>
                    )}
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      {msg.sender === "agent" && <Headphones className="h-3 w-3" />}
                      {msg.timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </span>

                    {msg.showConfirmationButtons &&
                      isAwaitingInput &&
                      msg.sender === "bot" &&
                      !flowFinished && (
                        <div className="flex gap-2 mt-2">
                          <Button
                            size="sm"
                            onClick={() => handleConfirmationClick("yes")}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            Yes
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleConfirmationClick("no")}
                          >
                            No
                          </Button>
                        </div>
                      )}

                    {msg.showBranchOptions &&
                      msg.sender === "bot" &&
                      msg.branchOptions && (
                        <div className="flex flex-col gap-2 mt-2">
                          {msg.branchOptions.map((opt, idx) => (
                            <Button
                              key={idx}
                              size="sm"
                              variant="outline"
                              onClick={() => handleBranchOptionClick(opt, msg.id)}
                              disabled={!!msg.selectedBranch}
                              className={msg.selectedBranch === opt ? "bg-blue-500 text-white border-blue-600" : ""}
                            >
                              {opt}
                            </Button>
                          ))}
                        </div>
                      )}
                  </div>
                  {msg.sender === "user" && (
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-gray-300">
                        <User className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3 mb-4">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className={handoffRequested 
                      ? "bg-gradient-to-r from-emerald-600 to-teal-500 text-white"
                      : "bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                    }>
                      {handoffRequested ? <Headphones className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                </div>
              )}
              {isHandoffLoading && (
                <div className="flex gap-3 mb-4">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-gradient-to-r from-emerald-600 to-teal-500 text-white">
                      <Headphones className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-blue-100 dark:bg-blue-900 rounded-lg p-3 flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                    <span className="text-sm text-blue-700 font-medium">Connecting to an agent...</span>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="p-4 border-t bg-white dark:bg-gray-900 flex-shrink-0">
              {/* IMPROVED: Jump to Latest Button */}
              {showJumpButton && (
                <div className="mb-3 flex justify-center">
                  <Button
                    onClick={() => scrollToBottom(true)}
                    variant="outline"
                    className="flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
                  >
                    <ArrowDown className="h-4 w-4" />
                    Jump to Latest Message
                  </Button>
                </div>
              )}

              {handoffRequested && !isConnectedToAgent && (
                <Alert className={`mb-2 ${isHandoffLoading ? 'bg-blue-50 border-blue-200' : 'bg-yellow-50 border-yellow-200'}`}>
                  {isHandoffLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                      <AlertDescription className="text-blue-800">
                        Searching for an available agent...
                      </AlertDescription>
                    </>
                  ) : (
                    <>
                      <Clock className="h-4 w-4 text-yellow-600" />
                      <AlertDescription className="text-yellow-800">
                        Waiting for an agent to respond. You can continue sending messages.
                      </AlertDescription>
                    </>
                  )}
                  {!isHandoffLoading && (
                    <div className="mt-2">
                      <Button size="sm" variant="outline" onClick={clientResolveHandoff}>End chat</Button>
                    </div>
                  )}
                </Alert>
              )}

              {handoffRequested && isConnectedToAgent && (
                <Alert className="mb-2 bg-green-50 border-green-200">
                  <Headphones className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    Connected to agent: {assignedAgentEmail}
                  </AlertDescription>
                  <div className="mt-2">
                    <Button size="sm" variant="outline" onClick={clientResolveHandoff}>End chat</Button>
                  </div>
                </Alert>
              )}

              {isListening && (
                <Alert className="mb-2 bg-blue-50 border-blue-200">
                  <Mic className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">Listening... Speak now</AlertDescription>
                </Alert>
              )}

              {isProcessing && !isHandoffLoading && (
                <Alert className="mb-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <AlertDescription>Processing your speech...</AlertDescription>
                </Alert>
              )}

              {handoffStatus === 'resolved' && (
                <Alert className="mb-2 bg-gray-50 border-gray-200">
                  <AlertDescription className="text-gray-800">
                    This conversation has been resolved. You cannot send messages.
                  </AlertDescription>
                  <div className="mt-2">
                    <Button size="sm" onClick={clientReopenHandoff} disabled={isReopenLoading}>
                      {isReopenLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Reopening...
                        </>
                      ) : (
                        'Reopen chat'
                      )}
                    </Button>
                  </div>
                </Alert>
              )}

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    ref={inputRef}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={getPlaceholderText()}
                    disabled={isLoading || isHandoffLoading || (!canSendText && !handoffRequested) || handoffStatus === 'resolved' || isProcessing}
                    className="pr-12"
                  />
                  {bot.voiceEnabled && canSendText && !handoffRequested && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={handleVoiceInput}
                      className="absolute right-1 top-1/2 -translate-y-1/2"
                      disabled={isLoading || isProcessing}
                    >
                      {isProcessing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isListening ? (
                        <MicOff className="h-4 w-4 text-red-500" />
                      ) : (
                        <Mic className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
                <Button
                  onClick={() => handleSendMessage()}
                  disabled={!inputMessage.trim() || isLoading || (!canSendText && !handoffRequested) || handoffStatus === 'resolved' || isListening || isProcessing}
                  size="icon"
                  className={handoffRequested 
                    ? "bg-gradient-to-r from-emerald-600 to-teal-500 hover:opacity-90"
                    : "bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90"
                  }
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <div className="text-center py-2 border-t mt-2">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Powered by{" "}
                  <span className="font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    TasteAI Studio
                  </span>
                </p>
              </div>
            </div>
          </>
        )}
        {showRatingModal && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-900 rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold mb-2">Rate your experience</h3>
              <p className="text-sm text-gray-500 mb-4">How would you rate the support you received?</p>
              {isLoadingRating && (
                <p className="text-sm text-gray-500 mb-4">Loading your previous rating...</p>
              )}
              {previousRatingValue && !isLoadingRating && (
                <p className="text-sm text-blue-600 mb-4">
                  Your previous rating: <span className="font-semibold">{previousRatingValue} ★</span> 
                  {previousRatingFeedback && <span className="block text-xs mt-1">Feedback: {previousRatingFeedback}</span>}
                </p>
              )}
              <div className="flex justify-center gap-2 mb-4">
                {[1,2,3,4,5].map(i => (
                  <button
                    key={i}
                    onClick={() => setRatingValue(i)}
                    className={`text-3xl ${ratingValue >= i ? 'text-yellow-400' : 'text-gray-300'}`}
                    aria-label={`Rate ${i}`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <textarea
                value={ratingFeedback}
                onChange={(e) => setRatingFeedback(e.target.value)}
                className="w-full p-2 border rounded mb-4 bg-white dark:bg-gray-800 text-sm"
                rows={4}
                placeholder="Optional feedback (what went well, what could improve)"
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowRatingModal(false)}>Cancel</Button>
                <Button onClick={submitRating} disabled={submittingRating || ratingValue < 1}>
                  {submittingRating ? 'Updating...' : previousRatingValue ? 'Update Rating' : 'Submit Rating'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};