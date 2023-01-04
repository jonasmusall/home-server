import { ComposeApp } from './ComposeApp';

export abstract class GameApp extends ComposeApp {
  abstract getPlayers(): Promise<number | Array<string>>;
}
