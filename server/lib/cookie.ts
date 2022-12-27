import { FastifyInstance } from 'fastify';
import { parse } from 'cookie';
import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyRequest {
    parseCookies: () => void,
    cookies: Record<string, string>
  }
}

function plugin(app: FastifyInstance) {
  app.decorateRequest(
    'cookies',
    {}
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
}

export const cookiePlugin = fp(plugin);
