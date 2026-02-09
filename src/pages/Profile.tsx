import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { User, ArrowLeft, ExternalLink, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { isAuthenticated, getAuthHeaders } from "@/utils/auth";
import { API_BASE_URL } from "@/api/auth";

const Profile = () => {
  const navigate = useNavigate();
  const [isConnecting, setIsConnecting] = useState(false);
  const [userDetails, setUserDetails] = useState<{ name?: string; email?: string } | null>(null);
  const [slackIntegration, setSlackIntegration] = useState<{ teamName?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchUserDetails = async () => {
    if (!isAuthenticated()) {
      navigate("/login");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setUserDetails(data.result.user);
        setSlackIntegration(data.result.hasSlackIntegration ? data.result.slackIntegration : null);
      }
    } catch (error) {
      console.error("Failed to fetch user details:", error);
      toast({
        title: "Error",
        description: "Failed to load profile details.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUserDetails();
  }, []);

  const handleSlackAuth = async () => {
    setIsConnecting(true);
    const token = localStorage.getItem("authToken");
    window.location.href = `${API_BASE_URL}/api/slack/install?token=${token}`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Settings className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-foreground">Profile Settings</h1>
                <p className="text-sm text-muted-foreground">
                  Manage your account and integrations
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            {/* Profile Card */}
            <Card>
              <CardHeader>
                <CardTitle>Account Information</CardTitle>
                <CardDescription>Your personal account details</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20">
                    <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                      {userDetails?.name?.charAt(0)?.toUpperCase() || <User className="h-8 w-8" />}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <h3 className="text-xl font-semibold">{userDetails?.name || "User"}</h3>
                    <p className="text-muted-foreground">{userDetails?.email || "No email available"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Integrations Card */}
            <Card>
              <CardHeader>
                <CardTitle>Integrations</CardTitle>
                <CardDescription>Connect external services to enhance your bots</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Slack Integration */}
                <div className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/5 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#4A154B] rounded-lg flex items-center justify-center text-white font-bold text-xl">
                      S
                    </div>
                    <div>
                      <h4 className="font-medium">Slack</h4>
                      <p className="text-sm text-muted-foreground">
                        {slackIntegration 
                          ? `Connected to ${slackIntegration.teamName}` 
                          : "Connect your Slack workspace to receive notifications"}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={handleSlackAuth}
                    disabled={isConnecting}
                    className="bg-[#4A154B] hover:bg-[#3a1039] text-white"
                  >
                    {isConnecting ? (
                      "Connecting..."
                    ) : (
                      <>
                        {slackIntegration ? "Reconnect" : "Connect"}
                        <ExternalLink className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>

                {/* Placeholder for future integrations */}
                <div className="flex items-center justify-between p-4 border rounded-lg border-dashed opacity-60">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                      <span className="text-muted-foreground text-xl">+</span>
                    </div>
                    <div>
                      <h4 className="font-medium text-muted-foreground">More Integrations</h4>
                      <p className="text-sm text-muted-foreground">
                        Additional integrations coming soon
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default Profile;
