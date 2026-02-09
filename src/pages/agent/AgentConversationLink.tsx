import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Headphones, MessageSquare, Loader2, AlertCircle } from "lucide-react";
import { setAgentAuthToken, setAgentEmail } from "@/utils/agentAuth";

const AgentConversationLink = () => {
  const { conversationId } = useParams<{ conversationId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isVerifying, setIsVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const token = searchParams.get("token");
  const email = searchParams.get("email");

  useEffect(() => {
    const verifyAndRedirect = async () => {
      if (!token || !conversationId) {
        setError("Invalid link. Please check the URL and try again.");
        setIsVerifying(false);
        return;
      }

      try {
        // Verify the token with the backend
        const response = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/api/agent/verify-link`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, conversationId }),
          }
        );

        const data = await response.json();

        if (!response.ok || data.error) {
          throw new Error(data.error || "Invalid or expired link");
        }

        // Set authentication
        setAgentAuthToken(data.result.token);
        if (email) {
          setAgentEmail(email);
        }

        // Redirect to the chat
        navigate(`/agent/chat/${conversationId}`, { replace: true });
      } catch (err: any) {
        console.error("Verification error:", err);
        setError(err.message || "Failed to verify link");
        setIsVerifying(false);
      }
    };

    verifyAndRedirect();
  }, [token, conversationId, email, navigate]);

  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mb-4" />
              <p className="text-muted-foreground">Verifying your access...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <CardTitle>Access Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => navigate("/agent/login")}
              >
                Go to Agent Login
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                If you believe this is an error, please contact support.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
};

export default AgentConversationLink;
