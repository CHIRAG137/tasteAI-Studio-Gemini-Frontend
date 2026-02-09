import { ReactNode } from "react";
import { Bot, Sparkles } from "lucide-react";

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle: string;
}

export const AuthLayout = ({ children, title, subtitle }: AuthLayoutProps) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo and Branding */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <div className="w-14 h-14 bg-gradient-to-br from-purple-600 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg">
              <Bot className="w-8 h-8 text-white" />
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-cyan-500 bg-clip-text text-transparent">
                TasteAI Studio
              </h1>
              <p className="text-xs text-muted-foreground">Build. Deploy. In Minutes.</p>
            </div>
          </div>
          
          <div className="space-y-1">
            <h2 className="text-3xl font-bold text-foreground">{title}</h2>
            <p className="text-muted-foreground">{subtitle}</p>
          </div>

          {/* Value Proposition Banner */}
          <div className="bg-gradient-to-r from-purple-100 to-cyan-100 border border-purple-200 rounded-lg p-3">
            <div className="flex items-center justify-center gap-2 text-sm">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span className="font-medium text-purple-900">
                Create production-ready chatbots in 2-3 minutes
              </span>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 shadow-lg">
          {children}
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground">
          <p>The first all-in-one platform for video bots, chatbots & real-time AI</p>
        </div>
      </div>
    </div>
  );
};
