import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import EmbedChat from "./pages/embed";
import Documentation from "./pages/Documentation";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Sessions from "./pages/Sessions";
import EditBot from "./pages/EditBot";
import Profile from "./pages/Profile";
import BotAnalytics from "./pages/BotAnalytics";
import { PublicBotChatPage } from "@/components/PublicBotChatPage";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PublicRoute } from "@/components/PublicRoute";
import { AgentProtectedRoute } from "@/components/agent/AgentProtectedRoute";
import AgentLogin from "./pages/agent/AgentLogin";
import AgentDashboard from "./pages/agent/AgentDashboard";
import AgentChat from "./pages/agent/AgentChat";
import AgentConversationLink from "./pages/agent/AgentConversationLink";
import AgentSetPassword from "./pages/agent/AgentSetPassword";
import AgentProfile from "./pages/agent/AgentProfile";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Protected Routes - require authentication */}
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <Index />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/sessions/:botId" 
            element={
              <ProtectedRoute>
                <Sessions />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/edit/:botId" 
            element={
              <ProtectedRoute>
                <EditBot />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/embed" 
            element={
              <ProtectedRoute>
                <EmbedChat />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/docs/:botId" 
            element={
              <ProtectedRoute>
                <Documentation />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/analytics/:botId" 
            element={
              <ProtectedRoute>
                <BotAnalytics />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/profile" 
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } 
          />

          {/* Public Routes - redirect to home if already authenticated */}
          <Route 
            path="/login" 
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            } 
          />
          <Route 
            path="/register" 
            element={
              <PublicRoute>
                <Register />
              </PublicRoute>
            } 
          />

          {/* Public bot chat page - accessible to everyone */}
          <Route path="/bot/:botId" element={<PublicBotChatPage />} />

          {/* Agent Routes */}
          <Route path="/agent/login" element={<AgentLogin />} />
          <Route path="/agent/set-password" element={<AgentSetPassword />} />
          <Route path="/agent/link/:conversationId" element={<AgentConversationLink />} />
          <Route 
            path="/agent" 
            element={
              <AgentProtectedRoute>
                <AgentDashboard />
              </AgentProtectedRoute>
            } 
          />
          <Route 
            path="/agent/profile" 
            element={
              <AgentProtectedRoute>
                <AgentProfile />
              </AgentProtectedRoute>
            } 
          />
          <Route 
            path="/agent/chat/:conversationId" 
            element={
              <AgentProtectedRoute>
                <AgentChat />
              </AgentProtectedRoute>
            } 
          />

          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;