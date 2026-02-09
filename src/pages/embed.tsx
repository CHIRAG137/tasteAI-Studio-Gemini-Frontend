// Key improvements made to fix the "Jump to Latest Message" button issues:
//
// 1. **Added tracking refs to prevent flicker:**
//    - `isAutoScrollingRef`: Prevents button visibility changes during programmatic scrolling
//    - `userScrolledAwayRef`: Tracks if user manually scrolled up
//    - `scrollTimeoutRef`: Debounces scroll state changes
//
// 2. **Improved scroll detection:**
//    - `checkIfNearBottom()`: More accurate detection with 150px threshold
//    - `handleScrollAreaScroll()`: Ignores scroll events during auto-scroll
//
// 3. **Smart auto-scroll logic:**
//    - Only auto-scrolls if user hasn't manually scrolled away
//    - Waits for loading to complete before auto-scrolling
//    - Uses setTimeout to ensure DOM is updated
//
// 4. **Button stability:**
//    - Button only shows when user deliberately scrolls up AND stays away
//    - Button hidden immediately when clicked (force parameter)
//    - No flickering during message additions or loading states
//
// 5. **Loading state handling:**
//    - Doesn't trigger auto-scroll during API calls
//    - Auto-scrolls only after response is complete
//    - Respects user's scroll position during loading

// Changes summary:
// - Line 35-38: Added new refs for scroll tracking
// - Line 272-275: Cleanup scroll timeout on unmount
// - Line 607-652: New improved scroll functions
// - Line 655-663: Smart auto-scroll effect
// - Line 665-673: Post-loading scroll effect
// - Line 1093: Improved button with force parameter

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Send, Bot, User, Mic, MicOff, Video, Loader2, X, PhoneOff, Volume2, VolumeX, Headphones, Clock, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EmbedCustomization } from "@/components/EmbedCustomizer";
import { useToast } from "@/components/ui/use-toast";

interface Message {
  id: string;
  from: "user" | "bot" | "agent";
  text: string;
  timestamp: Date;
  showConfirmationButtons?: boolean;
  showBranchOptions?: boolean;
  branchOptions?: string[];
  selectedBranch?: string;
  audioUrl?: string;
  isSystemMessage?: boolean;
}

export default function EmbedChat() {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const botId = searchParams.get("botId");
  const isPreview = searchParams.get("preview") === "true";
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [customization, setCustomization] = useState<EmbedCustomization | null>(null);
  const [botData, setBotData] = useState<any>(null);
  const [currentPausedFor, setCurrentPausedFor] = useState<any>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [flowFinished, setFlowFinished] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showVideoAvatar, setShowVideoAvatar] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  // IMPROVED: Jump to latest state with better tracking
  const [showJumpButton, setShowJumpButton] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const isAutoScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const userScrolledAwayRef = useRef(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [handoffSessionId, setHandoffSessionId] = useState<string | null>(null);

  // BROWSER SPEECH RECOGNITION (Speech-to-Text)
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const recognitionRef = useRef<any>(null);

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

      if (botData?.is_video_bot && flowFinished) {
        handleVoiceQuestion(transcript);
      } else {
        setInput(prev => {
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
  }, [botData?.is_video_bot, flowFinished]);

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

  // Poll for agent messages when handoff is active
  useEffect(() => {
    if (!handoffSessionId) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/api/handoff/${handoffSessionId}/client-messages?flowSessionId=${sessionId}`
        );
        const data = await response.json();

        if (data.status === 'success' && data.result?.messages) {
          const agentMessages = data.result.messages
            .filter((m: any) => m.sender === 'agent')
            .map((m: any) => ({
              id: `agent-${m.timestamp || Date.now()}`,
              from: 'agent' as const,
              text: m.message,
              timestamp: new Date(m.timestamp),
            }));

          setMessages((prev) => {
            const existingIds = new Set(prev.map(m => m.id));
            const newMessages = agentMessages.filter((m: Message) => !existingIds.has(m.id));
            return [...prev, ...newMessages];
          });

          const status = data.result.status;
          const assignedAgent = data.result.assignedAgent;

          if (status === 'active' && handoffStatusRef.current !== 'active') {
            setHandoffStatus('active');
            handoffStatusRef.current = 'active';
            setIsConnectedToAgent(true);
            if (assignedAgent?.email) setAssignedAgentEmail(assignedAgent.email);
            const agentMsg = `A human agent (${assignedAgent?.email || 'agent'}) has accepted your request.`;
            await addSystemMessage(agentMsg, 'handoff_accepted');
          }

          if (status === 'resolved' && handoffStatusRef.current !== 'resolved') {
            setHandoffStatus('resolved');
            handoffStatusRef.current = 'resolved';
            setHandoffRequested(false);
            setShowRatingModal(true);
            await addSystemMessage('This conversation has been marked resolved by the agent.', 'handoff_resolved');
          }
        }
      } catch (error) {
        console.error('Error polling agent messages:', error);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [handoffSessionId, sessionId]);

  // Request human handoff
  const requestHumanHandoff = async (userQuestion: string) => {
    if (!botData?.human_handoff_enabled && !botData?.humanHandoffEnabled) {
      await addSystemMessage("Human support is not available for this bot.", "handoff_unavailable");
      return;
    }

    if (handoffRequested) {
      await addSystemMessage("Your request for human support has already been submitted.", "handoff_duplicate_request");
      return;
    }

    setHandoffRequested(true);
    setIsHandoffLoading(true);
    await addSystemMessage("Connecting you with a human agent...", "handoff_connecting");

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/handoff/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botId: botData._id, flowSessionId: sessionId, userQuestion, userIpAddress: '', userAgent: navigator.userAgent }),
      });
      const data = await response.json();
      if (data.status === 'success' && data.result) {
        setHandoffSessionId(data.result.handoffSession._id);
        setAssignedAgentEmail(data.result.agent?.email || null);
        setIsConnectedToAgent(!!data.result.agent?.isOnline);
        setIsHandoffLoading(false);
        const agentStatusMessage = data.result.message;
        await addSystemMessage(agentStatusMessage, "handoff_agent_assigned");
        
        if (!data.result.agent?.isOnline) {
          await addSystemMessage("The agent is currently offline but will respond as soon as possible. You can continue asking questions or close this chat.", "handoff_agent_offline");
        }
      } else {
        throw new Error(data.message || 'Failed to request human support');
      }
    } catch (err) {
      console.error('Handoff request error:', err);
      await addSystemMessage('Failed to connect with a human agent. Please try again later.', 'handoff_error');
      setIsHandoffLoading(false);
      setHandoffRequested(false);
    }
  };

  // BROWSER SPEECH SYNTHESIS (Text-to-Speech)
  const speechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null);
  const ttsQueueRef = useRef<string[]>([]);
  const isProcessingTTSRef = useRef(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [showTtsPrompt, setShowTtsPrompt] = useState(false);

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
    if (!botData?.is_video_bot || !text.trim()) return;

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTTSQueue();
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      // IMPROVED: Clean up scroll timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Human handoff state
  const [handoffRequested, setHandoffRequested] = useState(false);
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

  const detectHandoffIntent = (message: string): boolean => {
    const handoffKeywords = [
      'speak to human', 'talk to agent', 'live agent', 'customer service',
      'representative', 'real person', 'human support', 'talk to someone',
      'speak to someone', 'human help', 'agent',
    ];
    const lowerMessage = message.toLowerCase();
    return handoffKeywords.some(keyword => lowerMessage.includes(keyword));
  };

  const addSystemMessage = async (content: string, messageType?: string) => {
    const systemMessage: Message = {
      id: `system-${Date.now()}`,
      from: "bot",
      text: content,
      timestamp: new Date(),
      isSystemMessage: true,
    };
    setMessages((prev) => [...prev, systemMessage]);

    if (sessionId) {
      try {
        await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/api/flow/session/${sessionId}/system-message`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: content,
              messageType: messageType || "system",
              handoffSessionId: handoffSessionId || undefined,
            }),
          }
        );
      } catch (error) {
        console.error("Error saving system message to flow session:", error);
      }
    }
  };

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

  const handleVoiceQuestion = async (question: string) => {
    if (!question.trim() || isLoading) return;

    if (flowFinished && detectHandoffIntent(question) && (botData?.human_handoff_enabled || botData?.humanHandoffEnabled)) {
      const userMessage: Message = {
        id: Date.now().toString(),
        from: "user",
        text: question,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);
      await requestHumanHandoff(question);
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      from: "user",
      text: question,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

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
            botId: botData._id,
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

  const sendMessageToAgent = async (message: string) => {
    if (!handoffSessionId) return;
    if (handoffStatusRef.current === 'resolved') {
      const msg = 'This conversation has been resolved. You cannot send more messages.';
      await addSystemMessage(msg, 'handoff_resolved_blocked');
      return;
    }

    try {
      await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/handoff/${handoffSessionId}/client-message`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, flowSessionId: sessionId }),
        }
      );
    } catch (error) {
      console.error('Error sending message to agent:', error);
      toast({ title: 'Error', description: 'Failed to send message to agent', variant: 'destructive' });
    }
  };

  const fetchExistingRating = async () => {
    if (!handoffSessionId || !sessionId) return;
    setIsLoadingRating(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/handoff/${handoffSessionId}/rating?flowSessionId=${sessionId}`
      );
      const data = await res.json();
      if (res.ok && data.userRating) {
        setPreviousRatingValue(data.userRating);
        setPreviousRatingFeedback(data.userFeedback || '');
      }
    } catch (error) {
      console.error('Error fetching existing rating:', error);
    } finally {
      setIsLoadingRating(false);
    }
  };

  const showRatingModalWithData = async () => {
    setShowRatingModal(true);
    setRatingSubmitted(false);
    await fetchExistingRating();
  };

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
        await showRatingModalWithData();
        await addSystemMessage('You have ended this conversation.', 'handoff_client_resolved');
      } else {
        throw new Error(data.message || 'Failed to resolve session');
      }
    } catch (error) {
      console.error('Error resolving handoff (client):', error);
      toast({ title: 'Error', description: 'Failed to end chat', variant: 'destructive' });
    }
  };

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
        await addSystemMessage('You have reopened the conversation. Waiting for an agent to respond.', 'handoff_client_reopened');
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

  // IMPROVED: Check if user is near bottom with threshold
  const checkIfNearBottom = () => {
    if (!scrollAreaRef.current) return true;
    const element = scrollAreaRef.current;
    const threshold = 150; // pixels from bottom
    const isNear = element.scrollHeight - element.scrollTop - element.clientHeight < threshold;
    return isNear;
  };

  // IMPROVED: Smooth scroll to bottom with better state management
  const scrollToBottom = (force = false) => {
    if (isAutoScrollingRef.current && !force) return;
    
    isAutoScrollingRef.current = true;
    userScrolledAwayRef.current = false;
    setShowJumpButton(false);
    
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    
    // Clear any existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    // Reset auto-scrolling flag after animation completes
    scrollTimeoutRef.current = setTimeout(() => {
      isAutoScrollingRef.current = false;
    }, 500);
  };

  // IMPROVED: Handle scroll events with better logic
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

  // IMPROVED: Auto-scroll when new messages arrive (only if user hasn't scrolled away)
  useEffect(() => {
    // Don't auto-scroll if user has manually scrolled away or currently loading
    if (userScrolledAwayRef.current || isLoading || isHandoffLoading) {
      return;
    }
    
    scrollToBottom();
  }, [messages.length]);

  // IMPROVED: Scroll to bottom after loading completes
  useEffect(() => {
    // When loading finishes and user hasn't scrolled away, scroll to bottom
    if (!isLoading && !isHandoffLoading && !userScrolledAwayRef.current) {
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    }
  }, [isLoading, isHandoffLoading]);

  const addBotMessage = (content: string, audioUrl?: string) => {
    const botMessage: Message = {
      id: Date.now().toString() + Math.random(),
      from: "bot",
      text: content,
      timestamp: new Date(),
      audioUrl,
    };
    setMessages((prev) => [...prev, botMessage]);

    return botMessage;
  };

  useEffect(() => {
    if (isPreview) {
      const handleMessage = (event: MessageEvent) => {
        if (event.data.type === 'CUSTOMIZATION_UPDATE') {
          setCustomization(event.data.customization);
        }
      };

      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }
  }, [isPreview]);

  useEffect(() => {
    if (customization?.useChatCustomCSS && customization?.chatCustomCSS) {
      const existingStyle = document.getElementById('embed-custom-css');
      if (existingStyle) {
        existingStyle.remove();
      }

      const style = document.createElement('style');
      style.id = 'embed-custom-css';
      style.textContent = customization.chatCustomCSS;
      document.head.appendChild(style);

      return () => {
        const styleToRemove = document.getElementById('embed-custom-css');
        if (styleToRemove) {
          styleToRemove.remove();
        }
      };
    } else {
      const existingStyle = document.getElementById('embed-custom-css');
      if (existingStyle) {
        existingStyle.remove();
      }
    }
  }, [customization?.useChatCustomCSS, customization?.chatCustomCSS]);

  useEffect(() => {
    if (botId && !isPreview) {
      const fetchData = async () => {
        try {
          const customizationResponse = await fetch(
            `${import.meta.env.VITE_BACKEND_URL}/api/bots/customisation/${botId}`
          );
          const customizationData = await customizationResponse.json();
          if (customizationData.result) {
            setCustomization(customizationData.result);
          }

          const botResponse = await fetch(
            `${import.meta.env.VITE_BACKEND_URL}/api/bots/${botId}`
          );
          const botDataResult = await botResponse.json();
          setBotData(botDataResult.result);
        } catch (error) {
          console.error('Error loading data:', error);
          setMessages([{
            id: "init",
            from: "bot",
            text: "Hello! I'm here to help. What would you like to know?",
            timestamp: new Date()
          }]);
        }
      };

      fetchData();
    }
  }, [botId, isPreview]);

  useEffect(() => {
    if (isPreview) {
      setMessages([
        {
          id: "bot-preview-1",
          from: "bot",
          text: "Hello! I'm here to help. What would you like to know?",
          timestamp: new Date(Date.now() - 60000)
        },
        {
          id: "user-preview-1",
          from: "user",
          text: "This is a preview of a user message",
          timestamp: new Date(Date.now() - 30000)
        },
        {
          id: "bot-preview-2",
          from: "bot",
          text: "This is how my responses will look with your customized colors!",
          timestamp: new Date()
        }
      ]);
    }
  }, [isPreview]);

  useEffect(() => {
    if (!botData || isPreview) return;

    const initFlow = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/api/flow/start/${botData._id}`,
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
              from: "bot",
              text: "",
              timestamp: new Date(),
              showBranchOptions: true,
              branchOptions: msg.options || [],
            });
            return;
          }

          const messageContent = msg.content || msg.message || "";
          botMessages.push({
            id: Date.now().toString() + Math.random(),
            from: "bot",
            text: messageContent,
            timestamp: new Date(),
            showConfirmationButtons: msg.type === "confirmation" && msg.awaitingInput,
            showBranchOptions: false,
            branchOptions: msg.options || [],
          });

          if (botData.is_video_bot && messageContent) {
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
        setMessages([{
          id: "init",
          from: "bot",
          text: "Hello! I'm here to help. What would you like to know?",
          timestamp: new Date()
        }]);
      }
    };

    initFlow();
  }, [botData, isPreview]);

  const handleAskQuestion = async () => {
    const question = input.trim();
    if (!question || isLoading) return;

    if (flowFinished && detectHandoffIntent(question) && (botData?.human_handoff_enabled || botData?.humanHandoffEnabled)) {
      const userMessage: Message = {
        id: Date.now().toString(),
        from: "user",
        text: question,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      await requestHumanHandoff(question);
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      from: "user",
      text: question,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

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
            botId: botData._id,
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
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + Math.random(),
          from: "bot",
          text: "I'm having trouble answering that. Please try again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (overrideInput?: string, isBranchOption?: boolean) => {
    const messageToSend = overrideInput || input.trim();

    if (!messageToSend || isLoading) return;

    if (isPreview) {
      const userMessage: Message = {
        id: Date.now().toString(),
        from: "user",
        text: messageToSend,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setIsLoading(true);

      setTimeout(() => {
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          from: "bot",
          text: "This is a preview response. Your actual bot will respond based on your training data.",
          timestamp: new Date()
        };
        setMessages((prev) => [...prev, botMessage]);
        setIsLoading(false);
      }, 1000);
      return;
    }

    if (flowFinished) {
      handleAskQuestion();
      return;
    }

    if (!sessionId) return;

    setCurrentPausedFor(null);

    const userMessage: Message = {
      id: Date.now().toString(),
      from: "user",
      text: messageToSend,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
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
            from: "bot",
            text: "",
            timestamp: new Date(),
            showBranchOptions: true,
            branchOptions: msg.options || [],
          });
          return;
        }

        const messageContent = msg.content || msg.message || "";
        botMessages.push({
          id: Date.now().toString() + Math.random(),
          from: "bot",
          text: messageContent,
          timestamp: new Date(),
          showConfirmationButtons: msg.type === "confirmation" && msg.awaitingInput,
          showBranchOptions: false,
          branchOptions: msg.options || [],
        });

        if (botData.is_video_bot && messageContent) {
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
          from: "bot",
          text: "Sorry, I'm having trouble connecting right now. Please try again.",
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
  const canSendText = isPreview || flowFinished || (isAwaitingInput &&
    currentPausedFor?.type !== "branch" &&
    !currentPausedFor?.showConfirmationButtons);

  const videoBotAvatarUrl = botData?.video_bot_image_url || null;

  if (!botId) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <Card className="p-6 text-center">
          <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No bot ID provided</p>
        </Card>
      </div>
    );
  }

  const getContainerStyle = () => {
    if (customization?.useChatCustomCSS) return {};
    return {
      backgroundColor: customization?.backgroundColor || undefined,
      color: customization?.textColor || undefined,
      fontFamily: customization?.fontFamily || undefined
    };
  };

  const getHeaderStyle = () => {
    if (customization?.useChatCustomCSS) return {};
    return {
      backgroundColor: customization?.headerBackground || undefined,
      borderRadius: customization ? `${customization.borderRadius}px ${customization.borderRadius}px 0 0` : undefined
    };
  };

  const getBotIconStyle = () => {
    if (customization?.useChatCustomCSS) return {};
    return {
      backgroundColor: customization?.primaryColor ? `${customization.primaryColor}20` : undefined,
      borderRadius: customization?.borderRadius ? `${customization.borderRadius}px` : undefined
    };
  };

  const getUserMessageStyle = () => {
    if (customization?.useChatCustomCSS) return {};
    return {
      backgroundColor: customization?.userMessageColor || undefined,
      color: "#000000",
      borderRadius: customization?.borderRadius ? `${customization.borderRadius}px` : '8px'
    };
  };

  const getBotMessageStyle = () => {
    if (customization?.useChatCustomCSS) return {};
    return {
      backgroundColor: customization?.botMessageColor || undefined,
      color: customization?.textColor || undefined,
      borderRadius: customization?.borderRadius ? `${customization.borderRadius}px` : '8px'
    };
  };

  const getInputStyle = () => {
    if (customization?.useChatCustomCSS) return {};
    return {
      borderRadius: customization?.borderRadius ? `${customization.borderRadius}px` : undefined,
      backgroundColor: customization?.backgroundColor || undefined,
      color: customization?.textColor || undefined
    };
  };

  const getSendButtonStyle = () => {
    if (customization?.useChatCustomCSS) return {};
    return {
      backgroundColor: customization?.primaryColor || undefined,
      borderRadius: customization?.borderRadius ? `${customization.borderRadius}px` : undefined
    };
  };

  return (
    <div
      className={`flex flex-col h-screen max-h-screen border border-border/20 transition-all duration-200 ${customization?.useChatCustomCSS ? 'embed-chat-container' : ''
        }`}
      style={getContainerStyle()}
    >
      {/* Fixed Header Section */}
      <div className="flex-shrink-0">
        {/* Video Bot Avatar Section */}
        {botData?.is_video_bot && showVideoAvatar && (
          <div className="relative w-full flex items-center justify-center border-b">
            {videoBotAvatarUrl ? (
              <div className="relative w-full h-48 flex items-center justify-center overflow-hidden">
                <img
                  src={videoBotAvatarUrl}
                  alt="Video Bot Avatar"
                  className="w-full h-full object-cover"
                />

                {(isLoading || isSpeaking) && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-4 py-2 rounded-full flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">{isSpeaking ? "Speaking..." : "Thinking..."}</span>
                  </div>
                )}

                {flowFinished && (
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
                    <div className="flex gap-2">
                      <Button
                        onClick={ttsEnabled ? disableTTS : enableTTS}
                        size="sm"
                        className={`h-10 w-10 rounded-full shadow-lg transition-all ${ttsEnabled
                            ? "bg-blue-500 hover:bg-blue-600"
                            : "bg-gray-400 hover:bg-gray-500"
                          }`}
                        title={ttsEnabled ? "Disable voice responses" : "Enable voice responses"}
                      >
                        {ttsEnabled ? (
                          <Volume2 className="h-5 w-5 text-white" />
                        ) : (
                          <VolumeX className="h-5 w-5 text-white" />
                        )}
                      </Button>

                      <Button
                        onClick={handleMicToggle}
                        size="sm"
                        className={`h-10 w-10 rounded-full shadow-lg transition-all ${!isMuted
                          ? isListening
                            ? "bg-red-500 hover:bg-red-600 animate-pulse"
                            : "bg-green-500 hover:bg-green-600"
                          : "bg-gray-400 hover:bg-gray-500"
                          }`}
                        disabled={isLoading || isProcessing || isSpeaking || handoffStatus === 'resolved'}
                      >
                        {isProcessing ? (
                          <Loader2 className="h-5 w-5 animate-spin text-white" />
                        ) : isMuted ? (
                          <MicOff className="h-5 w-5 text-white" />
                        ) : (
                          <Mic className="h-5 w-5 text-white" />
                        )}
                      </Button>

                      <Button
                        onClick={handleEndCall}
                        size="sm"
                        className="h-10 w-10 rounded-full shadow-lg bg-red-600 hover:bg-red-700"
                      >
                        <PhoneOff className="h-5 w-5 text-white" />
                      </Button>
                    </div>
                    <p className="text-xs text-white bg-black/50 backdrop-blur px-2 py-0.5 rounded-full">
                      {ttsEnabled ? "Voice on" : "Voice off"}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-48 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex flex-col items-center justify-center p-4">
                <Video className="h-12 w-12 mb-2 text-purple-400" />
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center">Video Bot</p>

                {flowFinished && (
                  <div className="flex flex-col items-center gap-1 mt-3">
                    <div className="flex gap-2">
                      <Button
                        onClick={ttsEnabled ? disableTTS : enableTTS}
                        size="sm"
                        className={`h-10 w-10 rounded-full shadow-lg transition-all ${ttsEnabled
                            ? "bg-blue-500 hover:bg-blue-600"
                            : "bg-gray-400 hover:bg-gray-500"
                          }`}
                        title={ttsEnabled ? "Disable voice responses" : "Enable voice responses"}
                      >
                        {ttsEnabled ? (
                          <Volume2 className="h-5 w-5 text-white" />
                        ) : (
                          <VolumeX className="h-5 w-5 text-white" />
                        )}
                      </Button>

                      <Button
                        onClick={handleMicToggle}
                        size="sm"
                        className={`h-10 w-10 rounded-full shadow-lg ${!isMuted
                          ? isListening
                            ? "bg-red-500 hover:bg-red-600 animate-pulse"
                            : "bg-green-500 hover:bg-green-600"
                          : "bg-gray-400 hover:bg-gray-500"
                          }`}
                        disabled={isLoading || isProcessing || isSpeaking || handoffStatus === 'resolved'}
                      >
                        {isProcessing ? (
                          <Loader2 className="h-5 w-5 animate-spin text-white" />
                        ) : isMuted ? (
                          <MicOff className="h-5 w-5 text-white" />
                        ) : (
                          <Mic className="h-5 w-5 text-white" />
                        )}
                      </Button>

                      <Button
                        onClick={handleEndCall}
                        size="sm"
                        className="h-10 w-10 rounded-full shadow-lg bg-red-600 hover:bg-red-700"
                      >
                        <PhoneOff className="h-5 w-5 text-white" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {ttsEnabled ? "Voice on" : "Voice off"}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {botData?.is_video_bot && !showVideoAvatar && (
          <div className="p-2 border-b">
            <Button
              onClick={handleBringBackAvatar}
              variant="outline"
              size="sm"
              className="w-full"
            >
              <Video className="h-4 w-4 mr-2" />
              Show Video Avatar
            </Button>
          </div>
        )}

        {/* Chat Header */}
        <div
          className={`p-4 border-b transition-all duration-200 ${customization?.useChatCustomCSS ? "embed-chat-header" : ""
            }`}
          style={getHeaderStyle()}
        >
          <div className="flex items-start gap-4">
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${customization?.useChatCustomCSS ? "embed-bot-icon" : ""
                }`}
              style={getBotIconStyle()}
            >
              <Bot
                className="h-5 w-5"
                style={
                  customization?.useChatCustomCSS
                    ? {}
                    : { color: customization?.primaryColor || undefined }
                }
              />
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold leading-tight truncate">
                {customization?.headerTitle || botData?.name || "Chat Assistant"}
              </h3>

              {customization?.headerSubtitle && (
                <p className="text-xs opacity-70 mt-0.5 truncate">
                  {customization.headerSubtitle}
                </p>
              )}

              <div className="flex flex-wrap gap-1.5 mt-2">
                {botData?.is_voice_enabled && (
                  <Badge variant="secondary" className="text-[11px] px-2 py-0.5">
                    <Volume2 className="h-3 w-3 mr-1" />
                    Voice
                  </Badge>
                )}

                {botData?.is_video_bot && (
                  <Badge variant="secondary" className="text-[11px] px-2 py-0.5">
                    <Video className="h-3 w-3 mr-1" />
                    Video
                  </Badge>
                )}

                {flowFinished && (
                  <Badge
                    className="text-[11px] px-2 py-0.5"
                    style={{
                      backgroundColor: customization?.primaryColor
                        ? `${customization.primaryColor}20`
                        : undefined,
                      color: customization?.primaryColor || undefined,
                    }}
                  >
                    Q&A Mode
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Messages Area */}
      <div 
        ref={scrollAreaRef}
        onScroll={handleScrollAreaScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden"
      >
        <div className="p-4 space-y-4 min-h-full flex flex-col">
          {messages.length === 0 && !isPreview && (
            <div className="text-center text-gray-400 py-8">
              <p className="text-sm">Start a conversation!</p>
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.from === "user" ? "justify-end" : "justify-start"}`}>
              {(msg.from === "bot" || msg.from === "agent") && (
                <div
                  className={`flex items-center justify-center w-6 h-6 rounded-full mt-auto transition-all duration-200 ${
                    msg.from === "agent" 
                      ? "bg-gradient-to-r from-emerald-600 to-teal-500" 
                      : customization?.useChatCustomCSS ? 'embed-bot-icon' : ''
                  }`}
                  style={msg.from === "agent" ? {} : getBotIconStyle()}
                >
                  {msg.from === "agent" ? (
                    <Headphones className="h-3 w-3 text-white" />
                  ) : (
                    <Bot
                      className="h-3 w-3 transition-colors duration-200"
                      style={customization?.useChatCustomCSS ? {} : { color: customization?.primaryColor || undefined }}
                    />
                  )}
                </div>
              )}
              <div className="flex flex-col gap-2">
                {msg.text && (
                  <div className={`max-w-[80%] ${msg.from === "user" ? "ml-auto" : ""}`}>
                    <div
                      className={`p-3 transition-all duration-200 ${
                        msg.from === "agent"
                          ? "bg-gradient-to-r from-emerald-600 to-teal-500 text-white rounded-lg"
                          : msg.isSystemMessage
                          ? "bg-orange-100 text-orange-900 border border-orange-200 rounded-lg"
                          : customization?.useChatCustomCSS
                          ? (msg.from === "user" ? 'embed-user-message' : 'embed-bot-message')
                          : ''
                      }`}
                      style={msg.from === "agent" || msg.isSystemMessage ? {} : (msg.from === "user" ? getUserMessageStyle() : getBotMessageStyle())}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                    </div>
                    <p className="text-xs opacity-70 mt-1 px-1 flex items-center gap-1">
                      {msg.from === "agent" && <Headphones className="h-3 w-3" />}
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                )}

                {msg.showConfirmationButtons && isAwaitingInput && msg.from === "bot" && !flowFinished && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleConfirmationClick("yes")}
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

                {msg.showBranchOptions && msg.from === "bot" && msg.branchOptions && (
                  <div className="flex flex-wrap gap-2">
                    {msg.branchOptions.map((opt, idx) => (
                      <Button
                        key={idx}
                        size="sm"
                        variant="outline"
                        onClick={() => handleBranchOptionClick(opt, msg.id)}
                        disabled={!!msg.selectedBranch}
                        style={{
                          borderColor: msg.selectedBranch === opt ? customization?.primaryColor || undefined : undefined,
                          backgroundColor: msg.selectedBranch === opt ? `${customization?.primaryColor}20` || undefined : undefined,
                          color: customization?.primaryColor || undefined,
                        }}
                      >
                        {opt}
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              {msg.from === "user" && (
                <div
                  className={`flex items-center justify-center w-6 h-6 rounded-full mt-auto transition-all duration-200 ${customization?.useChatCustomCSS ? 'embed-bot-icon' : ''
                    }`}
                  style={getBotIconStyle()}
                >
                  <User
                    className="h-3 w-3 transition-colors duration-200"
                    style={customization?.useChatCustomCSS ? {} : { color: customization?.primaryColor || undefined }}
                  />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div
                className={`flex items-center justify-center w-6 h-6 rounded-full transition-all duration-200 ${customization?.useChatCustomCSS ? 'embed-bot-icon' : ''
                  }`}
                style={getBotIconStyle()}
              >
                <Bot
                  className="h-3 w-3 transition-colors duration-200"
                  style={customization?.useChatCustomCSS ? {} : { color: customization?.primaryColor || undefined }}
                />
              </div>
              <div
                className={`p-3 transition-all duration-200 ${customization?.useChatCustomCSS ? 'embed-bot-message' : ''
                  }`}
                style={getBotMessageStyle()}
              >
                <div className="flex space-x-1">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 opacity-50 rounded-full animate-bounce ${customization?.useChatCustomCSS ? 'embed-loading-dot' : ''
                        }`}
                      style={{
                        animationDelay: `${i * 0.1}s`,
                        backgroundColor: customization?.useChatCustomCSS ? undefined : (customization?.textColor || undefined)
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {isHandoffLoading && (
            <div className="flex gap-3 justify-start">
              <div
                className={`flex items-center justify-center w-6 h-6 rounded-full transition-all duration-200 bg-gradient-to-r from-emerald-600 to-teal-500`}
              >
                <Headphones className="h-3 w-3 text-white" />
              </div>
              <div
                className={`p-3 transition-all duration-200 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center gap-2`}
              >
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <span className="text-sm text-blue-700 font-medium">Connecting to an agent...</span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Fixed Input Area */}
      <div
        className={`flex-shrink-0 p-4 border-t transition-all duration-200 ${customization?.useChatCustomCSS ? 'embed-chat-header' : ''
          }`}
        style={getHeaderStyle()}
      >
        {/* IMPROVED: Jump to Latest Button - stable, no flicker */}
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

        {showTtsPrompt && botData?.is_video_bot && (
          <Alert className="mb-2 bg-amber-50 border-amber-200">
            <Volume2 className="h-4 w-4 text-amber-600" />
            <AlertDescription className="flex items-center justify-between">
              <span className="text-amber-800 text-sm">Enable voice responses?</span>
              <div className="flex gap-2">
                <Button size="sm" onClick={enableTTS} className="bg-amber-600 hover:bg-amber-700 h-7 text-xs">
                  Enable
                </Button>
                <Button size="sm" variant="outline" onClick={disableTTS} className="h-7 text-xs">
                  No thanks
                </Button>
              </div>
            </AlertDescription>
          </Alert>
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
                <AlertDescription className="text-yellow-800 text-sm">Waiting for an agent to respond. You can continue sending messages.</AlertDescription>
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
            <AlertDescription className="text-green-800 text-sm">Connected to agent: {assignedAgentEmail}</AlertDescription>
            <div className="mt-2">
              <Button size="sm" variant="outline" onClick={clientResolveHandoff}>End chat</Button>
            </div>
          </Alert>
        )}

        {handoffStatus === 'resolved' && (
          <Alert className="mb-2 bg-gray-50 border-gray-200">
            <AlertDescription className="text-gray-800 text-sm">This conversation has been resolved. You cannot send messages.</AlertDescription>
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

        {flowFinished && isListening && !botData?.is_video_bot && (
          <Alert className="mb-2 bg-blue-50 border-blue-200">
            <Mic className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800 text-sm">Listening... Speak now</AlertDescription>
          </Alert>
        )}

        {isProcessing && !isHandoffLoading && (
          <Alert className="mb-3 border-blue-500 bg-blue-50 dark:bg-blue-900/20">
            <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
            <AlertDescription className="text-blue-800 dark:text-blue-200">
              Processing your speech...
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={
                isListening
                  ? "Listening... Speak now"
                  : isProcessing
                    ? "Processing speech..."
                    : flowFinished
                      ? "Ask me anything..."
                      : (customization?.placeholder || "Type your message...")
              }
              disabled={isLoading || isHandoffLoading || !canSendText || handoffStatus === 'resolved' || isProcessing}
              className={`flex-1 transition-all duration-200 ${botData?.is_voice_enabled && canSendText && flowFinished && !botData?.is_video_bot ? 'pr-10' : ''
                } ${customization?.useChatCustomCSS ? 'embed-input' : ''}`}
              style={getInputStyle()}
            />
            {botData?.is_voice_enabled && canSendText && flowFinished && !botData?.is_video_bot && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleVoiceInput}
                disabled={isProcessing}
                className={`absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 ${isListening
                    ? "text-red-500 animate-pulse"
                    : isProcessing
                      ? "text-gray-400"
                      : "text-muted-foreground hover:text-primary"
                  }`}
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isListening ? (
                  <MicOff className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
          <Button
            onClick={() => handleSendMessage()}
            disabled={!input.trim() || isLoading || isHandoffLoading || !canSendText || handoffStatus === 'resolved' || isListening || isProcessing}
            size="icon"
            className={`shrink-0 transition-all duration-200 ${customization?.useChatCustomCSS ? 'embed-send-button' : ''
              }`}
            style={getSendButtonStyle()}
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

      {/* Rating Modal */}
      {showRatingModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 w-full max-w-md mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold mb-2">Rate your experience</h3>
            {previousRatingValue > 0 && (
              <p className="text-sm text-gray-500 mb-3 p-2 bg-gray-100 dark:bg-gray-800 rounded">
                Your previous rating: {previousRatingValue} ★
                {previousRatingFeedback && <span className="block text-xs mt-1">"{previousRatingFeedback}"</span>}
              </p>
            )}
            <p className="text-sm text-gray-500 mb-4">How would you rate the support you received?</p>
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
                {submittingRating ? 'Submitting...' : previousRatingValue > 0 ? 'Update Rating' : 'Submit Rating'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}