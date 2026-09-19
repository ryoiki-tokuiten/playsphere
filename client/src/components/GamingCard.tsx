import React, { useState } from 'react';
import { User } from '@shared/schema';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Copy, MessageCircle, Share2, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ShareModal } from './ShareModal';
import { useAuth } from '@/hooks/use-auth';
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

interface GamingCardProps {
  user: User;
  onChatClick?: () => void;
  onCardClick?: () => void;
  isEditable?: boolean;
  onUserDeleted?: () => void;
}

function isUserActive(lastActive: Date | string): boolean {
  const fiveMinAgo = Date.now() - 5 * 60 * 1000;
  return new Date(lastActive).getTime() > fiveMinAgo;
}

export function GamingCard({
  user,
  onChatClick,
  onCardClick,
  isEditable = false,
  onUserDeleted,
}: GamingCardProps) {
  const { toast } = useToast();
  const { user: currentUser, isAdmin } = useAuth();
  const [showShare, setShowShare] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();

  const copyGameId = () => {
    navigator.clipboard.writeText(user.currentGameId || '');
    toast({
      title: "Copied!",
      description: "Game ID copied to clipboard",
    });
  };

  const handleDeleteUser = async () => {
    if (!currentUser || !isAdmin) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id }),
      });
      if (!res.ok) throw new Error('Failed to delete user');

      toast({ title: 'User Deleted', description: `User "${user.username}" has been removed.` });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      onUserDeleted?.();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
      setShowDelete(false);
    }
  };

  const isActive = isUserActive(user.lastActive);
  const bgColor = isActive ? '#07412382' : '#250d11';
  const initial = user.username ? user.username[0].toUpperCase() : '?';

  return (
    <>
      <Card
        className="w-full text-white cursor-pointer hover:opacity-95 transition-all duration-200 border border-[#eb0028] shadow-lg"
        style={{ backgroundColor: bgColor }}
        onClick={(e) => {
          if (!(e.target as HTMLElement).closest('button')) {
            onCardClick?.();
          }
        }}
      >
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar className="h-14 w-14 border border-white/20">
                <AvatarImage src={user.profilePicture || undefined} alt={user.username} />
                <AvatarFallback>{initial}</AvatarFallback>
              </Avatar>
              <span
                className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-[#0f0f0f] ${
                  isActive ? 'bg-emerald-500' : 'bg-gray-500'
                }`}
              />
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-white truncate">{user.username}</h3>
              <div className="flex gap-2 text-sm text-white/70 truncate">
                <span>{user.language}</span>
                <span>•</span>
                <span>{user.region}</span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {isAdmin && currentUser?.id !== user.id && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDelete(true);
                  }}
                  className="text-white hover:bg-red-800/30"
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              )}

              {!isEditable && onChatClick && currentUser?.id !== user.id && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChatClick();
                  }}
                  className="text-white hover:text-white/90 hover:bg-white/10"
                >
                  <MessageCircle className="h-5 w-5" />
                </Button>
              )}

              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowShare(true);
                }}
                className="text-white hover:text-white/90 hover:bg-white/10"
              >
                <Share2 className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <div className="mt-4 p-3 rounded-lg bg-black/30 border border-[#eb0028]/60">
            <div className="text-xs text-white/70">Currently Playing</div>
            <div className="mt-1 flex justify-between items-center">
              <span className="font-semibold text-white truncate pr-2">{user.currentGame}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  copyGameId();
                }}
                className="text-white hover:text-white/90 hover:bg-white/10 text-xs h-7 px-2"
              >
                <Copy className="h-3.5 w-3.5 mr-1" />
                <span>ID</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <ShareModal
        username={user.username}
        open={showShare}
        onClose={() => setShowShare(false)}
      />

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent className="bg-[#1A1A1A] border border-red-600 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-300">
              Are you sure you want to delete user "{user.username}"? This permanently removes their account and data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-gray-600 text-white hover:bg-gray-800">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
