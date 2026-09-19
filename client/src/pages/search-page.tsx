import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Filter, ArrowUpDown, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { User, Game } from '@shared/schema';
import { ChatWindow } from '@/components/ChatWindow';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ExpandedGameModal } from '@/components/ExpandedGameModal';
import { useAuth } from '@/hooks/use-auth';

const CATEGORIES = [
  'Action', 'RPG', 'Adventure', 'Strategy', 'Simulation',
  'Shooter', 'Puzzle', 'Survival', 'Platformer', 'Fighting',
  'Racing', 'Sports'
];

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [chatMinimized, setChatMinimized] = useState(false);
  const [sortByDownloads, setSortByDownloads] = useState<'asc' | 'desc' | null>(null);
  const itemsPerPage = 20;

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser, isAdmin } = useAuth();

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  const { data: games = [], isLoading: gamesLoading } = useQuery<Game[]>({
    queryKey: ['games'],
    queryFn: async () => {
      const res = await fetch('/api/games');
      if (!res.ok) throw new Error('Failed to fetch games');
      return res.json();
    },
  });

  const filteredGames = games
    .filter(game => {
      if (searchQuery && !game.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (selectedCategories.length > 0) {
        const hasSelectedCategory = (game.categories as string[]).some(category =>
          selectedCategories.includes(category)
        );
        if (!hasSelectedCategory) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortByDownloads === 'asc') return (a.downloads || 0) - (b.downloads || 0);
      if (sortByDownloads === 'desc') return (b.downloads || 0) - (a.downloads || 0);
      return a.name.localeCompare(b.name);
    });

  const totalPages = Math.ceil(filteredGames.length / itemsPerPage);
  const paginatedGames = filteredGames.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev =>
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
    );
    setPage(1);
  };

  const toggleSortByDownloads = () => {
    setSortByDownloads(prev => {
      if (prev === null) return 'desc';
      if (prev === 'desc') return 'asc';
      return null;
    });
  };

  const clearFilters = () => {
    setSelectedCategories([]);
    setSortByDownloads(null);
    setPage(1);
  };

  const getUsersWithGame = (gameName: string) => {
    return users.filter(user =>
      ((user.gamesPlayed as string[]) || []).includes(gameName) ||
      user.currentGame === gameName
    );
  };

  const handleDeleteGame = async (gameId: number, gameName: string) => {
    if (!currentUser || !isAdmin) return;
    try {
      const response = await fetch(`/api/admin/games/${gameId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id }),
      });

      if (!response.ok) throw new Error('Failed to delete game');

      toast({
        title: 'Game Deleted',
        description: `Game "${gameName}" has been deleted.`,
      });
      queryClient.invalidateQueries({ queryKey: ['games'] });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete game.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white pl-16">
      <div className="max-w-6xl mx-auto p-4 py-6">
        <div className="flex flex-col space-y-4 mb-6">
          <h1 className="text-2xl font-bold">Find Games & Players</h1>

          {/* Search and filter bar */}
          <div className="flex space-x-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search games..."
                className="pl-9 bg-[#1a1a1a] border-[#2D221C] text-white"
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="border-[#2D221C] bg-[#1a1a1a] text-white hover:bg-[#252525]">
                  <Filter className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-[#2D221C] text-white border-[#EC1146]">
                <DropdownMenuItem onSelect={e => e.preventDefault()}>
                  <div className="font-medium">Categories</div>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-[#3D322C]" />
                {CATEGORIES.map(category => (
                  <DropdownMenuCheckboxItem
                    key={category}
                    checked={selectedCategories.includes(category)}
                    onCheckedChange={() => toggleCategory(category)}
                    onSelect={e => e.preventDefault()}
                  >
                    {category}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator className="bg-[#3D322C]" />
                <DropdownMenuItem onClick={clearFilters}>
                  Clear filters
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              size="icon"
              onClick={toggleSortByDownloads}
              className={`border-[#2D221C] text-white ${sortByDownloads ? 'bg-[#eb0028]' : 'bg-[#1a1a1a] hover:bg-[#252525]'}`}
            >
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </div>

          {selectedCategories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedCategories.map(category => (
                <Badge
                  key={category}
                  className="bg-[#2D221C] text-white hover:bg-[#3D322C] cursor-pointer"
                  onClick={() => toggleCategory(category)}
                >
                  {category} ✕
                </Badge>
              ))}
            </div>
          )}

          {sortByDownloads && (
            <div className="text-xs text-gray-400">
              Sorting by downloads: {sortByDownloads === 'asc' ? 'lowest first' : 'highest first'}
            </div>
          )}
        </div>

        {gamesLoading ? (
          <div className="py-12 text-center text-white/70">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#eb0028] mb-2" />
            <p>Loading games...</p>
          </div>
        ) : paginatedGames.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            {searchQuery || selectedCategories.length > 0 ? 'No games match your search criteria.' : 'No games found.'}
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Games ({filteredGames.length})</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-12">
              {paginatedGames.map(game => (
                <Card
                  key={game.id}
                  className="bg-[#2D221C] text-white hover:bg-[#382b24] transition-colors cursor-pointer border border-[#3D322C]"
                  onClick={() => setSelectedGame(game)}
                >
                  <CardContent className="p-5">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-lg font-bold text-white truncate pr-2">{game.name}</h3>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteGame(game.id, game.name);
                          }}
                          className="text-white/60 hover:text-red-500 -mt-1 -mr-1 h-7 w-7"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1 mb-3">
                      {(game.categories as string[]).slice(0, 3).map((category, index) => (
                        <span key={index} className="bg-[#1A1A1A] px-2 py-0.5 rounded text-xs text-gray-300">
                          {category}
                        </span>
                      ))}
                      {(game.categories as string[]).length > 3 && (
                        <span className="bg-[#1A1A1A] px-2 py-0.5 rounded text-xs text-gray-400">
                          +{(game.categories as string[]).length - 3}
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-white/70 mb-2">
                      {(game.platforms as string[]).join(', ')}
                    </div>

                    <div className="text-xs text-white/50">
                      {game.downloads ? `${game.downloads.toLocaleString()} downloads` : 'No download data'}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 pb-16">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  className="text-white border-[#3D322C] bg-[#2D221C] hover:bg-[#382b24]"
                >
                  Previous
                </Button>
                <div className="text-sm text-gray-300 mx-2">
                  Page {page} of {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="text-white border-[#3D322C] bg-[#2D221C] hover:bg-[#382b24]"
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}

        {/* Selected Game Modal */}
        {selectedGame && (
          <ExpandedGameModal
            game={selectedGame}
            users={getUsersWithGame(selectedGame.name)}
            onClose={() => setSelectedGame(null)}
            onChatClick={(u) => {
              setSelectedUser(u);
              setChatMinimized(false);
              setSelectedGame(null);
            }}
          />
        )}

        {/* Chat Window */}
        {selectedUser && currentUser && (
          <ChatWindow
            currentUser={currentUser}
            otherUser={selectedUser}
            onClose={() => setSelectedUser(null)}
            isMinimized={chatMinimized}
            onMinimize={() => setChatMinimized(!chatMinimized)}
          />
        )}
      </div>
    </div>
  );
}
