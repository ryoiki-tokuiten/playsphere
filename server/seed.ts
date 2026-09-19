import { db, pool } from './db';
import { users, games } from '@shared/schema';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface GameEntry {
  Game: string;
  Category: string[] | string;
  Support: string[] | string;
  Contact?: string;
  Downloads?: number;
}

async function seedUsers() {
  console.log('Seeding default users...');
  const defaultUsers = [
    {
      username: '5crore',
      password: 'password123',
      profilePicture: 'https://api.dicebear.com/7.x/avataaars/svg?seed=5crore',
      language: 'Marathi',
      region: 'Satara',
      gamesPlayed: ['Valorant'],
      currentGame: 'Valorant',
      currentGameId: 'valorant_id_placeholder',
      isAdmin: true,
    },
    {
      username: 'admin',
      password: 'adminpassword',
      profilePicture: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
      language: 'English',
      region: 'North America',
      gamesPlayed: ['Valorant', 'Minecraft'],
      currentGame: 'Valorant',
      currentGameId: 'valorant_id_placeholder',
      isAdmin: true,
    },
    {
      username: 'dee.2',
      password: 'password456',
      profilePicture: 'https://api.dicebear.com/7.x/avataaars/svg?seed=dee.2',
      language: 'Hindi',
      region: 'Mumbai',
      gamesPlayed: ['Chess'],
      currentGame: 'Chess',
      currentGameId: 'chess_id_placeholder',
      isAdmin: false,
    },
  ];

  for (const u of defaultUsers) {
    const [existing] = await db.select().from(users).where(eq(users.username, u.username));
    if (!existing) {
      const hashedPassword = await bcrypt.hash(u.password, 10);
      await db.insert(users).values({ ...u, password: hashedPassword });
      console.log(`Created user: ${u.username}`);
    } else {
      console.log(`User ${u.username} already exists, skipping.`);
    }
  }
}

async function seedGames() {
  console.log('Seeding games from Games.json...');
  const gamesFilePath = path.join(__dirname, '..', 'Games.json');
  if (!fs.existsSync(gamesFilePath)) {
    console.warn(`Games.json not found at ${gamesFilePath}`);
    return;
  }

  const raw = JSON.parse(fs.readFileSync(gamesFilePath, 'utf-8')) as GameEntry[];
  const seen = new Set<string>();
  const uniqueGames = raw.filter(g => {
    if (!g.Game || seen.has(g.Game)) return false;
    seen.add(g.Game);
    return true;
  });

  console.log(`Clearing and importing ${uniqueGames.length} unique games...`);
  await db.delete(games);

  const batchSize = 100;
  for (let i = 0; i < uniqueGames.length; i += batchSize) {
    const chunk = uniqueGames.slice(i, i + batchSize).map(g => ({
      name: g.Game,
      categories: Array.isArray(g.Category) ? g.Category : [g.Category],
      platforms: Array.isArray(g.Support) ? g.Support : [g.Support],
      contact: g.Contact || null,
      downloads: g.Downloads || 0,
    }));
    await db.insert(games).values(chunk);
  }
  console.log('Games imported successfully.');
}

async function main() {
  try {
    await seedUsers();
    await seedGames();
    console.log('Seeding complete!');
  } catch (err) {
    console.error('Seeding error:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
