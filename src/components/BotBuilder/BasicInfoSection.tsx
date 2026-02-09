import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Upload } from "lucide-react";

interface BasicInfoSectionProps {
  botConfig: any;
  updateConfig: (field: string, value: any) => void;
}

export const BasicInfoSection = ({ botConfig, updateConfig }: BasicInfoSectionProps) => {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="botName" className="text-sm font-medium">
          Bot Name *
        </Label>
        <Input
          id="botName"
          placeholder="Enter your bot's name"
          value={botConfig.name}
          onChange={(e) => updateConfig("name", e.target.value)}
          className="h-11"
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="description" className="text-sm font-medium flex items-center gap-1">
          <FileText className="w-4 h-4" />
          Bot Description *
        </Label>
        <Textarea
          id="description"
          placeholder="Describe what your bot does and its main capabilities..."
          value={botConfig.description}
          onChange={(e) => updateConfig("description", e.target.value)}
          className="min-h-[100px] resize-none"
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="file" className="text-sm font-medium flex items-center gap-1">
          <Upload className="w-4 h-4" />
          Upload File
        </Label>
        <Input
          id="file"
          type="file"
          onChange={(e) => updateConfig("file", e.target.files?.[0] || null)}
          className="h-11 cursor-pointer file:cursor-pointer"
          accept=".pdf,.doc,.docx,.txt,.json"
        />
      </div>
    </div>
  );
};