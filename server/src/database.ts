import sqlite3 from 'sqlite3';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env') });

// Use environment variable or default path
// On Render, use the provided path or a persistent location
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../neon_threads.db');

let db: sqlite3.Database;

export function getDatabase(): sqlite3.Database {
  if (!db) {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err);
      } else {
        console.log('Connected to SQLite database');
      }
    });
  }
  return db;
}

export function initDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    
    // Users table
    database.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        preferences TEXT
      )
    `, (err) => {
      if (err) {
        reject(err);
        return;
      }
    });

    // Characters table
    database.run(`
      CREATE TABLE IF NOT EXISTS characters (
        id TEXT PRIMARY KEY,
        player_id TEXT NOT NULL,
        background TEXT NOT NULL,
        augmentations TEXT NOT NULL,
        appearance TEXT NOT NULL,
        trade TEXT NOT NULL,
        optional_prompts TEXT,
        full_description TEXT NOT NULL,
        created_at TEXT NOT NULL,
        current_story_state TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'alive',
        story_history TEXT NOT NULL DEFAULT '[]',
        inventory TEXT NOT NULL DEFAULT '[]',
        money INTEGER NOT NULL DEFAULT 500,
        health INTEGER NOT NULL DEFAULT 100,
        max_health INTEGER NOT NULL DEFAULT 100,
        FOREIGN KEY (player_id) REFERENCES users(id)
      )
    `, (err) => {
      if (err) {
        reject(err);
        return;
      }
      
      // Migration: Add new columns if they don't exist (for existing databases)
      database.run(`ALTER TABLE characters ADD COLUMN inventory TEXT DEFAULT '[]'`, (err) => {
        // Ignore error if column already exists
      });
      database.run(`ALTER TABLE characters ADD COLUMN money INTEGER DEFAULT 500`, (err) => {
        // Ignore error if column already exists
      });
      database.run(`ALTER TABLE characters ADD COLUMN health INTEGER DEFAULT 100`, (err) => {
        // Ignore error if column already exists
      });
      database.run(`ALTER TABLE characters ADD COLUMN max_health INTEGER DEFAULT 100`, (err) => {
        // Ignore error if column already exists
      });
    });

    // Story events table
    database.run(`
      CREATE TABLE IF NOT EXISTS story_events (
        id TEXT PRIMARY KEY,
        character_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        type TEXT NOT NULL,
        description TEXT NOT NULL,
        player_input TEXT,
        outcome TEXT NOT NULL,
        consequences TEXT,
        FOREIGN KEY (character_id) REFERENCES characters(id)
      )
    `, (err) => {
      if (err) {
        reject(err);
        return;
      }
    });

    // World state table
    database.run(`
      CREATE TABLE IF NOT EXISTS world_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

export function runQuery<T = any>(sql: string, params: any[] = []): Promise<T> {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    database.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows as T);
      }
    });
  });
}

export function runInsert(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    database.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
}

