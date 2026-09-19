import { useLocation } from "wouter";
import { Home, Search, MessageCircle, PlayCircle, Lightbulb, Shield } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export function Navbar() {
  const [location, setLocation] = useLocation();
  const { isAdmin } = useAuth();

  const isActive = (path: string) => {
    if (path === '/' && location === '/') return true;
    if (path !== '/' && location.startsWith(path)) return true;
    return false;
  };

  const navItems = [
    { label: "Home", path: "/", icon: Home },
    { label: "Search", path: "/search", icon: Search },
    { label: "Watch", path: "/watch", icon: PlayCircle },
    { label: "Chat", path: "/messages", icon: MessageCircle },
    { label: "Ideas", path: "/ideas", icon: Lightbulb },
    ...(isAdmin ? [{ label: "Admin", path: "/admin", icon: Shield }] : []),
  ];

  return (
    <nav className="nav-menu">
      <div className="flex flex-col gap-8">
        {navItems.map(({ label, path, icon: Icon }) => (
          <button
            key={path}
            onClick={() => setLocation(path)}
            className={`nav-item ${isActive(path) ? 'active' : ''}`}
          >
            <Icon className="h-6 w-6" />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
