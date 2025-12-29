import sqlite3 from 'sqlite3';
import { Pool, Client } from 'pg';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env') });

// Database connection - supports both SQLite (dev) and PostgreSQL (prod)
const usePostgres = !!process.env.DATABASE_URL;
let sqliteDb: sqlite3.Database | null = null;
let pgPool: Pool | null = null;

// PostgreSQL connection
if (usePostgres) {
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  pgPool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client', err);
  });

  console.log('Connected to PostgreSQL database');
} else {
  // SQLite connection (for development)
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../neon_threads.db');
  sqliteDb = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error opening SQLite database:', err);
    } else {
      console.log('Connected to SQLite database');
    }
  });
}

// Unified database query functions
export async function runQuery<T = any>(sql: string, params: any[] = []): Promise<T> {
  if (usePostgres && pgPool) {
    // Convert SQLite ? placeholders to PostgreSQL $1, $2, etc.
    const pgSql = sql.replace(/\?/g, (_, offset) => {
      const index = sql.substring(0, offset).split('?').length;
      return `$${index}`;
    });
    const result = await pgPool.query(pgSql, params);
    return result.rows as T;
  } else if (sqliteDb) {
    return new Promise((resolve, reject) => {
      sqliteDb!.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows as T);
        }
      });
    });
  }
  throw new Error('No database connection available');
}

export async function runInsert(sql: string, params: any[] = []): Promise<{ lastID: string | number; changes: number }> {
  if (usePostgres && pgPool) {
    // Convert SQLite ? placeholders to PostgreSQL $1, $2, etc.
    const pgSql = sql.replace(/\?/g, (_, offset) => {
      const index = sql.substring(0, offset).split('?').length;
      return `$${index}`;
    });
    // For PostgreSQL, if we're inserting with an ID, return that ID
    // Otherwise, return the first row's id if available
    const result = await pgPool.query(pgSql, params);
    const insertedId = result.rows[0]?.id || params[0] || '0';
    return { lastID: insertedId, changes: result.rowCount || 0 };
  } else if (sqliteDb) {
    return new Promise((resolve, reject) => {
      sqliteDb!.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    });
  }
  throw new Error('No database connection available');
}

export async function runUpdate(sql: string, params: any[] = []): Promise<{ changes: number }> {
  if (usePostgres && pgPool) {
    const pgSql = sql.replace(/\?/g, (_, offset) => {
      const index = sql.substring(0, offset).split('?').length;
      return `$${index}`;
    });
    const result = await pgPool.query(pgSql, params);
    return { changes: result.rowCount || 0 };
  } else if (sqliteDb) {
    return new Promise((resolve, reject) => {
      sqliteDb!.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }
  throw new Error('No database connection available');
}

export async function initDatabase(): Promise<void> {
  if (usePostgres && pgPool) {
    // PostgreSQL schema
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        username VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        preferences JSONB
      )
    `);

    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS characters (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        player_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        background TEXT NOT NULL,
        augmentations TEXT NOT NULL,
        appearance TEXT NOT NULL,
        trade TEXT NOT NULL,
        optional_prompts JSONB,
        full_description TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        current_story_state JSONB NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'alive',
        story_history JSONB NOT NULL DEFAULT '[]',
        inventory JSONB NOT NULL DEFAULT '[]',
        money INTEGER NOT NULL DEFAULT 500,
        health INTEGER NOT NULL DEFAULT 100,
        max_health INTEGER NOT NULL DEFAULT 100
      )
    `);

    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS story_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        type VARCHAR(50) NOT NULL,
        description TEXT NOT NULL,
        player_input TEXT,
        outcome TEXT NOT NULL,
        consequences JSONB
      )
    `);

    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS world_state (
        key VARCHAR(255) PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('PostgreSQL database initialized');
  } else if (sqliteDb) {
    // SQLite schema (existing)
    return new Promise((resolve, reject) => {
      // Users table with auth fields
      sqliteDb!.run(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          username TEXT,
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
      sqliteDb!.run(`
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
        
        // Migration: Add new columns if they don't exist
        sqliteDb!.run(`ALTER TABLE characters ADD COLUMN inventory TEXT DEFAULT '[]'`, () => {});
        sqliteDb!.run(`ALTER TABLE characters ADD COLUMN money INTEGER DEFAULT 500`, () => {});
        sqliteDb!.run(`ALTER TABLE characters ADD COLUMN health INTEGER DEFAULT 100`, () => {});
        sqliteDb!.run(`ALTER TABLE characters ADD COLUMN max_health INTEGER DEFAULT 100`, () => {});
      });

      // Story events table
      sqliteDb!.run(`
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
      sqliteDb!.run(`
        CREATE TABLE IF NOT EXISTS world_state (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}

// Helper function to parse JSON fields (works with both SQLite strings and PostgreSQL objects)
export function parseJsonField(value: any): any {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  // PostgreSQL returns objects directly
  return value;
}

// Close database connections
export async function closeDatabase(): Promise<void> {
  if (pgPool) {
    await pgPool.end();
  }
  if (sqliteDb) {
    return new Promise((resolve, reject) => {
      sqliteDb!.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}
