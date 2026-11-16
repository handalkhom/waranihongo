import type { KanaData } from '@wara/content/schema';
import { tokenise } from './tokenise';

function geminateOf(following: string): string {
  if (following.startsWith('ch')) return 't';
  return /^[b-df-hj-np-tv-z]/.test(following) ? following.slice(0, 1) : '';
}

function romajiOf(token: KanaData, next: KanaData | undefined, built: string): string {
  const following = next === undefined ? '' : next.romaji;
  if (token.char === 'ー') return /[aeiou]$/.test(built) ? built.slice(-1) : '-';
  if (token.char === 'っ' || token.char === 'ッ') return geminateOf(following);
  if (token.char === 'ん' || token.char === 'ン') return /^[aeiouy]/.test(following) ? "n'" : token.romaji;
  return token.romaji;
}

export function romanize({
  reading,
  kana,
}: {
  readonly reading: string;
  readonly kana: ReadonlyArray<KanaData>;
}): string {
  const tokens = tokenise({ reading, kana });
  return tokens.reduce((built, token, index) => built + romajiOf(token, tokens[index + 1], built), '');
}
