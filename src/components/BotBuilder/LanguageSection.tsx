import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X } from "lucide-react";

interface LanguageSectionProps {
  botConfig: any;
  updateConfig: (field: string, value: any) => void;
}

const AVAILABLE_LANGUAGES = [
  "English", "Spanish", "French", "German", "Italian", "Portuguese", 
  "Russian", "Japanese", "Chinese", "Korean", "Arabic", "Hindi",
  "Dutch", "Swedish", "Norwegian", "Danish", "Finnish"
];

export const LanguageSection = ({ botConfig, updateConfig }: LanguageSectionProps) => {
  const [selectedLanguage, setSelectedLanguage] = useState("");

  const addLanguage = () => {
    if (selectedLanguage && !botConfig.languages.includes(selectedLanguage)) {
      updateConfig("languages", [...botConfig.languages, selectedLanguage]);
      setSelectedLanguage("");
    }
  };

  const removeLanguage = (languageToRemove: string) => {
    if (botConfig.languages.length > 1) {
      updateConfig("languages", botConfig.languages.filter((lang: string) => lang !== languageToRemove));
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-6 border border-border/50 bg-card/50">
        <div className="space-y-4">
          <div>
            <Label className="text-base font-medium">Supported Languages</Label>
            <p className="text-sm text-muted-foreground mt-1">
              Configure which languages your bot can understand and respond in
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {botConfig.languages.map((language: string) => (
              <Badge key={language} variant="secondary" className="px-3 py-1">
                {language}
                {botConfig.languages.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLanguage(language)}
                    className="ml-2 hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </Badge>
            ))}
          </div>
          
          <div className="flex gap-2">
            <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select a language to add" />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_LANGUAGES.filter(lang => !botConfig.languages.includes(lang)).map((language) => (
                  <SelectItem key={language} value={language}>
                    {language}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              type="button"
              onClick={addLanguage} 
              disabled={!selectedLanguage}
              variant="outline"
              size="icon"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};