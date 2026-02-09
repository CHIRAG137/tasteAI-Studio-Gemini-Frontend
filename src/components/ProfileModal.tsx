import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { isAuthenticated, getAuthHeaders } from "@/utils/auth";
import { API_BASE_URL } from "@/api/auth";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileModal = ({ isOpen, onClose }: ProfileModalProps) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [userLoggedIn, setUserLoggedIn] = useState(false);
  const [userDetails, setUserDetails] = useState<{ name?: string; email?: string } | null>(null);
  const [slackIntegration, setSlackIntegration] = useState<{ teamName?: string } | null>(null);
  const { toast } = useToast();

  const fetchUserDetails = async () => {
    if (!isAuthenticated()) {
      setUserLoggedIn(false);
      setUserDetails(null);
      setSlackIntegration(null);
      return;
    }

    setUserLoggedIn(true);
    
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
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchUserDetails();
    }
  }, [isOpen]);

  const handleSlackAuth = async () => {
    if (!userLoggedIn) {
      toast({
        title: "Authentication Required",
        description: "Please log in to connect your Slack workspace.",
        variant: "destructive",
      });
      return;
    }

    const token = localStorage.getItem("authToken");
    window.location.href = `${API_BASE_URL}/api/slack/install?token=${token}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Profile</DialogTitle>
          <DialogDescription>
            Manage your account settings and integrations
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex items-center space-x-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-lg">
                <User className="h-8 w-8" />
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="text-lg font-semibold">{userDetails?.name || "User Profile"}</h3>
              <p className="text-sm text-muted-foreground">
                {userDetails?.email || "Manage your tasteAI Studio account"}
              </p>
            </div>
          </div>

          {userLoggedIn ? (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-3">Integrations</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-purple-600 rounded flex items-center justify-center text-white font-bold text-sm">
                        S
                      </div>
                      <div>
                        <p className="font-medium">Slack</p>
                        <p className="text-sm text-muted-foreground">
                          {slackIntegration ? `Connected to ${slackIntegration.teamName}` : "Connect your workspace"}
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={handleSlackAuth}
                      disabled={isConnecting}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      {isConnecting ? (
                        "Connecting..."
                      ) : (
                        <>
                          {slackIntegration ? "Upgrade Slack Auth" : "Add to Slack"}
                          <ExternalLink className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-muted-foreground">
                Please log in to access integrations
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};