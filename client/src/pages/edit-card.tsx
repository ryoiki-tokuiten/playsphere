import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { getStoredUser, setStoredUser } from '@/lib/auth-utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ProfileForm, ProfileFormData } from '@/components/ProfileForm';
import { KeyRound } from 'lucide-react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

const passwordChangeSchema = z.object({
  oldPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

type PasswordChangeValues = z.infer<typeof passwordChangeSchema>;

export default function EditCard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);

  const currentUser = getStoredUser();
  const userId = currentUser?.id;

  const { data: userData, isLoading } = useQuery<User>({
    queryKey: ['user', userId],
    queryFn: async () => {
      if (!userId) throw new Error('Not logged in');
      const res = await fetch(`/api/users/${userId}`);
      if (!res.ok) throw new Error('Failed to load user');
      return res.json();
    },
    enabled: !!userId,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      if (!userId) throw new Error('User not found');
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to update profile');
      }
      return res.json();
    },
    onSuccess: (updated) => {
      setStoredUser(updated);
      queryClient.invalidateQueries({ queryKey: ['user', userId] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({
        title: 'Profile Updated',
        description: 'Your gamer card has been successfully updated.',
      });
      setLocation('/');
    },
    onError: (err: any) => {
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const passwordForm = useForm<PasswordChangeValues>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: { oldPassword: '', newPassword: '' },
  });

  const passwordMutation = useMutation({
    mutationFn: async (vals: PasswordChangeValues) => {
      const res = await fetch(`/api/users/${userId}/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vals),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to change password');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Password Updated',
        description: 'Your password was changed successfully.',
      });
      setPasswordDialogOpen(false);
      passwordForm.reset();
    },
    onError: (err: any) => {
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center text-white">
        Loading profile...
      </div>
    );
  }

  const initialData: Partial<ProfileFormData> = {
    username: userData?.username,
    language: userData?.language,
    region: userData?.region,
    profilePicture: userData?.profilePicture || '',
    gamesPlayed: (userData?.gamesPlayed as string[]) || [],
    currentGame: userData?.currentGame,
    currentGameId: userData?.currentGameId,
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] py-8 px-4 flex justify-center items-center">
      <Card className="w-full max-w-4xl bg-[#0f0f0f] border-[#2D221C] text-white">
        <CardContent className="p-6 md:p-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl md:text-3xl font-bold text-white">Edit Your Gamer Card</h1>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPasswordDialogOpen(true)}
              className="border-[#2D221C] bg-[#1a1a1a] hover:bg-[#252525] text-white flex items-center gap-2"
            >
              <KeyRound className="w-4 h-4 text-[#eb0028]" />
              Change Password
            </Button>
          </div>

          <ProfileForm
            initialData={initialData}
            onSubmit={(data) => updateMutation.mutate(data)}
            isSubmitting={updateMutation.isPending}
            submitLabel="Update Profile"
            isEditMode={true}
            onCancel={() => setLocation('/')}
          />
        </CardContent>
      </Card>

      {/* Password Change Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="bg-[#0f0f0f] text-white border border-[#2D221C]">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription className="text-gray-400">
              Enter your current password and choose a new one.
            </DialogDescription>
          </DialogHeader>

          <Form {...passwordForm}>
            <form
              onSubmit={passwordForm.handleSubmit((vals) => passwordMutation.mutate(vals))}
              className="space-y-4 pt-2"
            >
              <FormField
                control={passwordForm.control}
                name="oldPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Current password"
                        {...field}
                        className="bg-[#1a1a1a] border-[#2D221C] text-white"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={passwordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="New password (min 6 chars)"
                        {...field}
                        className="bg-[#1a1a1a] border-[#2D221C] text-white"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setPasswordDialogOpen(false)}
                  className="text-gray-400 hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={passwordMutation.isPending}
                  className="bg-[#eb0028] hover:bg-[#eb0028]/90 text-white"
                >
                  {passwordMutation.isPending ? 'Updating...' : 'Save Password'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
