import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, assert, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { KanaData, KanaItem } from '@wara/content/schema';
import { KanaToRomajiDrill } from '@/modules/kana/KanaToRomajiDrill';
import type { KanaDrillAnswer } from '@/modules/kana/types';

const FEEDBACK_MS = 800;

const hiragana = (char: string, romaji: string, romajiAccepted: ReadonlyArray<string>): KanaItem => ({
  type: 'kana',
  id: `kana:hira:${char}`,
  level: 'kana',
  phase: 0,
  tags: [],
  data: { char, romaji, romajiAccepted, script: 'hiragana', group: 'basic' },
});

const NE = hiragana('ね', 'ne', ['ne']);
const RE = hiragana('れ', 're', ['re']);
const WA = hiragana('わ', 'wa', ['wa']);
const SHI = hiragana('し', 'shi', ['shi', 'si']);

const CHOICES: ReadonlyArray<KanaItem> = [RE, NE, SHI, WA];
const KANA: ReadonlyArray<KanaData> = [NE.data, RE.data, WA.data, SHI.data];

const newOnAnswer = (): Mock<(answer: KanaDrillAnswer) => void> => vi.fn<(answer: KanaDrillAnswer) => void>();

const renderChoice = (item: KanaItem, onAnswer: (answer: KanaDrillAnswer) => void): void => {
  render(<KanaToRomajiDrill item={item} answerMode="choice" choices={CHOICES} onAnswer={onAnswer} />);
};

const renderTyped = (item: KanaItem, onAnswer: (answer: KanaDrillAnswer) => void): void => {
  render(<KanaToRomajiDrill item={item} answerMode="typed" kana={KANA} onAnswer={onAnswer} />);
};

const advance = (ms: number): void => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

const choiceButton = (romaji: string): HTMLElement => {
  const button = screen.queryByRole('button', { name: romaji });
  assert.isNotNull(button, `tombol pilihan "${romaji}" tidak ditemukan`);
  return button;
};

const romajiInput = (): HTMLElement => {
  const input = screen.queryByLabelText('Romaji');
  assert.isNotNull(input, 'input berlabel "Romaji" tidak ditemukan');
  return input;
};

const kirimButton = (): HTMLElement => {
  const button = screen.queryByRole('button', { name: 'Kirim' });
  assert.isNotNull(button, 'tombol "Kirim" tidak ditemukan');
  return button;
};

const lanjutButton = (): HTMLElement => {
  const button = screen.queryByRole('button', { name: 'Lanjut' });
  assert.isNotNull(button, 'tombol "Lanjut" tidak ditemukan');
  return button;
};

const answerForm = (): HTMLFormElement => {
  const form = romajiInput().closest('form');
  assert.isNotNull(form, 'input "Romaji" tidak berada di dalam form');
  return form;
};

const type = (text: string): void => {
  fireEvent.change(romajiInput(), { target: { value: text } });
};

const correctAnswerShown = (romaji: string): boolean => {
  const pattern = new RegExp(`Jawaban yang benar:\\s*${romaji}(?![a-z])`, 'u');
  return screen.queryAllByText((_content, element) => element !== null && pattern.test(element.textContent)).length > 0;
};

const enabledKirimButtons = (): ReadonlyArray<HTMLElement> =>
  screen.queryAllByRole('button', { name: 'Kirim' }).filter((button) => !button.matches(':disabled'));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-16T09:00:00.000Z'));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('KanaToRomajiDrill — choice', () => {
  it('should show the kana glyph inside a lang="ja" element and the prompt "Bagaimana bacaan huruf ini?"', () => {
    renderChoice(NE, newOnAnswer());

    const glyph = screen.queryByText('ね');
    assert.isNotNull(glyph, 'glyph ね tidak ditampilkan');
    expect(glyph.closest('[lang="ja"]')).not.toBeNull();
    expect(screen.queryByText('Bagaimana bacaan huruf ini?')).not.toBeNull();
  });

  it('should render one button per choice labelled with its romaji, in the given order', () => {
    renderChoice(NE, newOnAnswer());

    const expected = CHOICES.map((choice) => choiceButton(choice.data.romaji));
    const rendered = screen.getAllByRole('button').filter((button) => expected.includes(button));
    expect(rendered).toEqual(expected);
    expect(expected.map((button) => button.textContent.trim())).toEqual(['re', 'ne', 'shi', 'wa']);
  });

  it('should show "Benar" and disable every choice when the item\'s own romaji is chosen', () => {
    const onAnswer = newOnAnswer();
    renderChoice(NE, onAnswer);

    fireEvent.click(choiceButton('ne'));

    expect(screen.queryByText('Benar')).not.toBeNull();
    expect(screen.queryByText('Belum tepat')).toBeNull();
    for (const choice of CHOICES) {
      expect(choiceButton(choice.data.romaji)).toHaveProperty('disabled', true);
    }
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it('should call onAnswer once, exactly 800 ms after a correct choice, with the elapsed time up to the click', () => {
    const onAnswer = newOnAnswer();
    renderChoice(NE, onAnswer);

    advance(1500);
    fireEvent.click(choiceButton('ne'));
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
      elapsedMs: 1500,
    });
  });

  it('should show "Belum tepat" with ne as the correct answer and a Lanjut button when れ is chosen for ね', () => {
    const onAnswer = newOnAnswer();
    renderChoice(NE, onAnswer);

    fireEvent.click(choiceButton('re'));

    expect(screen.queryByText('Belum tepat')).not.toBeNull();
    expect(screen.queryByText('Benar')).toBeNull();
    expect(correctAnswerShown('ne')).toBe(true);
    expect(correctAnswerShown('re')).toBe(false);
    lanjutButton();
  });

  it('should ignore further choice clicks and not continue by itself after a wrong choice', () => {
    const onAnswer = newOnAnswer();
    renderChoice(NE, onAnswer);

    fireEvent.click(choiceButton('re'));
    expect(screen.queryByText('Belum tepat')).not.toBeNull();
    fireEvent.click(choiceButton('ne'));
    fireEvent.click(choiceButton('wa'));
    advance(10_000);

    expect(screen.queryByText('Belum tepat')).not.toBeNull();
    expect(screen.queryByText('Benar')).toBeNull();
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it('should call onAnswer once with correct false and the chosen id after Lanjut, timed up to the click only', () => {
    const onAnswer = newOnAnswer();
    renderChoice(NE, onAnswer);

    advance(2300);
    fireEvent.click(choiceButton('re'));
    advance(5000);
    expect(onAnswer).not.toHaveBeenCalled();
    fireEvent.click(lanjutButton());

    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith({
      itemId: NE.id,
      correct: false,
      given: { mode: 'choice', itemId: RE.id },
      elapsedMs: 2300,
    });
  });
});

describe('KanaToRomajiDrill — typed', () => {
  it('should show the kana glyph inside a lang="ja" element, the prompt, and a "Romaji" input without revealing the answer', () => {
    renderTyped(NE, newOnAnswer());

    const glyph = screen.queryByText('ね');
    assert.isNotNull(glyph, 'glyph ね tidak ditampilkan');
    expect(glyph.closest('[lang="ja"]')).not.toBeNull();
    expect(screen.queryByText('Bagaimana bacaan huruf ini?')).not.toBeNull();
    expect(romajiInput().tagName).toBe('INPUT');
    expect(screen.queryByText('ne')).toBeNull();
  });

  it('should keep Kirim disabled while the input is empty or only whitespace and enable it once text is typed', () => {
    renderTyped(NE, newOnAnswer());

    expect(kirimButton()).toHaveProperty('disabled', true);
    type('   ');
    expect(kirimButton()).toHaveProperty('disabled', true);
    type('n');
    expect(kirimButton()).toHaveProperty('disabled', false);
  });

  it('should judge "NE " correct for ね via Kirim and call onAnswer once after 800 ms with the text as typed', () => {
    const onAnswer = newOnAnswer();
    renderTyped(NE, onAnswer);

    advance(1800);
    type('NE ');
    fireEvent.click(kirimButton());

    expect(screen.queryByText('Benar')).not.toBeNull();
    expect(screen.queryByText('Belum tepat')).toBeNull();
    advance(FEEDBACK_MS - 1);
    expect(onAnswer).not.toHaveBeenCalled();
    advance(1);
    advance(5000);

    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith({
      itemId: NE.id,
      correct: true,
      given: { mode: 'typed', text: 'NE ' },
      elapsedMs: 1800,
    });
  });

  it('should judge the variant "si" correct for し when submitted with Enter', () => {
    const onAnswer = newOnAnswer();
    renderTyped(SHI, onAnswer);

    advance(900);
    type('si');
    fireEvent.submit(answerForm());

    expect(screen.queryByText('Benar')).not.toBeNull();
    advance(FEEDBACK_MS);

    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith({
      itemId: SHI.id,
      correct: true,
      given: { mode: 'typed', text: 'si' },
      elapsedMs: 900,
    });
  });

  it('should make the input read-only, retire Kirim, and ignore a second submit once an answer is submitted', () => {
    const onAnswer = newOnAnswer();
    renderTyped(NE, onAnswer);

    type('ne');
    fireEvent.submit(answerForm());

    expect(screen.queryByText('Benar')).not.toBeNull();
    expect(romajiInput()).toHaveProperty('readOnly', true);
    expect(enabledKirimButtons()).toEqual([]);
    type('re');
    fireEvent.submit(answerForm());
    advance(FEEDBACK_MS);

    expect(screen.queryByText('Belum tepat')).toBeNull();
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith(
      expect.objectContaining({ correct: true, given: { mode: 'typed', text: 'ne' } }),
    );
  });

  it('should show "Belum tepat" with ne as the correct answer when "re" is submitted with Enter for ね', () => {
    const onAnswer = newOnAnswer();
    renderTyped(NE, onAnswer);

    type('re');
    fireEvent.submit(answerForm());

    expect(screen.queryByText('Belum tepat')).not.toBeNull();
    expect(screen.queryByText('Benar')).toBeNull();
    expect(correctAnswerShown('ne')).toBe(true);
    expect(romajiInput()).toHaveProperty('readOnly', true);
    expect(enabledKirimButtons()).toEqual([]);
    advance(10_000);
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it('should call onAnswer once with correct false and the typed text after Lanjut, timed up to the submit only', () => {
    const onAnswer = newOnAnswer();
    renderTyped(NE, onAnswer);

    advance(3200);
    type('re');
    fireEvent.click(kirimButton());
    advance(4000);
    fireEvent.click(lanjutButton());

    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith({
      itemId: NE.id,
      correct: false,
      given: { mode: 'typed', text: 're' },
      elapsedMs: 3200,
    });
  });
});
