// Database initialization for SQLite (for future use)
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '@shared/schema';

let db: ReturnType<typeof drizzle> | null = null;

export function initializeDatabase() {
  try {
    const sqlite = new Database('database.sqlite');
    db = drizzle(sqlite, { schema });
    console.log('SQLite database initialized');
    return db;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

export function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}
