import { spawn } from 'child_process';

export class Terminal {
  private constructor() { }

  public static async new(): Promise<Terminal> {
    const instance = new Terminal();

    const proc = spawn('node', [
      `-p 'console.log(process.env)'`
    ], {
      shell: true,
      env: {
        'COLORTERM': 'truecolor',
        'TERM': 'xterm-256color',
        'FORCE_COLOR': ''
      }
    });
    proc.stdout.on('data', (data: Buffer) => {
      console.log(data);
      console.log(data.toString('utf8'));
    });
    proc.stderr.on('data', (data: Buffer) => {
      console.log(data);
      console.log(data.toString('utf8'));
    });

    return instance;
  }
}
