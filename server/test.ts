import { ComposeApp } from './apps/docker-apps/ComposeApp';

class DockerTest extends ComposeApp {
  name = 'test';
  dir = '~/terraria-server';
}

let test = new DockerTest();

test.on('stdout', (chunk: Buffer) => console.log(chunk.toString('utf8')));

await test.start();
console.log('Container started');
