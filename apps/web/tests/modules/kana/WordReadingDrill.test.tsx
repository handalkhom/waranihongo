import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, assert, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { KanaData, VocabData, VocabItem } from '@wara/content/schema';
import { WordReadingDrill } from '@/modules/kana/WordReadingDrill';
import type { KanaDrillAnswer } from '@/modules/kana/types';

const FEEDBACK_MS = 800;

const kanaData = (
  char: string,
  romaji: string,
  romajiAccepted: ReadonlyArray<string>,
  script: KanaData['script'],
  group: KanaData['group'],
): KanaData => ({ char, romaji, romajiAccepted, script, group });

const KANA: ReadonlyArray<KanaData> = [
  kanaData('と', 'to', ['to'], 'hiragana', 'basic'),
  kanaData('も', 'mo', ['mo'], 'hiragana', 'basic'),
  kanaData('だ', 'da', ['da'], 'hiragana', 'dakuten'),
  kanaData('ち', 'chi', ['chi', 'ti'], 'hiragana', 'basic'),
  kanaData('き', 'ki', ['ki'], 'hiragana', 'basic'),
  kanaData('っ', '', [], 'hiragana', 'small'),
  kanaData('て', 'te', ['te'], 'hiragana', 'basic'),
  kanaData('し', 'shi', ['shi', 'si'], 'hiragana', 'basic'),
  kanaData('しゃ', 'sha', ['sha', 'sya'], 'hiragana', 'combination'),
  kanaData('ん', 'n', ['n', 'nn'], 'hiragana', 'basic'),
  kanaData('コ', 'ko', ['ko'], 'katakana', 'basic'),
  kanaData('ヒ', 'hi', ['hi'], 'katakana', 'basic'),
  kanaData('ー', '', [], 'katakana', 'mark'),
];

const readingWord = (word: string, meaningId: string, pos: VocabData['pos']): VocabItem => ({
  type: 'vocab',
  source: 'content',
  id: `vocab:other:${word}`,
  level: 'other',
  phase: 0,
  tags: ['reading-practice'],
  data: { word, reading: word, meaningId, pos, register: 'plain', examples: [] },
});

const TOMODACHI = readingWord('ともだち', 'vocab:other:ともだち', 'noun');
const KITTE = readingWord('きって', 'vocab:other:きって', 'noun');
const SHASHIN = readingWord('しゃしん', 'vocab:other:しゃしん', 'noun');
const KOOHII = readingWord('コーヒー', 'vocab:other:コーヒー', 'noun');

const newOnAnswer = (): Mock<(answer: KanaDrillAnswer) => void> => vi.fn<(answer: KanaDrillAnswer) => void>();

const renderDrill = (item: VocabItem, onAnswer: (answer: KanaDrillAnswer) => void): void => {
  render(<WordReadingDrill item={item} kana={KANA} onAnswer={onAnswer} />);
};

const advance = (ms: number): void => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
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
  const pattern = new RegExp(`Jawaban yang benar:\\s*${romaji}(?![a-z'-])`, 'u');
  return screen.queryAllByText((_content, element) => element !== null && pattern.test(element.textContent)).length > 0;
};

const enabledKirimButtons = (): ReadonlyArray<HTMLElement> =>
  screen.queryAllByRole('button', { name: 'Kirim' }).filter((button) => !button.matches(':disabled'));

const submitAndCollect = (item: VocabItem, text: string, elapsedMs: number): Mock<(answer: KanaDrillAnswer) => void> => {
  const onAnswer = newOnAnswer();
  renderDrill(item, onAnswer);
  advance(elapsedMs);
  type(text);
  fireEvent.submit(answerForm());
  return onAnswer;
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-16T09:00:00.000Z'));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('WordReadingDrill — prompt', () => {
  it('should show "Baca kata ini", the word ともだち inside a lang="ja" element, and a "Romaji" input without revealing tomodachi', () => {
    renderDrill(TOMODACHI, newOnAnswer());

    expect(screen.queryByText('Baca kata ini')).not.toBeNull();
    const word = screen.queryByText('ともだち');
    assert.isNotNull(word, 'kata ともだち tidak ditampilkan');
    expect(word.closest('[lang="ja"]')).not.toBeNull();
    expect(romajiInput().tagName).toBe('INPUT');
    expect(document.body.textContent).not.toMatch(/tomodachi/u);
  });

  it('should keep Kirim disabled while the input is empty or only whitespace and enable it once text is typed', () => {
    renderDrill(TOMODACHI, newOnAnswer());

    expect(kirimButton()).toHaveProperty('disabled', true);
    type('   ');
    expect(kirimButton()).toHaveProperty('disabled', true);
    type('t');
    expect(kirimButton()).toHaveProperty('disabled', false);
  });
});

describe('WordReadingDrill — correct readings', () => {
  it('should judge "Tomodachi " correct for ともだち via Kirim and call onAnswer once after 800 ms with the text as typed', () => {
    const onAnswer = newOnAnswer();
    renderDrill(TOMODACHI, onAnswer);

    advance(2400);
    type('Tomodachi ');
    fireEvent.click(kirimButton());

    expect(screen.queryByText('Benar')).not.toBeNull();
    expect(screen.queryByText('Belum tepat')).toBeNull();
    advance(FEEDBACK_MS - 1);
    expect(onAnswer).not.toHaveBeenCalled();
    advance(1);
    advance(5000);

    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith({
      itemId: TOMODACHI.id,
      correct: true,
      given: { mode: 'typed', text: 'Tomodachi ' },
      elapsedMs: 2400,
    });
  });

  it('should judge "tomodati" correct for ともだち when ち accepts ti, submitted with Enter', () => {
    const onAnswer = submitAndCollect(TOMODACHI, 'tomodati', 1100);

    expect(screen.queryByText('Benar')).not.toBeNull();
    advance(FEEDBACK_MS);

    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith({
      itemId: TOMODACHI.id,
      correct: true,
      given: { mode: 'typed', text: 'tomodati' },
      elapsedMs: 1100,
    });
  });

  it('should judge "kitte" correct for きって with っ doubling the next consonant', () => {
    const onAnswer = submitAndCollect(KITTE, 'kitte', 700);

    expect(screen.queryByText('Benar')).not.toBeNull();
    expect(screen.queryByText('Belum tepat')).toBeNull();
    advance(FEEDBACK_MS);

    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith({
      itemId: KITTE.id,
      correct: true,
      given: { mode: 'typed', text: 'kitte' },
      elapsedMs: 700,
    });
  });

  it('should judge "syasin" correct for しゃしん when しゃ accepts sya and し accepts si', () => {
    const onAnswer = submitAndCollect(SHASHIN, 'syasin', 3000);

    expect(screen.queryByText('Benar')).not.toBeNull();
    expect(screen.queryByText('Belum tepat')).toBeNull();
    advance(FEEDBACK_MS);

    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith({
      itemId: SHASHIN.id,
      correct: true,
      given: { mode: 'typed', text: 'syasin' },
      elapsedMs: 3000,
    });
  });

  it.each(['ko-hi-', 'koohii'])('should judge "%s" correct for コーヒー', (text) => {
    const onAnswer = submitAndCollect(KOOHII, text, 1600);

    expect(screen.queryByText('Benar')).not.toBeNull();
    expect(screen.queryByText('Belum tepat')).toBeNull();
    advance(FEEDBACK_MS);

    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith({
      itemId: KOOHII.id,
      correct: true,
      given: { mode: 'typed', text },
      elapsedMs: 1600,
    });
  });

  it('should make the input read-only, retire Kirim, and ignore a second submit once an answer is submitted', () => {
    const onAnswer = submitAndCollect(TOMODACHI, 'tomodachi', 500);

    expect(screen.queryByText('Benar')).not.toBeNull();
    expect(romajiInput()).toHaveProperty('readOnly', true);
    expect(enabledKirimButtons()).toEqual([]);
    type('tomadachi');
    fireEvent.submit(answerForm());
    advance(FEEDBACK_MS);

    expect(screen.queryByText('Belum tepat')).toBeNull();
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith(
      expect.objectContaining({ correct: true, given: { mode: 'typed', text: 'tomodachi' } }),
    );
  });
});

describe('WordReadingDrill — wrong readings', () => {
  it('should show "Belum tepat" with tomodachi as the correct answer and a Lanjut button when "tomadachi" is submitted for ともだち', () => {
    const onAnswer = submitAndCollect(TOMODACHI, 'tomadachi', 900);

    expect(screen.queryByText('Belum tepat')).not.toBeNull();
    expect(screen.queryByText('Benar')).toBeNull();
    expect(correctAnswerShown('tomodachi')).toBe(true);
    expect(correctAnswerShown('tomadachi')).toBe(false);
    expect(romajiInput()).toHaveProperty('readOnly', true);
    expect(enabledKirimButtons()).toEqual([]);
    lanjutButton();
    advance(10_000);
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it.each([
    { item: KITTE, text: 'kisutte', shown: 'kitte' },
    { item: KITTE, text: 'kite', shown: 'kitte' },
    { item: KOOHII, text: 'kohi', shown: 'koohii' },
  ])('should show $shown as the correct answer when "$text" is submitted for $item.data.word', ({ item, text, shown }) => {
    submitAndCollect(item, text, 400);

    expect(screen.queryByText('Belum tepat')).not.toBeNull();
    expect(screen.queryByText('Benar')).toBeNull();
    expect(correctAnswerShown(shown)).toBe(true);
  });

  it('should call onAnswer once with correct false and the typed text after Lanjut, timed up to the submit only', () => {
    const onAnswer = newOnAnswer();
    renderDrill(TOMODACHI, onAnswer);

    advance(3700);
    type('tomadachi');
    fireEvent.click(kirimButton());
    advance(4000);
    expect(onAnswer).not.toHaveBeenCalled();
    fireEvent.click(lanjutButton());

    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith({
      itemId: TOMODACHI.id,
      correct: false,
      given: { mode: 'typed', text: 'tomadachi' },
      elapsedMs: 3700,
    });
  });
});
