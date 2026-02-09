import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import {
  Bot,
  Sparkles,
  User,
  Mic,
  Languages,
  Brain,
  Globe,
  MessageSquare,
  ArrowLeft,
  Video,
  Users,
} from "lucide-react";

import { BasicInfoSection } from "@/components/BotBuilder/BasicInfoSection";
import { WebsiteSection } from "@/components/BotBuilder/WebsiteSection";
import { VoiceSection } from "@/components/BotBuilder/VoiceSection";
import { LanguageSection } from "@/components/BotBuilder/LanguageSection";
import { PersonaSection } from "@/components/BotBuilder/PersonaSection";
import { SlackSection } from "@/components/BotBuilder/SlackSection";
import { ConversationFlowSection } from "@/components/BotBuilder/ConversationFlowSection";
import { VideoBotSection } from "@/components/BotBuilder/VideoBotSection";
import { HumanHandoffSection } from "@/components/BotBuilder/HumanHandoffSection";

import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/utils/auth";

interface BotConfig {
  name: string;
  websiteUrl: string;
  description: string;
  file: File | null;

  voiceEnabled: boolean;
  voiceId?: string;

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

  conversationFlow: {
    nodes: any[];
    edges: any[];
  };

  scrapedMarkdown?: string[];
  scrapedUrls?: string[];
  existingScrapedUrls?: string[];

  // Video bot
  isVideoBot: boolean;
  videoBotImageUrl?: string;
  videoBotImagePublicId?: string;

  // Human handoff
  humanHandoffEnabled?: boolean;
  humanHandoffEmails?: string;
}

const EditBot = () => {
  const { botId } = useParams<{ botId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);

  const [botConfig, setBotConfig] = useState<BotConfig>({
    name: "",
    websiteUrl: "",
    description: "",
    file: null,

    voiceEnabled: false,
    voiceId: "",

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

    conversationFlow: { nodes: [], edges: [] },

    scrapedMarkdown: [],
    scrapedUrls: [],
    existingScrapedUrls: [],

    isVideoBot: false,
    videoBotImageUrl: "",
    videoBotImagePublicId: "",

    humanHandoffEnabled: false,
    humanHandoffEmails: "",
  });

  // ---------------- FETCH BOT ----------------
  useEffect(() => {
    const fetchBot = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/api/bots/${botId}`,
          { headers: getAuthHeaders() }
        );

        if (!res.ok) throw new Error("Failed to fetch bot");

        const data = await res.json();
        const bot = data.result;

        setBotConfig({
          name: bot.name || "",
          websiteUrl: bot.website_url || "",
          description: bot.description || "",
          file: null,

          voiceEnabled: bot.is_voice_enabled || false,
          voiceId: bot.voice_id || "",

          languages: bot.supported_languages || ["English"],
          primaryPurpose: bot.primary_purpose || "",
          specializationArea: bot.specialisation_area || "",
          conversationalTone: bot.conversation_tone || "",
          responseStyle: bot.response_style || "",
          targetAudience: bot.target_audience || "",
          keyTopics: bot.key_topics || "",
          keywords: bot.keywords || "",
          customInstructions: bot.custom_instructions || "",

          isSlackEnabled: bot.is_slack_enabled || false,
          slackChannelId: bot.slack_channel_id || "",

          conversationFlow: bot.conversationFlow || { nodes: [], edges: [] },

          scrapedMarkdown: [],
          scrapedUrls: [],
          existingScrapedUrls: bot.scraped_urls || [],

          isVideoBot: bot.is_video_bot || false,
          videoBotImageUrl: bot.video_bot_image_url || "",
          videoBotImagePublicId: bot.video_bot_image_public_id || "",

          humanHandoffEnabled: bot.human_handoff_enabled || false,
          humanHandoffEmails: bot.human_handoff_emails || "",
        });
      } catch (err) {
        toast({
          title: "Error",
          description: "Failed to load bot details",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchBot();
  }, [botId, toast]);

  const updateConfig = (field: keyof BotConfig, value: any) => {
    setBotConfig(prev => ({ ...prev, [field]: value }));
  };

  // ---------------- VALIDATION ----------------
  const validateBotConfig = (): string | null => {
    if (!botConfig.name.trim()) return "Bot name is required.";
    if (!botConfig.description.trim()) return "Bot description is required.";

    if (botConfig.isVideoBot) {
      if (!botConfig.videoBotImageUrl || !botConfig.videoBotImagePublicId) {
        return "Video bot image is required.";
      }
      if (!botConfig.voiceId) {
        return "Voice ID is required for Video Bot.";
      }
    }

    return null;
  };

  // ---------------- SUBMIT ----------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const error = validateBotConfig();
    if (error) {
      toast({ title: "Validation Error", description: error, variant: "destructive" });
      return;
    }

    try {
      const formData = new FormData();

      formData.append("name", botConfig.name);
      formData.append("website_url", botConfig.websiteUrl);
      formData.append("description", botConfig.description);

      formData.append("is_voice_enabled", botConfig.voiceEnabled.toString());
      formData.append("supported_languages", JSON.stringify(botConfig.languages));
      formData.append("primary_purpose", botConfig.primaryPurpose);
      formData.append("specialisation_area", botConfig.specializationArea);
      formData.append("conversation_tone", botConfig.conversationalTone);
      formData.append("response_style", botConfig.responseStyle);
      formData.append("target_audience", botConfig.targetAudience);
      formData.append("key_topics", botConfig.keyTopics);
      formData.append("keywords", botConfig.keywords);
      formData.append("custom_instructions", botConfig.customInstructions);

      formData.append("is_slack_enabled", botConfig.isSlackEnabled.toString());
      formData.append("slack_channel_id", botConfig.slackChannelId);

      formData.append("conversationFlow", JSON.stringify(botConfig.conversationFlow));

      // Video bot
      formData.append("is_video_bot", botConfig.isVideoBot.toString());
      formData.append("video_bot_image_url", botConfig.videoBotImageUrl || "");
      formData.append("video_bot_image_public_id", botConfig.videoBotImagePublicId || "");
      formData.append("voice_id", botConfig.voiceId || "");

      // Human handoff
      formData.append("human_handoff_enabled", (botConfig.humanHandoffEnabled || false).toString());
      formData.append("human_handoff_emails", botConfig.humanHandoffEmails || "");

      if (botConfig.scrapedMarkdown?.length) {
        formData.append("scraped_content", JSON.stringify(botConfig.scrapedMarkdown));
      }

      if (botConfig.scrapedUrls?.length) {
        formData.append("scraped_urls", JSON.stringify(botConfig.scrapedUrls));
      }

      if (botConfig.file) {
        formData.append("file", botConfig.file);
      }

      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/bots/${botId}`,
        {
          method: "PUT",
          headers: getAuthHeaders(),
          body: formData,
        }
      );

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Update failed");

      toast({
        title: "Bot Updated",
        description: `${botConfig.name} updated successfully`,
      });

      navigate("/");
    } catch (err) {
      toast({
        title: "Update Failed",
        description: err instanceof Error ? err.message : "Something went wrong",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Bot className="w-10 h-10 text-primary animate-pulse" />
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
                  <Bot className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold">Edit Bot</h1>
                  <p className="text-sm text-muted-foreground">{botConfig.name || "Loading..."}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-6">
        <div className="max-w-4xl mx-auto">
          <Card className="shadow-strong border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Sparkles className="w-6 h-6 text-primary" />
                Bot Configuration
              </CardTitle>
              <CardDescription>
                Update your bot settings and configuration
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <CollapsibleSection title="Basic Information" icon={<User className="w-5 h-5 text-primary" />} defaultOpen>
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

                <CollapsibleSection title="Slack Integration" icon={<MessageSquare className="w-5 h-5 text-primary" />}>
                  <SlackSection botConfig={botConfig} updateConfig={updateConfig} />
                </CollapsibleSection>

                <CollapsibleSection title="Talk to Human" icon={<Users className="w-5 h-5 text-primary" />}>
                  <HumanHandoffSection botConfig={botConfig} updateConfig={updateConfig} />
                </CollapsibleSection>

                <ConversationFlowSection
                  botId={botId}
                  initialNodes={botConfig.conversationFlow.nodes}
                  initialEdges={botConfig.conversationFlow.edges}
                  onFlowChange={(nodes, edges) =>
                    updateConfig("conversationFlow", { nodes, edges })
                  }
                />

                <div className="flex justify-end gap-3 pt-6">
                  <Button variant="outline" onClick={() => navigate("/")}>
                    Cancel
                  </Button>
                  <Button type="submit" size="lg" className="bg-gradient-primary">
                    <Bot className="w-5 h-5 mr-2" />
                    Update Bot
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default EditBot;
