import { $id, domContentPromise, eventPromise } from './lib/util.js';
import { username } from './session.js';

await domContentPromise;

const accountCircle = $id('account-circle') as HTMLAnchorElement;
if (username !== undefined) {
  accountCircle.href = '/account';
}
