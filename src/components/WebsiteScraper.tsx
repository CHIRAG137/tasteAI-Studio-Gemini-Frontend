import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Search, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/utils/auth";

interface FoundUrl {
  url: string;
  selected: boolean;
}

interface ScrapeJob {
  id: string;
  status: 'in_progress' | 'completed' | 'failed';
  data?: any[];
}

interface WebsiteScraperProps {
  websiteUrl: string;
  onScrapedDataReady: (markdownData: string[], scrapedUrls: string[]) => void;
}

export const WebsiteScraper = ({ websiteUrl, onScrapedDataReady }: WebsiteScraperProps) => {
  const { toast } = useToast();

  // Step 1: URL search
  const [searchLoading, setSearchLoading] = useState(false);
  const [foundUrls, setFoundUrls] = useState<FoundUrl[]>([]);

  // Step 2: URL selection and scraping
  const [scrapeLoading, setScrapeLoading] = useState(false);
  const [scrapeJob, setScrapeJob] = useState<ScrapeJob | null>(null);

  // Step 3: Results polling
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [scrapeProgress, setScrapeProgress] = useState(0);
  const [scrapeResults, setScrapeResults] = useState<any[]>([]);

  const handleSearchUrls = async () => {
    if (!websiteUrl?.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid website URL",
        variant: "destructive",
      });
      return;
    }

    setSearchLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/scrape/search-urls`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: websiteUrl,
          limit: 50,
          includeSubdomains: true,
          ignoreSitemap: true,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const urls = data.result.links.map((url: string) => ({
          url,
          selected: false,
        }));
        setFoundUrls(urls);
        toast({
          title: "URLs Found",
          description: `Found ${urls.length} URLs for scraping`,
        });
      } else {
        throw new Error(data.error || "Failed to search URLs");
      }
    } catch (error) {
      console.error("URL search error:", error);
      toast({
        title: "Search Failed",
        description: error instanceof Error ? error.message : "Failed to search URLs",
        variant: "destructive",
      });
    } finally {
      setSearchLoading(false);
    }
  };

  const handleUrlSelection = (index: number, checked: boolean) => {
    setFoundUrls(prev =>
      prev.map((item, i) =>
        i === index ? { ...item, selected: checked } : item
      )
    );
  };

  const selectAllUrls = (checked: boolean) => {
    setFoundUrls(prev =>
      prev.map(item => ({ ...item, selected: checked }))
    );
  };

  const handleScrapeSelected = async () => {
    const selectedUrls = foundUrls.filter(item => item.selected).map(item => item.url);

    if (selectedUrls.length === 0) {
      toast({
        title: "No URLs Selected",
        description: "Please select at least one URL to scrape",
        variant: "destructive",
      });
      return;
    }

    setScrapeLoading(true);
    setScrapeProgress(0);

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/scrape/urls`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          urls: selectedUrls,
          formats: ["markdown", "html"],
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setScrapeJob({
          id: data.result.id,
          status: 'in_progress',
        });

        // Start polling for results
        startPolling(data.result.id);

        toast({
          title: "Scraping Started",
          description: `Started scraping ${selectedUrls.length} URLs`,
        });
      } else {
        throw new Error(data.error || "Failed to start scraping");
      }
    } catch (error) {
      console.error("Scraping error:", error);
      toast({
        title: "Scraping Failed",
        description: error instanceof Error ? error.message : "Failed to start scraping",
        variant: "destructive",
      });
      setScrapeLoading(false);
    }
  };

  const startPolling = (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/scrape/result/${jobId}`, {
          headers: getAuthHeaders(),
        });

        const data = await response.json();

        if (data.result === 202) {
          // Still in progress
          setScrapeProgress(prev => Math.min(prev + 10, 90));
        } else if (data.result === 200 && data.message.message === "Job completed.") {
          // Completed
          setScrapeJob(prev => prev ? { ...prev, status: 'completed', data: data.message.data } : null);
          setScrapeResults(data.message.data || []);
          setScrapeProgress(100);
          setScrapeLoading(false);
          clearInterval(interval);
          setPollingInterval(null);

          toast({
            title: "Scraping Complete",
            description: `Successfully scraped ${data.message.data?.length || 0} pages`,
          });
        } else {
          // Failed
          setScrapeJob(prev => prev ? { ...prev, status: 'failed' } : null);
          setScrapeLoading(false);
          clearInterval(interval);
          setPollingInterval(null);

          toast({
            title: "Scraping Failed",
            description: "The scraping job failed",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, 3000);

    setPollingInterval(interval);
  };

  const handleUseForTraining = () => {
    if (scrapeResults.length === 0) {
      toast({
        title: "No Data Available",
        description: "No scraped data available for training",
        variant: "destructive",
      });
      return;
    }

    // Extract markdown content from all scraped pages
    const markdownData = scrapeResults
      .map(result => result.markdown)
      .filter(markdown => markdown && markdown.trim().length > 0);

    // Extract URLs from the scraped results
    const scrapedUrls = scrapeResults
      .map(result => result.metadata?.sourceURL || result.metadata?.url)
      .filter(url => url);

    if (markdownData.length === 0) {
      toast({
        title: "No Content Found",
        description: "No markdown content found in scraped data",
        variant: "destructive",
      });
      return;
    }

    // Pass the markdown data and URLs to parent component
    onScrapedDataReady(markdownData, scrapedUrls);

    toast({
      title: "Data Ready",
      description: `${markdownData.length} pages ready for bot training`,
    });
  };

  const resetScraper = () => {
    setFoundUrls([]);
    setScrapeJob(null);
    setScrapeResults([]);
    setScrapeProgress(0);

    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
  };

  const selectedCount = foundUrls.filter(item => item.selected).length;

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Search and scrape specific pages from your website to train your bot with relevant content.
        </p>
        <Button
          onClick={handleSearchUrls}
          disabled={!websiteUrl?.trim() || searchLoading || scrapeLoading}
          className="bg-gradient-primary hover:opacity-90"
        >
          {searchLoading ? (
            <>
              <Clock className="w-4 h-4 mr-2 animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <Search className="w-4 h-4 mr-2" />
              Find URLs
            </>
          )}
        </Button>
      </div>

      {/* Step 2: URL Selection */}
      {foundUrls.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Found URLs ({foundUrls.length})</h3>
            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="select-all"
                  checked={selectedCount === foundUrls.length}
                  onCheckedChange={selectAllUrls}
                />
                <label htmlFor="select-all" className="text-sm font-medium">
                  Select All
                </label>
              </div>
              <Badge variant="secondary">
                {selectedCount} selected
              </Badge>
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto border border-border rounded-md p-3 space-y-2">
            {foundUrls.map((item, index) => (
              <div key={index} className="flex items-center space-x-2">
                <Checkbox
                  id={`url-${index}`}
                  checked={item.selected}
                  onCheckedChange={(checked) => handleUrlSelection(index, !!checked)}
                />
                <label
                  htmlFor={`url-${index}`}
                  className="text-sm text-muted-foreground truncate flex-1 cursor-pointer"
                >
                  {item.url}
                </label>
              </div>
            ))}
          </div>

          <Button
            onClick={handleScrapeSelected}
            disabled={selectedCount === 0 || scrapeLoading}
            className="w-full bg-gradient-primary hover:opacity-90"
          >
            {scrapeLoading ? (
              <>
                <Clock className="w-4 h-4 mr-2 animate-spin" />
                Scraping in Progress...
              </>
            ) : (
              `Scrape Selected URLs (${selectedCount})`
            )}
          </Button>
        </div>
      )}

      {/* Step 3: Scraping Progress */}
      {scrapeLoading && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary animate-spin" />
            <span className="text-sm font-medium">Scraping in progress...</span>
          </div>
          <Progress value={scrapeProgress} className="w-full" />
          <p className="text-xs text-muted-foreground">
            This may take a few minutes depending on the number of URLs
          </p>
        </div>
      )}

      {/* Step 4: Results */}
      {scrapeJob?.status === 'completed' && scrapeResults.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-success" />
            <h3 className="text-lg font-semibold">Scraping Complete</h3>
          </div>

          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm">
              Successfully scraped <strong>{scrapeResults.length}</strong> pages.
              The content is now ready to be used for training your bot.
            </p>
          </div>

          <div className="flex gap-4">
            <Button onClick={resetScraper} variant="outline">
              Scrape Another Website
            </Button>
            <Button
              type="button"
              onClick={handleUseForTraining}
              className="bg-gradient-primary hover:opacity-90"
            >
              Use for Bot Training
            </Button>
          </div>
        </div>
      )}

      {scrapeJob?.status === 'failed' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-destructive" />
            <h3 className="text-lg font-semibold text-destructive">Scraping Failed</h3>
          </div>

          <Button onClick={resetScraper} variant="outline">
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
};
