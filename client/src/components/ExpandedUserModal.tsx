import { useState } from 'react';
import { User } from '@shared/schema';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Copy, Share2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ShareModal } from './ShareModal';

interface ExpandedUserModalProps {
  user: User;
  onClose: () => void;
}

export function ExpandedUserModal({ user, onClose }: ExpandedUserModalProps) {
  const { toast } = useToast();
  const [showShare, setShowShare] = useState(false);

  const copyGameId = () => {
    navigator.clipboard.writeText(user.currentGameId);
    toast({
      title: "Copied!",
      description: "Game ID copied to clipboard",
    });
  };

  const initial = user.username ? user.username[0].toUpperCase() : '?';

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <Card className="w-full max-w-xl bg-[#0f0f0f] border border-[#2D221C] text-white overflow-hidden shadow-2xl">
        <CardHeader className="bg-[#2D221C] py-4 px-6 flex flex-row justify-between items-center border-b border-[#3D322C]">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14 border border-[#eb0028]">
              <AvatarImage src={user.profilePicture || undefined} alt={user.username} />
              <AvatarFallback>{initial}</AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-xl font-bold">{user.username}</h2>
              <div className="flex gap-2 text-sm text-gray-400">
                <span>{user.language}</span>
                <span>•</span>
                <span>{user.region}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowShare(true)}
              className="text-[#EC1146] hover:bg-[#EC1146]/20"
            >
              <Share2 className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-white/60 hover:text-white"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-5">
              <div className="p-4 rounded-lg bg-[#2D221C] border border-[#3D322C]">
                <div className="text-xs text-gray-400 mb-1">Currently Playing</div>
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-lg">{user.currentGame}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyGameId}
                    className="text-[#EC1146] hover:bg-[#EC1146]/10"
                  >
                    <Copy className="h-4 w-4 mr-1.5" />
                    <span>{user.currentGameId}</span>
                  </Button>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-2">Games Played</h3>
                <div className="grid grid-cols-2 gap-2">
                  {user.gamesPlayed?.map((game) => (
                    <div key={game} className="p-2.5 rounded bg-[#1A1A1A] border border-[#2D221C] text-sm">
                      {game}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-1">Last Active</h3>
                <div className="text-sm text-gray-400">
                  {new Date(user.lastActive).toLocaleString()}
                </div>
              </div>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <ShareModal
        username={user.username}
        open={showShare}
        onClose={() => setShowShare(false)}
      />
    </div>
  );
}
