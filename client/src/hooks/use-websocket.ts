import { useEffect, useRef, useState, useCallback } from 'react';
import { Message } from '@shared/schema';

export interface GroupMessage extends Omit<Message, 'toUserId'> {
  type: 'groupMessage';
  groupId: number;
}

export function useWebSocket(
  userId: number,
  onMessage?: (msg: Message) => void,
  onGroupMessage?: (msg: GroupMessage) => void,
  onTypingStatus?: (fromUserId: number, isTyping: boolean) => void,
  onGroupTypingStatus?: (fromUserId: number, groupId: number, isTyping: boolean) => void
) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const queueRef = useRef<any[]>([]);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Store latest callbacks in refs so we NEVER reconnect when callbacks change
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const onGroupMessageRef = useRef(onGroupMessage);
  onGroupMessageRef.current = onGroupMessage;
  const onTypingStatusRef = useRef(onTypingStatus);
  onTypingStatusRef.current = onTypingStatus;
  const onGroupTypingStatusRef = useRef(onGroupTypingStatus);
  onGroupTypingStatusRef.current = onGroupTypingStatus;

  const connect = useCallback(() => {
    const validUserId = Number(userId);
    if (!validUserId || isNaN(validUserId)) return;

    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        // Identify ourselves immediately to the server
        ws.send(JSON.stringify({ type: 'identify', fromUserId: validUserId }));

        // Drain any pending queue
        while (queueRef.current.length > 0) {
          const item = queueRef.current.shift();
          try {
            ws.send(JSON.stringify(item));
          } catch (e) {
            console.error('Failed to send queued item', e);
          }
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'typing') {
            onTypingStatusRef.current?.(data.fromUserId, data.isTyping);
          } else if (data.type === 'groupTyping') {
            onGroupTypingStatusRef.current?.(data.fromUserId, data.groupId, data.isTyping);
          } else if (data.type === 'groupMessage') {
            onGroupMessageRef.current?.(data as GroupMessage);
          } else if (data.type !== 'error') {
            onMessageRef.current?.(data as Message);
          }
        } catch (err) {
          console.error('WebSocket parse error:', err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(connect, 2000);
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        try { ws.close(); } catch {}
      };
    } catch (err) {
      console.error('WebSocket connection initialization error:', err);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(connect, 2000);
    }
  }, [userId]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const send = (payload: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
      return true;
    } else {
      queueRef.current.push(payload);
      // REST fallback if WebSocket is offline or queueing
      if (payload.type === 'message' || payload.type === 'groupMessage') {
        fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch(() => {});
      }
      return false;
    }
  };

  const sendMessage = (toUserId: number, content: string) => {
    return send({
      type: 'message',
      fromUserId: Number(userId),
      toUserId: Number(toUserId),
      content,
    });
  };

  const sendGroupMessage = (groupId: number, content: string) => {
    return send({
      type: 'groupMessage',
      fromUserId: Number(userId),
      groupId: Number(groupId),
      content,
    });
  };

  const sendTypingStatus = (toUserId: number, isTyping: boolean) => {
    return send({
      type: 'typing',
      fromUserId: Number(userId),
      toUserId: Number(toUserId),
      isTyping,
    });
  };

  const sendGroupTypingStatus = (groupId: number, isTyping: boolean) => {
    return send({
      type: 'groupTyping',
      fromUserId: Number(userId),
      groupId: Number(groupId),
      isTyping,
    });
  };

  return {
    sendMessage,
    sendGroupMessage,
    sendTypingStatus,
    sendGroupTypingStatus,
    isConnected,
  };
}
