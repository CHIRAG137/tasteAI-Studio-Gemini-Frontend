import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { Bot, Sparkles, User, Globe, Mic, Languages, Brain, MessageSquare, Video, Users, Bell, BellRing } from "lucide-react";
import { BasicInfoSection } from "./BotBuilder/BasicInfoSection";
import { WebsiteSection } from "./BotBuilder/WebsiteSection";
import { VoiceSection } from "./BotBuilder/VoiceSection";
import { LanguageSection } from "./BotBuilder/LanguageSection";
import { PersonaSection } from "./BotBuilder/PersonaSection";
import { SlackSection } from "./BotBuilder/SlackSection";
import { ConversationFlowSection } from "./BotBuilder/ConversationFlowSection";
import { VideoBotSection } from "./BotBuilder/VideoBotSection";
import { HumanHandoffSection } from "./BotBuilder/HumanHandoffSection";
import { Node, Edge } from '@xyflow/react';
import { useToast } from "@/hooks/use-toast";
import { BotCard } from "@/components/BotCard";
import { ChatBot } from "@/components/ChatBot";
import { useNavigate } from "react-router-dom";
import { getAuthHeaders, isAuthenticated } from "@/utils/auth";
import { Navbar } from "@/components/Navbar";
import { BotCardSkeleton } from "./BotCardSkeleton";
import { BotFilters, BotFilterState } from "./BotFilters";
interface BotConfig {
  name: string;
  websiteUrl: string;
  description: string;
  file: File | null;
  voiceEnabled: boolean;
  languages: string[];
  primaryPurpose: string;
  specializationArea: string;
  conversationalTone: string;
  responseStyle: string;
  targetAudience: string;
  keyTopics: string;
  keywords: string;
  customInstructions: string;
  isSlackEnabled: boolean;
  slackChannelId: string;
  conversationFlow?: { nodes: Node[]; edges: Edge[] };
  scrapedMarkdown?: string[];
  scrapedUrls?: string[];
  isVideoBot: boolean;
  videoBotImageUrl?: string;
  videoBotImagePublicId?: string;
  voiceId?: string;
  humanHandoffEnabled?: boolean;
  humanHandoffEmails?: string;
}

export const BotBuilder = () => {
  const navigate = useNavigate();

  const { toast } = useToast();
  const [savedBots, setSavedBots] = useState<any[]>([]);
  const [selectedBotForTest, setSelectedBotForTest] = useState<any | null>(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(6);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isCreatingBot, setIsCreatingBot] = useState(false);
  const [creatingBot, setCreatingBot] = useState<any | null>(null);
  const [progress, setProgress] = useState(0);
  const [isFetchingBots, setIsFetchingBots] = useState(true);
  const [notifyOnComplete, setNotifyOnComplete] = useState(false);
  const [filters, setFilters] = useState<BotFilterState>({
    searchQuery: "",
    primaryPurpose: "all",
    conversationalTone: "all",
    voiceEnabled: "all",
    isVideoBot: "all",
    humanHandoffEnabled: "all",
  });

  // Filter bots based on current filters
  const filteredBots = useMemo(() => {
    return savedBots.filter((bot) => {
      // Search by name
      if (filters.searchQuery && !bot.name.toLowerCase().includes(filters.searchQuery.toLowerCase())) {
        return false;
      }
      // Primary purpose filter
      if (filters.primaryPurpose !== "all" && bot.primaryPurpose !== filters.primaryPurpose) {
        return false;
      }
      // Conversational tone filter
      if (filters.conversationalTone !== "all" && bot.conversationalTone !== filters.conversationalTone) {
        return false;
      }
      // Voice enabled filter
      if (filters.voiceEnabled !== "all") {
        const voiceValue = filters.voiceEnabled === "true";
        if (bot.voiceEnabled !== voiceValue && !bot.isVideoBot) return false;
        // Video bots always have voice
        if (bot.isVideoBot && !voiceValue) return false;
      }
      // Video bot filter
      if (filters.isVideoBot !== "all") {
        const isVideoValue = filters.isVideoBot === "true";
        if (bot.isVideoBot !== isVideoValue) return false;
      }
      // Human handoff filter
      if (filters.humanHandoffEnabled !== "all") {
        const handoffValue = filters.humanHandoffEnabled === "true";
        if (bot.humanHandoffEnabled !== handoffValue) return false;
      }
      return true;
    });
  }, [savedBots, filters]);

  const handleLoadMore = () => {
    if (hasNextPage && !isLoadingMore) {
      fetchBots(page + 1, true);
    }
  };

  const [botConfig, setBotConfig] = useState<BotConfig>({
    name: "",
    websiteUrl: "",
    description: "",
    file: null,
    voiceEnabled: false,
    languages: ["English"],
    primaryPurpose: "",
    specializationArea: "",
    conversationalTone: "",
    responseStyle: "",
    targetAudience: "",
    keyTopics: "",
    keywords: "",
    customInstructions: "",
    isSlackEnabled: false,
    slackChannelId: "",
    conversationFlow: {
      nodes: [
        {
          id: '1',
          type: 'message',
          position: { x: 250, y: 50 },
          data: {
            label: 'Welcome Message',
            type: 'message',
            message: 'Hello! I\'m here to help you. Let\'s start by getting some information.'
          },
        },
      ],
      edges: []
    },
    isVideoBot: false,
    videoBotImageUrl: "",
    videoBotImagePublicId: "",
    voiceId: "",
    humanHandoffEnabled: false,
    humanHandoffEmails: "",
  });

  const fetchBots = async (pageNumber = 1, append = false) => {
    try {
      pageNumber === 1 ? setIsFetchingBots(true) : setIsLoadingMore(true);

      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/bots?page=${pageNumber}&limit=${limit}`,
        { headers: getAuthHeaders() }
      );

      if (!res.ok) throw new Error("Failed to fetch bots");

      const data = await res.json();
      const { bots, pagination } = data.result;

      const mappedBots = bots.map((bot: any) => ({
        id: bot._id,
        name: bot.name,
        description: bot.description,
        websiteUrl: bot.website_url,
        voiceEnabled: bot.is_voice_enabled,
        languages: Array.isArray(bot.supported_languages)
          ? bot.supported_languages
          : ["English"],
        primaryPurpose: bot.primary_purpose,
        conversationalTone: bot.conversation_tone,
        isVideoBot: bot.is_video_bot,
        videoBotImageUrl: bot.video_bot_image_url,
        videoBotImagePublicId: bot.video_bot_image_public_id,
        voiceId: bot.voice_id,
        humanHandoffEnabled: bot.human_handoff_enabled,
      }));

      setSavedBots(prev =>
        append ? [...prev, ...mappedBots] : mappedBots
      );

      setHasNextPage(pagination.hasNextPage);
      setPage(pagination.page);
    } catch (err) {
      console.error("Error fetching bots:", err);
    } finally {
      setIsFetchingBots(false);
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchBots(1);
  }, []);

  const updateConfig = (field: keyof BotConfig, value: any) => {
    setBotConfig(prev => ({ ...prev, [field]: value }));
  };

  const validateBotConfig = (): string | null => {
    // Basic validations
    if (!botConfig.name.trim()) {
      return "Bot name is required.";
    }

    if (!botConfig.description.trim()) {
      return "Bot description is required.";
    }

    // Video bot validations
    if (botConfig.isVideoBot) {
      if (!botConfig.videoBotImageUrl || !botConfig.videoBotImagePublicId) {
        return "Video bot image is required. Please upload and save a cropped image.";
      }

      if (!botConfig.voiceId) {
        return "Voice ID is required for Video Bot. Please select a voice.";
      }
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthenticated()) {
      navigate("/login");
      return;
    }

    const validationError = validateBotConfig();
    if (validationError) {
      toast({
        title: "Missing Required Information",
        description: validationError,
        variant: "destructive",
      });
      return;
    }

    if (isCreatingBot) return; // prevent duplicate clicks

    // Helper function to play notification sound
    const playNotificationSound = () => {
      if (notifyOnComplete) {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Pleasant notification tone
        oscillator.frequency.setValueAtTime(587.33, audioContext.currentTime); // D5
        oscillator.frequency.setValueAtTime(880, audioContext.currentTime + 0.1); // A5
        oscillator.frequency.setValueAtTime(1174.66, audioContext.currentTime + 0.2); // D6
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
      }
    };

    try {
      setIsCreatingBot(true);
      setProgress(5);

      // Create temporary “bot is being created” card
      const tempBot = {
        id: "temp",
        name: botConfig.name || "New Bot",
        description: "Bot is being created. Please wait...",
        websiteUrl: botConfig.websiteUrl,
        voiceEnabled: botConfig.voiceEnabled,
        languages: botConfig.languages,
        primaryPurpose: botConfig.primaryPurpose,
        conversationalTone: botConfig.conversationalTone,
        isVideoBot: botConfig.isVideoBot,
        voiceId: botConfig.voiceId,
        isLoading: true,
        humanHandoffEnabled: botConfig.humanHandoffEnabled,
      };

      setCreatingBot(tempBot);
      setSavedBots(prev => [tempBot, ...prev]);

      // Simulate progress bar while backend works
      const progressInterval = setInterval(() => {
        setProgress(prev => (prev < 90 ? prev + 5 : prev));
      }, 1000);

      const formData = new FormData();
      Object.entries({
        name: botConfig.name,
        website_url: botConfig.websiteUrl,
        description: botConfig.description,
        is_voice_enabled: botConfig.voiceEnabled.toString(),
        supported_languages: JSON.stringify(botConfig.languages),
        primary_purpose: botConfig.primaryPurpose,
        specialisation_area: botConfig.specializationArea,
        conversation_tone: botConfig.conversationalTone,
        response_style: botConfig.responseStyle,
        target_audience: botConfig.targetAudience,
        key_topics: botConfig.keyTopics,
        keywords: botConfig.keywords,
        custom_instructions: botConfig.customInstructions,
        is_slack_enabled: botConfig.isSlackEnabled.toString(),
        slack_channel_id: botConfig.slackChannelId,
        conversationFlow: JSON.stringify(botConfig.conversationFlow || { nodes: [], edges: [] }),
        is_video_bot: botConfig.isVideoBot.toString(),
        video_bot_image_url: botConfig.videoBotImageUrl || "",
        video_bot_image_public_id: botConfig.videoBotImagePublicId || "",
        voice_id: botConfig.voiceId || "",
        human_handoff_enabled: (botConfig.humanHandoffEnabled || false).toString(),
        human_handoff_emails: botConfig.humanHandoffEmails || "",
      }).forEach(([key, value]) => formData.append(key, value as string));

      if (botConfig.scrapedMarkdown?.length)
        formData.append("scraped_content", JSON.stringify(botConfig.scrapedMarkdown));
      if (botConfig.scrapedUrls?.length)
        formData.append("scraped_urls", JSON.stringify(botConfig.scrapedUrls));
      if (botConfig.file) formData.append("file", botConfig.file);

      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/bots/create`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData,
      });

      clearInterval(progressInterval);
      setProgress(100);

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to create bot");

      toast({
        title: "Bot Created Successfully!",
        description: result.message || `${botConfig.name} has been created successfully.`,
      });

      // Play notification sound if enabled
      playNotificationSound();

      // Replace temp bot with real one
      await fetchBots();

      setCreatingBot(null);
    } catch (error) {
      console.error("Error creating bot:", error);
      toast({
        title: "Error Creating Bot",
        description: error instanceof Error ? error.message : "Failed to create bot. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreatingBot(false);
      setProgress(0);
      setNotifyOnComplete(false);
    }
  };

  const handleTest = (id: string) => {
    const bot = savedBots.find(b => b.id === id);
    if (bot) setSelectedBotForTest(bot);
  };

  const handleShare = (botId: string) => {
    const shareUrl = `${window.location.origin}/bot/${botId}`;
    navigator.clipboard.writeText(shareUrl);
    alert(`Shareable link copied:\n${shareUrl}`);
  };


  const handleIntegrate = (id: string) => {
    navigate(`/docs/${id}`);
  };

  const handleEdit = (id: string) => {
    navigate(`/edit/${id}`);
  };

  const handleSessions = (id: string) => {
    navigate(`/sessions/${id}`);
  };

  const handleAnalytics = (id: string) => {
    navigate(`/analytics/${id}`);
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/bots/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to delete bot");
      }

      // Remove bot from UI list
      setSavedBots(prev => prev.filter(bot => bot.id !== id));

      toast({
        title: "Bot Deleted",
        description: data.message || "Bot and its data were deleted successfully.",
      });
    } catch (error) {
      console.error("Delete bot error:", error);
      toast({
        title: "Error Deleting Bot",
        description: error instanceof Error ? error.message : "Something went wrong.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-background py-12 px-4">
        <div id="bot-builder" className="max-w-4xl mx-auto space-y-8 scroll-mt-20">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-primary rounded-2xl shadow-medium mb-4">
              <Bot className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-hero bg-clip-text text-transparent">
              tasteAI Studio
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Create intelligent, customized AI bots tailored to your specific needs.
              Configure everything from personality to capabilities with our intuitive builder.
            </p>
          </div>

          <Card className="shadow-strong border-0">
            <CardHeader className="space-y-1 pb-8">
              <CardTitle className="text-2xl flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-primary" />
                Configure Your Bot
              </CardTitle>
              <CardDescription className="text-base">
                Fill in the details below to create your custom AI assistant
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <CollapsibleSection title="Basic Information" icon={<User className="w-5 h-5 text-primary" />} defaultOpen={true}>
                  <BasicInfoSection botConfig={botConfig} updateConfig={updateConfig} />
                </CollapsibleSection>
                <CollapsibleSection title="Website & Content" icon={<Globe className="w-5 h-5 text-primary" />}>
                  <WebsiteSection botConfig={botConfig} updateConfig={updateConfig} />
                </CollapsibleSection>
                <CollapsibleSection title="Video Bot" icon={<Video className="w-5 h-5 text-primary" />}>
                  <VideoBotSection botConfig={botConfig} updateConfig={updateConfig} />
                </CollapsibleSection>
                {!botConfig.isVideoBot && (
                  <CollapsibleSection title="Voice Configuration" icon={<Mic className="w-5 h-5 text-primary" />}>
                    <VoiceSection botConfig={botConfig} updateConfig={updateConfig} />
                  </CollapsibleSection>
                )}
                <CollapsibleSection title="Language Support" icon={<Languages className="w-5 h-5 text-primary" />}>
                  <LanguageSection botConfig={botConfig} updateConfig={updateConfig} />
                </CollapsibleSection>
                <CollapsibleSection title="Persona & Behavior" icon={<Brain className="w-5 h-5 text-primary" />}>
                  <PersonaSection botConfig={botConfig} updateConfig={updateConfig} />
                </CollapsibleSection>
                <CollapsibleSection title="Add Bot to Slack Channel" icon={<MessageSquare className="w-5 h-5 text-primary" />}>
                  <SlackSection botConfig={botConfig} updateConfig={updateConfig} />
                </CollapsibleSection>

                <CollapsibleSection title="Talk to Human" icon={<Users className="w-5 h-5 text-primary" />}>
                  <HumanHandoffSection botConfig={botConfig} updateConfig={updateConfig} />
                </CollapsibleSection>

                <ConversationFlowSection
                  onFlowSave={(nodes, edges) => {
                    updateConfig('conversationFlow', { nodes, edges });
                    toast({
                      title: "Flow Saved",
                      description: "Conversation flow has been saved to your bot configuration.",
                    });
                  }}
                  onFlowChange={(nodes, edges) => {
                    // Auto-update the bot config whenever the flow changes
                    updateConfig('conversationFlow', { nodes, edges });
                  }}
                  initialNodes={botConfig.conversationFlow?.nodes}
                  initialEdges={botConfig.conversationFlow?.edges}
                />

                <div className="flex justify-end pt-6 gap-3 items-center">
                  {isCreatingBot && (
                    <Button
                      type="button"
                      variant={notifyOnComplete ? "default" : "outline"}
                      size="lg"
                      onClick={() => setNotifyOnComplete(!notifyOnComplete)}
                      className={notifyOnComplete 
                        ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white animate-pulse" 
                        : ""}
                    >
                      {notifyOnComplete ? (
                        <BellRing className="w-5 h-5 mr-2" />
                      ) : (
                        <Bell className="w-5 h-5 mr-2" />
                      )}
                      {notifyOnComplete ? "Will Notify" : "Notify Me"}
                    </Button>
                  )}
                  <Button
                    type="submit"
                    size="lg"
                    className="bg-gradient-primary hover:opacity-90 shadow-medium px-8 py-3 text-lg font-semibold"
                    disabled={isCreatingBot}
                  >
                    <Bot className="w-5 h-5 mr-2" />
                    {isCreatingBot ? "Creating..." : "Create Bot"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div id="your-bots" className="w-full px-4 py-12 scroll-mt-20">
          <div className="max-w-7xl mx-auto space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold text-foreground">Your Bots</h2>
              <p className="text-lg text-muted-foreground">
                Manage and interact with your created AI assistants
              </p>
            </div>

            {/* Search and Filters */}
            <BotFilters
              onFiltersChange={setFilters}
              totalBots={savedBots.length}
              filteredCount={filteredBots.length}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {isFetchingBots
                ? Array.from({ length: 6 }).map((_, i) => (
                  <BotCardSkeleton key={i} />
                ))
                : filteredBots.length === 0 ? (
                  <div className="col-span-full text-center py-12">
                    <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">No bots found</h3>
                    <p className="text-muted-foreground">
                      {savedBots.length === 0 
                        ? "Create your first bot to get started" 
                        : "Try adjusting your search or filters"}
                    </p>
                  </div>
                )
                : filteredBots.map(bot => (
                  <BotCard
                    key={bot.id}
                    bot={bot.id === "temp" ? { ...bot, progress } : bot}
                    onTest={handleTest}
                    onShare={handleShare}
                    onIntegrate={handleIntegrate}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onSessions={handleSessions}
                    onAnalytics={handleAnalytics}
                  />
                ))
              }
            </div>

            {!isFetchingBots && (page > 1 || hasNextPage) && (
              <div className="flex justify-center gap-4 pt-6">
                {page > 1 && (
                  <Button
                    onClick={() => {
                      setPage(1);
                      setSavedBots(prev => prev.slice(0, limit));
                      setHasNextPage(true);
                    }}
                    variant="outline"
                  >
                    Show Less
                  </Button>
                )}
                {hasNextPage && (
                  <Button
                    onClick={handleLoadMore}
                    variant="outline"
                    disabled={isLoadingMore}
                  >
                    {isLoadingMore ? "Loading..." : "Load More"}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedBotForTest && (
        <ChatBot bot={selectedBotForTest} onClose={() => setSelectedBotForTest(null)} />
      )}
    </>
  );
};
