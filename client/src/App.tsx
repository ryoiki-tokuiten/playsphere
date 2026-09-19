import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/hooks/use-auth";

import AuthPage from "@/pages/auth-page";
import SetupPage from "@/pages/setup-page";
import HomePage from "@/pages/home-page";
import ChatPage from "@/pages/chat-page";
import SearchPage from "@/pages/search-page";
import WatchPage from "@/pages/watch-page";
import IdeasPage from "@/pages/ideas-page";
import AdminDashboard from "@/pages/admin-dashboard";
import EditCard from "@/pages/edit-card";
import SharePage from "@/pages/share-page";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAdmin, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#eb0028]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      <Switch>
        <Route path="/auth">
          {isAuthenticated ? <Redirect to="/" /> : <AuthPage />}
        </Route>
        <Route path="/setup" component={SetupPage} />
        <Route path="/">
          {!isAuthenticated ? <Redirect to="/auth" /> : <HomePage />}
        </Route>
        <Route path="/messages">
          {!isAuthenticated ? <Redirect to="/auth" /> : <ChatPage />}
        </Route>
        <Route path="/search">
          {!isAuthenticated ? <Redirect to="/auth" /> : <SearchPage />}
        </Route>
        <Route path="/watch">
          {!isAuthenticated ? <Redirect to="/auth" /> : <WatchPage />}
        </Route>
        <Route path="/ideas">
          {!isAuthenticated ? <Redirect to="/auth" /> : <IdeasPage />}
        </Route>
        <Route path="/admin">
          {!isAuthenticated || !isAdmin ? <Redirect to="/" /> : <AdminDashboard />}
        </Route>
        <Route path="/edit">
          {!isAuthenticated ? <Redirect to="/auth" /> : <EditCard />}
        </Route>
        <Route path="/share/:username" component={SharePage} />
        <Route component={NotFound} />
      </Switch>
      {isAuthenticated && <Navbar />}
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}
