import { $id, eventPromise } from '../scripts/lib/util.js';
import { username } from '../scripts/session.js';

await eventPromise(window, 'DOMContentLoaded');

$id('username')!.innerText = username ?? '';
