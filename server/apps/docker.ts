import websocketPlugin from '@fastify/websocket';
import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

export class Docker {
  public readonly plugin = fp(this._plugin);

  private constructor() { }

  public static async new(): Promise<Docker> {
    const instance = new Docker();

    return instance;
  }

  private _plugin(app: FastifyInstance, options: {}, done: (err?: Error) => void) {
    app.register(websocketPlugin);

    app.get('/api/docker/containers', async (request, reply) => {
    });

    app.get('/ws/docker', { websocket: true }, (connection, req) => {
    });

    done();
  }
}
