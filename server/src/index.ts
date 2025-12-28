import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { characterRoutes } from './routes/characters';
import { storyRoutes } from './routes/story';
import { initDatabase } from './database';

// Load environment variables from server/.env
dotenv.config({ path: path.join(__dirname, '../../.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// Health check endpoint for Render
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// CORS configuration - allow frontend domain
const corsOptions = {
  origin: process.env.APP_URL || 'http://localhost:3000',
  credentials: true
};
app.use(cors(corsOptions));
app.use(express.json());

// Initialize database
initDatabase().then(() => {
  console.log('Database initialized');
}).catch((err) => {
  console.error('Database initialization failed:', err);
});

// Routes
app.use('/api/characters', characterRoutes);
app.use('/api/story', storyRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Log API key status (without showing the key)
if (process.env.OPENROUTER_API_KEY) {
  console.log('✅ OpenRouter API key loaded');
} else {
  console.warn('⚠️  OpenRouter API key NOT loaded');
}

