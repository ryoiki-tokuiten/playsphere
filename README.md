# PlaySphere

A social gaming hub where players discover teammates, customize shareable gamer cards, chat in real time, explore games, submit community ideas, and watch game streams.

## What You Can Do

Create your personal gamer card showcasing your in-game handles, region, languages, and titles you play. Share your profile instantly via direct link or QR code. Coordinate matches using real-time direct messaging or create group chats with other gamers. Discover new games filtered by category, submit and upvote feature suggestions on the community ideas board, and stream gameplay highlights.

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
