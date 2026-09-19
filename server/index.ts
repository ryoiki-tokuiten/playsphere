import dotenv from 'dotenv';
dotenv.config();
import express, { type Request, Response, NextFunction } from "express";
import session from 'express-session';
import passport from 'passport';
import cors from 'cors';
import connectPgSimple from 'connect-pg-simple';
import memorystore from 'memorystore';
import { setupPassport } from './auth';
import { pool } from './db';
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:5000'],
  credentials: true,
}));

const PgSession = connectPgSimple(session);
const MemoryStore = memorystore(session);

const sessionStore = process.env.NODE_ENV === 'production' && process.env.DATABASE_URL
  ? new PgSession({
      pool,
      tableName: 'session',
      createTableIfMissing: true,
    })
  : new MemoryStore({
      checkPeriod: 24 * 60 * 60 * 1000,
    });

app.use(
  session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'playsphere-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    },
    name: 'playsphere.sid',
  })
);

app.use(passport.initialize());
app.use(passport.session());
setupPassport();

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    if (req.path.startsWith("/api")) {
      log(`${req.method} ${req.path} ${res.statusCode} in ${Date.now() - start}ms`);
    }
  });
  next();
});

// Global error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Server error:", err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: {
      message: process.env.NODE_ENV === "production"
        ? "An unexpected error occurred."
        : err.message || "Internal Server Error",
    }
  });
});

(async () => {
  const server = registerRoutes(app);

  if (process.env.NODE_ENV !== "production") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const PORT = parseInt(process.env.PORT || '5000', 10);
  server.listen(PORT, "0.0.0.0", () => {
    log(`PlaySphere serving on port ${PORT}`);
  });
})();
