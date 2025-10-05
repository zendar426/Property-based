// src/db/sqlite.ts
import Database from "bun:sqlite";
import path from "path";
import fs from "fs";

export function createDb(filePath?: string) {
    let dbFile = filePath;
    if (!dbFile) {
        // por defecto usa data/db.sqlite
        const dataDir = path.resolve(process.cwd(), "data");
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        dbFile = path.join(dataDir, "db.sqlite");
    }

    const db = new Database(dbFile === ":memory:" ? ":memory:" : dbFile);

    // Crear tabla si no existe
    db.run(`
    CREATE TABLE IF NOT EXISTS produce (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      tipo TEXT NOT NULL,
      precioPorKilo REAL NOT NULL
    )
  `);

    return db;
}
