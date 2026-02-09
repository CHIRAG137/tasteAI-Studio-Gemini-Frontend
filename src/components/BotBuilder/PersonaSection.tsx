import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Target, MessageCircle, Palette, Users, Hash, Settings } from "lucide-react";
import { useEffect } from "react";

interface PersonaSectionProps {
  botConfig: any;
  updateConfig: (field: string, value: any) => void;
}

export const PersonaSection = ({ botConfig, updateConfig }: PersonaSectionProps) => {

  useEffect(() => {
    if (!botConfig.primaryPurpose) updateConfig("primaryPurpose", "customer-support");
    if (!botConfig.conversationalTone) updateConfig("conversationalTone", "professional");
    if (!botConfig.responseStyle) updateConfig("responseStyle", "concise");
    if (!botConfig.targetAudience) updateConfig("targetAudience", "customers");
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Primary Purpose */}
        <Card className="p-4 border border-border/50 bg-card/50">
          <Label className="text-sm font-medium flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-primary" />
            Primary Purpose
          </Label>
          <Select
            value={botConfig.primaryPurpose || "customer-support"}
            onValueChange={(value) => updateConfig("primaryPurpose", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select primary purpose" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="customer-support">Customer Support</SelectItem>
              <SelectItem value="sales-assistant">Sales Assistant</SelectItem>
              <SelectItem value="educational-tutor">Educational Tutor</SelectItem>
              <SelectItem value="personal-assistant">Personal Assistant</SelectItem>
              <SelectItem value="technical-advisor">Technical Advisor</SelectItem>
              <SelectItem value="creative-helper">Creative Helper</SelectItem>
              <SelectItem value="data-analyst">Data Analyst</SelectItem>
              <SelectItem value="content-creator">Content Creator</SelectItem>
            </SelectContent>
          </Select>
        </Card>

        {/* Conversational Tone */}
        <Card className="p-4 border border-border/50 bg-card/50">
          <Label className="text-sm font-medium flex items-center gap-2 mb-2">
            <MessageCircle className="w-4 h-4 text-primary" />
            Conversational Tone
          </Label>
          <Select
            value={botConfig.conversationalTone || "professional"}
            onValueChange={(value) => updateConfig("conversationalTone", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select tone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="professional">Professional</SelectItem>
              <SelectItem value="friendly">Friendly</SelectItem>
              <SelectItem value="casual">Casual</SelectItem>
              <SelectItem value="formal">Formal</SelectItem>
              <SelectItem value="enthusiastic">Enthusiastic</SelectItem>
              <SelectItem value="empathetic">Empathetic</SelectItem>
              <SelectItem value="authoritative">Authoritative</SelectItem>
              <SelectItem value="humorous">Humorous</SelectItem>
            </SelectContent>
          </Select>
        </Card>

        {/* Response Style */}
        <Card className="p-4 border border-border/50 bg-card/50">
          <Label className="text-sm font-medium flex items-center gap-2 mb-2">
            <Palette className="w-4 h-4 text-primary" />
            Response Style
          </Label>
          <Select
            value={botConfig.responseStyle || "concise"}
            onValueChange={(value) => updateConfig("responseStyle", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select response style" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="concise">Concise & Direct</SelectItem>
              <SelectItem value="detailed">Detailed & Comprehensive</SelectItem>
              <SelectItem value="conversational">Conversational & Engaging</SelectItem>
              <SelectItem value="bullet-points">Structured & Bullet Points</SelectItem>
              <SelectItem value="storytelling">Storytelling & Examples</SelectItem>
              <SelectItem value="technical">Technical & Precise</SelectItem>
            </SelectContent>
          </Select>
        </Card>

        {/* Target Audience */}
        <Card className="p-4 border border-border/50 bg-card/50">
          <Label className="text-sm font-medium flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-primary" />
            Target Audience
          </Label>
          <Select
            value={botConfig.targetAudience || "customers"}
            onValueChange={(value) => updateConfig("targetAudience", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select target audience" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general-public">General Public</SelectItem>
              <SelectItem value="business-professionals">Business Professionals</SelectItem>
              <SelectItem value="students">Students</SelectItem>
              <SelectItem value="developers">Developers</SelectItem>
              <SelectItem value="researchers">Researchers</SelectItem>
              <SelectItem value="customers">Customers</SelectItem>
              <SelectItem value="children">Children</SelectItem>
              <SelectItem value="seniors">Seniors</SelectItem>
            </SelectContent>
          </Select>
        </Card>
      </div>

      {/* Specialization Area */}
      <Card className="p-4 border border-border/50 bg-card/50">
        <Label htmlFor="specializationArea" className="text-sm font-medium flex items-center gap-2 mb-2">
          <Settings className="w-4 h-4 text-primary" />
          Specialization Area
        </Label>
        <Input
          id="specializationArea"
          placeholder="e.g., Healthcare, Finance, Technology, Education..."
          value={botConfig.specializationArea}
          onChange={(e) => updateConfig("specializationArea", e.target.value)}
          className="h-11"
        />
      </Card>

      {/* Key Topics */}
      <Card className="p-4 border border-border/50 bg-card/50">
        <Label htmlFor="keyTopics" className="text-sm font-medium flex items-center gap-2 mb-2">
          <Hash className="w-4 h-4 text-primary" />
          Key Topics
        </Label>
        <Textarea
          id="keyTopics"
          placeholder="List the main topics your bot should be knowledgeable about..."
          value={botConfig.keyTopics}
          onChange={(e) => updateConfig("keyTopics", e.target.value)}
          className="min-h-[80px] resize-none"
        />
      </Card>

      {/* Keywords */}
      <Card className="p-4 border border-border/50 bg-card/50">
        <Label htmlFor="keywords" className="text-sm font-medium flex items-center gap-2 mb-2">
          <Hash className="w-4 h-4 text-primary" />
          Keywords
        </Label>
        <Input
          id="keywords"
          placeholder="Enter relevant keywords separated by commas..."
          value={botConfig.keywords}
          onChange={(e) => updateConfig("keywords", e.target.value)}
          className="h-11"
        />
      </Card>

      {/* Custom Instructions */}
      <Card className="p-4 border border-border/50 bg-card/50">
        <Label htmlFor="customInstructions" className="text-sm font-medium flex items-center gap-2 mb-2">
          <Settings className="w-4 h-4 text-primary" />
          Custom Instructions
        </Label>
        <Textarea
          id="customInstructions"
          placeholder="Provide any specific instructions or behaviors you want your bot to follow..."
          value={botConfig.customInstructions}
          onChange={(e) => updateConfig("customInstructions", e.target.value)}
          className="min-h-[120px] resize-none"
        />
      </Card>
    </div>
  );
};