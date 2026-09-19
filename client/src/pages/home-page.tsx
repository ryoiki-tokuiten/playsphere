import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { User } from '@shared/schema';
import { GamingCard } from '@/components/GamingCard';
import { Button } from '@/components/ui/button';
import { ChatWindow } from '@/components/ChatWindow';
import { User as UserIcon, LogOut, SlidersHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { useLocation } from 'wouter';
import { getStoredUser } from '@/lib/auth-utils';
import { ExpandedUserModal } from '@/components/ExpandedUserModal';

export default function HomePage() {
  const [sortBy, setSortBy] = useState<string>('recent');
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [showChatWith, setShowChatWith] = useState<User | null>(null);
  const [expandedUser, setExpandedUser] = useState<User | null>(null);
  const [, setLocation] = useLocation();
  const [chatMinimized, setChatMinimized] = useState(false);

  const currentUser = getStoredUser();

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  useEffect(() => {
    const handleChatEvent = (event: Event) => {
      const { userId } = (event as CustomEvent).detail;
      const userToChat = users.find(u => u.id === userId);
      if (userToChat) {
        setShowChatWith(userToChat);
      }
    };

    window.addEventListener('openChat', handleChatEvent as EventListener);
    return () => {
      window.removeEventListener('openChat', handleChatEvent as EventListener);
    };
  }, [users]);

  useEffect(() => {
    if (users.length && !isLoading) {
      const chatWithUserId = sessionStorage.getItem('chatWithUserId');
      if (chatWithUserId) {
        const userToChat = users.find(u => u.id === parseInt(chatWithUserId));
        if (userToChat) {
          setShowChatWith(userToChat);
          sessionStorage.removeItem('chatWithUserId');
        }
      }
    }
  }, [users, isLoading]);

  const { regions, languages } = useMemo(() => {
    const regionsSet = new Set<string>();
    const languagesSet = new Set<string>();

    users.forEach(user => {
      if (user.region) regionsSet.add(user.region);
      if (user.language) languagesSet.add(user.language);
    });

    return {
      regions: Array.from(regionsSet).sort(),
      languages: Array.from(languagesSet).sort(),
    };
  }, [users]);

  const filteredUsers = users
    .filter(u => !currentUser || u.id !== currentUser.id)
    .filter(u => selectedRegions.length === 0 || selectedRegions.includes(u.region))
    .filter(u => selectedLanguages.length === 0 || selectedLanguages.includes(u.language))
    .sort((a, b) => {
      if (sortBy === 'recent') {
        return new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime();
      }
      return a.currentGame.localeCompare(b.currentGame);
    });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0f0f0f] text-white">
        <div className="animate-pulse">Loading gamer cards...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white pl-16">
      <div className="max-w-6xl mx-auto p-4">
        <div className="flex items-center justify-between py-6 mb-6">
          <h1 className="text-2xl font-bold">Playsphere</h1>
          <div className="flex gap-3 items-center flex-wrap">
            <Button
              variant="outline"
              className="bg-[#2D221C] border-none text-white hover:bg-[#2D221C]/80"
              onClick={() => setLocation('/edit')}
            >
              <UserIcon className="h-4 w-4 mr-2" />
              My Card
            </Button>

            {/* Sort Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="bg-[#2D221C] border-none text-white hover:bg-[#2D221C]/80">
                  <SlidersHorizontal className="h-4 w-4 mr-2" />
                  Sort: {sortBy === 'recent' ? 'Most Recent' : 'By Game'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-[#2D221C] text-white border-[#EC1146]">
                <DropdownMenuCheckboxItem
                  checked={sortBy === 'recent'}
                  onCheckedChange={() => setSortBy('recent')}
                >
                  Most Recent
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={sortBy === 'game'}
                  onCheckedChange={() => setSortBy('game')}
                >
                  By Game
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Region Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="bg-[#2D221C] border-none text-white hover:bg-[#2D221C]/80">
                  {selectedRegions.length > 0 ? `${selectedRegions.length} Regions` : 'Region'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-[#2D221C] text-white border-[#EC1146] max-h-60 overflow-y-auto">
                <DropdownMenuItem onClick={() => setSelectedRegions([])} className="justify-between">
                  All Regions {selectedRegions.length === 0 && '✓'}
                </DropdownMenuItem>
                {regions.map(region => (
                  <DropdownMenuCheckboxItem
                    key={region}
                    checked={selectedRegions.includes(region)}
                    onCheckedChange={(checked) => {
                      setSelectedRegions(prev => checked ? [...prev, region] : prev.filter(r => r !== region));
                    }}
                  >
                    {region}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Language Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="bg-[#2D221C] border-none text-white hover:bg-[#2D221C]/80">
                  {selectedLanguages.length > 0 ? `${selectedLanguages.length} Languages` : 'Language'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-[#2D221C] text-white border-[#EC1146] max-h-60 overflow-y-auto">
                <DropdownMenuItem onClick={() => setSelectedLanguages([])} className="justify-between">
                  All Languages {selectedLanguages.length === 0 && '✓'}
                </DropdownMenuItem>
                {languages.map(language => (
                  <DropdownMenuCheckboxItem
                    key={language}
                    checked={selectedLanguages.includes(language)}
                    onCheckedChange={(checked) => {
                      setSelectedLanguages(prev => checked ? [...prev, language] : prev.filter(l => l !== language));
                    }}
                  >
                    {language}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Logout */}
            <Button
              variant="outline"
              className="bg-[#2D221C] border-none text-white hover:bg-[#2D221C]/80"
              onClick={() => {
                localStorage.removeItem('user');
                window.location.href = '/auth';
              }}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUsers.map((user) => (
            <GamingCard
              key={user.id}
              user={user}
              onChatClick={() => setShowChatWith(user)}
              onCardClick={() => setExpandedUser(user)}
            />
          ))}
        </div>
      </div>

      {showChatWith && currentUser && (
        <ChatWindow
          currentUser={currentUser}
          otherUser={showChatWith}
          onClose={() => setShowChatWith(null)}
          isMinimized={chatMinimized}
          onMinimize={() => setChatMinimized(!chatMinimized)}
        />
      )}

      {expandedUser && (
        <ExpandedUserModal
          user={expandedUser}
          onClose={() => setExpandedUser(null)}
        />
      )}
    </div>
  );
}
