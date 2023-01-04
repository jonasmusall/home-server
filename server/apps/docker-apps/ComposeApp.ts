import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { EventEmitter } from 'events';

export abstract class ComposeApp extends EventEmitter {
  readonly abstract name: string;
  readonly abstract dir: string;

  public instanceName?: string;

  private ctrlProc?: ChildProcessWithoutNullStreams;
  private ctrlStdoutChunks: Buffer[] = [];
  private attachProc?: ChildProcessWithoutNullStreams;
  private lineChunks: Buffer[] = [];

  constructor() {
    super();
  }

  public start(): Promise<void> {
    this.ctrlProc = spawn(
      'docker',
      [ 'compose', '--ansi', 'never', 'up', '-d' ],
      {
        cwd: this.dir
      }
    );

    this.ctrlProc.stdout.on('data', (chunk: Buffer) => {
      this.ctrlStdoutChunks.push(chunk);
    });

    this.ctrlProc.on('exit', this.handleStartProcExit);

    return new Promise((resolve, reject) => {
      this.once('started', resolve);
      this.once('error', reject);
    });
  }

  public run(command: string, timeoutMs: number = 2000): Promise<string> {
    this.attachProc?.stdin.write(command + '\x0a');
    return new Promise(resolve => {
      this.once('line', (line: string) => {
        resolve(line);
      });
      setTimeout(resolve, timeoutMs, '');
    });
  }

  private handleStartProcExit(code: number | null) {
    if (code !== 0) {
      console.error(`up: Non-zero return code (${code})`);
      this.emit('error', `up: Non-zero return code (${code})`);
      return;
    }
    const output = Buffer.concat(this.ctrlStdoutChunks).toString('utf8');
    const re = /.*Container ([a-zA-Z0-9-]+)  Started/gs;
    const match = output.match(re);
    if (match === null) {
      console.error('up: Unexpected output');
      this.emit('error', 'up: Unexpected output');
      return;
    }
    this.instanceName = match[1];
    this.attachProc = spawn(
      'docker',
      [ 'compose', 'attach', this.instanceName ],
      {
        cwd: this.dir
      }
    );
    this.attachProc.stdout.on('data', (chunk: Buffer) => {
      this.emit('stdout', chunk);
      let start = 0;
      let lfIndex = chunk.indexOf(0x0a);
      while (lfIndex != -1) {
        this.lineChunks.push(chunk.subarray(start, lfIndex));
        this.emit('line', Buffer.concat(this.lineChunks).toString('utf8'));
        this.lineChunks = [];
        start = lfIndex + 1;
        lfIndex = chunk.indexOf(0x0a, start);
      }
      this.lineChunks.push(chunk.subarray(start));
    });
    this.emit('started');
  }
}
