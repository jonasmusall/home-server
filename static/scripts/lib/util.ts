export function eventPromise(object: EventTarget, type: string) {
  return new Promise(resolve => object.addEventListener(type, resolve));
}

export function $id(id: string) {
  return document.getElementById(id);
}

export const domContentPromise = eventPromise(window, 'DOMContentLoaded');
