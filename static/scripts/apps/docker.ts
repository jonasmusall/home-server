import { domContentPromise } from '../lib/util.js';

await domContentPromise;

console.log(await (await fetch('/api/docker/containers')).json());
