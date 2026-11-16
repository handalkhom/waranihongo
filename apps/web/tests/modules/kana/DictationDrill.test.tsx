import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, assert, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { UserProfile } from '@wara/core';
import type { KanaItem } from '@wara/content/schema';
import { SettingsContext } from '@/hooks/useSettings';
import { DictationDrill } from '@/modules/kana/DictationDrill';
import type { KanaDrillAnswer } from '@/modules/kana/types';
import { speakJapanese } from '@/services/tts';

vi.mock('@/services/tts', () => ({ speakJapanese: vi.fn() }));

const FEEDBACK_MS = 800;

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

const CHOICES: ReadonlyArray<KanaItem> = [RE, ME, NE, WA];

const profile = (): UserProfile => ({
  id: 'me',
  name: 'Handal',
  dailyTargetMin: 30,
  romajiAid: 'on-demand',
  theme: 'system',
  ttsVoiceUri: 'voice-x',
  startDate: '2026-11-13',
  weakSeeds: [],
});

const speak = vi.mocked(speakJapanese);

const newOnAnswer = (): Mock<(answer: KanaDrillAnswer) => void> => vi.fn<(answer: KanaDrillAnswer) => void>();

const renderDrill = (item: KanaItem, onAnswer: (answer: KanaDrillAnswer) => void): void => {
  render(<DictationDrill item={item} choices={CHOICES} onAnswer={onAnswer} />);
};

const renderDrillWithVoice = (item: KanaItem, onAnswer: (answer: KanaDrillAnswer) => void): void => {
  render(
    <SettingsContext value={{ status: 'ready', profile: profile() }}>
      <DictationDrill item={item} choices={CHOICES} onAnswer={onAnswer} />
    </SettingsContext>,
  );
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

const putarLagiButton = (): HTMLElement => {
  const button = screen.queryByRole('button', { name: 'Putar lagi' });
  assert.isNotNull(button, 'tombol "Putar lagi" tidak ditemukan');
  return button;
};

const lanjutButton = (): HTMLElement => {
  const button = screen.queryByRole('button', { name: 'Lanjut' });
  assert.isNotNull(button, 'tombol "Lanjut" tidak ditemukan');
  return button;
};

const textOutsideButtons = (): string => {
  const copy = document.body.cloneNode(true);
  assert.instanceOf(copy, HTMLElement);
  for (const button of Array.from(copy.querySelectorAll('button'))) {
    button.remove();
  }
  return copy.textContent;
};

const glyphsOutsideButtons = (char: string): ReadonlyArray<HTMLElement> =>
  screen.queryAllByText(char).filter((element) => element.closest('button') === null);

const correctAnswerShown = (char: string): boolean => {
  const pattern = new RegExp(`Jawaban yang benar:\\s*${char}`, 'u');
  return screen.queryAllByText((_content, element) => element !== null && pattern.test(element.textContent)).length > 0;
};

beforeEach(() => {
  speak.mockReset();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-16T09:00:00.000Z'));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('DictationDrill — audio', () => {
  it('should speak the item\'s char exactly once on mount with a null voice when no settings provider is present', () => {
    renderDrill(NE, newOnAnswer());

    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalledWith('ね', null);
  });

  it('should speak the item\'s char with the profile\'s ttsVoiceUri on mount and on "Putar lagi"', () => {
    renderDrillWithVoice(NE, newOnAnswer());

    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenLastCalledWith('ね', 'voice-x');
    fireEvent.click(putarLagiButton());

    expect(speak).toHaveBeenCalledTimes(2);
    expect(speak).toHaveBeenLastCalledWith('ね', 'voice-x');
  });

  it('should speak the item\'s char once more per "Putar lagi" click, also after a wrong answer, and not when a choice is clicked', () => {
    renderDrill(NE, newOnAnswer());

    fireEvent.click(putarLagiButton());
    expect(speak).toHaveBeenCalledTimes(2);
    expect(speak).toHaveBeenLastCalledWith('ね', null);
    fireEvent.click(choiceButton('れ'));
    expect(screen.queryByText('Belum tepat')).not.toBeNull();
    expect(speak).toHaveBeenCalledTimes(2);

    expect(putarLagiButton()).toHaveProperty('disabled', false);
    fireEvent.click(putarLagiButton());
    expect(speak).toHaveBeenCalledTimes(3);
    expect(speak).toHaveBeenLastCalledWith('ね', null);
  });

  it('should keep "Putar lagi" usable after a correct answer, before the drill continues', () => {
    renderDrill(NE, newOnAnswer());

    fireEvent.click(choiceButton('ね'));
    expect(screen.queryByText('Benar')).not.toBeNull();
    expect(putarLagiButton()).toHaveProperty('disabled', false);
    fireEvent.click(putarLagiButton());

    expect(speak).toHaveBeenCalledTimes(2);
    expect(speak).toHaveBeenLastCalledWith('ね', null);
  });
});

describe('DictationDrill — question', () => {
  it('should show the prompt "Dengarkan, lalu pilih hurufnya" without showing the item\'s glyph outside the choice buttons', () => {
    renderDrill(NE, newOnAnswer());

    choiceButton('ね');
    expect(screen.queryByText('Dengarkan, lalu pilih hurufnya')).not.toBeNull();
    expect(glyphsOutsideButtons('ね')).toEqual([]);
    expect(textOutsideButtons()).not.toContain('ね');
  });

  it('should render one button per choice, in the given order, each char inside a lang="ja" element', () => {
    renderDrill(NE, newOnAnswer());

    const expected = CHOICES.map((choice) => choiceButton(choice.data.char));
    const rendered = screen.getAllByRole('button').filter((button) => expected.includes(button));
    expect(rendered).toEqual(expected);
    expect(expected.map((button) => button.textContent.trim())).toEqual(['れ', 'め', 'ね', 'わ']);
    for (const choice of CHOICES) {
      const glyph = within(choiceButton(choice.data.char)).getByText(choice.data.char);
      expect(glyph.closest('[lang="ja"]')).not.toBeNull();
    }
  });
});

describe('DictationDrill — answering', () => {
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
    const revealed = glyphsOutsideButtons('ね');
    expect(revealed.length).toBeGreaterThan(0);
    for (const glyph of revealed) {
      expect(glyph.closest('[lang="ja"]')).not.toBeNull();
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
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it('should call onAnswer once with correct false and the chosen id after Lanjut, timed up to the click only', () => {
    const onAnswer = newOnAnswer();
    renderDrill(NE, onAnswer);

    advance(2600);
    fireEvent.click(choiceButton('め'));
    advance(4000);
    expect(onAnswer).not.toHaveBeenCalled();
    fireEvent.click(lanjutButton());

    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith({
      itemId: NE.id,
      correct: false,
      given: { mode: 'choice', itemId: ME.id },
      elapsedMs: 2600,
    });
  });
});
