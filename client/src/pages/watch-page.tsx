import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';

interface Video {
  id: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
  publishedAt: string;
  platform: 'youtube' | 'twitch';
  url: string;
}

export default function WatchPage() {
  const { user } = useAuth();
  const [selectedGame, setSelectedGame] = useState<string | null>(null);

  useEffect(() => {
    if (user?.currentGame && !selectedGame) {
      setSelectedGame(user.currentGame);
    } else if (user?.gamesPlayed && (user.gamesPlayed as string[]).length > 0 && !selectedGame) {
      setSelectedGame((user.gamesPlayed as string[])[0]);
    }
  }, [user]);

  const { data: videos = [], isLoading } = useQuery<Video[]>({
    queryKey: ['videos', selectedGame],
    queryFn: async () => {
      if (!selectedGame) return [];
      const res = await fetch(`/api/videos/${encodeURIComponent(selectedGame)}`);
      if (!res.ok) throw new Error('Failed to fetch videos');
      return res.json();
    },
    enabled: !!selectedGame,
  });

  const gamesList = Array.from(
    new Set([
      ...(user?.currentGame ? [user.currentGame] : []),
      ...((user?.gamesPlayed as string[]) || []),
    ])
  );

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white pl-16">
      <div className="max-w-6xl mx-auto p-4 py-6">
        <h1 className="text-2xl font-bold mb-4">Watch Game Videos</h1>

        <div className="flex flex-wrap gap-2 mb-6">
          {gamesList.map((game) => (
            <Button
              key={game}
              variant="outline"
              size="sm"
              className={`rounded-full border-[#2D221C] text-xs transition-colors ${
                selectedGame === game
                  ? 'bg-[#eb0028] text-white border-[#eb0028]'
                  : 'bg-[#1a1a1a] text-gray-300 hover:bg-[#252525]'
              }`}
              onClick={() => setSelectedGame(game)}
            >
              {game} {game === user?.currentGame && '(Playing)'}
            </Button>
          ))}
          {gamesList.length === 0 && (
            <p className="text-gray-400 text-sm">No games in your profile yet. Add games from your profile page.</p>
          )}
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-gray-400">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#eb0028] mb-2" />
            <p>Loading game streams & videos...</p>
          </div>
        ) : videos.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-12">
            {videos.map((video) => (
              <Card
                key={video.id}
                className="bg-[#1a1a1a] border-[#2D221C] overflow-hidden hover:border-[#eb0028] transition-all"
              >
                <CardContent className="p-0">
                  <a href={video.url} target="_blank" rel="noopener noreferrer" className="block group">
                    <div className="relative aspect-video overflow-hidden">
                      <img
                        src={video.thumbnail}
                        alt={video.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <span className="absolute bottom-2 right-2 bg-black/80 px-2 py-0.5 rounded text-[10px] text-white uppercase font-bold tracking-wider">
                        {video.platform}
                      </span>
                    </div>
                    <div className="p-4 space-y-2">
                      <h3 className="font-semibold text-white text-sm line-clamp-2 leading-snug group-hover:text-[#eb0028] transition-colors">
                        {video.title}
                      </h3>
                      <div className="flex justify-between items-center text-xs text-gray-400">
                        <span className="truncate max-w-[60%]">{video.channelTitle}</span>
                        <span>{new Date(video.publishedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="py-16 text-center text-gray-400">
            {selectedGame ? `No videos found for ${selectedGame}` : 'Select a game to watch highlights and streams'}
          </div>
        )}
      </div>
    </div>
  );
}
