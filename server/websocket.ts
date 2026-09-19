import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { db } from './db';
import { messages, groupMembers } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

interface WSMessage {
  type: 'identify' | 'message' | 'groupMessage' | 'typing' | 'groupTyping';
  fromUserId?: number;
  toUserId?: number;
  groupId?: number;
  content?: string;
  isTyping?: boolean;
}

// Global registry of user connections (allows multiple tabs/windows per user)
export const clients = new Map<number, Set<WebSocket>>();

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    try {
      const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
      if (url.pathname === '/ws') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      }
    } catch (e) {
      // Ignore invalid URLs; let other upgrade listeners handle
    }
  });

  wss.on('connection', (ws) => {
    let currentUserId: number | undefined;

    ws.on('message', async (raw) => {
      try {
        const msg: WSMessage = JSON.parse(raw.toString());
        const fromUserId = Number(msg.fromUserId);

        if (fromUserId && !isNaN(fromUserId)) {
          currentUserId = fromUserId;
          if (!clients.has(fromUserId)) {
            clients.set(fromUserId, new Set());
          }
          clients.get(fromUserId)!.add(ws);
        }

        // 1. Direct Message
        if (msg.type === 'message' && msg.toUserId && msg.content && fromUserId) {
          const toUserId = Number(msg.toUserId);

          const [saved] = await db
            .insert(messages)
            .values({
              fromUserId,
              toUserId,
              groupId: null,
              content: msg.content,
              timestamp: new Date(),
              isRead: false,
              readAt: null,
              type: msg.content.startsWith('![image]') ? 'image' : 'text',
            })
            .returning();

          const payload = JSON.stringify(saved);

          // Send to all open sockets of recipient
          const recipientSockets = clients.get(toUserId);
          recipientSockets?.forEach(clientWs => {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(payload);
            }
          });

          // Send to all open sockets of sender (including confirmation)
          const senderSockets = clients.get(fromUserId);
          senderSockets?.forEach(clientWs => {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(payload);
            }
          });
        }

        // 2. Group Message
        else if (msg.type === 'groupMessage' && msg.groupId && msg.content && fromUserId) {
          const groupId = Number(msg.groupId);

          const [membership] = await db
            .select()
            .from(groupMembers)
            .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, fromUserId)));

          if (!membership) {
            ws.send(JSON.stringify({ type: 'error', message: 'Not a member of this group' }));
            return;
          }

          const [saved] = await db
            .insert(messages)
            .values({
              fromUserId,
              toUserId: null,
              groupId,
              content: msg.content,
              timestamp: new Date(),
              isRead: false,
              readAt: null,
              type: msg.content.startsWith('![image]') ? 'image' : 'text',
            })
            .returning();

          const members = await db
            .select({ userId: groupMembers.userId })
            .from(groupMembers)
            .where(eq(groupMembers.groupId, groupId));

          const payload = JSON.stringify({ ...saved, type: 'groupMessage' });
          for (const m of members) {
            const memberSockets = clients.get(Number(m.userId));
            memberSockets?.forEach(memberWs => {
              if (memberWs.readyState === WebSocket.OPEN) {
                memberWs.send(payload);
              }
            });
          }
        }

        // 3. Direct Typing Indicator
        else if (msg.type === 'typing' && msg.toUserId && fromUserId) {
          const toUserId = Number(msg.toUserId);
          const recipientSockets = clients.get(toUserId);
          if (recipientSockets) {
            const payload = JSON.stringify({
              type: 'typing',
              fromUserId,
              toUserId,
              isTyping: Boolean(msg.isTyping),
            });
            recipientSockets.forEach(clientWs => {
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(payload);
              }
            });
          }
        }

        // 4. Group Typing Indicator
        else if (msg.type === 'groupTyping' && msg.groupId && fromUserId) {
          const groupId = Number(msg.groupId);
          const members = await db
            .select({ userId: groupMembers.userId })
            .from(groupMembers)
            .where(eq(groupMembers.groupId, groupId));

          const payload = JSON.stringify({
            type: 'groupTyping',
            fromUserId,
            groupId,
            isTyping: Boolean(msg.isTyping),
          });

          for (const m of members) {
            if (m.userId !== fromUserId) {
              const memberSockets = clients.get(Number(m.userId));
              memberSockets?.forEach(memberWs => {
                if (memberWs.readyState === WebSocket.OPEN) {
                  memberWs.send(payload);
                }
              });
            }
          }
        }
      } catch (err) {
        console.error('WebSocket error:', err);
      }
    });

    ws.on('close', () => {
      if (currentUserId && clients.has(currentUserId)) {
        const userSockets = clients.get(currentUserId)!;
        userSockets.delete(ws);
        if (userSockets.size === 0) {
          clients.delete(currentUserId);
        }
      }
    });
  });
}
