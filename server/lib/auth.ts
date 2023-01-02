import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { IncomingMessage } from 'http';
import { cookiePlugin } from './cookie.js';
import { SqlDb } from './SqlDb.js';
import { urlQueryToObject } from './util.js';

declare module 'fastify' {
  interface FastifyRequest {
    getToken: () => string | undefined,
    verifyToken: () => Promise<number | undefined>
  }
}

type User = {
  id: number,
  name: string,
  ctime: number,
  salt: string,
  hash: string
}

type Session = {
  token: string,
  userid: number,
  ctime: number
}

interface ILoginBody {
  username: string,
  password: string
}

const loginBodySchema = {
  type: 'object',
  properties: {
    username: { type: 'string' },
    passwort: { type: 'string' }
  }
}

interface IPasswordBody {
  password: string,
  newPassword: string
}

const passwordBodySchema = {
  type: 'object',
  properties: {
    password: { type: 'string' },
    newPassword: { type: 'string' }
  }
}

const SESSION_TIMEOUT = 600; // 10 min (in s)

export class Auth {
  private initializedPromise: Promise<void>;
  public db?: SqlDb;

  constructor(dbPath: string) {
    this.initializedPromise = new Promise<void>(async (resolve, reject) => {
      // initialize database
      this.db = await SqlDb.open(dbPath);
      await this.db.run(`
        CREATE TABLE IF NOT EXISTS meta (
          zero INTEGER NOT NULL PRIMARY KEY,
          nextuserid INTEGER NOT NULL
        );
      `);
      await this.db.run(`
        INSERT OR IGNORE INTO meta (zero, nextuserid) VALUES (0, 0);
      `);
      await this.db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER NOT NULL PRIMARY KEY,
          name TEXT NOT NULL,
          ctime INTEGER NOT NULL,
          salt TEXT NOT NULL,
          hash TEXT NOT NULL
        );
      `);
      await this.db.run(`
        CREATE TABLE IF NOT EXISTS sessions (
          token TEXT NOT NULL PRIMARY KEY,
          userid INTEGER,
          ctime INTEGER NOT NULL,
          FOREIGN KEY (userid) REFERENCES users (id)
        );
      `);
      resolve();
    });
  }

  /* -------- FASTIFY PLUGIN -------- */

  static plugin(
    app: FastifyInstance,
    options: {
      authInstance: Auth,
      sessionPostUrl?: string,
      sessionFailureUrl?: string,
      sessionSuccessUrl?: string,
      logoutPostUrl?: string,
      logoutRedirectUrl?: string,
      passwordPostUrl?: string,
      passwordFailureUrl?: string,
      passwordSuccessUrl?: string,
      createFailureUrl?: string,
      createSuccessUrl?: string
    },
    done: (err?: Error) => void
  ) {
    if (!options.authInstance) {
      return;
    }
    const auth = options.authInstance;

    app.register(cookiePlugin);

    app.decorateRequest(
      'getToken',
      function (this: FastifyRequest) {
        this.parseCookies();
        return this.cookies?.app_ses;
      }
    )

    app.decorateRequest(
      'verifyToken',
      async function (this: FastifyRequest) {
        const token = this.getToken();
        if (token === undefined) {
          return undefined;
        }
        return await auth.verifySession(token);
      }
    );

    // parse form POST requests
    app.addContentTypeParser(
      'application/x-www-form-urlencoded',
      function (_request: FastifyRequest, payload: IncomingMessage): Promise<{ [key: string]: string }> {
        return new Promise<{ [key: string]: string }>((resolve, _reject) => {
          let body = '';
          payload.on('data', (chunk) => {
            body += chunk;
          });
          payload.on('end', () => {
            resolve(urlQueryToObject(body));
          });
        });
      }
    );

    // POST: session initialization
    app.post<{
      Body: ILoginBody
    }>(
      options.sessionPostUrl ?? '/session',
      { schema: { body: loginBodySchema } },
      async (request, reply) => {
        // always create a token
        const token = await auth.generateSafeToken();

        // always redirect and set token cookie
        reply
          .code(302)
          .header('Set-Cookie', `app_ses=${token}; Max-Age=${SESSION_TIMEOUT}; Secure; HttpOnly; SameSite=Strict`);

        // search for user in database
        const user = await auth.getUserByName(request.body.username);

        if (user !== undefined) {
          // user exists, check password
          const hash = sha256Hash(request.body.password + user.salt);
          const hashABuf = Buffer.from(hash, 'utf8');
          const hashBBuf = Buffer.from(user.hash, 'utf8');
          if (timingSafeEqual(hashABuf, hashBBuf)) {
            // password correct
            // assign user session to token
            await auth.assignSession(user.id, token);
            reply
              .header('Set-Cookie', `app_user=${user.name}; Max-Age=${SESSION_TIMEOUT}; Secure; SameSite=Strict`)
              .header('Location', options.sessionSuccessUrl ?? '/')
              .send();
            return;
          }
        }

        // user does not exist or password was wrong
        // assign null session to token (for failed login check)
        await auth.assignSession(null, token);
        reply
          .header('Location', options.sessionFailureUrl ?? '/login')
          .send();
      }
    );

    // POST: session deletion
    app.post(
      options.logoutPostUrl ?? '/logout',
      async (request, reply) => {
        const token = request.getToken();
        if (token !== undefined) {
          await auth.deleteSession(token);
        }
        reply.code(302)
          .header('Location', options.logoutRedirectUrl ?? '/')
          .header('Set-Cookie', 'app_ses=; Max-Age=0; Secure; HttpOnly; SameSite=Strict')
          .header('Set-Cookie', 'app_user=; Max-Age=0; Secure; SameSite=Strict')
          .send();
      }
    );

    // POST: password change
    app.post<{
      Body: IPasswordBody
    }>(
      options.passwordPostUrl ?? '/password',
      { schema: { body: passwordBodySchema } },
      async (request, reply) => {
        reply.code(302);
        const userid = await request.verifyToken();
        if (userid !== undefined) {
          const user = (await auth.getUserById(userid))!;
          // check password
          const hash = sha256Hash(request.body.password + user.salt);
          const hashABuf = Buffer.from(hash, 'utf8');
          const hashBBuf = Buffer.from(user.hash, 'utf8');
          if (timingSafeEqual(hashABuf, hashBBuf)) {
            await auth.changeUserPassword(userid, request.body.newPassword);
            reply.header('Location', options.passwordSuccessUrl ?? '/')
              .send();
            return;
          }
        }
        reply.header('Location', options.passwordFailureUrl ?? '/')
          .send();
      }
    );

    // POST: account creation
    app.post<{
      Body: ILoginBody
    }>(
      '/api/auth/create',
      { schema: { body: loginBodySchema } },
      async (request, reply) => {
        reply.code(302);
        if (await auth.createUser(request.body.username, request.body.password) === undefined) {
          reply.header('Location', options.createFailureUrl);
        } else {
          reply.header('Location', options.createSuccessUrl);
        }
        reply.send();
      }
    )

    done();
  }

  /* -------- PUBLIC METHODS -------- */

  async initialized(): Promise<void> {
    await this.initializedPromise;
  }

  async getUserByName(username: string): Promise<User | undefined> {
    const result = await this.db!.get(`
      SELECT * FROM users WHERE name = ${sanitize(username)};
    `);
    if (result === undefined) {
      return undefined;
    }
    return {
      id: result.id,
      name: unsanitize(result.name),
      ctime: result.ctime,
      salt: result.salt,
      hash: result.hash
    }
  }

  async getUserById(userid: number): Promise<User | undefined> {
    const result = await this.db!.get(`
      SELECT * FROM users WHERE id = ${userid};
    `);
    if (result === undefined) {
      return undefined;
    }
    return {
      id: result.id,
      name: unsanitize(result.name),
      ctime: result.ctime,
      salt: result.salt,
      hash: result.hash
    }
  }

  async createUser(username: string, password: string): Promise<User | undefined> {
    const id = (await this.db!.get(`
      SELECT nextuserid FROM meta;
    `))!.nextuserid;
    console.log(id);
    if (await this.db!.get(`SELECT id FROM users WHERE name = ${sanitize(username)};`) !== undefined) {
      return undefined;
    }
    await this.db!.run(`
      UPDATE meta SET nextuserid = ${id + 1};
    `);
    const salt = generateSalt();
    const user = {
      id: id,
      name: username,
      ctime: nowSeconds(),
      salt: salt,
      hash: sha256Hash(password + salt)
    }
    await this.db!.run(`
      INSERT INTO users (
        id,
        name,
        ctime,
        salt,
        hash
      ) VALUES (
        ${user.id},
        ${sanitize(user.name)},
        ${user.ctime},
        "${user.salt}",
        "${user.hash}"
      );
    `);
    return user;
  }

  async changeUserPassword(userid: number, newPassword: string): Promise<void> {
    const salt = generateSalt();
    const hash = sha256Hash(newPassword + salt);
    await this.db!.run(`
      UPDATE users SET salt = "${salt}", hash = "${hash}" WHERE id = ${userid};
    `);
  }

  async deleteUser(): Promise<boolean> {
    // TODO: implementation
    return false;
  }

  /**
   * Assign a session token to a user or NULL
   * @param userid 
   * @param token 
   */
  async assignSession(userid: number | null, token: string): Promise<void> {
    await this.db!.run(`
      INSERT INTO sessions (token, userid, ctime) VALUES ("${token}", ${userid ?? 'NULL'}, ${nowSeconds()});
    `);
  }

  async verifySession(token: string): Promise<number | undefined> {
    return (await this.db!.get(`
      SELECT userid FROM sessions WHERE token = "${token}";
    `))?.userid;
  }

  async deleteSession(token: string): Promise<void> {
    await this.db!.run(`
      DELETE FROM sessions WHERE token = "${token}";
    `);
  }

  /* -------- PRIVATE METHODS -------- */

  private async generateSafeToken(): Promise<string> {
    let token: string;
    let exists: boolean;
    do {
      token = generateToken();
      exists = await this.db!.get(`
        SELECT token FROM sessions WHERE token = "${token}";
      `) !== undefined;
    } while (exists);
    return token;
  }

  private async purgeSessions(): Promise<void> {
    const purgeBefore = nowSeconds() - SESSION_TIMEOUT;
    await this.db!.run(`
      DELETE FROM sessions WHERE ctime <= ${purgeBefore};
    `);
  }
}

export const authPlugin = fp(Auth.plugin);

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function sanitize(input: string): string {
  return JSON.stringify(input);
}

function unsanitize(input: string): string {
  return JSON.parse(`"${input}"`);
}

function generateSalt(): string {
  return randomBytes(16).toString('hex');
}

function generateToken(): string {
  return randomBytes(64).toString('hex');
}

function sha256Hash(input: string): string {
  return createHash('sha256').update(input).digest('base64');
}
