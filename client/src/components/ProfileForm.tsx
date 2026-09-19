import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Game } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { ImageUpload } from '@/components/ImageUpload';
import { Search, Filter, ArrowUpDown, Check, ChevronsUpDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import { standardLanguages } from '@/lib/languages';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  'Action', 'RPG', 'Adventure', 'Strategy', 'Simulation',
  'Shooter', 'Puzzle', 'Survival', 'Platformer', 'Fighting',
  'Racing', 'Sports'
];

export interface ProfileFormData {
  username: string;
  password?: string;
  language: string;
  region: string;
  profilePicture: string;
  gamesPlayed: string[];
  currentGame: string;
  currentGameId: string;
}

interface ProfileFormProps {
  initialData?: Partial<ProfileFormData>;
  onSubmit: (data: ProfileFormData) => void;
  isSubmitting?: boolean;
  submitLabel?: string;
  isEditMode?: boolean;
  onCancel?: () => void;
}

export function ProfileForm({
  initialData,
  onSubmit,
  isSubmitting = false,
  submitLabel = "Save Profile",
  isEditMode = false,
  onCancel,
}: ProfileFormProps) {
  const [username, setUsername] = useState(initialData?.username || '');
  const [password, setPassword] = useState(initialData?.password || '');
  const [language, setLanguage] = useState(initialData?.language || '');
  const [region, setRegion] = useState(initialData?.region || '');
  const [profilePicture, setProfilePicture] = useState(initialData?.profilePicture || '');
  const [selectedGames, setSelectedGames] = useState<string[]>(initialData?.gamesPlayed || []);
  const [currentGame, setCurrentGame] = useState(initialData?.currentGame || '');
  const [currentGameId, setCurrentGameId] = useState(initialData?.currentGameId || '');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [sortByDownloads, setSortByDownloads] = useState<'asc' | 'desc' | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [openLanguage, setOpenLanguage] = useState(false);
  const itemsPerPage = 20;

  const { data: games = [], isLoading: gamesLoading } = useQuery<Game[]>({
    queryKey: ['/api/games'],
    queryFn: async () => {
      const res = await fetch('/api/games');
      if (!res.ok) throw new Error('Failed to fetch games');
      return res.json();
    }
  });

  const filteredGames = games
    .filter(game => {
      if (searchQuery && !game.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (selectedCategories.length > 0) {
        return selectedCategories.some(cat => (game.categories as string[])?.includes(cat));
      }
      return true;
    })
    .sort((a, b) => {
      if (sortByDownloads === 'asc') return (a.downloads || 0) - (b.downloads || 0);
      if (sortByDownloads === 'desc') return (b.downloads || 0) - (a.downloads || 0);
      return a.name.localeCompare(b.name);
    });

  const totalPages = Math.ceil(filteredGames.length / itemsPerPage);
  const paginatedGames = filteredGames.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
    setCurrentPage(1);
  };

  const toggleGameSelection = (gameName: string) => {
    setSelectedGames(prev => {
      const updated = prev.includes(gameName) ? prev.filter(g => g !== gameName) : [...prev, gameName];
      if (!updated.includes(currentGame)) {
        setCurrentGame(updated[0] || '');
      }
      return updated;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      username,
      ...(isEditMode ? {} : { password }),
      language,
      region,
      profilePicture,
      gamesPlayed: selectedGames,
      currentGame,
      currentGameId,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Details */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isEditMode}
              placeholder="Username"
              required
              className="bg-[#1A1A1A] border-[#3A3A3A] text-white"
            />
          </div>

          {!isEditMode && (
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                className="bg-[#1A1A1A] border-[#3A3A3A] text-white"
              />
            </div>
          )}

          <div className="space-y-2 flex flex-col">
            <Label>Language</Label>
            <Popover open={openLanguage} onOpenChange={setOpenLanguage}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className={cn(
                    "w-full justify-between bg-[#1A1A1A] border-[#3A3A3A] text-white hover:bg-[#2A2A2A]",
                    !language && "text-muted-foreground"
                  )}
                >
                  {language || "Select language..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0 bg-[#1A1A1A] border-[#3A3A3A] text-white">
                <Command className="bg-[#1A1A1A] text-white">
                  <CommandInput placeholder="Search language..." className="text-white" />
                  <CommandEmpty>No language found.</CommandEmpty>
                  <CommandGroup>
                    <ScrollArea className="h-60">
                      {standardLanguages.map((lang) => (
                        <CommandItem
                          key={lang}
                          value={lang}
                          onSelect={() => {
                            setLanguage(lang);
                            setOpenLanguage(false);
                          }}
                          className="hover:bg-[#2D221C] cursor-pointer"
                        >
                          <Check
                            className={cn("mr-2 h-4 w-4", language === lang ? "opacity-100" : "opacity-0")}
                          />
                          {lang}
                        </CommandItem>
                      ))}
                    </ScrollArea>
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="region">Region</Label>
            <Input
              id="region"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="Enter your region"
              required
              className="bg-[#1A1A1A] border-[#3A3A3A] text-white"
            />
          </div>

          <div className="space-y-2">
            <Label>Profile Picture</Label>
            <ImageUpload
              currentImage={profilePicture}
              onImageSelected={setProfilePicture}
              onImageUploaded={setProfilePicture}
            />
          </div>
        </div>

        {/* Right Column: Game Selector */}
        <div className="space-y-4">
          <Label>Games You Play</Label>
          <Card className="bg-[#1A1A1A] border-[#3A3A3A]">
            <CardContent className="p-4 space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search games..."
                    className="pl-8 bg-[#0F0F0F] border-[#3A3A3A]"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                  />
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="bg-[#0F0F0F] border-[#3A3A3A]">
                      <Filter className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 bg-[#1A1A1A] border-[#3A3A3A] text-white">
                    <DropdownMenuItem disabled className="font-semibold text-xs text-gray-400">Categories</DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-[#3A3A3A]" />
                    {CATEGORIES.map(cat => (
                      <DropdownMenuCheckboxItem
                        key={cat}
                        checked={selectedCategories.includes(cat)}
                        onCheckedChange={() => toggleCategory(cat)}
                      >
                        {cat}
                      </DropdownMenuCheckboxItem>
                    ))}
                    <DropdownMenuSeparator className="bg-[#3A3A3A]" />
                    <DropdownMenuItem onClick={() => setSelectedCategories([])}>Clear Filters</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setSortByDownloads(p => p === null ? 'desc' : p === 'desc' ? 'asc' : null)}
                  className={cn("bg-[#0F0F0F] border-[#3A3A3A]", sortByDownloads && "border-primary text-primary")}
                >
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </div>

              {/* Selected Categories */}
              {selectedCategories.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedCategories.map(cat => (
                    <Badge key={cat} variant="secondary" className="cursor-pointer bg-[#2D221C]" onClick={() => toggleCategory(cat)}>
                      {cat} ✕
                    </Badge>
                  ))}
                </div>
              )}

              {/* Selected Games Badges */}
              {selectedGames.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs text-gray-400">Selected ({selectedGames.length}):</div>
                  <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                    {selectedGames.map(game => (
                      <Badge key={game} className="cursor-pointer bg-primary/20 text-primary border border-primary/40" onClick={() => toggleGameSelection(game)}>
                        {game} ✕
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Games Scrollable List */}
              {gamesLoading ? (
                <div className="py-8 text-center text-sm text-gray-400">Loading games...</div>
              ) : (
                <ScrollArea className="h-56">
                  <div className="space-y-1">
                    {paginatedGames.map(game => {
                      const isSelected = selectedGames.includes(game.name);
                      return (
                        <div
                          key={game.id}
                          onClick={() => toggleGameSelection(game.name)}
                          className={cn(
                            "p-2 rounded-md flex items-center justify-between cursor-pointer transition-colors text-sm",
                            isSelected ? "bg-primary/20 text-white" : "hover:bg-[#2D221C] text-gray-300"
                          )}
                        >
                          <div>
                            <div className="font-medium">{game.name}</div>
                            <div className="text-xs text-gray-500">{(game.categories as string[])?.slice(0, 2).join(', ')}</div>
                          </div>
                          <div className="text-xs text-gray-500">{(game.downloads || 0).toLocaleString()} dl</div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-between items-center text-xs pt-2 border-t border-[#3A3A3A]">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className="h-7 text-xs bg-[#0F0F0F] border-[#3A3A3A]"
                  >
                    Previous
                  </Button>
                  <span>{currentPage} / {totalPages}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className="h-7 text-xs bg-[#0F0F0F] border-[#3A3A3A]"
                  >
                    Next
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-3 pt-2">
            <div className="space-y-2">
              <Label>Current Game</Label>
              <Select value={currentGame} onValueChange={setCurrentGame}>
                <SelectTrigger className="bg-[#1A1A1A] border-[#3A3A3A] text-white">
                  <SelectValue placeholder="Select current game" />
                </SelectTrigger>
                <SelectContent className="bg-[#1A1A1A] border-[#3A3A3A] text-white">
                  {selectedGames.length === 0 ? (
                    <SelectItem value="none" disabled>Select games played first</SelectItem>
                  ) : (
                    selectedGames.map(game => (
                      <SelectItem key={game} value={game}>{game}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="currentGameId">Current Game ID</Label>
              <Input
                id="currentGameId"
                value={currentGameId}
                onChange={(e) => setCurrentGameId(e.target.value)}
                placeholder="Your GamerTag / Riot ID / Steam ID"
                required
                className="bg-[#1A1A1A] border-[#3A3A3A] text-white"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between pt-4 border-t border-[#2D221C]">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} className="bg-transparent border-[#3A3A3A] text-white hover:bg-[#2D221C]">
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          disabled={isSubmitting || selectedGames.length === 0 || !currentGame || !currentGameId}
          className="ml-auto bg-[#EC1146] hover:bg-[#EC1146]/90 text-white"
        >
          {isSubmitting ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
