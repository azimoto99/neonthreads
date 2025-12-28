# Neon Threads

A cyberpunk multiplayer storytelling game with AI-generated comic book panels.

## Features

- 🎮 **Interactive Storytelling** - AI-driven narrative that responds to your actions
- 🎨 **6-Panel Comic Book Layout** - Stories displayed as comic book panels with dialogue
- 🖼️ **AI-Generated Images** - Anime-style illustrations using Google Imagen-4
- 💰 **Inventory & Money System** - Track items and currency
- ⚔️ **Challenging Gameplay** - Actions can fail, consequences matter
- 🎭 **Character Creation** - Deep character customization
- 🌃 **Cyberpunk Setting** - Neon-soaked Night City atmosphere

## Tech Stack

- **Frontend:** React + TypeScript
- **Backend:** Node.js + Express + TypeScript
- **Database:** SQLite
- **AI Story Generation:** OpenRouter (Claude via xiaomi/mimo-v2-flash:free)
- **Image Generation:** Google Imagen-4 via Replicate

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- OpenRouter API key (for story generation)
- Replicate API token (for image generation - optional)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/azimoto99/neonthreads.git
cd neonthreads
```

2. Install dependencies:
```bash
npm run install-all
```

3. Set up environment variables:

Create `server/.env`:
```env
PORT=3001
OPENROUTER_API_KEY=your_openrouter_api_key_here
REPLICATE_API_TOKEN=your_replicate_api_token_here
APP_URL=http://localhost:3000
NODE_ENV=development
DATABASE_PATH=./neon_threads.db
```

4. Start the development servers:
```bash
npm run dev
```

5. Open http://localhost:3000 in your browser

## Deployment

See [RENDER_DEPLOYMENT.md](./RENDER_DEPLOYMENT.md) for detailed deployment instructions to Render.

## Project Structure

```
neon-threads/
├── client/          # React frontend
│   ├── src/
│   │   ├── components/  # React components
│   │   └── types.ts     # TypeScript types
│   └── public/
├── server/          # Express backend
│   ├── src/
│   │   ├── routes/      # API routes
│   │   ├── services/    # AI and image services
│   │   └── database.ts  # Database setup
│   └── .env            # Environment variables
└── package.json     # Root package.json
```

## API Keys Setup

### OpenRouter API Key (Required)

1. Sign up at https://openrouter.ai/
2. Get your API key from https://openrouter.ai/keys
3. Add to `server/.env` as `OPENROUTER_API_KEY`

### Replicate API Token (Optional - for images)

1. Sign up at https://replicate.com/
2. Get your token from https://replicate.com/account/api-tokens
3. Add credits at https://replicate.com/account/billing
4. Add to `server/.env` as `REPLICATE_API_TOKEN`

See [OPENROUTER_SETUP.md](./OPENROUTER_SETUP.md) and [API_KEY_SETUP.md](./API_KEY_SETUP.md) for detailed instructions.

## Gameplay

1. **Create Character** - Answer prompts to build your cyberpunk character
2. **Generate Story** - AI creates a 6-panel comic book story
3. **Make Choices** - Your actions affect the story
4. **Manage Resources** - Track inventory, money, and health
5. **Face Consequences** - Actions can fail, characters can die

## Development

### Running Locally

```bash
# Install all dependencies
npm run install-all

# Start both servers (backend + frontend)
npm run dev

# Or run separately:
npm run server  # Backend only (port 3001)
npm run client  # Frontend only (port 3000)
```

### Building for Production

```bash
# Build frontend
cd client && npm run build

# Build backend
cd server && npm run build
```

## License

MIT

## Contributing

Contributions welcome! Please feel free to submit a Pull Request.

