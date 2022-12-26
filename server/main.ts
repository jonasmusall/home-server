import fastify, { FastifyInstance } from 'fastify';
import * as fastifyStatic from '@fastify/static';
import * as path from 'path';
import { PROJECTROOT } from './lib/util.js';
import { pingpong } from './api/pingpong.js';
import { Auth } from './lib/auth.js';

const PORT = 8888;

const app: FastifyInstance = fastify({ logger: false });
const auth = new Auth(path.resolve(PROJECTROOT, 'db', 'auth.sqlite3'));
await auth.initialized();

declare module 'fastify' {
  interface FastifyReply {
    ssr: boolean
  }
}
app.decorateReply('ssr', false);
app.addHook('onSend', async (request, reply, payload) => {
  if (reply.ssr && typeof payload === 'string') {
    return payload
      .replaceAll('X-USERNAME', '');
  }
  return payload;
});

console.log(await auth.createUser('jonas', 'abc123'));

app.register(fastifyStatic, {
  root: path.resolve(PROJECTROOT, 'static')
});

app.register(Auth.plugin, {
  authInstance: auth,
  sessionPostUrl: '/session',
  sessionFailureUrl: '/login',
  sessionSuccessUrl: '/'
});

app.register(pingpong);

app.listen({ port: PORT }, (err, addr) => {
  if (err) throw err;
  console.log(`Listening on ${addr}`);
});
