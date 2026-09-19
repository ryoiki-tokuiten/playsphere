import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcrypt';
import { db } from './db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
      password: string;
      profilePicture: string | null;
      language: string;
      region: string;
      gamesPlayed: string[];
      currentGame: string;
      currentGameId: string;
      lastActive: Date;
      isAdmin: boolean;
    }
  }
}

declare module 'express-session' {
  interface SessionData {
    pendingAuth?: {
      username: string;
      password: string;
    };
  }
}

export function setupPassport() {
  passport.use(
    new LocalStrategy(
      { usernameField: 'username', passwordField: 'password' },
      async (username, password, done) => {
        try {
          const [user] = await db.select().from(users).where(eq(users.username, username));
          if (!user) {
            return done(null, false, { message: 'Incorrect username.' });
          }

          const isMatch = await bcrypt.compare(password, user.password);
          if (!isMatch) {
            return done(null, false, { message: 'Incorrect password.' });
          }

          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: any, done) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, Number(id)));
      done(null, user || null);
    } catch (err) {
      done(err);
    }
  });
}
