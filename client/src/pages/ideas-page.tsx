import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/use-auth';
import { getIdeas, createIdea, voteForIdea, deleteIdea, IdeaItem, IdeasResponse } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Plus, ChevronDown, ChevronUp, ThumbsUp, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Game } from '@shared/schema';

export default function IdeasPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [selectedGameName, setSelectedGameName] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [expandedIdeas, setExpandedIdeas] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const [gameSearch, setGameSearch] = useState('');

  const queryClient = useQueryClient();
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  const { data: games = [] } = useQuery<Game[]>({
    queryKey: ['games'],
    queryFn: async () => {
      const res = await fetch('/api/games');
      if (!res.ok) throw new Error('Failed to fetch games');
      return res.json();
    },
  });

  const { data: ideasData, isLoading } = useQuery({
    queryKey: ['ideas', page],
    queryFn: () => getIdeas(page, 15),
  });

  const createMutation = useMutation({
    mutationFn: createIdea,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ideas'] });
      setIsDialogOpen(false);
      setSelectedGameId(null);
      setSelectedGameName('');
      setTitle('');
      setDescription('');
      toast({ title: 'Success', description: 'Feature request submitted!' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create idea', variant: 'destructive' });
    },
  });

  const voteMutation = useMutation({
    mutationFn: voteForIdea,
    onMutate: async (ideaId: number) => {
      await queryClient.cancelQueries({ queryKey: ['ideas', page] });
      const previousData = queryClient.getQueryData<IdeasResponse>(['ideas', page]);
      if (previousData) {
        queryClient.setQueryData<IdeasResponse>(['ideas', page], {
          ...previousData,
          ideas: previousData.ideas.map(i => {
            if (i.id === ideaId) {
              const newHasVoted = !i.hasVoted;
              return {
                ...i,
                hasVoted: newHasVoted,
                votes: newHasVoted ? i.votes + 1 : Math.max(0, i.votes - 1),
              };
            }
            return i;
          }),
        });
      }
      return { previousData };
    },
    onError: (_err, _ideaId, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['ideas', page], context.previousData);
      }
      toast({ title: 'Error', description: 'Failed to submit vote', variant: 'destructive' });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['ideas'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteIdea,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ideas'] });
      toast({ title: 'Deleted', description: 'Feature request removed' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete idea', variant: 'destructive' });
    },
  });

  const toggleExpand = (id: number) => {
    setExpandedIdeas(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const filteredGames = games.filter(g =>
    g.name.toLowerCase().includes(gameSearch.toLowerCase())
  );

  const handleSubmit = () => {
    if (!selectedGameId || !title.trim() || !description.trim()) {
      toast({ title: 'Missing fields', description: 'Please fill out all fields', variant: 'destructive' });
      return;
    }
    createMutation.mutate({
      gameId: selectedGameId,
      title: title.trim(),
      description: description.trim(),
    });
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white pl-16">
      <div className="max-w-4xl mx-auto p-4 py-8">
        <Card className="bg-[#141414] border-[#2D221C] text-white p-6 mb-8">
          <p className="text-base md:text-lg leading-relaxed text-gray-300">
            Ever thought, <span className="text-white italic">'This game would be perfect with just one more thing?'</span>{' '}
            Maybe a new game mode, extra lore, or character balance? Share your ideas directly with game developers. If your suggestion gets 100+ votes, we'll forward it to the dev team!
          </p>
        </Card>

        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Community Feature Requests</h1>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#eb0028] hover:bg-[#eb0028]/90 text-white flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Request a Feature
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#0f0f0f] text-white border border-[#2D221C]">
              <DialogHeader>
                <DialogTitle>New Feature Request</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Game Name</label>
                  <Select
                    value={selectedGameId?.toString() || ''}
                    onValueChange={val => {
                      const g = games.find(x => x.id === parseInt(val));
                      if (g) {
                        setSelectedGameId(g.id);
                        setSelectedGameName(g.name);
                      }
                    }}
                  >
                    <SelectTrigger className="w-full bg-[#1a1a1a] border-[#2D221C] text-white">
                      <SelectValue placeholder={selectedGameName || "Select a game"} />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1a1a] border-[#2D221C] text-white max-h-60">
                      <div className="p-2">
                        <Input
                          placeholder="Search game..."
                          value={gameSearch}
                          onChange={e => setGameSearch(e.target.value)}
                          className="h-8 bg-[#0f0f0f] border-none text-xs text-white"
                        />
                      </div>
                      <ScrollArea className="h-48">
                        {filteredGames.map(game => (
                          <SelectItem key={game.id} value={game.id.toString()}>
                            {game.name}
                          </SelectItem>
                        ))}
                      </ScrollArea>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Request Title</label>
                  <Input
                    placeholder="Short summary of your request"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="bg-[#1a1a1a] border-[#2D221C] text-white"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Describe Your Suggestion</label>
                  <Textarea
                    placeholder="Explain what should be added or changed, and why..."
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    className="h-32 bg-[#1a1a1a] border-[#2D221C] text-white"
                  />
                </div>

                <Button
                  onClick={handleSubmit}
                  disabled={createMutation.isPending}
                  className="w-full bg-[#eb0028] hover:bg-[#eb0028]/90 text-white"
                >
                  {createMutation.isPending ? 'Submitting...' : 'Submit Request'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-gray-400">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#eb0028] mb-2" />
            <p>Loading feature requests...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {ideasData?.ideas.map((idea: IdeaItem) => {
              const isExpanded = expandedIdeas.includes(idea.id);

              return (
                <Card key={idea.id} className="bg-[#141414] border-[#2D221C] text-white p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs bg-[#2D221C] text-[#eb0028] px-2 py-0.5 rounded font-medium">
                          {idea.gameName}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-white leading-snug">{idea.title}</h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => voteMutation.mutate(idea.id)}
                        className={`border-[#2D221C] flex items-center gap-1.5 ${
                          idea.hasVoted ? 'bg-[#eb0028] text-white hover:bg-[#eb0028]/90' : 'bg-[#1a1a1a] text-gray-300 hover:bg-[#252525]'
                        }`}
                      >
                        <ThumbsUp className="h-4 w-4" />
                        <span>{idea.votes}</span>
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleExpand(idea.id)}
                        className="text-gray-400 hover:text-white h-8 w-8"
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>

                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(idea.id)}
                          className="text-gray-400 hover:text-red-500 h-8 w-8"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-[#2D221C] text-gray-300 text-sm space-y-3">
                      <p className="whitespace-pre-line leading-relaxed">{idea.description}</p>
                      <div className="flex items-center justify-between text-xs text-gray-500 pt-2">
                        <span>Submitted by <strong className="text-gray-400">{idea.creatorUsername}</strong></span>
                        <span>{new Date(idea.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}

            {ideasData && ideasData.totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-8 pb-12">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  className="bg-[#141414] border-[#2D221C] text-white"
                >
                  Previous
                </Button>
                <div className="flex items-center px-2 text-xs text-gray-400">
                  Page {page} of {ideasData.totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === ideasData.totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="bg-[#141414] border-[#2D221C] text-white"
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
