import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, assert, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { KanaItem } from '@wara/content/schema';
import { RomajiToKanaDrill } from '@/modules/kana/RomajiToKanaDrill';
import type { KanaDrillAnswer } from '@/modules/kana/types';

const FEEDBACK_MS = 800;
const DRILL_BUTTON_HEIGHTS: ReadonlyArray<string> = ['h-14', 'h-16', 'h-20', 'min-h-14'];

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
const WA = hiragana('わ', 'wa');
const ME = hiragana('め', 'me');

const CHOICES: ReadonlyArray<KanaItem> = [RE, WA, NE, ME];

const newOnAnswer = (): Mock<(answer: KanaDrillAnswer) => void> => vi.fn<(answer: KanaDrillAnswer) => void>();

const renderDrill = (item: KanaItem, onAnswer: (answer: KanaDrillAnswer) => void): HTMLElement =>
  render(<RomajiToKanaDrill item={item} choices={CHOICES} onAnswer={onAnswer} />).container;

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

const textOutsideButtons = (container: HTMLElement): string => {
  const copy = container.cloneNode(true);
  assert.instanceOf(copy, HTMLElement);
  for (const button of copy.querySelectorAll('button')) {
    button.remove();
  }
  return copy.textContent;
};

const correctAnswerShown = (char: string): boolean => {
  const pattern = new RegExp(`Jawaban yang benar:\\s*${char}`, 'u');
  return screen.queryAllByText((_content, element) => element !== null && pattern.test(element.textContent)).length > 0;
};

const glyphsOutsideButtons = (char: string): ReadonlyArray<HTMLElement> =>
  screen.queryAllByText(char).filter((element) => element.closest('button') === null);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-16T09:00:00.000Z'));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('RomajiToKanaDrill', () => {
  it('should show the prompt "Pilih huruf untuk bunyi ini" and the item\'s romaji as the question', () => {
    renderDrill(NE, newOnAnswer());

    expect(screen.queryByText('Pilih huruf untuk bunyi ini')).not.toBeNull();
    expect(screen.queryByText('ne')).not.toBeNull();
  });

  it('should show the item\'s glyph only inside its choice button before an answer', () => {
    const container = renderDrill(NE, newOnAnswer());

    choiceButton('ね');
    expect(textOutsideButtons(container)).not.toContain('ね');
    expect(glyphsOutsideButtons('ね')).toEqual([]);
  });

  it('should render one button per choice, in the given order, each named by its char inside a lang="ja" element', () => {
    renderDrill(NE, newOnAnswer());

    const expected = CHOICES.map((choice) => choiceButton(choice.data.char));
    const rendered = screen.getAllByRole('button').filter((button) => expected.includes(button));
    expect(rendered).toEqual(expected);
    expect(expected.map((button) => button.textContent.trim())).toEqual(['れ', 'わ', 'ね', 'め']);
    for (const choice of CHOICES) {
      const glyph = screen.queryByText(choice.data.char);
      assert.isNotNull(glyph, `glyph ${choice.data.char} tidak ditampilkan`);
      expect(glyph.closest('button')).toBe(choiceButton(choice.data.char));
      expect(glyph.closest('[lang="ja"]')).not.toBeNull();
    }
  });

  it('should give every choice button a 56 px drill height class', () => {
    renderDrill(NE, newOnAnswer());

    for (const choice of CHOICES) {
      const button = choiceButton(choice.data.char);
      const heights = DRILL_BUTTON_HEIGHTS.filter((height) => button.classList.contains(height));
      expect(heights, `tinggi tombol ${choice.data.char}: ${button.className}`).toHaveLength(1);
    }
  });

  it('should show "Benar" and disable every choice when the item\'s own char is chosen', () => {
    const onAnswer = newOnAnswer();
    renderDrill(NE, onAnswer);

    fireEvent.click(choiceButton('ね'));

    expect(screen.queryByText('Benar')).not.toBeNull();
    expect(screen.queryByText('Belum tepat')).toBeNull();
    for (const choice of CHOICES) {
      expect(choiceButton(choice.data.char)).toHaveProperty('disabled', true);
    }
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it('should call onAnswer once, exactly 800 ms after a correct choice, with the elapsed time up to the click', () => {
    const onAnswer = newOnAnswer();
    renderDrill(NE, onAnswer);

    advance(1700);
    fireEvent.click(choiceButton('ね'));
    expect(screen.queryByText('Benar')).not.toBeNull();
    advance(FEEDBACK_MS - 1);
    expect(onAnswer).not.toHaveBeenCalled();
    advance(1);
    advance(5000);

    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith({
      itemId: NE.id,
      correct: true,
      given: { mode: 'choice', itemId: NE.id },
      elapsedMs: 1700,
    });
  });

  it('should show "Belum tepat" with ね in a lang="ja" element as the correct answer and a Lanjut button when れ is chosen for ね', () => {
    const onAnswer = newOnAnswer();
    renderDrill(NE, onAnswer);

    fireEvent.click(choiceButton('れ'));

    expect(screen.queryByText('Belum tepat')).not.toBeNull();
    expect(screen.queryByText('Benar')).toBeNull();
    expect(correctAnswerShown('ね')).toBe(true);
    expect(correctAnswerShown('れ')).toBe(false);
    const answers = glyphsOutsideButtons('ね');
    expect(answers).toHaveLength(1);
    for (const answer of answers) {
      expect(answer.closest('[lang="ja"]')).not.toBeNull();
    }
    lanjutButton();
  });

  it('should ignore further choice clicks and not continue by itself after a wrong choice', () => {
    const onAnswer = newOnAnswer();
    renderDrill(NE, onAnswer);

    fireEvent.click(choiceButton('れ'));
    expect(screen.queryByText('Belum tepat')).not.toBeNull();
    fireEvent.click(choiceButton('ね'));
    fireEvent.click(choiceButton('め'));
    advance(10_000);

    expect(screen.queryByText('Belum tepat')).not.toBeNull();
    expect(screen.queryByText('Benar')).toBeNull();
    expect(correctAnswerShown('ね')).toBe(true);
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it('should call onAnswer once with correct false and the chosen id after Lanjut, timed up to the click only', () => {
    const onAnswer = newOnAnswer();
    renderDrill(NE, onAnswer);

    advance(2400);
    fireEvent.click(choiceButton('れ'));
    advance(5000);
    expect(onAnswer).not.toHaveBeenCalled();
    fireEvent.click(lanjutButton());

    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith({
      itemId: NE.id,
      correct: false,
      given: { mode: 'choice', itemId: RE.id },
      elapsedMs: 2400,
    });
  });
});
