import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Code2,
  Copy,
  ExternalLink,
  Settings,
  Check,
  Palette,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Info
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { EmbedCustomizer, EmbedCustomization } from "@/components/EmbedCustomizer";
import axios from "axios";

interface Bot {
  id: string;
  name: string;
  description: string;
}

interface FoundUrl {
  url: string;
  selected: boolean;
}

export default function Documentation() {
  const { botId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [bot, setBot] = useState<Bot | null>(null);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [customization, setCustomization] = useState<EmbedCustomization | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Page control state
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [foundUrls, setFoundUrls] = useState<FoundUrl[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showPageControl, setShowPageControl] = useState(false);

  useEffect(() => {
    if (botId) {
      fetchBot();
    }
  }, [botId]);

  const fetchBot = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/bots/${botId}`);
      const botData = response.data.result;
      setBot({
        id: botData._id,
        name: botData.name,
        description: botData.description
      });
    } catch (error) {
      console.error("Error fetching bot:", error);
      toast({
        title: "Error",
        description: "Failed to load bot information",
        variant: "destructive"
      });
    }
  };

  const searchUrls = async () => {
    if (!websiteUrl.trim()) {
      toast({
        title: "Error",
        description: "Please enter a website URL",
        variant: "destructive"
      });
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/scrape/search-urls`, {
        method: "POST",
        headers: {
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
          description: `Found ${urls.length} URLs on your website`,
        });
      } else {
        throw new Error(data.error || "Failed to search URLs");
      }
    } catch (error) {
      console.error("Error searching URLs:", error);
      toast({
        title: "Error",
        description: "Failed to search website URLs",
        variant: "destructive"
      });
    } finally {
      setIsSearching(false);
    }
  };

  const toggleUrlSelection = (index: number) => {
    setFoundUrls(prev =>
      prev.map((url, i) =>
        i === index ? { ...url, selected: !url.selected } : url
      )
    );
  };

  const selectAllUrls = () => {
    setFoundUrls(prev => prev.map(url => ({ ...url, selected: true })));
  };

  const deselectAllUrls = () => {
    setFoundUrls(prev => prev.map(url => ({ ...url, selected: false })));
  };

  const copyToClipboard = (code: string, type: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(type);
    toast({ title: "Copied!", description: `${type} code copied to clipboard` });
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleCustomizationSave = (newCustomization: EmbedCustomization) => {
    setCustomization(newCustomization);
  };

  if (!bot) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading bot information...</p>
        </div>
      </div>
    );
  }

  const embedUrl = `${window.location.origin}/embed?botId=${botId}`;

  const selectedUrls = foundUrls.filter(u => u.selected);
  const hasSelectedUrls = selectedUrls.length > 0;

  // Generate allowed pages array for the code - convert full URLs to paths
  const allowedPagesArray = hasSelectedUrls
    ? selectedUrls.map(u => {
      try {
        const urlObj = new URL(u.url);
        return `"${urlObj.pathname}"`;
      } catch {
        return `"${u.url}"`;
      }
    }).join(',\n      ')
    : '';

  const basicEmbedCode = `<!-- Basic Embed Code (Shows on All Pages) -->
<script src="https://tastebot-studio-backend-gvvb.onrender.com/widget.js"></script>
<script>
  ChatBotWidget.init({
    botId: "${botId}",
    apiUrl: "https://tastebot-studio.onrender.com",
    position: "bottom-right",
  });
</script>`;

  const restrictedEmbedCode = hasSelectedUrls ? `<!-- Restricted Embed Code (Shows Only on Selected Pages) -->
<script src="https://tastebot-studio-backend-gvvb.onrender.com/widget.js"></script>
<script>
  ChatBotWidget.init({
    botId: "${botId}",
    apiUrl: "https://tastebot-studio.onrender.com",
    position: "bottom-right",
    allowedPages: [
      ${allowedPagesArray}
    ]
  });
</script>` : '';

  const CodeBlock = ({ code, language, type }: { code: string; language: string; type: string }) => (
    <div className="relative">
      <div className="flex items-center justify-between mb-2">
        <Badge variant="outline" className="text-xs">
          {language}
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => copyToClipboard(code, type)}
          className="h-8 px-2"
        >
          {copiedCode === type ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
      <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
        <code>{code}</code>
      </pre>
    </div>
  );

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
                  <Code2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold">Integration Guide</h1>
                  <p className="text-sm text-muted-foreground">{bot?.name || "Loading..."}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto p-6 max-w-5xl">

      {/* Bot Info */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Code2 className="h-5 w-5 text-primary" />
              {bot.name}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setIsCustomizerOpen(true)}
                className="flex items-center gap-2"
              >
                <Palette className="h-4 w-4" />
                Customize UI
              </Button>
              <Button
                variant="outline"
                onClick={() => window.open(embedUrl, '_blank')}
                className="flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Test Chat
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">{bot.description}</p>
          <div className="bg-muted p-3 rounded-lg">
            <p className="text-sm font-medium mb-1">Embed URL:</p>
            <code className="text-sm bg-background px-2 py-1 rounded">{embedUrl}</code>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(embedUrl, 'Embed URL')}
              className="ml-2 h-6 px-2"
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Embed Code Section - Shows First */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code2 className="h-5 w-5 text-primary" />
            Quick Start - Embed Code
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex items-start gap-2 mb-3">
              <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Default Configuration</p>
                <p className="text-muted-foreground text-sm">
                  This code will display your chatbot on every page of your website. If you want to show it only on specific pages, use the Page Control feature below.
                </p>
              </div>
            </div>
            <CodeBlock code={basicEmbedCode} language="HTML" type="Basic Embed" />
          </div>

          <Separator />

          {/* Installation Instructions */}
          <div className="space-y-4">
            <h4 className="font-semibold text-base">📋 Installation Instructions</h4>

            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
              <h5 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Code2 className="h-4 w-4" />
                Method 1: Direct HTML Integration
              </h5>
              <ol className="text-sm space-y-2 text-muted-foreground">
                <li className="flex gap-2">
                  <span className="font-semibold text-foreground">1.</span>
                  <span>Copy the embed code above by clicking the copy button</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-foreground">2.</span>
                  <span>Open your website's HTML file in a code editor</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-foreground">3.</span>
                  <span>Paste the code just before the closing <code className="bg-background px-1.5 py-0.5 rounded text-xs">&lt;/body&gt;</code> tag</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-foreground">4.</span>
                  <span>Save and refresh your website to see the chatbot</span>
                </li>
              </ol>
            </div>

            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-4 rounded-lg">
              <h5 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Method 2: Google Tag Manager (No Coding)
              </h5>
              <ol className="text-sm space-y-2 text-muted-foreground">
                <li className="flex gap-2">
                  <span className="font-semibold text-foreground">1.</span>
                  <span>Log in to <a href="https://tagmanager.google.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">Google Tag Manager</a></span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-foreground">2.</span>
                  <span>Click <strong>"Add a new tag"</strong></span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-foreground">3.</span>
                  <span>Choose <strong>"Custom HTML"</strong> as tag type</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-foreground">4.</span>
                  <span>Paste the embed code above</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-foreground">5.</span>
                  <span>Set triggering to <strong>"All Pages"</strong></span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-foreground">6.</span>
                  <span>Save and publish your changes</span>
                </li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Page Control Feature - Optional */}
      <Card className="mb-6">
        <CardHeader>
          <div className="space-y-2">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                Advanced: Page Control (Optional)
              </div>
              <Button
                variant="outline"
                onClick={() => setShowPageControl(!showPageControl)}
              >
                {showPageControl ? "Hide" : "Show"} Page Selector
              </Button>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Want to display your chatbot only on specific pages? Use this tool to discover all pages on your website and select exactly where your chatbot should appear. Perfect for showing the bot only on product pages, support sections, or landing pages.
            </p>
          </div>
        </CardHeader>
        {showPageControl && (
          <CardContent className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">How This Works:</p>
                  <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
                    <li>Enter your website URL and click "Find Pages" to discover all available pages</li>
                    <li>Select the specific pages where you want the chatbot to appear</li>
                    <li>Copy the generated custom embed code with your selected pages</li>
                    <li>The chatbot will automatically show/hide as users navigate your site</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="Enter your website URL (e.g., https://example.com)"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={searchUrls}
                disabled={isSearching}
                className="flex items-center gap-2"
              >
                {isSearching ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    Find Pages
                  </>
                )}
              </Button>
            </div>

            {foundUrls.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    Found {foundUrls.length} pages ({selectedUrls.length} selected)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={selectAllUrls}
                    >
                      Select All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={deselectAllUrls}
                    >
                      Deselect All
                    </Button>
                  </div>
                </div>

                <div className="border rounded-lg max-h-64 overflow-y-auto">
                  {foundUrls.map((urlObj, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer border-b last:border-b-0"
                      onClick={() => toggleUrlSelection(index)}
                    >
                      <div className="flex-shrink-0">
                        {urlObj.selected ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <span className="text-sm truncate flex-1">
                        {urlObj.url}
                      </span>
                    </div>
                  ))}
                </div>

                {hasSelectedUrls && (
                  <>
                    <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-3 rounded-lg">
                      <p className="text-sm font-medium text-green-900 dark:text-green-100">
                        ✓ {selectedUrls.length} pages selected
                      </p>
                      <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                        Your custom embed code is generated below. Copy and use it instead of the basic code.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-sm">Your Custom Embed Code:</h4>
                      </div>
                      <CodeBlock code={restrictedEmbedCode} language="HTML" type="Custom Embed" />

                      <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-3 rounded-lg">
                        <p className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-1">
                          💡 Important:
                        </p>
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                          Use this custom code instead of the basic code above. The chatbot will automatically appear only on the {selectedUrls.length} selected page{selectedUrls.length !== 1 ? 's' : ''} and hide on all others.
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Advanced Examples */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code2 className="h-5 w-5 text-primary" />
            Advanced Configuration Examples
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            For advanced users: Manually configure page patterns using wildcards and path matching.
          </p>

          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold mb-2">Example 1: Show on all product and blog pages</h4>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
                <code>{`ChatBotWidget.init({
  botId: "${botId}",
  apiUrl: "https://tastebot-studio.onrender.com",
  position: "bottom-right",
  allowedPages: [
    "/products/*",  // All product pages
    "/blog/*"       // All blog posts
  ]
});`}</code>
              </pre>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2">Example 2: Show on specific pages with dynamic routes</h4>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
                <code>{`ChatBotWidget.init({
  botId: "${botId}",
  apiUrl: "https://tastebot-studio.onrender.com",
  position: "bottom-right",
  allowedPages: [
    "/",           // Homepage
    "/contact",    // Contact page
    "/edit"        // Matches /edit and /edit/123, /edit/abc, etc.
  ]
});`}</code>
              </pre>
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-semibold text-sm mb-2">Pattern Matching Rules:</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• <code className="bg-background px-1 py-0.5 rounded">/edit</code> - Matches /edit, /edit/123, /edit/anything</li>
                <li>• <code className="bg-background px-1 py-0.5 rounded">/products/*</code> - Matches all URLs starting with /products/</li>
                <li>• <code className="bg-background px-1 py-0.5 rounded">/blog/*/comments</code> - Matches nested paths with wildcards</li>
                <li>• Leave <code className="bg-background px-1 py-0.5 rounded">allowedPages</code> empty to show on all pages</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customizer Modal */}
      <EmbedCustomizer
        isOpen={isCustomizerOpen}
        onClose={() => setIsCustomizerOpen(false)}
        botId={botId!}
        botName={bot.name}
        onSave={handleCustomizationSave}
      />
      </div>
    </div>
  );
}
