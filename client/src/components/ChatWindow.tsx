import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useWebSocket } from '@/hooks/use-websocket';
import { Message, User } from '@shared/schema';
import { useQuery } from '@tanstack/react-query';
import { X, Image as ImageIcon, CheckCheck, Minimize2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ImageUpload } from './ImageUpload';
import { AnimatePresence, motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { getStoredUser } from '@/lib/auth-utils';

interface ChatWindowProps {
  currentUser?: User | null;
  otherUser: User;
  onClose: () => void;
  isMinimized?: boolean;
  onMinimize?: () => void;
}

function formatLastActive(lastActive: Date | string | null): string {
  if (!lastActive) return 'Offline';
  const diffInMinutes = Math.floor((Date.now() - new Date(lastActive).getTime()) / (1000 * 60));
  if (diffInMinutes < 5) return 'Online';
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
  return `${Math.floor(diffInMinutes / 1440)}d ago`;
}

function formatTime(timestamp: string | Date): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ChatWindow({ currentUser, otherUser, onClose, isMinimized: externalMinimized, onMinimize }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [internalMinimized, setInternalMinimized] = useState(false);
  const isMinimized = externalMinimized !== undefined ? externalMinimized : internalMinimized;

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const currentId = Number(currentUser?.id || (currentUser as any)?.user?.id || getStoredUser()?.id || 0);
  const otherId = Number(otherUser?.id || 0);

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  const { data: historicalMessages } = useQuery<Message[]>({
    queryKey: [`/api/messages/${currentId}/${otherId}`],
    enabled: !!currentId && !!otherId && !isNaN(currentId) && !isNaN(otherId),
  });

  useEffect(() => {
    if (historicalMessages) {
      setMessages(historicalMessages);
      setTimeout(() => scrollToBottom(false), 50);
    }
  }, [historicalMessages, scrollToBottom]);

  const onMessage = useCallback((msg: Message) => {
    const msgFrom = Number(msg.fromUserId);
    const msgTo = Number(msg.toUserId);

    if (
      (msgFrom === otherId && msgTo === currentId) ||
      (msgFrom === currentId && msgTo === otherId)
    ) {
      setMessages(prev => {
        // Reconcile optimistic update
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
  }, [currentId, otherId, scrollToBottom]);

  const onTypingStatus = useCallback((userId: number, typing: boolean) => {
    if (Number(userId) === otherId) setIsTyping(typing);
  }, [otherId]);

  const { sendMessage, sendTypingStatus } = useWebSocket(currentId, onMessage, undefined, onTypingStatus);

  useEffect(() => {
    if (!isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
      scrollToBottom(false);
    }
  }, [isMinimized, scrollToBottom]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || !otherId || !currentId) return;

    // Optimistic update
    const tempMsg: Message = {
      id: Date.now(),
      fromUserId: currentId,
      toUserId: otherId,
      groupId: null,
      content: text,
      timestamp: new Date(),
      isRead: false,
      readAt: null,
      type: 'text',
    };
    setMessages(prev => [...prev, tempMsg]);
    setInput('');

    sendMessage(otherId, text);
    setTimeout(() => scrollToBottom(true), 50);
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    sendTypingStatus(otherId, true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      sendTypingStatus(otherId, false);
    }, 1200);
  };

  const isOnline = otherUser.lastActive && (Date.now() - new Date(otherUser.lastActive).getTime()) < 5 * 60 * 1000;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed bottom-4 right-4 z-50 w-80 max-w-[95vw]"
      >
        <Card className="bg-[#0f0f0f] border-[#2D221C] shadow-2xl overflow-hidden flex flex-col">
          {/* Header */}
          <CardHeader
            className="p-3 flex flex-row items-center justify-between border-b border-[#2D221C] cursor-pointer"
            onClick={() => onMinimize ? onMinimize() : setInternalMinimized(!internalMinimized)}
          >
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={otherUser.profilePicture || undefined} />
                <AvatarFallback className="bg-[#2D221C] text-white">
                  {otherUser.username ? otherUser.username.charAt(0).toUpperCase() : '?'}
                </AvatarFallback>
              </Avatar>
              <div>
                <h4 className="font-medium text-white text-sm leading-tight">{otherUser.username}</h4>
                <div className="text-[11px] text-gray-400 flex items-center gap-1">
                  <span className={cn("w-1.5 h-1.5 rounded-full", isOnline ? "bg-green-500" : "bg-gray-500")} />
                  <span>{formatLastActive(otherUser.lastActive)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-gray-400 hover:text-white"
                onClick={() => onMinimize ? onMinimize() : setInternalMinimized(!internalMinimized)}
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-gray-400 hover:text-white"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>

          {/* Body */}
          {!isMinimized && (
            <>
              <CardContent className="p-0 h-80 overflow-hidden">
                <ScrollArea className="h-full p-3">
                  <div className="space-y-3">
                    {messages.map((msg, i) => {
                      const isSender = Number(msg.fromUserId) === currentId;
                      const isImg = msg.content?.match(/^!\[image\]\((.*?)\)$/);

                      return (
                        <div key={msg.id || i} className={cn("flex flex-col", isSender ? "items-end" : "items-start")}>
                          <div
                            className={cn(
                              "p-2.5 rounded-xl max-w-[85%] text-sm break-words",
                              isSender ? "bg-[#EC1146] text-white rounded-br-none" : "bg-[#2D221C] text-white rounded-bl-none"
                            )}
                          >
                            {isImg ? (
                              <img src={isImg[1]} alt="Shared" className="rounded max-h-48 object-cover" />
                            ) : (
                              msg.content
                            )}
                          </div>
                          <span className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                            {formatTime(msg.timestamp)}
                            {isSender && <CheckCheck className="w-3 h-3 text-blue-400" />}
                          </span>
                        </div>
                      );
                    })}
                    {isTyping && (
                      <div className="text-xs text-gray-400 italic">
                        {otherUser.username} is typing...
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
              </CardContent>

              <CardFooter className="p-2 border-t border-[#2D221C] bg-[#0f0f0f] flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-400 hover:text-white"
                  onClick={() => setShowImageUpload(true)}
                >
                  <ImageIcon className="h-4 w-4" />
                </Button>
                <form
                  className="flex-1 flex gap-2"
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
                    className="h-8 bg-[#2D221C] border-none text-white text-xs placeholder:text-gray-500"
                  />
                  <Button type="submit" size="sm" className="h-8 bg-[#EC1146] hover:bg-[#eb0028] text-white text-xs px-3">
                    Send
                  </Button>
                </form>
              </CardFooter>
            </>
          )}
        </Card>

        <Dialog open={showImageUpload} onOpenChange={setShowImageUpload}>
          <DialogContent className="bg-[#0f0f0f] text-white border border-[#2D221C]">
            <DialogHeader>
              <DialogTitle>Send Image</DialogTitle>
            </DialogHeader>
            <ImageUpload
              onImageUploaded={url => {
                const imgContent = `![image](${url})`;
                const tempMsg: Message = {
                  id: Date.now(),
                  fromUserId: currentId,
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
                setShowImageUpload(false);
                setTimeout(() => scrollToBottom(true), 50);
              }}
            />
          </DialogContent>
        </Dialog>
      </motion.div>
    </AnimatePresence>
  );
}
