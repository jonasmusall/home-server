import { FastifyInstance } from 'fastify';

export async function pingpong(app: FastifyInstance, options: any) {
  app.get('/api/ping', (request, reply) => {
    reply.send('pong');
  });
}
