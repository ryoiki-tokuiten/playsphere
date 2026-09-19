import { pgTable, text, serial, integer, json, timestamp, boolean, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  profilePicture: text("profilePicture"),
  language: text("language").notNull(),
  region: text("region").notNull(),
  gamesPlayed: json("gamesPlayed").$type<string[]>().notNull(),
  currentGame: text("currentGame").notNull(),
  currentGameId: text("currentGameId").notNull(),
  lastActive: timestamp("lastActive").notNull().defaultNow(),
  isAdmin: boolean("isAdmin").notNull().default(false),
});

export const games = pgTable("games", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  categories: json("categories").$type<string[]>().notNull(),
  platforms: json("platforms").$type<string[]>().notNull(),
  contact: text("contact"),
  downloads: bigint("downloads", { mode: "number" }),
});

export const groups = pgTable("group_chats", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: integer("createdBy").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  adminIds: json("adminIds").$type<number[]>().notNull().default([]),
});

export const groupMembers = pgTable("group_members", {
  id: serial("id").primaryKey(),
  groupId: integer("groupId").notNull().references(() => groups.id),
  userId: integer("userId").notNull().references(() => users.id),
  joinedAt: timestamp("joinedAt").notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  fromUserId: integer("fromUserId").notNull().references(() => users.id),
  toUserId: integer("toUserId").references(() => users.id),
  groupId: integer("groupId").references(() => groups.id),
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  isRead: boolean("isRead").notNull().default(false),
  readAt: timestamp("readAt"),
  type: text("type").notNull().default("text"),
});

export const ideas = pgTable("ideas", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id").notNull().references(() => games.id),
  userId: integer("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  votes: integer("votes").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const ideaVotes = pgTable("idea_votes", {
  id: serial("id").primaryKey(),
  ideaId: integer("idea_id").notNull().references(() => ideas.id),
  userId: integer("user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const ideasRelations = relations(ideas, ({ one, many }) => ({
  game: one(games, {
    fields: [ideas.gameId],
    references: [games.id],
  }),
  creator: one(users, {
    fields: [ideas.userId],
    references: [users.id],
  }),
  votes: many(ideaVotes),
}));

export const ideaVotesRelations = relations(ideaVotes, ({ one }) => ({
  idea: one(ideas, {
    fields: [ideaVotes.ideaId],
    references: [ideas.id],
  }),
  user: one(users, {
    fields: [ideaVotes.userId],
    references: [users.id],
  }),
}));

export const insertGroupSchema = createInsertSchema(groups, {
  name: z.string().min(1, "Group name is required"),
  ownerId: z.number(),
}).omit({ id: true, createdAt: true });

export const insertGameSchema = createInsertSchema(games).omit({ id: true });
export const insertIdeaSchema = createInsertSchema(ideas).omit({ id: true, votes: true, createdAt: true });

export type User = typeof users.$inferSelect;
export type Game = typeof games.$inferSelect;
export type Group = typeof groups.$inferSelect;
export type GroupMember = typeof groupMembers.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Idea = typeof ideas.$inferSelect;
export type IdeaVote = typeof ideaVotes.$inferSelect;
