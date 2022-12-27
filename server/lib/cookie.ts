import { FastifyInstance } from 'fastify';
import { parse } from 'cookie';
import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyRequest {
    parseCookies: () => void,
    cookies: Record<string, string>
  }
}

function plugin(app: FastifyInstance, options: {}, done: (err?: Error) => void) {
  app.addHook(
    'onRequest',
    async function (request) {
      request.cookies = {};
    }
  );

  app.decorateRequest(
    'parseCookies',
    function () {
      this.cookies = {};
      const header = this.raw.headers.cookie;
      if (header) {
        this.cookies = parse(header);
      }
    }
  );

  done();
}

export const cookiePlugin = fp(plugin);
