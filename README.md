# PlaySphere

This is an experimental project built around a simple idea: a public lobby where gamers can openly broadcast what they are playing so anyone interested can reach out, chat, and play together. It is an open room to discover people by games. Users can just search a game and find people who play that game, or specifically find people who play that game in a given region and speak some given language.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure your environment variables in a `.env` file:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/playsphere
SESSION_SECRET=your-session-secret
YOUTUBE_API_KEY=your-youtube-api-key
PORT=5000
```

3. Push the database schema and seed initial data:

```bash
npm run db:push
npm run db:seed
```

4. Launch the application:

```bash
npm run dev
```

Open `http://localhost:5000` in your browser. Default administrator login is `admin` / `adminpassword`.
