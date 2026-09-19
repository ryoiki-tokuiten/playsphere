import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { setStoredUser } from '@/lib/auth-utils';
import { Card, CardContent } from '@/components/ui/card';
import { ProfileForm, ProfileFormData } from '@/components/ProfileForm';

export default function SetupPage() {
  const { toast } = useToast();
  const [initialData, setInitialData] = useState<Partial<ProfileFormData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const u = params.get('username');
    const p = params.get('password');

    const pendingAuth = localStorage.getItem('pendingAuth');
    if (pendingAuth) {
      try {
        const parsed = JSON.parse(pendingAuth);
        setInitialData({
          username: parsed.username || '',
          password: parsed.password || '',
        });
        return;
      } catch (e) {}
    }

    if (u || p) {
      setInitialData({
        username: u || '',
        password: p || '',
      });
    }
  }, []);

  const handleSubmit = async (formData: ProfileFormData) => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || 'Failed to create account');
      }

      setStoredUser(result.user || result);
      localStorage.removeItem('pendingAuth');
      window.location.href = '/';
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to create account',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] py-8 px-4 flex justify-center items-center">
      <Card className="w-full max-w-4xl bg-[#0f0f0f] border-[#2D221C] text-white">
        <CardContent className="p-6 md:p-8">
          <h1 className="text-2xl md:text-3xl font-bold mb-2 text-center text-white">Complete Your Profile</h1>
          <p className="text-gray-400 text-center mb-8 text-sm">
            Set up your gamer card and let the community know what you play.
          </p>

          <ProfileForm
            initialData={initialData}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            submitLabel="Complete Setup"
          />
        </CardContent>
      </Card>
    </div>
  );
}
