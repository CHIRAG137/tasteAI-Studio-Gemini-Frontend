import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Eye, EyeOff, Headphones, MessageSquare, LogIn, Mail, Lock } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { setAgentAuthToken, setAgentEmail } from "@/utils/agentAuth";
import { useToast } from "@/hooks/use-toast";

const AgentLogin = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmailInput] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const from = (location.state as any)?.from?.pathname || "/agent";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast({
        title: "Error",
        description: "Please enter both email and password",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/human-agent/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      // Backend returns: {status: "success", result: {token, agent}, message}
      if (!response.ok || data.status !== "success") {
        toast({
          title: "Login Failed",
          description: data.message || "Invalid email or password",
          variant: "destructive",
        });
      } else {
        // Store the JWT token using your utility functions
        setAgentAuthToken(data.result.token);
        setAgentEmail(data.result.agent.email);
        
        // Also store agent ID for future use
        localStorage.setItem("agentId", data.result.agent.id);

        toast({
          title: "Success",
          description: "Login successful! Redirecting...",
        });

        // Redirect to agent dashboard or previous location
        setTimeout(() => {
          navigate(from, { replace: true });
        }, 500);
      }
    } catch (err) {
      console.error("Login error:", err);
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo and Branding */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <div className="w-14 h-14 bg-gradient-to-br from-emerald-600 to-teal-500 rounded-xl flex items-center justify-center shadow-lg">
              <Headphones className="w-8 h-8 text-white" />
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
                Agent Portal
              </h1>
              <p className="text-xs text-muted-foreground">TasteAI Studio</p>
            </div>
          </div>
          
          <div className="space-y-1">
            <h2 className="text-3xl font-bold text-foreground">Welcome, Agent</h2>
            <p className="text-muted-foreground">Sign in to view and respond to conversations</p>
          </div>

          {/* Info Banner */}
          <div className="bg-gradient-to-r from-emerald-100 to-teal-100 border border-emerald-200 rounded-lg p-3">
            <div className="flex items-center justify-center gap-2 text-sm">
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              <span className="font-medium text-emerald-900">
                Help users get the support they need
              </span>
            </div>
          </div>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Agent Login</CardTitle>
            <CardDescription>
              Use your registered agent email to sign in
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="agent@example.com"
                    value={email}
                    onChange={(e) => setEmailInput(e.target.value)}
                    required
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pl-10 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <LogIn className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" />
                    Sign In
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground space-y-2">
          <p>Powered by TasteAI Studio</p>
          <p>
            Don't have access?{" "}
            <span className="text-emerald-600 font-medium">Contact your administrator</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AgentLogin;
