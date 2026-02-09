import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Globe, CheckCircle2 } from "lucide-react";
import { WebsiteScraper } from "@/components/WebsiteScraper";

interface WebsiteSectionProps {
  botConfig: any;
  updateConfig: (field: string, value: any) => void;
}

export const WebsiteSection = ({ botConfig, updateConfig }: WebsiteSectionProps) => {
  const handleScrapedData = (markdownData: string[], scrapedUrls: string[]) => {
    // Store the scraped markdown data and URLs in the bot config
    updateConfig("scrapedMarkdown", markdownData);
    updateConfig("scrapedUrls", scrapedUrls);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="websiteUrl" className="text-sm font-medium flex items-center gap-1">
          <Globe className="w-4 h-4" />
          Website URL
        </Label>
        <Input
          id="websiteUrl"
          placeholder="https://your-website.com"
          value={botConfig.websiteUrl}
          onChange={(e) => updateConfig("websiteUrl", e.target.value)}
          className="h-11"
        />
      </div>
      
      {/* Show existing scraped URLs if available */}
      {botConfig.existingScrapedUrls && botConfig.existingScrapedUrls.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-success" />
            <h4 className="text-sm font-semibold">Previously Scraped URLs ({botConfig.existingScrapedUrls.length})</h4>
          </div>
          <div className="bg-muted/50 border border-border rounded-md p-3 max-h-40 overflow-y-auto">
            <ul className="space-y-2">
              {botConfig.existingScrapedUrls.map((url: string, index: number) => (
                <li key={index} className="text-xs text-muted-foreground flex items-start gap-2">
                  <CheckCircle2 className="w-3 h-3 text-success mt-0.5 flex-shrink-0" />
                  <span className="break-all">{url}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-muted-foreground">
            These URLs were used for training. You can scrape additional URLs below to add more content.
          </p>
        </div>
      )}
      
      <WebsiteScraper 
        websiteUrl={botConfig.websiteUrl} 
        onScrapedDataReady={handleScrapedData}
      />
      
      {/* Show indicator if new scraped data is available */}
      {botConfig.scrapedMarkdown && botConfig.scrapedMarkdown.length > 0 && (
        <div className="bg-success/10 border border-success/20 rounded-md p-3">
          <p className="text-sm text-success">
            ✓ {botConfig.scrapedMarkdown.length} new pages ready for training
          </p>
        </div>
      )}
    </div>
  );
};
