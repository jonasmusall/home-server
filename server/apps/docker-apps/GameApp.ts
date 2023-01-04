import { ComposeApp } from './ComposeApp.js';

export abstract class GameApp extends ComposeApp {
  abstract getPlayers(): Promise<number | Array<string>>;
}
