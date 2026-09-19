import { useState } from 'react';
import { User, Game } from '@shared/schema';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, MessageCircle, Trash2 } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ExpandedGameModalProps {
  game: Game;
  users: User[];
  onClose: () => void;
  onChatClick: (user: User) => void;
}

export function ExpandedGameModal({ game, users, onClose, onChatClick }: ExpandedGameModalProps) {
  const { user: currentUser, isAdmin } = useAuth();
  const { toast } = useToast();
  const [showDelete, setShowDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();

  const handleDelete = async () => {
    if (!currentUser || !isAdmin) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/games/${game.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id }),
      });
      if (!res.ok) throw new Error('Failed to delete game');

      toast({ title: 'Success', description: `Game "${game.name}" deleted` });
      queryClient.invalidateQueries({ queryKey: ['games'] });
      onClose();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
      setShowDelete(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-40 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <Card className="w-full max-w-2xl bg-[#0f0f0f] border border-[#2D221C] text-white overflow-hidden shadow-2xl">
        <CardHeader className="bg-[#2D221C] py-4 px-6 flex flex-row justify-between items-center border-b border-[#3D322C]">
          <div>
            <h2 className="text-xl font-bold">{game.name}</h2>
            <div className="flex gap-2 text-sm text-gray-400">
              <span>{game.platforms?.join(', ')}</span>
              <span>•</span>
              <span>{(game.downloads || 0).toLocaleString()} downloads</span>
            </div>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDelete(true)}
                className="text-white/60 hover:text-red-500"
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            )}
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
          <div className="mb-5 space-y-3">
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Categories</h3>
              <div className="flex flex-wrap gap-1.5">
                {game.categories?.map((cat) => (
                  <span key={cat} className="bg-[#2D221C] border border-[#3D322C] px-2.5 py-1 rounded-full text-xs">
                    {cat}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Platforms</h3>
              <div className="flex flex-wrap gap-1.5">
                {game.platforms?.map((plat) => (
                  <span key={plat} className="bg-[#2D221C] border border-[#3D322C] px-2.5 py-1 rounded-full text-xs">
                    {plat}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
            Players with this game ({users.length})
          </h3>

          <ScrollArea className="max-h-[40vh]">
            <div className="space-y-2">
              {users.length > 0 ? (
                users.map((u) => (
                  <div key={u.id} className="p-3 rounded-lg bg-[#1A1A1A] border border-[#2D221C] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 border border-[#eb0028]/40">
                        <AvatarImage src={u.profilePicture || undefined} />
                        <AvatarFallback>{u.username[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-sm">{u.username}</div>
                        <div className="text-xs text-gray-400">{u.region} • {u.language}</div>
                      </div>
                    </div>
                    {currentUser?.id !== u.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          onClose();
                          onChatClick(u);
                        }}
                        className="text-[#EC1146] hover:bg-[#EC1146]/20"
                      >
                        <MessageCircle className="h-5 w-5" />
                      </Button>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-gray-400 text-sm">
                  No active players found for this game.
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent className="bg-[#1A1A1A] border border-red-600 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Game</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-300">
              Are you sure you want to permanently delete "{game.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-gray-600 text-white hover:bg-gray-800">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
