import { apiRequest } from './queryClient';
import { getStoredUser } from './auth-utils';

export interface IdeaItem {
  id: number;
  gameId: number;
  gameName: string;
  gameContact: string | null;
  title: string;
  description: string;
  votes: number;
  hasVoted: boolean;
  creatorUsername: string;
  createdAt: string;
}

export interface IdeasResponse {
  ideas: IdeaItem[];
  total: number;
  page: number;
  totalPages: number;
}

export async function getIdeas(page = 1, limit = 10): Promise<IdeasResponse> {
  const user = getStoredUser();
  const userIdParam = user?.id ? `&userId=${user.id}` : '';
  return apiRequest(`/api/ideas?page=${page}&limit=${limit}${userIdParam}`);
}

export async function createIdea(data: { gameId: number; title: string; description: string }): Promise<IdeaItem> {
  const user = getStoredUser();
  return apiRequest({
    url: '/api/ideas',
    method: 'POST',
    body: { ...data, userId: user?.id },
  });
}

export async function voteForIdea(ideaId: number): Promise<IdeaItem> {
  const user = getStoredUser();
  return apiRequest({
    url: `/api/ideas/${ideaId}/vote`,
    method: 'POST',
    body: { userId: user?.id },
  });
}

export async function deleteIdea(id: number): Promise<{ message: string }> {
  const user = getStoredUser();
  return apiRequest({
    url: `/api/ideas/${id}`,
    method: 'DELETE',
    body: { userId: user?.id },
  });
}
