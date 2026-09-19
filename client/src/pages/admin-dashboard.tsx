import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Redirect } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  Shield,
  Home,
  Plus,
  Settings,
  LogOut,
  Users,
  Activity,
  Globe,
  Gamepad2,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const CATEGORIES = [
  'Action', 'RPG', 'Adventure', 'Strategy', 'Simulation',
  'Shooter', 'Puzzle', 'Survival', 'Platformer', 'Fighting',
  'Racing', 'Sports'
];

const PLATFORMS = ['PC', 'Games', 'Console'];

interface UserStats {
  users: {
    byRegion: Record<string, number>;
    byLanguage: Record<string, number>;
    total: number;
  };
  activeUsers: {
    daily: number;
    weekly: number;
    monthly: number;
    quarterly: number;
  };
}

interface GamesByRegion {
  byRegion: Record<string, Record<string, number>>;
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const { user, isAdmin, isAuthenticated, isLoading, logout } = useAuth();
  const { toast } = useToast();

  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [gamesByRegion, setGamesByRegion] = useState<GamesByRegion | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  // Add Game form state
  const [gameName, setGameName] = useState('');
  const [gameContact, setGameContact] = useState('');
  const [gameDownloads, setGameDownloads] = useState('0');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [isSubmittingGame, setIsSubmittingGame] = useState(false);

  useEffect(() => {
    if (isAuthenticated && isAdmin && activeTab === 'overview' && user?.id) {
      setIsLoadingStats(true);
      setError(null);

      Promise.all([
        fetch(`/api/admin/user-stats?userId=${user.id}`).then(r => r.json()),
        fetch(`/api/admin/games-by-region?userId=${user.id}`).then(r => r.json()),
      ])
        .then(([statsData, regionData]) => {
          if (statsData.success) {
            setUserStats(statsData);
          }
          if (regionData.success) {
            setGamesByRegion(regionData.gamesByRegion);
            const regions = Object.keys(regionData.gamesByRegion?.byRegion || {});
            if (regions.length > 0) setSelectedRegion(regions[0]);
          }
        })
        .catch(err => setError(err.message))
        .finally(() => setIsLoadingStats(false));
    }
  }, [isAuthenticated, isAdmin, activeTab, user?.id]);

  const gamesInSelectedRegion = useMemo(() => {
    if (!gamesByRegion?.byRegion || !selectedRegion) return [];
    const data = gamesByRegion.byRegion[selectedRegion] || {};
    return Object.entries(data)
      .map(([game, count]) => ({ game, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [gamesByRegion, selectedRegion]);

  const availableRegions = useMemo(() => {
    if (!gamesByRegion?.byRegion) return [];
    return Object.keys(gamesByRegion.byRegion).sort();
  }, [gamesByRegion]);

  const maxGameCount = useMemo(() => {
    if (gamesInSelectedRegion.length === 0) return 1;
    return Math.max(...gamesInSelectedRegion.map(x => x.count), 1);
  }, [gamesInSelectedRegion]);

  const handleAddGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gameName.trim()) {
      toast({ title: 'Error', description: 'Game name is required', variant: 'destructive' });
      return;
    }
    if (selectedCategories.length === 0) {
      toast({ title: 'Error', description: 'Select at least one category', variant: 'destructive' });
      return;
    }
    if (selectedPlatforms.length === 0) {
      toast({ title: 'Error', description: 'Select at least one platform', variant: 'destructive' });
      return;
    }

    setIsSubmittingGame(true);
    try {
      const res = await fetch('/api/admin/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          game: {
            name: gameName.trim(),
            categories: selectedCategories,
            platforms: selectedPlatforms,
            contact: gameContact.trim() || null,
            downloads: parseInt(gameDownloads) || 0,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to add game');
      }

      toast({ title: 'Success', description: `Game "${gameName}" added successfully!` });
      setGameName('');
      setGameContact('');
      setGameDownloads('0');
      setSelectedCategories([]);
      setSelectedPlatforms([]);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmittingGame(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#EC1146]" />
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return <Redirect to="/" />;
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white pl-16">
      <div className="max-w-6xl mx-auto p-4 py-6">
        <div className="flex items-center justify-between py-4 mb-6">
          <div className="flex items-center">
            <Shield className="text-[#EC1146] h-6 w-6 mr-2" />
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-[#2D221C] px-3 py-1.5 rounded text-xs">
              <span className="text-gray-400">Admin: </span>
              <span className="font-semibold text-white">{user?.username}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="bg-[#2D221C] text-white hover:bg-[#2D221C]/80 border-none"
              onClick={() => (window.location.href = '/')}
            >
              <Home className="mr-1.5 h-3.5 w-3.5" /> Home
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="bg-transparent text-white hover:bg-red-900/30 border-red-800/40"
              onClick={logout}
            >
              <LogOut className="mr-1.5 h-3.5 w-3.5" /> Logout
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-3 mb-6 bg-[#2D221C] p-1 rounded-lg">
            <TabsTrigger value="overview" className="data-[state=active]:bg-[#EC1146] data-[state=active]:text-white">
              Overview
            </TabsTrigger>
            <TabsTrigger value="add-game" className="data-[state=active]:bg-[#EC1146] data-[state=active]:text-white">
              <Plus className="h-4 w-4 mr-1.5" /> Add Game
            </TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:bg-[#EC1146] data-[state=active]:text-white">
              <Settings className="h-4 w-4 mr-1.5" /> Settings
            </TabsTrigger>
          </TabsList>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="space-y-6">
            <Card className="bg-[#2D221C] border-[#EC1146]">
              <CardHeader>
                <CardTitle className="text-white">User Analytics</CardTitle>
                <CardDescription className="text-gray-400">
                  Platform telemetry and active distribution
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingStats ? (
                  <div className="py-12 text-center text-gray-400">Loading analytics...</div>
                ) : error ? (
                  <div className="p-4 bg-red-950/40 border border-red-500/40 rounded text-center text-red-300">
                    {error}
                  </div>
                ) : userStats ? (
                  <div className="space-y-6">
                    {/* 4 Stats Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-[#1A1A1A] p-4 rounded-lg border border-[#3D322C] flex flex-col items-center">
                        <Users className="h-6 w-6 text-white mb-2" />
                        <h3 className="text-2xl font-bold">{userStats.users.total}</h3>
                        <p className="text-xs text-gray-400">Total Users</p>
                      </div>
                      <div className="bg-[#1A1A1A] p-4 rounded-lg border border-[#3D322C] flex flex-col items-center">
                        <Activity className="h-6 w-6 text-green-400 mb-2" />
                        <h3 className="text-2xl font-bold">{userStats.activeUsers.daily}</h3>
                        <p className="text-xs text-gray-400">Active Today</p>
                      </div>
                      <div className="bg-[#1A1A1A] p-4 rounded-lg border border-[#3D322C] flex flex-col items-center">
                        <Activity className="h-6 w-6 text-blue-400 mb-2" />
                        <h3 className="text-2xl font-bold">{userStats.activeUsers.weekly}</h3>
                        <p className="text-xs text-gray-400">Active This Week</p>
                      </div>
                      <div className="bg-[#1A1A1A] p-4 rounded-lg border border-[#3D322C] flex flex-col items-center">
                        <Activity className="h-6 w-6 text-purple-400 mb-2" />
                        <h3 className="text-2xl font-bold">{userStats.activeUsers.monthly}</h3>
                        <p className="text-xs text-gray-400">Active This Month</p>
                      </div>
                    </div>

                    {/* Region breakdown */}
                    <div className="bg-[#1A1A1A] p-5 rounded-lg border border-[#3D322C]">
                      <h3 className="text-base font-semibold mb-3">Users by Region</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {Object.entries(userStats.users.byRegion || {}).map(([reg, count]) => (
                          <div key={reg} className="bg-[#0F0F0F] p-3 rounded flex justify-between items-center">
                            <span className="text-xs text-gray-300">{reg}</span>
                            <span className="bg-[#EC1146] px-2 py-0.5 rounded text-xs font-bold">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Language breakdown */}
                    <div className="bg-[#1A1A1A] p-5 rounded-lg border border-[#3D322C]">
                      <h3 className="text-base font-semibold mb-3">Users by Language</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {Object.entries(userStats.users.byLanguage || {}).map(([lang, count]) => (
                          <div key={lang} className="bg-[#0F0F0F] p-3 rounded flex justify-between items-center">
                            <span className="text-xs text-gray-300">{lang}</span>
                            <span className="bg-[#EC1146] px-2 py-0.5 rounded text-xs font-bold">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Games by Region visual chart */}
                    <div className="bg-[#1A1A1A] p-5 rounded-lg border border-[#3D322C]">
                      <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                          <Gamepad2 className="h-5 w-5 text-gray-400" />
                          <h3 className="text-base font-semibold">Games Distribution by Region</h3>
                        </div>
                        {availableRegions.length > 0 && (
                          <Select value={selectedRegion || ''} onValueChange={setSelectedRegion}>
                            <SelectTrigger className="w-40 bg-[#0F0F0F] border-[#3D322C] text-xs">
                              <SelectValue placeholder="Select Region" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#0F0F0F] border-[#3D322C] text-white">
                              {availableRegions.map(reg => (
                                <SelectItem key={reg} value={reg}>{reg}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      {gamesInSelectedRegion.length > 0 ? (
                        <div className="space-y-3 pt-2">
                          {gamesInSelectedRegion.map((item, idx) => {
                            const pct = Math.round((item.count / maxGameCount) * 100);
                            return (
                              <div key={item.game} className="space-y-1">
                                <div className="flex justify-between text-xs">
                                  <span className="font-medium text-gray-200">{item.game}</span>
                                  <span className="text-gray-400">{item.count} player{item.count > 1 ? 's' : ''}</span>
                                </div>
                                <div className="w-full bg-[#0F0F0F] h-2.5 rounded-full overflow-hidden">
                                  <div
                                    className="bg-[#EC1146] h-full rounded-full transition-all duration-500"
                                    style={{ width: `${Math.max(pct, 5)}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="py-8 text-center text-gray-500 text-sm">
                          No game activity recorded in this region yet.
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ADD GAME TAB */}
          <TabsContent value="add-game">
            <Card className="bg-[#2D221C] border-[#EC1146]">
              <CardHeader>
                <CardTitle className="text-white">Add New Game</CardTitle>
                <CardDescription className="text-gray-400">
                  Register a new game title into Playsphere's global database
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddGame} className="space-y-4 max-w-xl">
                  <div>
                    <Label className="text-xs text-gray-300">Game Name</Label>
                    <Input
                      value={gameName}
                      onChange={e => setGameName(e.target.value)}
                      placeholder="e.g. Cyberpunk 2077"
                      className="bg-[#1a1a1a] border-[#3D322C] text-white"
                    />
                  </div>

                  <div>
                    <Label className="text-xs text-gray-300 mb-2 block">Categories</Label>
                    <div className="grid grid-cols-3 gap-2 bg-[#1a1a1a] p-3 rounded-md border border-[#3D322C]">
                      {CATEGORIES.map(cat => (
                        <div key={cat} className="flex items-center space-x-2">
                          <Checkbox
                            id={`cat-${cat}`}
                            checked={selectedCategories.includes(cat)}
                            onCheckedChange={checked => {
                              setSelectedCategories(prev =>
                                checked ? [...prev, cat] : prev.filter(c => c !== cat)
                              );
                            }}
                          />
                          <label htmlFor={`cat-${cat}`} className="text-xs text-gray-300 cursor-pointer">
                            {cat}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-gray-300 mb-2 block">Platforms</Label>
                    <div className="flex gap-4 bg-[#1a1a1a] p-3 rounded-md border border-[#3D322C]">
                      {PLATFORMS.map(plat => (
                        <div key={plat} className="flex items-center space-x-2">
                          <Checkbox
                            id={`plat-${plat}`}
                            checked={selectedPlatforms.includes(plat)}
                            onCheckedChange={checked => {
                              setSelectedPlatforms(prev =>
                                checked ? [...prev, plat] : prev.filter(p => p !== plat)
                              );
                            }}
                          />
                          <label htmlFor={`plat-${plat}`} className="text-xs text-gray-300 cursor-pointer">
                            {plat}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-gray-300">Contact / Website / Support Email</Label>
                    <Input
                      value={gameContact}
                      onChange={e => setGameContact(e.target.value)}
                      placeholder="contact@gamestudio.com"
                      className="bg-[#1a1a1a] border-[#3D322C] text-white"
                    />
                  </div>

                  <div>
                    <Label className="text-xs text-gray-300">Initial Estimated Downloads</Label>
                    <Input
                      type="number"
                      value={gameDownloads}
                      onChange={e => setGameDownloads(e.target.value)}
                      className="bg-[#1a1a1a] border-[#3D322C] text-white"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmittingGame}
                    className="bg-[#EC1146] hover:bg-[#eb0028] text-white w-full"
                  >
                    {isSubmittingGame ? 'Adding Game...' : 'Add Game to Database'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SETTINGS TAB */}
          <TabsContent value="settings">
            <Card className="bg-[#2D221C] border-[#EC1146]">
              <CardHeader>
                <CardTitle className="text-white">Admin Settings</CardTitle>
                <CardDescription className="text-gray-400">
                  Privileged account credentials and system information
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-[#1a1a1a] p-5 rounded-lg border border-[#3D322C] space-y-4">
                  <h3 className="text-sm font-semibold text-white">System Administrator Account</h3>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-gray-400">Username:</span>
                      <p className="font-semibold text-white mt-0.5">{user?.username}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Account ID:</span>
                      <p className="font-semibold text-white mt-0.5">{user?.id}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Primary Region:</span>
                      <p className="font-semibold text-white mt-0.5">{user?.region || 'Global'}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Primary Language:</span>
                      <p className="font-semibold text-white mt-0.5">{user?.language || 'English'}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
