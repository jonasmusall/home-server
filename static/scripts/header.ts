import { $id, eventPromise } from './lib/util.js';
import { username } from './session.js';

await eventPromise(window, 'DOMContentLoaded');

const accountCircle = $id('account-circle') as HTMLAnchorElement;
if (username !== undefined) {
  accountCircle.href = '/account';
}
