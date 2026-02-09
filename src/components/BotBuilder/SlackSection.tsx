import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { MessageSquare } from "lucide-react";

interface SlackSectionProps {
  botConfig: any;
  updateConfig: (field: string, value: any) => void;
}

export const SlackSection = ({ botConfig, updateConfig }: SlackSectionProps) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <Switch
          id="isSlackEnabled"
          checked={botConfig.isSlackEnabled || false}
          onCheckedChange={(checked) => updateConfig("isSlackEnabled", checked)}
        />
        <Label htmlFor="isSlackEnabled" className="text-sm font-medium flex items-center gap-1">
          <MessageSquare className="w-4 h-4" />
          Enable Slack Integration
        </Label>
      </div>
      
      {botConfig.isSlackEnabled && (
        <div className="space-y-2">
          <Label htmlFor="slackChannelId" className="text-sm font-medium">
            Slack Channel ID
          </Label>
          <Input
            id="slackChannelId"
            placeholder="Enter Slack Channel ID (e.g., C1234567890)"
            value={botConfig.slackChannelId || ""}
            onChange={(e) => updateConfig("slackChannelId", e.target.value)}
            className="h-11"
          />
          <p className="text-xs text-muted-foreground">
            You can find the Channel ID by right-clicking on a channel and selecting "Copy link". The ID is at the end of the URL.
          </p>
        </div>
      )}
    </div>
  );
};