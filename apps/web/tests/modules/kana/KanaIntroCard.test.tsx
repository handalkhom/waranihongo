import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, assert, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { contentBundle } from '@wara/content';
import type { KanaItem } from '@wara/content/schema';
import type { UserProfile } from '@wara/core';
import { SettingsContext } from '@/hooks/useSettings';
import { KanaIntroCard } from '@/modules/kana/KanaIntroCard';
import { speakJapanese } from '@/services/tts';

vi.mock('@/services/tts', () => ({ speakJapanese: vi.fn() }));

const KANA: ReadonlyArray<KanaItem> = contentBundle.items.flatMap((item) => (item.type === 'kana' ? [item] : []));

const kanaById = (id: string): KanaItem => {
  const found = KANA.find((item) => item.id === id);
  assert.isDefined(found, `kana "${id}" tidak ada di konten`);
  return found;
};

const NE = kanaById('kana:hira:ね');
const A = kanaById('kana:hira:あ');

const ALL_MNEMONICS: ReadonlyArray<string> = KANA.flatMap((item) =>
  item.data.mnemonic === undefined ? [] : [item.data.mnemonic],
);

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

const newOnDone = (): Mock<() => void> => vi.fn<() => void>();

const renderCard = (item: KanaItem, onDone: () => void): void => {
  render(<KanaIntroCard item={item} onDone={onDone} />);
};

const renderCardWithVoice = (item: KanaItem, onDone: () => void): void => {
  render(
    <SettingsContext value={{ status: 'ready', profile: profile() }}>
      <KanaIntroCard item={item} onDone={onDone} />
    </SettingsContext>,
  );
};

const button = (name: string): HTMLElement => {
  const found = screen.queryByRole('button', { name });
  assert.isNotNull(found, `tombol "${name}" tidak ditemukan`);
  return found;
};

const textOutsideButtons = (): string => {
  const copy = document.body.cloneNode(true);
  assert.instanceOf(copy, HTMLElement);
  for (const element of Array.from(copy.querySelectorAll('button'))) {
    element.remove();
  }
  return copy.textContent;
};

const glyphsOutsideButtons = (char: string): ReadonlyArray<HTMLElement> =>
  screen.queryAllByText(char).filter((element) => element.closest('button') === null);

beforeEach(() => {
  speak.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('KanaIntroCard — content', () => {
  it('should show the kana ね outside any button inside a lang="ja" element', () => {
    renderCard(NE, newOnDone());

    const glyphs = glyphsOutsideButtons('ね');
    expect(glyphs.length).toBeGreaterThan(0);
    for (const glyph of glyphs) {
      expect(glyph.closest('[lang="ja"]')).not.toBeNull();
    }
  });

  it('should show the romaji "ne" outside the buttons when the kana is ね', () => {
    renderCard(NE, newOnDone());

    expect(textOutsideButtons()).toMatch(/\bne\b/u);
  });

  it('should show the kana あ in a lang="ja" element and its romaji "a" when the kana has no mnemonic', () => {
    renderCard(A, newOnDone());

    const glyphs = glyphsOutsideButtons('あ');
    expect(glyphs.length).toBeGreaterThan(0);
    for (const glyph of glyphs) {
      expect(glyph.closest('[lang="ja"]')).not.toBeNull();
    }
    expect(textOutsideButtons()).toMatch(/\ba\b/u);
  });

  it('should show the Indonesian mnemonic of ね when the kana has one', () => {
    renderCard(NE, newOnDone());

    assert.isDefined(NE.data.mnemonic);
    expect(textOutsideButtons()).toContain(NE.data.mnemonic);
  });

  it('should show no mnemonic text and no empty placeholder when the kana あ has no mnemonic', () => {
    assert.isUndefined(A.data.mnemonic);
    assert.isNotEmpty(ALL_MNEMONICS);
    renderCard(A, newOnDone());

    button('Mengerti');
    const text = textOutsideButtons();
    for (const mnemonic of ALL_MNEMONICS) {
      expect(text).not.toContain(mnemonic);
    }
    expect(text).not.toMatch(/undefined|null/u);
  });
});

describe('KanaIntroCard — audio', () => {
  it('should not speak on mount', () => {
    renderCard(NE, newOnDone());

    button('Dengar');
    expect(speak).not.toHaveBeenCalled();
  });

  it('should speak the char once per "Dengar" press with a null voice when no settings provider is present', () => {
    renderCard(NE, newOnDone());

    fireEvent.click(button('Dengar'));
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenLastCalledWith('ね', null);
    fireEvent.click(button('Dengar'));

    expect(speak).toHaveBeenCalledTimes(2);
    expect(speak).toHaveBeenLastCalledWith('ね', null);
  });

  it('should speak the char with the profile\'s ttsVoiceUri when "Dengar" is pressed inside a ready settings provider', () => {
    renderCardWithVoice(A, newOnDone());

    expect(speak).not.toHaveBeenCalled();
    fireEvent.click(button('Dengar'));

    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalledWith('あ', 'voice-x');
  });

  it('should not call onDone when "Dengar" is pressed', () => {
    const onDone = newOnDone();
    renderCard(NE, onDone);

    fireEvent.click(button('Dengar'));

    expect(speak).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
  });
});

describe('KanaIntroCard — done', () => {
  it('should not call onDone on mount', () => {
    const onDone = newOnDone();
    renderCard(NE, onDone);

    button('Mengerti');
    expect(onDone).not.toHaveBeenCalled();
  });

  it('should call onDone exactly once per "Mengerti" press without speaking', () => {
    const onDone = newOnDone();
    renderCard(NE, onDone);

    fireEvent.click(button('Mengerti'));
    expect(onDone).toHaveBeenCalledTimes(1);
    fireEvent.click(button('Mengerti'));

    expect(onDone).toHaveBeenCalledTimes(2);
    expect(speak).not.toHaveBeenCalled();
  });
});
