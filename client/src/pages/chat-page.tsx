import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { User, Message, Group } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useWebSocket, type GroupMessage } from '@/hooks/use-websocket';
import {
  MessageCircle,
  Search,
  Users,
  Image as ImageIcon,
  Plus,
  Trash2,
  MoreVertical,
  LogOut,
  Send,
  CheckCheck,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ImageUpload } from '@/components/ImageUpload';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { getStoredUser } from '@/lib/auth-utils';
import { cn } from '@/lib/utils';

type ActiveChat =
  | { type: 'direct'; user: User }
  | { type: 'group'; group: Group };

function formatMessageTime(timestamp: string | Date): string {
  const date = new Date(timestamp);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (isYesterday) {
    return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export default function ChatPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const currentUser = getStoredUser();
  const currentUserId = Number(currentUser?.id || 0);

  const [activeTab, setActiveTab] = useState<'direct' | 'groups'>('direct');
  const [selectedChat, setSelectedChat] = useState<ActiveChat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<number[]>([]);

  // Modals
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);

  const [groupMembersOpen, setGroupMembersOpen] = useState(false);
  const [groupDetails, setGroupDetails] = useState<{ group: Group; members: User[] } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  // Fetch users & groups
  const { data: users = [] } = useQuery<User[]>({ queryKey: ['/api/users'] });
  const { data: groups = [] } = useQuery<Group[]>({
    queryKey: [`/api/users/${currentUserId}/groups`],
    enabled: !!currentUserId,
  });

  // Handle incoming WebSocket messages
  const onDirectMessage = useCallback((msg: Message) => {
    if (selectedChat?.type === 'direct' && currentUserId) {
      const msgFrom = Number(msg.fromUserId);
      const msgTo = Number(msg.toUserId);
      const otherId = Number(selectedChat.user.id);

      if (
        (msgFrom === otherId && msgTo === currentUserId) ||
        (msgFrom === currentUserId && msgTo === otherId)
      ) {
        setMessages(prev => {
          const idx = prev.findIndex(m =>
            m.id === msg.id ||
            (m.content === msg.content &&
              Number(m.fromUserId) === msgFrom &&
              Number(m.toUserId) === msgTo &&
              Math.abs(new Date(m.timestamp).getTime() - new Date(msg.timestamp).getTime()) < 10000)
          );

          if (idx !== -1) {
            const updated = [...prev];
            updated[idx] = msg;
            return updated;
          }
          return [...prev, msg];
        });

        if (msgFrom === otherId) setIsTyping(false);
        setTimeout(() => scrollToBottom(true), 50);
      }
    }
  }, [selectedChat, currentUserId, scrollToBottom]);

  const onGroupMessage = useCallback((msg: GroupMessage) => {
    if (selectedChat?.type === 'group' && Number(msg.groupId) === Number(selectedChat.group.id)) {
      setMessages(prev => {
        const idx = prev.findIndex(m =>
          m.id === msg.id ||
          (m.content === msg.content &&
            Number(m.fromUserId) === Number(msg.fromUserId) &&
            Math.abs(new Date(m.timestamp).getTime() - new Date(msg.timestamp).getTime()) < 10000)
        );

        if (idx !== -1) {
          const updated = [...prev];
          updated[idx] = msg as unknown as Message;
          return updated;
        }
        return [...prev, msg as unknown as Message];
      });
      setTimeout(() => scrollToBottom(true), 50);
    }
  }, [selectedChat, scrollToBottom]);

  const onTypingStatus = useCallback((fromUserId: number, typing: boolean) => {
    if (selectedChat?.type === 'direct' && Number(selectedChat.user.id) === Number(fromUserId)) {
      setIsTyping(typing);
    }
  }, [selectedChat]);

  const onGroupTypingStatus = useCallback((fromUserId: number, groupId: number, typing: boolean) => {
    if (selectedChat?.type === 'group' && Number(selectedChat.group.id) === Number(groupId)) {
      const numFrom = Number(fromUserId);
      if (numFrom !== currentUserId) {
        setTypingUsers(prev => (typing ? (prev.includes(numFrom) ? prev : [...prev, numFrom]) : prev.filter(id => id !== numFrom)));
      }
    }
  }, [selectedChat, currentUserId]);

  const { sendMessage, sendGroupMessage, sendTypingStatus, sendGroupTypingStatus } = useWebSocket(
    currentUserId,
    onDirectMessage,
    onGroupMessage,
    onTypingStatus,
    onGroupTypingStatus
  );

  // Load message history on chat switch
  useEffect(() => {
    if (!selectedChat || !currentUserId) return;

    if (selectedChat.type === 'direct') {
      fetch(`/api/messages/${currentUserId}/${selectedChat.user.id}`)
        .then(r => r.json())
        .then(data => {
          setMessages(Array.isArray(data) ? data : []);
          setTimeout(() => scrollToBottom(false), 50);
        })
        .catch(() => setMessages([]));
    } else {
      fetch(`/api/groups/${selectedChat.group.id}/messages?userId=${currentUserId}`)
        .then(r => r.json())
        .then(data => {
          setMessages(Array.isArray(data) ? data : []);
          setTimeout(() => scrollToBottom(false), 50);
        })
        .catch(() => setMessages([]));

      fetch(`/api/groups/${selectedChat.group.id}/members`)
        .then(r => r.json())
        .then(members => setGroupDetails({ group: selectedChat.group, members: Array.isArray(members) ? members : [] }))
        .catch(() => {});
    }

    setTimeout(() => inputRef.current?.focus(), 100);
  }, [selectedChat, currentUserId, scrollToBottom]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || !selectedChat || !currentUserId) return;

    if (selectedChat.type === 'direct') {
      const otherId = Number(selectedChat.user.id);
      const tempMsg: Message = {
        id: Date.now(),
        fromUserId: currentUserId,
        toUserId: otherId,
        groupId: null,
        content: text,
        timestamp: new Date(),
        isRead: false,
        readAt: null,
        type: text.startsWith('![image]') ? 'image' : 'text',
      };
      setMessages(prev => [...prev, tempMsg]);
      sendMessage(otherId, text);
    } else {
      const grpId = Number(selectedChat.group.id);
      const tempMsg: Message = {
        id: Date.now(),
        fromUserId: currentUserId,
        toUserId: null,
        groupId: grpId,
        content: text,
        timestamp: new Date(),
        isRead: false,
        readAt: null,
        type: text.startsWith('![image]') ? 'image' : 'text',
      };
      setMessages(prev => [...prev, tempMsg]);
      sendGroupMessage(grpId, text);
    }

    setInput('');
    setTimeout(() => scrollToBottom(true), 50);
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    if (!selectedChat || !currentUserId) return;

    if (selectedChat.type === 'direct') {
      const otherId = Number(selectedChat.user.id);
      sendTypingStatus(otherId, true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => sendTypingStatus(otherId, false), 1200);
    } else {
      const grpId = Number(selectedChat.group.id);
      sendGroupTypingStatus(grpId, true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => sendGroupTypingStatus(grpId, false), 1200);
    }
  };

  const handleImageUploaded = (url: string) => {
    if (!selectedChat || !currentUserId) return;
    const imgContent = `![image](${url})`;

    if (selectedChat.type === 'direct') {
      const otherId = Number(selectedChat.user.id);
      const tempMsg: Message = {
        id: Date.now(),
        fromUserId: currentUserId,
        toUserId: otherId,
        groupId: null,
        content: imgContent,
        timestamp: new Date(),
        isRead: false,
        readAt: null,
        type: 'image',
      };
      setMessages(prev => [...prev, tempMsg]);
      sendMessage(otherId, imgContent);
    } else {
      const grpId = Number(selectedChat.group.id);
      const tempMsg: Message = {
        id: Date.now(),
        fromUserId: currentUserId,
        toUserId: null,
        groupId: grpId,
        content: imgContent,
        timestamp: new Date(),
        isRead: false,
        readAt: null,
        type: 'image',
      };
      setMessages(prev => [...prev, tempMsg]);
      sendGroupMessage(grpId, imgContent);
    }
    setShowImageUpload(false);
    setTimeout(() => scrollToBottom(true), 50);
  };

  const handleDeleteMessage = async (msgId: number) => {
    try {
      const res = await fetch(`/api/messages/${msgId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId }),
      });
      if (res.ok) {
        setMessages(prev => prev.filter(m => m.id !== msgId));
        toast({ title: 'Deleted', description: 'Message deleted successfully' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to delete message', variant: 'destructive' });
    }
  };

  const handleClearHistory = async (otherUserId: number) => {
    try {
      const res = await fetch(`/api/messages/history/${otherUserId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId }),
      });
      if (res.ok) {
        setMessages([]);
        toast({ title: 'Cleared', description: 'Conversation cleared' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to clear conversation', variant: 'destructive' });
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || !currentUserId) return;
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newGroupName.trim(),
          description: newGroupDesc.trim(),
          ownerId: currentUserId,
          members: selectedMembers,
        }),
      });
      if (!res.ok) throw new Error('Failed to create group');
      const group = await res.json();
      toast({ title: 'Success', description: `Group "${group.name}" created` });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${currentUserId}/groups`] });
      setCreateGroupOpen(false);
      setNewGroupName('');
      setNewGroupDesc('');
      setSelectedMembers([]);
      setSelectedChat({ type: 'group', group });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleLeaveGroup = async (groupId: number) => {
    try {
      await fetch(`/api/groups/${groupId}/members/${currentUserId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentUserId }),
      });
      setSelectedChat(null);
      queryClient.invalidateQueries({ queryKey: [`/api/users/${currentUserId}/groups`] });
      toast({ title: 'Left group', description: 'You have left the group' });
    } catch (err) {}
  };

  const filteredUsers = users.filter(
    u => Number(u.id) !== currentUserId && u.username.toLowerCase().includes(search.toLowerCase())
  );
  const filteredGroups = groups.filter(g => g.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex h-screen bg-[#0f0f0f] text-white pl-16">
      {/* Sidebar */}
      <div className="w-80 border-r border-[#2D221C] flex flex-col bg-[#141414]">
        <div className="p-4 border-b border-[#2D221C]">
          <div className="flex justify-between items-center mb-3">
            <h1 className="text-xl font-bold">Messages</h1>
            {activeTab === 'groups' && (
              <Button
                size="sm"
                onClick={() => setCreateGroupOpen(true)}
                className="bg-[#eb0028] hover:bg-[#eb0028]/90 text-white h-7 px-2 text-xs flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> New Group
              </Button>
            )}
          </div>

          <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)} className="w-full mb-3">
            <TabsList className="grid grid-cols-2 bg-[#1e1e1e]">
              <TabsTrigger value="direct" className="text-xs">Direct</TabsTrigger>
              <TabsTrigger value="groups" className="text-xs">Groups</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-500" />
            <Input
              placeholder={`Search ${activeTab === 'direct' ? 'players' : 'groups'}...`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-8 pl-8 bg-[#1e1e1e] border-none text-xs text-white placeholder:text-gray-500"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {activeTab === 'direct' ? (
              filteredUsers.map(user => {
                const isSelected = selectedChat?.type === 'direct' && Number(selectedChat.user.id) === Number(user.id);
                const isOnline = user.lastActive && Date.now() - new Date(user.lastActive).getTime() < 300000;

                return (
                  <div
                    key={user.id}
                    onClick={() => setSelectedChat({ type: 'direct', user })}
                    className={cn(
                      "flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors",
                      isSelected ? "bg-[#2D221C]" : "hover:bg-[#1a1a1a]"
                    )}
                  >
                    <div className="relative">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.profilePicture || undefined} />
                        <AvatarFallback className="bg-[#2D221C] text-white">
                          {user.username[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span
                        className={cn(
                          "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-[#141414]",
                          isOnline ? "bg-green-500" : "bg-gray-500"
                        )}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate text-white">{user.username}</div>
                      <div className="text-xs text-gray-400 truncate">
                        {user.currentGame || 'No game active'}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              filteredGroups.map(group => {
                const isSelected = selectedChat?.type === 'group' && Number(selectedChat.group.id) === Number(group.id);

                return (
                  <div
                    key={group.id}
                    onClick={() => setSelectedChat({ type: 'group', group })}
                    className={cn(
                      "flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors",
                      isSelected ? "bg-[#2D221C]" : "hover:bg-[#1a1a1a]"
                    )}
                  >
                    <div className="w-10 h-10 rounded-full bg-[#2D221C] flex items-center justify-center text-white font-bold">
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate text-white">{group.name}</div>
                      <div className="text-xs text-gray-400 truncate">Group chat</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Panel */}
      <div className="flex-1 flex flex-col bg-[#0f0f0f]">
        {selectedChat ? (
          <>
            {/* Header */}
            <div className="h-16 border-b border-[#2D221C] px-6 flex items-center justify-between bg-[#141414]">
              <div className="flex items-center gap-3">
                {selectedChat.type === 'direct' ? (
                  <>
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={selectedChat.user.profilePicture || undefined} />
                      <AvatarFallback className="bg-[#2D221C] text-white">
                        {selectedChat.user.username[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h2 className="font-semibold text-white leading-tight">{selectedChat.user.username}</h2>
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <span
                          className={cn(
                            "w-2 h-2 rounded-full",
                            selectedChat.user.lastActive && Date.now() - new Date(selectedChat.user.lastActive).getTime() < 300000
                              ? "bg-green-500"
                              : "bg-gray-500"
                          )}
                        />
                        <span>{selectedChat.user.currentGame || 'Playsphere Player'}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-full bg-[#2D221C] flex items-center justify-center">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-white leading-tight">{selectedChat.group.name}</h2>
                      <p className="text-xs text-gray-400">
                        {groupDetails?.members?.length || 1} members
                      </p>
                    </div>
                  </>
                )}
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-[#2D221C] text-white border-[#3D322C]">
                  {selectedChat.type === 'direct' ? (
                    <DropdownMenuItem
                      onClick={() => handleClearHistory(selectedChat.user.id)}
                      className="text-red-400 focus:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4 mr-2" /> Clear History
                    </DropdownMenuItem>
                  ) : (
                    <>
                      <DropdownMenuItem onClick={() => setGroupMembersOpen(true)} className="cursor-pointer">
                        <Users className="w-4 h-4 mr-2" /> View Members
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleLeaveGroup(selectedChat.group.id)} className="text-red-400 cursor-pointer">
                        <LogOut className="w-4 h-4 mr-2" /> Leave Group
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Message Area */}
            <ScrollArea className="flex-1 p-6">
              <div className="space-y-4">
                {messages.map((msg, i) => {
                  const isSender = Number(msg.fromUserId) === currentUserId;
                  const sender = users.find(u => Number(u.id) === Number(msg.fromUserId));
                  const isImg = msg.content?.match(/^!\[image\]\((.*?)\)$/);

                  return (
                    <div key={msg.id || i} className={cn("flex flex-col group", isSender ? "items-end" : "items-start")}>
                      {selectedChat.type === 'group' && !isSender && sender && (
                        <span className="text-[11px] text-gray-400 mb-1 ml-1 font-medium">{sender.username}</span>
                      )}
                      <div className="flex items-center gap-1.5 max-w-[85%]">
                        {isSender && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-white p-0"
                              >
                                <MoreVertical className="w-3.5 h-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="bg-[#2D221C] text-white border-[#3D322C] text-xs">
                              <DropdownMenuItem
                                onClick={() => handleDeleteMessage(msg.id)}
                                className="text-red-400 focus:text-red-400 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                        <div
                          className={cn(
                            "p-3 rounded-xl text-sm break-words leading-relaxed",
                            isSender ? "bg-[#EC1146] text-white rounded-br-none" : "bg-[#2D221C] text-white rounded-bl-none"
                          )}
                        >
                          {isImg ? (
                            <img src={isImg[1]} alt="Attached" className="rounded-lg max-h-64 object-cover" />
                          ) : (
                            msg.content
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                        {formatMessageTime(msg.timestamp)}
                        {isSender && <CheckCheck className="w-3 h-3 text-blue-400" />}
                      </span>
                    </div>
                  );
                })}

                {isTyping && selectedChat.type === 'direct' && (
                  <div className="flex items-center gap-2 text-gray-400 text-xs italic">
                    <div className="flex space-x-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span>{selectedChat.user.username} is typing...</span>
                  </div>
                )}
                {selectedChat.type === 'group' && typingUsers.length > 0 && (
                  <div className="flex items-center gap-2 text-gray-400 text-xs italic">
                    <div className="flex space-x-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" />
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span>Someone is typing...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input Bar */}
            <div className="p-4 border-t border-[#2D221C] bg-[#141414] flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="text-gray-400 hover:text-white"
                onClick={() => setShowImageUpload(true)}
              >
                <ImageIcon className="w-5 h-5" />
              </Button>

              <form
                className="flex-1 flex items-center gap-2"
                onSubmit={e => {
                  e.preventDefault();
                  handleSend();
                }}
              >
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={handleTyping}
                  placeholder="Type a message..."
                  className="bg-[#1e1e1e] border-none text-white text-sm"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!input.trim()}
                  className="bg-[#eb0028] hover:bg-[#eb0028]/90 text-white disabled:opacity-40"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 gap-3">
            <MessageCircle className="w-12 h-12 stroke-[1.5]" />
            <p className="text-sm">Select a chat or group to start messaging</p>
          </div>
        )}
      </div>

      {/* Image Upload Modal */}
      <Dialog open={showImageUpload} onOpenChange={setShowImageUpload}>
        <DialogContent className="bg-[#0f0f0f] text-white border border-[#2D221C]">
          <DialogHeader>
            <DialogTitle>Send Image</DialogTitle>
          </DialogHeader>
          <ImageUpload onImageUploaded={handleImageUploaded} />
        </DialogContent>
      </Dialog>

      {/* Create Group Modal */}
      <Dialog open={createGroupOpen} onOpenChange={setCreateGroupOpen}>
        <DialogContent className="bg-[#0f0f0f] text-white border border-[#2D221C]">
          <DialogHeader>
            <DialogTitle>Create Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Group Name</label>
              <Input
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                placeholder="e.g. Valorant Squad"
                className="bg-[#1e1e1e] border-[#2D221C] text-white"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Description</label>
              <Input
                value={newGroupDesc}
                onChange={e => setNewGroupDesc(e.target.value)}
                placeholder="What's this group for?"
                className="bg-[#1e1e1e] border-[#2D221C] text-white"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Add Members</label>
              <ScrollArea className="h-44 border border-[#2D221C] rounded-md p-2 bg-[#141414]">
                {filteredUsers.map(u => (
                  <div key={u.id} className="flex items-center space-x-2 py-1.5 px-1">
                    <Checkbox
                      id={`member-${u.id}`}
                      checked={selectedMembers.includes(u.id)}
                      onCheckedChange={checked => {
                        setSelectedMembers(prev =>
                          checked ? [...prev, u.id] : prev.filter(id => id !== u.id)
                        );
                      }}
                    />
                    <label htmlFor={`member-${u.id}`} className="text-sm cursor-pointer flex-1">
                      {u.username}
                    </label>
                  </div>
                ))}
              </ScrollArea>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateGroupOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateGroup} className="bg-[#eb0028] hover:bg-[#eb0028]/90 text-white">
              Create Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Group Members Modal */}
      <Dialog open={groupMembersOpen} onOpenChange={setGroupMembersOpen}>
        <DialogContent className="bg-[#0f0f0f] text-white border border-[#2D221C]">
          <DialogHeader>
            <DialogTitle>Group Members</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <ScrollArea className="h-60">
              <div className="space-y-2">
                {groupDetails?.members?.map(m => (
                  <div key={m.id} className="flex items-center justify-between p-2 rounded bg-[#1e1e1e]">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={m.profilePicture || undefined} />
                        <AvatarFallback className="bg-[#2D221C] text-white">
                          {m.username[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{m.username}</span>
                    </div>
                    {groupDetails.group.ownerId === m.id && (
                      <span className="text-[10px] bg-[#eb0028]/20 text-[#eb0028] px-2 py-0.5 rounded">
                        Owner
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
