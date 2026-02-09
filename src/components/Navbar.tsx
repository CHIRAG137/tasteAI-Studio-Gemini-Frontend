import { useNavigate } from "react-router-dom";
import { User, Plus, Bot, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { removeAuthToken, getAuthToken } from "@/utils/auth";
import { logoutBotUser } from "@/api/auth";
import { useToast } from "@/hooks/use-toast";

export const Navbar = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleLogout = async () => {
    try {
      const token = getAuthToken();
      if (token) {
        // Call logout API
        await logoutBotUser(token);
      }
      
      // Clear token from localStorage
      removeAuthToken();
      
      toast({
        title: "Success",
        description: "Logged out successfully",
      });
      
      // Redirect to login page
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout error:", error);
      // Clear token anyway even if API call fails
      removeAuthToken();
      navigate("/login", { replace: true });
    }
  };

  return (
    <nav className="w-full bg-background border-b border-border px-4 py-3 sticky top-0 z-50 backdrop-blur-sm bg-background/95">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold text-foreground">tasteAI Studio</h1>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={() => scrollToSection('your-bots')}
            className="text-sm"
          >
            <Bot className="w-4 h-4 mr-2" />
            Your Bots
          </Button>
          <Button
            onClick={() => scrollToSection('bot-builder')}
            className="bg-gradient-primary hover:opacity-90 transition-all hover:animate-none [animation:slow-zoom_6s_ease-in-out_infinite] [@keyframes_slow-zoom:{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}]"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Bot
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuItem onClick={() => navigate("/profile")}>
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
};
