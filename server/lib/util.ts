import { fileURLToPath, URLSearchParams } from 'url';

export const PROJECTROOT = fileURLToPath(new URL('../..', import.meta.url));

export function urlQueryToObject(query: string): { [key: string]: string } {
  const entries = new URLSearchParams(query).entries();
  const result = {} as { [key: string]: string };
  for (const [key, value] of entries) {
    result[key] = value;
  }
  return result;
}
