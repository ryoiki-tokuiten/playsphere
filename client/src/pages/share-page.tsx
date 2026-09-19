import { useQuery } from '@tanstack/react-query';
import { useParams } from 'wouter';
import { GamingCard } from '@/components/GamingCard';
import { User } from '@shared/schema';

export default function SharePage() {
  const { username } = useParams<{ username: string }>();

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  const sharedUser = users.find(u => u.username === username);

  if (!sharedUser) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center text-white p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Gamer Card Not Found</h1>
          <p className="text-gray-400">This gamer card does not exist or has been removed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] p-4 flex items-center justify-center">
      <GamingCard user={sharedUser} />
    </div>
  );
}
