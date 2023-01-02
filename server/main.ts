import fastify, { FastifyInstance } from 'fastify';
import * as fastifyStatic from '@fastify/static';
import * as path from 'path';
import { PROJECTROOT } from './lib/util.js';
import { Auth, authPlugin } from './lib/auth.js';

const PORT = 8888;

const app: FastifyInstance = fastify({ logger: false });
const auth = await Auth.new(path.resolve(PROJECTROOT, 'db', 'auth.sqlite3'));

app.register(fastifyStatic, {
  root: path.resolve(PROJECTROOT, 'static')
});

app.register(authPlugin, {
  authInstance: auth,
  sessionFailureUrl: '/login#failure',
  sessionSuccessUrl: '/',
  logoutRedirectUrl: '/',
  passwordFailureUrl: '/account#failure',
  passwordSuccessUrl: '/account#success',
  createFailureUrl: '/createUser.html#failure',
  createSuccessUrl: '/createUser.html#success'
});

app.listen({ port: PORT }, (err, addr) => {
  if (err) throw err;
  console.log(`Listening on ${addr}`);
});
