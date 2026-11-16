import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, assert, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { KanaItem } from '@wara/content/schema';
import { ContrastDrill } from '@/modules/kana/ContrastDrill';

const FEEDBACK_MS = 800;
const RNG_CALLS_PER_ROUND = 2;
const DRILL_BUTTON_HEIGHTS: ReadonlyArray<string> = ['h-14', 'h-16', 'h-20', 'min-h-14'];

const ASK_TARGET = 0.2;
const ASK_PARTNER = 0.7;
const TARGET_FIRST = 0.2;
const PARTNER_FIRST = 0.7;
const FALLBACK_RNG = 0.3;

const hiragana = (char: string, romaji: string): KanaItem => ({
  type: 'kana',
  id: `kana:hira:${char}`,
  level: 'kana',
  phase: 0,
  tags: [],
  data: { char, romaji, romajiAccepted: [romaji], script: 'hiragana', group: 'basic' },
});

const NE = hiragana('ね', 'ne');
const RE = hiragana('れ', 're');

const scriptedRng = (values: ReadonlyArray<number>): Mock<() => number> => {
  const rng = vi.fn<() => number>();
  for (const value of values) {
    rng.mockReturnValueOnce(value);
  }
  rng.mockReturnValue(FALLBACK_RNG);
  return rng;
};

const newOnDone = (): Mock<() => void> => vi.fn<() => void>();

const renderDrill = (rng: () => number, onDone: () => void): void => {
  render(<ContrastDrill target={NE} partner={RE} rng={rng} onDone={onDone} />);
};

const advance = (ms: number): void => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

const choiceButton = (char: string): HTMLElement => {
  const button = screen.queryByRole('button', { name: char });
  assert.isNotNull(button, `tombol pilihan "${char}" tidak ditemukan`);
  return button;
};

const lanjutButton = (): HTMLElement => {
  const button = screen.queryByRole('button', { name: 'Lanjut' });
  assert.isNotNull(button, 'tombol "Lanjut" tidak ditemukan');
  return button;
};

const choiceOrder = (): ReadonlyArray<string> => {
  const choices = [choiceButton('ね'), choiceButton('れ')];
  return screen
    .getAllByRole('button')
    .filter((button) => choices.includes(button))
    .map((button) => button.textContent.trim());
};

const textShown = (pattern: RegExp): boolean =>
  screen.queryAllByText((_content, element) => element !== null && pattern.test(element.textContent)).length > 0;

const promptShown = (romaji: string): boolean => textShown(new RegExp(`Pilih:\\s*${romaji}(?![a-z])`, 'u'));

const progressShown = (count: number): boolean => textShown(new RegExp(`Benar berturut-turut:\\s*${String(count)}\\s*/\\s*3`, 'u'));

const innermostWithText = (pattern: RegExp): ReadonlyArray<HTMLElement> => {
  const matches = screen.queryAllByText((_content, element) => element !== null && pattern.test(element.textContent));
  return matches.filter((element) => !matches.some((other) => other !== element && element.contains(other)));
};

const correctAnswerHolders = (char: string): ReadonlyArray<HTMLElement> =>
  innermostWithText(new RegExp(`Jawaban yang benar:\\s*${char}`, 'u'));

const pickCorrect = (char: string): void => {
  fireEvent.click(choiceButton(char));
  advance(FEEDBACK_MS);
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-16T09:00:00.000Z'));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ContrastDrill', () => {
  it('should title the drill "Bedakan ね dan れ" with the target first and each char in its own lang="ja" element', () => {
    renderDrill(scriptedRng([ASK_PARTNER, PARTNER_FIRST]), newOnDone());

    const headings = screen.queryAllByRole('heading').filter((heading) => /Bedakan\s*ね\s*dan\s*れ/u.test(heading.textContent));
    expect(headings).toHaveLength(1);
    for (const heading of headings) {
      for (const char of ['ね', 'れ']) {
        const glyph = within(heading).queryByText(char);
        assert.isNotNull(glyph, `huruf ${char} tidak ada di judul`);
        expect(glyph.closest('[lang="ja"]')).not.toBeNull();
      }
    }
  });

  it('should show "Benar berturut-turut: 0/3" before any pick', () => {
    renderDrill(scriptedRng([ASK_TARGET, TARGET_FIRST]), newOnDone());

    expect(progressShown(0)).toBe(true);
    expect(progressShown(1)).toBe(false);
  });

  it.each([
    { asked: ASK_TARGET, order: TARGET_FIRST, prompt: 'ne', other: 're', buttons: ['ね', 'れ'] },
    { asked: ASK_TARGET, order: PARTNER_FIRST, prompt: 'ne', other: 're', buttons: ['れ', 'ね'] },
    { asked: ASK_PARTNER, order: TARGET_FIRST, prompt: 're', other: 'ne', buttons: ['ね', 'れ'] },
    { asked: ASK_PARTNER, order: PARTNER_FIRST, prompt: 're', other: 'ne', buttons: ['れ', 'ね'] },
    { asked: 0.5, order: 0.5, prompt: 're', other: 'ne', buttons: ['れ', 'ね'] },
  ])(
    'should call rng exactly twice and show "Pilih: $prompt" with buttons $buttons when rng gives $asked then $order',
    ({ asked, order, prompt, other, buttons }) => {
      const rng = scriptedRng([asked, order]);
      renderDrill(rng, newOnDone());

      expect(rng).toHaveBeenCalledTimes(RNG_CALLS_PER_ROUND);
      expect(promptShown(prompt)).toBe(true);
      expect(promptShown(other)).toBe(false);
      expect(choiceOrder()).toEqual(buttons);
    },
  );

  it('should render exactly two choice buttons, each named by its char inside a lang="ja" element', () => {
    renderDrill(scriptedRng([ASK_TARGET, TARGET_FIRST]), newOnDone());

    const japaneseButtons = screen.queryAllByRole('button').filter((button) => button.querySelector('[lang="ja"]') !== null || button.closest('[lang="ja"]') !== null);
    expect(japaneseButtons).toHaveLength(2);
    for (const char of ['ね', 'れ']) {
      expect(screen.queryAllByRole('button', { name: char })).toHaveLength(1);
      const glyph = within(choiceButton(char)).queryByText(char);
      assert.isNotNull(glyph, `glyph ${char} tidak ada di tombolnya`);
      expect(glyph.closest('[lang="ja"]')).not.toBeNull();
    }
  });

  it('should give both choice buttons a 56 px drill height class', () => {
    renderDrill(scriptedRng([ASK_TARGET, TARGET_FIRST]), newOnDone());

    for (const char of ['ね', 'れ']) {
      const button = choiceButton(char);
      const heights = DRILL_BUTTON_HEIGHTS.filter((height) => button.classList.contains(height));
      expect(heights, `tinggi tombol ${char}: ${button.className}`).toHaveLength(1);
    }
  });

  it('should show "Benar", raise the count to 1/3, and disable both choices when the asked letter is picked', () => {
    const onDone = newOnDone();
    renderDrill(scriptedRng([ASK_TARGET, TARGET_FIRST]), onDone);

    fireEvent.click(choiceButton('ね'));

    expect(screen.queryByText('Benar')).not.toBeNull();
    expect(screen.queryByText('Belum tepat')).toBeNull();
    expect(progressShown(1)).toBe(true);
    expect(progressShown(0)).toBe(false);
    expect(choiceButton('ね')).toHaveProperty('disabled', true);
    expect(choiceButton('れ')).toHaveProperty('disabled', true);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('should start the next round from rng exactly 800 ms after a correct pick', () => {
    const rng = scriptedRng([ASK_TARGET, TARGET_FIRST, ASK_PARTNER, PARTNER_FIRST]);
    renderDrill(rng, newOnDone());

    fireEvent.click(choiceButton('ね'));
    advance(FEEDBACK_MS - 1);
    expect(rng).toHaveBeenCalledTimes(RNG_CALLS_PER_ROUND);
    expect(promptShown('ne')).toBe(true);
    advance(1);

    expect(rng).toHaveBeenCalledTimes(2 * RNG_CALLS_PER_ROUND);
    expect(promptShown('re')).toBe(true);
    expect(promptShown('ne')).toBe(false);
    expect(choiceOrder()).toEqual(['れ', 'ね']);
    expect(screen.queryByText('Benar')).toBeNull();
    expect(choiceButton('ね')).toHaveProperty('disabled', false);
    expect(choiceButton('れ')).toHaveProperty('disabled', false);
    expect(progressShown(1)).toBe(true);
  });

  it('should show "Belum tepat" with the asked れ in its own lang="ja" element as the correct answer when ね is picked for re', () => {
    renderDrill(scriptedRng([ASK_PARTNER, TARGET_FIRST]), newOnDone());

    fireEvent.click(choiceButton('ね'));

    expect(screen.queryByText('Belum tepat')).not.toBeNull();
    expect(screen.queryByText('Benar')).toBeNull();
    expect(correctAnswerHolders('ね')).toEqual([]);
    const holders = correctAnswerHolders('れ');
    expect(holders).toHaveLength(1);
    for (const holder of holders) {
      expect(holder.closest('button')).toBeNull();
      const glyph = within(holder).queryByText('れ');
      assert.isNotNull(glyph, 'jawaban benar れ tidak berada di elemennya sendiri');
      expect(glyph.closest('[lang="ja"]')).not.toBeNull();
    }
    expect(choiceButton('ね')).toHaveProperty('disabled', true);
    expect(choiceButton('れ')).toHaveProperty('disabled', true);
    lanjutButton();
  });

  it('should reset the count from 1/3 to 0/3 when a wrong letter is picked', () => {
    renderDrill(scriptedRng([ASK_TARGET, TARGET_FIRST, ASK_TARGET, PARTNER_FIRST]), newOnDone());

    pickCorrect('ね');
    expect(progressShown(1)).toBe(true);
    fireEvent.click(choiceButton('れ'));

    expect(screen.queryByText('Belum tepat')).not.toBeNull();
    expect(progressShown(0)).toBe(true);
    expect(progressShown(1)).toBe(false);
  });

  it('should not continue by itself after a wrong pick and ignore further choice clicks', () => {
    const rng = scriptedRng([ASK_TARGET, TARGET_FIRST]);
    const onDone = newOnDone();
    renderDrill(rng, onDone);

    fireEvent.click(choiceButton('れ'));
    expect(screen.queryByText('Belum tepat')).not.toBeNull();
    fireEvent.click(choiceButton('ね'));
    advance(10_000);

    expect(screen.queryByText('Belum tepat')).not.toBeNull();
    expect(screen.queryByText('Benar')).toBeNull();
    expect(progressShown(0)).toBe(true);
    expect(rng).toHaveBeenCalledTimes(RNG_CALLS_PER_ROUND);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('should start the next round from rng when Lanjut is pressed after a wrong pick', () => {
    const rng = scriptedRng([ASK_TARGET, TARGET_FIRST, ASK_PARTNER, PARTNER_FIRST]);
    renderDrill(rng, newOnDone());

    fireEvent.click(choiceButton('れ'));
    fireEvent.click(lanjutButton());

    expect(rng).toHaveBeenCalledTimes(2 * RNG_CALLS_PER_ROUND);
    expect(screen.queryByText('Belum tepat')).toBeNull();
    expect(promptShown('re')).toBe(true);
    expect(promptShown('ne')).toBe(false);
    expect(choiceOrder()).toEqual(['れ', 'ね']);
    expect(choiceButton('ね')).toHaveProperty('disabled', false);
    expect(progressShown(0)).toBe(true);
  });

  it('should call onDone once, exactly 800 ms after the third consecutive correct pick, and draw no further round', () => {
    const rng = scriptedRng([ASK_TARGET, TARGET_FIRST, ASK_PARTNER, PARTNER_FIRST, ASK_TARGET, PARTNER_FIRST]);
    const onDone = newOnDone();
    renderDrill(rng, onDone);

    pickCorrect('ね');
    pickCorrect('れ');
    expect(progressShown(2)).toBe(true);
    fireEvent.click(choiceButton('ね'));
    expect(screen.queryByText('Benar')).not.toBeNull();
    expect(progressShown(3)).toBe(true);
    advance(FEEDBACK_MS - 1);
    expect(onDone).not.toHaveBeenCalled();
    advance(1);
    advance(5000);

    expect(onDone).toHaveBeenCalledTimes(1);
    expect(rng).toHaveBeenCalledTimes(3 * RNG_CALLS_PER_ROUND);
  });

  it('should not call onDone after correct, correct, wrong, correct, correct, and call it once after one more correct', () => {
    const rng = scriptedRng([
      ASK_TARGET, TARGET_FIRST,
      ASK_PARTNER, TARGET_FIRST,
      ASK_TARGET, PARTNER_FIRST,
      ASK_PARTNER, PARTNER_FIRST,
      ASK_TARGET, TARGET_FIRST,
      ASK_PARTNER, PARTNER_FIRST,
    ]);
    const onDone = newOnDone();
    renderDrill(rng, onDone);

    pickCorrect('ね');
    pickCorrect('れ');
    fireEvent.click(choiceButton('れ'));
    fireEvent.click(lanjutButton());
    pickCorrect('れ');
    pickCorrect('ね');
    advance(5000);

    expect(onDone).not.toHaveBeenCalled();
    expect(progressShown(2)).toBe(true);
    expect(promptShown('re')).toBe(true);

    pickCorrect('れ');
    advance(5000);

    expect(onDone).toHaveBeenCalledTimes(1);
    expect(rng).toHaveBeenCalledTimes(6 * RNG_CALLS_PER_ROUND);
  });
});
