import { GameApp } from './GameApp.js';

export class MinecraftServer extends GameApp {
  async getPlayers(): Promise<number | string[]> {
    return 0;
  }
  name = 'minecraft-server';
  dir = '~/minecraft-server';
}
