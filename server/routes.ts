import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import passport from "passport";
import bcrypt from "bcrypt";
import path from "path";
import fs from "fs";
import multer from "multer";
import crypto from "crypto";
import { google } from "googleapis";
import { eq, and, or, inArray, desc, gte, sql } from "drizzle-orm";
import { db } from "./db";
import { 
  users, games, groups, groupMembers, messages, ideas, ideaVotes,
  insertGroupSchema, insertGameSchema, insertIdeaSchema,
  type User 
} from "@shared/schema";
import { setupWebSocket, clients } from "./websocket";

// Configure Multer for uploads
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname)}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
});

// Admin verification middleware
async function verifyAdmin(req: Request, res: Response, next: NextFunction) {
  const userId = req.body?.userId || req.query?.userId || (req.user as User)?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized - User ID required" });

  const [user] = await db.select().from(users).where(eq(users.id, Number(userId)));
  if (!user || !user.isAdmin) return res.status(403).json({ message: "Forbidden - Admin access required" });

  next();
}

function sanitizeUser(user: User) {
  const { password, ...safeUser } = user;
  return safeUser;
}

export function registerRoutes(app: Express): Server {
  // ----------------------------------------------------
  // Static uploads
  // ----------------------------------------------------
  app.use("/uploads", (_req, res, next) => {
    res.setHeader("Cache-Control", "public, max-age=31536000");
    next();
  }, (req, res, next) => {
    // Serve from process.cwd()/uploads
    const filePath = path.join(process.cwd(), "uploads", req.path);
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      next();
    }
  });

  // ----------------------------------------------------
  // Authentication Routes
  // ----------------------------------------------------
  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: Error | null, user: User | false, info: { message: string }) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: info?.message || "Invalid credentials" });

      req.logIn(user, (err) => {
        if (err) return next(err);
        return res.json({ user: sanitizeUser(user), redirect: "home" });
      });
    })(req, res, next);
  });

  const handleSignup = async (req: Request, res: Response) => {
    try {
      const data = req.body;
      const [existing] = await db.select().from(users).where(eq(users.username, data.username));
      if (existing) return res.status(400).json({ message: "Username already exists" });

      // If initial step without language/region, save pending credentials in session
      if (!data.language || !data.region) {
        if (!data.password) return res.status(400).json({ message: "Password is required" });
        const hashedPassword = await bcrypt.hash(data.password, 10);
        req.session.pendingAuth = { username: data.username, password: hashedPassword };
        return res.json({ redirect: "setup" });
      }

      // Final step or direct registration
      let passwordToUse: string | undefined;
      if (req.session?.pendingAuth && req.session.pendingAuth.username === data.username) {
        passwordToUse = req.session.pendingAuth.password;
        delete req.session.pendingAuth;
      } else {
        if (!data.password) return res.status(400).json({ message: "Password is required" });
        passwordToUse = await bcrypt.hash(data.password, 10);
      }

      const gamesPlayed = Array.isArray(data.gamesPlayed) ? data.gamesPlayed : [];
      const [newUser] = await db.insert(users).values({
        username: data.username,
        password: passwordToUse,
        language: data.language,
        region: data.region,
        gamesPlayed,
        currentGame: data.currentGame,
        currentGameId: data.currentGameId,
        profilePicture: data.profilePicture || null,
        lastActive: new Date(),
        isAdmin: false,
      }).returning();

      req.logIn(newUser, (err) => {
        if (err) return res.status(500).json({ message: "Failed to log in after account creation" });
        return res.status(201).json({ user: sanitizeUser(newUser), message: "User created successfully" });
      });
    } catch (err: any) {
      console.error("Signup error:", err);
      res.status(500).json({ message: err.message || "Failed to create account" });
    }
  };

  app.post("/api/auth/signup", handleSignup);
  app.post("/api/signup", handleSignup);

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) return res.status(500).json({ message: "Logout failed" });
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get(["/api/user", "/api/auth/me", "/api/auth/user"], (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json(sanitizeUser(req.user as User));
  });

  // ----------------------------------------------------
  // User Routes
  // ----------------------------------------------------
  app.get("/api/users", async (_req, res) => {
    const allUsers = await db.select().from(users).orderBy(desc(users.lastActive));
    res.json(allUsers.map(sanitizeUser));
  });

  app.get("/api/users/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid user ID" });
    const [user] = await db.select().from(users).where(eq(users.id, id));
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(sanitizeUser(user));
  });

  app.patch("/api/users/:id", async (req, res) => {
    try {
      const userId = Number(req.params.id);
      const updates = { ...req.body };
      delete updates.username;
      delete updates.password;

      if (updates.gamesPlayed && typeof updates.gamesPlayed === "string") {
        try { updates.gamesPlayed = JSON.parse(updates.gamesPlayed); } catch {}
      }

      const [updated] = await db.update(users)
        .set({ ...updates, lastActive: new Date() })
        .where(eq(users.id, userId))
        .returning();

      if (!updated) return res.status(404).json({ message: "User not found" });
      res.json(sanitizeUser(updated));
    } catch (err: any) {
      res.status(400).json({ message: "Invalid update data", error: err.message });
    }
  });

  const handleChangePassword = async (userId: number, oldPass: string, newPass: string, res: Response) => {
    if (!oldPass || !newPass || newPass.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters" });
    }
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return res.status(404).json({ message: "User not found" });

    const isValid = await bcrypt.compare(oldPass, user.password);
    if (!isValid) return res.status(401).json({ message: "Current password is incorrect" });

    const hashedPassword = await bcrypt.hash(newPass, 10);
    await db.update(users).set({ password: hashedPassword }).where(eq(users.id, userId));
    return res.json({ message: "Password updated successfully" });
  };

  app.post("/api/users/:id/change-password", async (req, res) => {
    await handleChangePassword(Number(req.params.id), req.body.oldPassword, req.body.newPassword, res);
  });

  app.post("/api/user/change-password", async (req, res) => {
    await handleChangePassword(Number(req.body.userId), req.body.currentPassword, req.body.newPassword, res);
  });

  // ----------------------------------------------------
  // Image Upload
  // ----------------------------------------------------
  app.post("/api/upload/image", upload.single("image"), (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    res.json({ url: `${baseUrl}/uploads/${req.file.filename}`, success: true });
  });

  // ----------------------------------------------------
  // Games Routes
  // ----------------------------------------------------
  app.get("/api/games", async (_req, res) => {
    const allGames = await db.select().from(games);
    res.json(allGames);
  });

  app.get("/api/games/category", async (req, res) => {
    const categories = (req.query.categories as string)?.split(",") || [];
    const allGames = await db.select().from(games);
    const filtered = allGames.filter(game => {
      const cats = game.categories as string[];
      return categories.some(c => cats.includes(c));
    });
    res.json(filtered);
  });

  app.get("/api/games/:id", async (req, res) => {
    const [game] = await db.select().from(games).where(eq(games.id, Number(req.params.id)));
    if (!game) return res.status(404).json({ message: "Game not found" });
    res.json(game);
  });

  // ----------------------------------------------------
  // Direct Messages
  // ----------------------------------------------------
  app.get("/api/messages/:fromUserId/:toUserId", async (req, res) => {
    try {
      const u1 = Number(req.params.fromUserId);
      const u2 = Number(req.params.toUserId);
      if (isNaN(u1) || isNaN(u2)) return res.json([]);

      const thread = await db.select().from(messages).where(
        or(
          and(eq(messages.fromUserId, u1), eq(messages.toUserId, u2)),
          and(eq(messages.fromUserId, u2), eq(messages.toUserId, u1))
        )
      ).orderBy(messages.timestamp);
      res.json(thread);
    } catch (err) {
      console.error("Error loading messages:", err);
      res.json([]);
    }
  });

  app.post("/api/messages", async (req, res) => {
    try {
      const fromUserId = Number(req.body.fromUserId);
      const toUserId = req.body.toUserId ? Number(req.body.toUserId) : null;
      const groupId = req.body.groupId ? Number(req.body.groupId) : null;
      const content = req.body.content;

      if (!fromUserId || (!toUserId && !groupId) || !content) {
        return res.status(400).json({ message: "Missing required message parameters" });
      }

      const [saved] = await db
        .insert(messages)
        .values({
          fromUserId,
          toUserId,
          groupId,
          content,
          timestamp: new Date(),
          isRead: false,
          readAt: null,
          type: content.startsWith("![image]") ? "image" : "text",
        })
        .returning();

      // Broadcast via open WebSockets
      const payload = JSON.stringify(groupId ? { ...saved, type: "groupMessage" } : saved);
      if (toUserId) {
        const recipientSockets = clients.get(toUserId);
        recipientSockets?.forEach((ws) => ws.readyState === 1 && ws.send(payload));
        // Echo to sender sockets
        const senderSockets = clients.get(fromUserId);
        senderSockets?.forEach((ws) => ws.readyState === 1 && ws.send(payload));
      } else if (groupId) {
        const members = await db
          .select({ userId: groupMembers.userId })
          .from(groupMembers)
          .where(eq(groupMembers.groupId, groupId));
        members.forEach((m) => {
          clients.get(m.userId)?.forEach((ws) => ws.readyState === 1 && ws.send(payload));
        });
      }

      res.status(201).json(saved);
    } catch (err: any) {
      console.error("Error creating message:", err);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // Delete individual message
  app.delete("/api/messages/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const userId = Number(req.body.userId) || (req.user as User)?.id;
      if (!id || !userId) return res.status(400).json({ message: "Message ID and user ID are required" });

      await db.delete(messages).where(and(eq(messages.id, id), eq(messages.fromUserId, userId)));
      res.json({ success: true, message: "Message deleted successfully" });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete message" });
    }
  });

  // Clear chat history between two users
  const handleClearHistory = async (req: any, res: any) => {
    try {
      const targetUserId = Number(req.params.otherUserId || req.params.targetUserId);
      const userId = Number(req.body.userId) || (req.user as User)?.id;
      if (!targetUserId || !userId) return res.status(400).json({ message: "User IDs are required" });

      await db.delete(messages).where(
        or(
          and(eq(messages.fromUserId, userId), eq(messages.toUserId, targetUserId)),
          and(eq(messages.fromUserId, targetUserId), eq(messages.toUserId, userId))
        )
      );
      res.json({ success: true, message: "Chat history cleared" });
    } catch (err) {
      res.status(500).json({ message: "Failed to clear chat history" });
    }
  };

  app.delete("/api/messages/history/:otherUserId", handleClearHistory);
  app.delete("/api/users/:targetUserId/chat", handleClearHistory);

  // ----------------------------------------------------
  // Group Chats & Memberships
  // ----------------------------------------------------
  app.post("/api/groups", async (req, res) => {
    try {
      const data = insertGroupSchema.parse(req.body);
      const [newGroup] = await db.insert(groups).values(data).returning();
      await db.insert(groupMembers).values({ groupId: newGroup.id, userId: data.ownerId });

      // Add other members if supplied
      if (Array.isArray(req.body.members)) {
        for (const mid of req.body.members) {
          const numId = Number(mid);
          if (numId && numId !== data.ownerId) {
            try {
              await db.insert(groupMembers).values({ groupId: newGroup.id, userId: numId });
            } catch {}
          }
        }
      }

      res.status(201).json(newGroup);
    } catch (err: any) {
      res.status(400).json({ message: "Invalid group data", error: err.message });
    }
  });

  app.get("/api/users/:userId/groups", async (req, res) => {
    try {
      const userId = Number(req.params.userId);
      if (isNaN(userId)) return res.json([]);
      const memberships = await db.select({ groupId: groupMembers.groupId }).from(groupMembers).where(eq(groupMembers.userId, userId));
      if (memberships.length === 0) return res.json([]);
      const groupList = await db.select().from(groups).where(inArray(groups.id, memberships.map(m => m.groupId)));
      res.json(groupList);
    } catch (err) {
      res.json([]);
    }
  });

  app.get("/api/groups/:groupId", async (req, res) => {
    const [group] = await db.select().from(groups).where(eq(groups.id, Number(req.params.groupId)));
    if (!group) return res.status(404).json({ message: "Group not found" });
    res.json(group);
  });

  app.delete("/api/groups/:groupId", async (req, res) => {
    const groupId = Number(req.params.groupId);
    const userId = Number(req.body.userId);
    const [group] = await db.select().from(groups).where(eq(groups.id, groupId));
    if (!group || group.ownerId !== userId) {
      return res.status(403).json({ message: "Only the group owner can delete this group" });
    }

    await db.delete(groupMembers).where(eq(groupMembers.groupId, groupId));
    await db.delete(messages).where(eq(messages.groupId, groupId));
    await db.delete(groups).where(eq(groups.id, groupId));
    res.json({ message: "Group deleted successfully" });
  });

  app.get("/api/groups/:groupId/members", async (req, res) => {
    const groupId = Number(req.params.groupId);
    const memberships = await db.select({ userId: groupMembers.userId }).from(groupMembers).where(eq(groupMembers.groupId, groupId));
    if (memberships.length === 0) return res.json([]);
    const memberUsers = await db.select().from(users).where(inArray(users.id, memberships.map(m => m.userId)));
    res.json(memberUsers.map(sanitizeUser));
  });

  app.post("/api/groups/:groupId/members", async (req, res) => {
    const groupId = Number(req.params.groupId);
    const { userId, currentUserId } = req.body;
    const [group] = await db.select().from(groups).where(eq(groups.id, groupId));
    if (!group || group.ownerId !== Number(currentUserId)) {
      return res.status(403).json({ message: "Only group owner can add members" });
    }

    const [existing] = await db.select().from(groupMembers).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, Number(userId))));
    if (!existing) {
      await db.insert(groupMembers).values({ groupId, userId: Number(userId) });
    }
    res.json({ message: "Member added successfully" });
  });

  app.delete("/api/groups/:groupId/members/:memberId", async (req, res) => {
    const groupId = Number(req.params.groupId);
    const memberId = Number(req.params.memberId);
    const currentUserId = Number(req.body.currentUserId);
    const [group] = await db.select().from(groups).where(eq(groups.id, groupId));

    if (!group) return res.status(404).json({ message: "Group not found" });
    const isOwner = group.ownerId === currentUserId;
    const isSelf = memberId === currentUserId;

    if (!isOwner && !isSelf) return res.status(403).json({ message: "Permission denied" });
    if (memberId === group.ownerId && !isSelf) return res.status(400).json({ message: "Cannot remove owner" });

    await db.delete(groupMembers).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, memberId)));
    res.json({ message: "Member removed successfully" });
  });

  app.post("/api/groups/:groupId/transfer-ownership", async (req, res) => {
    const groupId = Number(req.params.groupId);
    const { currentOwnerId, newOwnerId } = req.body;
    const [group] = await db.select().from(groups).where(eq(groups.id, groupId));
    if (!group || group.ownerId !== Number(currentOwnerId)) {
      return res.status(403).json({ message: "Only current owner can transfer ownership" });
    }

    await db.update(groups).set({ ownerId: Number(newOwnerId) }).where(eq(groups.id, groupId));
    res.json({ message: "Ownership transferred successfully" });
  });

  app.get("/api/groups/:groupId/messages", async (req, res) => {
    try {
      const groupId = Number(req.params.groupId);
      const userId = Number(req.query.userId) || (req.user as User)?.id;
      if (!groupId) return res.status(400).json({ message: "Invalid group ID" });

      const [group] = await db.select().from(groups).where(eq(groups.id, groupId));
      if (!group) return res.status(404).json({ message: "Group not found" });

      if (userId) {
        const [member] = await db.select().from(groupMembers).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));
        if (!member && group.ownerId !== userId) {
          return res.status(403).json({ message: "Not a group member" });
        }
      }

      const groupMsgList = await db.select().from(messages).where(eq(messages.groupId, groupId)).orderBy(messages.timestamp);
      res.json(groupMsgList);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch group messages" });
    }
  });

  // ----------------------------------------------------
  // Ideas Routes
  // ----------------------------------------------------
  app.get("/api/ideas", async (req, res) => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;
      const offset = (page - 1) * limit;
      const userId = (req.user as User)?.id || Number(req.query.userId) || 0;

      const allIdeas = await db.query.ideas.findMany({
        with: { game: true, creator: true },
        orderBy: [desc(ideas.votes), desc(ideas.createdAt)],
        limit,
        offset,
      });

      const userVotes = userId
        ? await db.select().from(ideaVotes).where(eq(ideaVotes.userId, userId))
        : [];
      const votedSet = new Set(userVotes.map(v => v.ideaId));

      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(ideas);

      res.json({
        ideas: allIdeas.map(idea => ({
          id: idea.id,
          gameId: idea.gameId,
          gameName: idea.game?.name || "Unknown Game",
          gameContact: idea.game?.contact || null,
          title: idea.title,
          description: idea.description,
          votes: idea.votes,
          hasVoted: votedSet.has(idea.id),
          creatorUsername: idea.creator?.username || "Unknown User",
          createdAt: idea.createdAt,
        })),
        total: Number(count),
        page,
        totalPages: Math.ceil(Number(count) / limit),
      });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch ideas", error: err.message });
    }
  });

  app.post("/api/ideas", async (req, res) => {
    try {
      const userId = (req.user as User)?.id || Number(req.body?.userId) || Number(req.query?.userId);
      if (!userId || isNaN(userId)) return res.status(401).json({ message: "Authentication required" });

      const data = insertIdeaSchema.parse({ ...req.body, userId });
      const [newIdea] = await db.insert(ideas).values(data).returning();
      const [game] = await db.select().from(games).where(eq(games.id, newIdea.gameId));
      const [creator] = await db.select().from(users).where(eq(users.id, newIdea.userId));

      res.status(201).json({
        id: newIdea.id,
        gameId: newIdea.gameId,
        gameName: game?.name || "",
        title: newIdea.title,
        description: newIdea.description,
        votes: newIdea.votes,
        hasVoted: false,
        creatorUsername: creator?.username || "",
        createdAt: newIdea.createdAt,
      });
    } catch (err: any) {
      res.status(400).json({ message: "Invalid idea data", error: err.message });
    }
  });

  app.post("/api/ideas/:id/vote", async (req, res) => {
    try {
      const ideaId = Number(req.params.id);
      const userId = (req.user as User)?.id || Number(req.body?.userId) || Number(req.query?.userId);
      if (!userId || isNaN(userId)) return res.status(401).json({ message: "Authentication required" });

      const [existingVote] = await db
        .select()
        .from(ideaVotes)
        .where(and(eq(ideaVotes.ideaId, ideaId), eq(ideaVotes.userId, userId)));

      let hasVoted = false;
      if (existingVote) {
        await db.delete(ideaVotes).where(and(eq(ideaVotes.ideaId, ideaId), eq(ideaVotes.userId, userId)));
        await db.update(ideas).set({ votes: sql`GREATEST(0, votes - 1)` }).where(eq(ideas.id, ideaId));
      } else {
        await db.insert(ideaVotes).values({ ideaId, userId });
        await db.update(ideas).set({ votes: sql`votes + 1` }).where(eq(ideas.id, ideaId));
        hasVoted = true;
      }

      const [updatedIdea] = await db.query.ideas.findMany({
        where: eq(ideas.id, ideaId),
        with: { game: true, creator: true },
      });

      if (!updatedIdea) return res.status(404).json({ message: "Idea not found" });

      res.json({
        id: updatedIdea.id,
        gameId: updatedIdea.gameId,
        gameName: updatedIdea.game?.name || "",
        title: updatedIdea.title,
        description: updatedIdea.description,
        votes: updatedIdea.votes,
        hasVoted,
        creatorUsername: updatedIdea.creator?.username || "",
        createdAt: updatedIdea.createdAt,
      });
    } catch (err: any) {
      console.error("Error voting for idea:", err);
      res.status(500).json({ message: "Failed to submit vote", error: err.message });
    }
  });

  app.delete("/api/ideas/:id", verifyAdmin, async (req, res) => {
    const ideaId = Number(req.params.id);
    await db.delete(ideaVotes).where(eq(ideaVotes.ideaId, ideaId));
    await db.delete(ideas).where(eq(ideas.id, ideaId));
    res.json({ message: "Idea deleted successfully" });
  });

  // ----------------------------------------------------
  // Admin Operations
  // ----------------------------------------------------
  app.delete("/api/admin/users/:id", verifyAdmin, async (req, res) => {
    const userId = Number(req.params.id);
    try {
      await db.delete(messages).where(or(eq(messages.fromUserId, userId), eq(messages.toUserId, userId)));
      const ownedGroups = await db.select().from(groups).where(eq(groups.ownerId, userId));
      for (const g of ownedGroups) {
        await db.delete(messages).where(eq(messages.groupId, g.id));
        await db.delete(groupMembers).where(eq(groupMembers.groupId, g.id));
        await db.delete(groups).where(eq(groups.id, g.id));
      }
      await db.delete(groupMembers).where(eq(groupMembers.userId, userId));
      await db.delete(ideaVotes).where(eq(ideaVotes.userId, userId));
      await db.delete(ideas).where(eq(ideas.userId, userId));
      await db.delete(users).where(eq(users.id, userId));
      res.json({ message: "User deleted successfully" });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to delete user", error: err.message });
    }
  });

  app.delete("/api/admin/games/:id", verifyAdmin, async (req, res) => {
    const gameId = Number(req.params.id);
    const relatedIdeas = await db.select().from(ideas).where(eq(ideas.gameId, gameId));
    for (const idea of relatedIdeas) {
      await db.delete(ideaVotes).where(eq(ideaVotes.ideaId, idea.id));
    }
    await db.delete(ideas).where(eq(ideas.gameId, gameId));
    await db.delete(games).where(eq(games.id, gameId));
    res.json({ success: true });
  });

  app.post("/api/admin/games", verifyAdmin, async (req, res) => {
    try {
      const data = insertGameSchema.parse(req.body.game);
      const [newGame] = await db.insert(games).values(data).returning();
      res.status(201).json(newGame);
    } catch (err: any) {
      res.status(400).json({ message: "Failed to add game", error: err.message });
    }
  });

  app.get("/api/admin/user-stats", verifyAdmin, async (_req, res) => {
    try {
      const allUsers = await db.select().from(users);
      const byRegion: Record<string, number> = {};
      const byLanguage: Record<string, number> = {};

      allUsers.forEach(u => {
        if (u.region) byRegion[u.region] = (byRegion[u.region] || 0) + 1;
        if (u.language) byLanguage[u.language] = (byLanguage[u.language] || 0) + 1;
      });

      const now = Date.now();
      const daily = allUsers.filter(u => now - new Date(u.lastActive).getTime() <= 24 * 3600 * 1000).length;
      const weekly = allUsers.filter(u => now - new Date(u.lastActive).getTime() <= 7 * 24 * 3600 * 1000).length;
      const monthly = allUsers.filter(u => now - new Date(u.lastActive).getTime() <= 30 * 24 * 3600 * 1000).length;
      const quarterly = allUsers.filter(u => now - new Date(u.lastActive).getTime() <= 90 * 24 * 3600 * 1000).length;

      res.json({
        success: true,
        users: { byRegion, byLanguage, total: allUsers.length },
        activeUsers: { daily, weekly, monthly, quarterly },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get("/api/admin/games-by-region", verifyAdmin, async (_req, res) => {
    try {
      const allUsers = await db.select({ region: users.region, gamesPlayed: users.gamesPlayed }).from(users);
      const byRegion: Record<string, Record<string, number>> = {};

      allUsers.forEach(u => {
        if (!u.region) return;
        if (!byRegion[u.region]) byRegion[u.region] = {};
        const played = Array.isArray(u.gamesPlayed) ? u.gamesPlayed : [];
        played.forEach(g => {
          byRegion[u.region][g] = (byRegion[u.region][g] || 0) + 1;
        });
      });

      res.json({ success: true, gamesByRegion: { byRegion } });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // ----------------------------------------------------
  // Videos (YouTube Data API v3)
  // ----------------------------------------------------
  const youtube = google.youtube({
    version: "v3",
    auth: process.env.YOUTUBE_API_KEY,
  });

  app.get("/api/videos/:gameName", async (req, res) => {
    try {
      const { gameName } = req.params;
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

      const response = await youtube.search.list({
        part: ["snippet"],
        q: `${gameName} gameplay -shorts`,
        type: ["video"],
        order: "date",
        publishedAfter: thirtyDaysAgo,
        maxResults: 8,
        videoDuration: "medium",
      });

      const videoList = (response.data.items || [])
        .filter(item => {
          const title = item.snippet?.title?.toLowerCase() || "";
          return !title.includes("#short") && !title.includes("tiktok");
        })
        .map(item => ({
          id: item.id?.videoId || "",
          title: item.snippet?.title || "",
          thumbnail: item.snippet?.thumbnails?.high?.url || "",
          channelTitle: item.snippet?.channelTitle || "",
          publishedAt: item.snippet?.publishedAt || "",
          platform: "youtube" as const,
          url: `https://www.youtube.com/watch?v=${item.id?.videoId}`,
        }))
        .slice(0, 6);

      res.json(videoList);
    } catch (err: any) {
      console.error("YouTube API error:", err.message);
      res.json([]);
    }
  });

  const httpServer = createServer(app);
  setupWebSocket(httpServer);
  return httpServer;
}
