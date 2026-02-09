import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { Bot, Sparkles, User, Mic, Languages, Brain, Globe, MessageSquare, GitBranch } from "lucide-react";
import { BasicInfoSection } from "./BotBuilder/BasicInfoSection";
import { VoiceSection } from "./BotBuilder/VoiceSection";
import { LanguageSection } from "./BotBuilder/LanguageSection";
import { PersonaSection } from "./BotBuilder/PersonaSection";
import { WebsiteSection } from "./BotBuilder/WebsiteSection";
import { SlackSection } from "./BotBuilder/SlackSection";
import { ConversationFlowSection } from "./BotBuilder/ConversationFlowSection";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/utils/auth";

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
  conversationFlow: {
    nodes: any[];
    edges: any[];
  };
  isVideoBot: boolean
}

interface EditBotModalProps {
  isOpen: boolean;
  onClose: () => void;
  bot: any;
  onBotUpdated: () => void;
}

export const EditBotModal = ({ isOpen, onClose, bot, onBotUpdated }: EditBotModalProps) => {
  const { toast } = useToast();
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
    conversationFlow: { nodes: [], edges: [] },
    isVideoBot: false,
  });

  // Populate form with bot data when modal opens
  useEffect(() => {
    if (bot && isOpen) {
      setBotConfig({
        name: bot.name || "",
        websiteUrl: bot.websiteUrl || "",
        description: bot.description || "",
        file: null,
        voiceEnabled: bot.voiceEnabled || false,
        languages: bot.languages || ["English"],
        primaryPurpose: bot.primaryPurpose || "",
        specializationArea: bot.specializationArea || "",
        conversationalTone: bot.conversationalTone || "",
        responseStyle: bot.responseStyle || "",
        targetAudience: bot.targetAudience || "",
        keyTopics: bot.keyTopics || "",
        keywords: bot.keywords || "",
        customInstructions: bot.customInstructions || "",
        isSlackEnabled: bot.isSlackEnabled || false,
        slackChannelId: bot.slackChannelId || "",
        conversationFlow: bot.conversationFlow || { nodes: [], edges: [] },
        isVideoBot: bot.isVideoBot
      });
    }
  }, [bot, isOpen]);

  const updateConfig = (field: keyof BotConfig, value: any) => {
    setBotConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
      formData.append("is_video_bot", botConfig.isVideoBot.toString());

      if (botConfig.file) {
        formData.append("file", botConfig.file);
      }

      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/bots/${bot.id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update bot");
      }

      toast({
        title: "Bot Updated Successfully!",
        description: result.message || `${botConfig.name} has been updated successfully.`,
      });

      onBotUpdated();
      onClose();
    } catch (error) {
      console.error("Error updating bot:", error);
      toast({
        title: "Error Updating Bot",
        description: error instanceof Error ? error.message : "Failed to update bot. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-primary rounded-xl shadow-medium">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-2xl flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-primary" />
                Edit Bot
              </DialogTitle>
              <DialogDescription className="text-base">
                Update your bot's configuration and settings
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <CollapsibleSection title="Basic Information" icon={<User className="w-5 h-5 text-primary" />} defaultOpen={true}>
            <BasicInfoSection botConfig={botConfig} updateConfig={updateConfig} />
          </CollapsibleSection>
          
          <CollapsibleSection title="Website & Content" icon={<Globe className="w-5 h-5 text-primary" />}>
            <WebsiteSection botConfig={botConfig} updateConfig={updateConfig} />
          </CollapsibleSection>
          
          <CollapsibleSection title="Voice Configuration" icon={<Mic className="w-5 h-5 text-primary" />}>
            <VoiceSection botConfig={botConfig} updateConfig={updateConfig} />
          </CollapsibleSection>
          
          <CollapsibleSection title="Language Support" icon={<Languages className="w-5 h-5 text-primary" />}>
            <LanguageSection botConfig={botConfig} updateConfig={updateConfig} />
          </CollapsibleSection>
          
          <CollapsibleSection title="Persona & Behavior" icon={<Brain className="w-5 h-5 text-primary" />}>
            <PersonaSection botConfig={botConfig} updateConfig={updateConfig} />
          </CollapsibleSection>
          
          <CollapsibleSection title="Slack Integration" icon={<MessageSquare className="w-5 h-5 text-primary" />}>
            <SlackSection botConfig={botConfig} updateConfig={updateConfig} />
          </CollapsibleSection>
          
          <CollapsibleSection title="Conversation Flow" icon={<GitBranch className="w-5 h-5 text-primary" />}>
            <ConversationFlowSection 
              botId={bot?.id}
              onFlowChange={(nodes, edges) => {
                updateConfig("conversationFlow", { nodes, edges });
              }}
            />
          </CollapsibleSection>

          <div className="flex justify-end gap-3 pt-6">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="lg"
              className="bg-gradient-primary hover:opacity-90 shadow-medium px-8"
            >
              <Bot className="w-5 h-5 mr-2" />
              Update Bot
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};