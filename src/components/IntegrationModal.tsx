import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Copy, Code2, Globe, Server, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface IntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  botId: string;
  botName: string;
}

export const IntegrationModal = ({ isOpen, onClose, botId, botName }: IntegrationModalProps) => {
  const { toast } = useToast();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyToClipboard = (code: string, type: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(type);
    toast({ title: "Copied!", description: `${type} code copied to clipboard` });
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const webWidgetCode = `<!-- Add this script tag to your HTML -->
<script src="${import.meta.env.VITE_BACKEND_URL}/widget.js"></script>
<script>
  ChatBotWidget.init({
    botId: "${botId}",
    apiUrl: "${import.meta.env.VITE_FRONTEND_URL}",
    theme: "modern",
    position: "bottom-right",
    triggerLabel: "Chat with ${botName}",
    primaryColor: "#3b82f6",
    headerTitle: "${botName}",
    placeholder: "Type your message...",
    welcomeMessage: "Hi! How can I help you today?"
  });
</script>`;

  const backendSDKCode = `// Install the SDK
npm install your-chatbot-sdk

// Initialize and use the SDK
import { ChatBotSDK } from 'your-chatbot-sdk';

const chatBot = new ChatBotSDK({
  botId: "${botId}",
  apiUrl: "import.meta.env.VITE_BACKEND_URL",
  apiKey: "your-api-key" // Get this from your dashboard
});

// Send a message
const response = await chatBot.sendMessage({
  message: "Hello, how can you help me?",
  userId: "user-123",
  sessionId: "session-456"
});

console.log(response.reply);`;

  const reactComponentCode = `// Install React component
npm install @your-org/react-chatbot

// Use in your React app
import { ChatBotWidget } from '@your-org/react-chatbot';

function App() {
  return (
    <div>
      {/* Your app content */}
      
      <ChatBotWidget
        botId="${botId}"
        apiUrl="import.meta.env.VITE_BACKEND_URL"
        theme="modern"
        position="bottom-right"
        primaryColor="#3b82f6"
        headerTitle="${botName}"
        welcomeMessage="Hi! How can I help you today?"
      />
    </div>
  );
}`;

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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Code2 className="h-6 w-6 text-primary" />
            Integrate {botName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 h-5 text-primary" />
                Web Widget Integration
              </CardTitle>
              <CardDescription>
                Add a floating chat widget to any website with just a few lines of code
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Step 1: Add the script to your HTML</h4>
                <CodeBlock code={webWidgetCode} language="HTML" type="Web Widget" />
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold text-sm mb-2">Features:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Floating chat widget with customizable position</li>
                  <li>• Responsive design for mobile and desktop</li>
                  <li>• Customizable colors and branding</li>
                  <li>• Auto-expanding chat window</li>
                  <li>• Session persistence</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={() => window.open(`/docs/${botId}`, '_blank')}>
            View Full Documentation
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};