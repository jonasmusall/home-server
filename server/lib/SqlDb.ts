import * as _sqlite3 from 'sqlite3';
import type { Database as DatabaseType } from 'sqlite3';
const sqlite3 = (_sqlite3 as any).default as _sqlite3.sqlite3;
const Database = sqlite3.Database;
const { OPEN_CREATE, OPEN_FULLMUTEX, OPEN_READWRITE, OPEN_SHAREDCACHE } = sqlite3;

export class SqlDb {
  private db: DatabaseType;

  private constructor(filename: string, mode?: number, callback?: (err: Error | null) => void) {
    this.db = new Database(filename, mode, callback);
  }

  static open(filename: string, mode?: number): Promise<SqlDb> {
    return new Promise((resolve, reject) => {
      const instance = new SqlDb(
        filename,
        mode ?? (OPEN_READWRITE | OPEN_CREATE | OPEN_FULLMUTEX | OPEN_SHAREDCACHE),
        (err) => {
          if (err !== null) {
            reject(err);
            return;
          }
          resolve(instance);
        }
      );
    });
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err !== null) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }
  
  run(query: string): Promise<{ lastId: number, changes: number }> {
    return new Promise((resolve, reject) => {
      this.db.run(query, [], function (err) {
        if (err !== null) {
          reject(err);
          return;
        }
        resolve({
          lastId: this.lastID,
          changes: this.changes
        });
      });
    });
  }

  get(query: string): Promise<{ [column: string]: any } | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get(query, [], function (err, row) {
        if (err !== null) {
          reject(err);
          return;
        }
        resolve(row);
      });
    });
  }
}
