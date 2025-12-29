import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { characterRoutes } from './routes/characters';
import { storyRoutes } from './routes/story';
import authRoutes from './routes/auth';
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
const allowedOrigins = [
  'http://localhost:3000',
  'https://neonthreads-client.onrender.com',
  process.env.APP_URL
].filter(Boolean); // Remove undefined values

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
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
app.use('/api/auth', authRoutes);
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

