import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import Dexie from 'dexie';
import { assert, describe, expect, it, onTestFinished, vi } from 'vitest';
import { contentBundle } from '@wara/content';
import { DAILY_TARGET_MIN_OPTIONS, RATING, type Repository, type ReviewState } from '@wara/core';
import { renderApp } from '../../renderApp';

const WAIT = { timeout: 3000 };
const DAY_MS = 24 * 60 * 60 * 1000;

const NE = 'kana:hira:ね';
const RE = 'kana:hira:れ';
const SO = 'kana:kata:ソ';

const KANA_IDS: ReadonlyArray<string> = contentBundle.items.flatMap((item) =>
  item.type === 'kana' ? [item.id] : [],
);

const reviewState = (itemId: string, due: Date): ReviewState => ({
  itemId,
  stability: 12,
  difficulty: 5,
  due,
  lastReview: new Date(due.getTime() - 12 * DAY_MS),
  reps: 3,
  lapses: 0,
  learningSteps: 0,
  state: 'review',
});

const futureDue = (): Date => new Date(Date.now() + 10 * DAY_MS);

const seedAllKanaExcept =
  (unseen: ReadonlyArray<string>) =>
  async (repository: Repository): Promise<void> => {
    const due = futureDue();
    await repository.commitReview(
      KANA_IDS.filter((id) => !unseen.includes(id)).map((id) => reviewState(id, due)),
      [],
    );
  };

const present = (query: () => HTMLElement | null, message: string): Promise<HTMLElement> =>
  waitFor(() => {
    const element = query();
    assert.isNotNull(element, message);
    return element;
  }, WAIT);

const nameField = (): Promise<HTMLElement> =>
  present(() => screen.queryByLabelText('Nama panggilan'), 'field "Nama panggilan" tidak ditemukan');

const startButton = (): Promise<HTMLElement> =>
  present(
    () => screen.queryByRole('button', { name: 'Mulai uji cepat' }),
    'tombol "Mulai uji cepat" tidak ditemukan',
  );

const startQuickTest = async (): Promise<void> => {
  fireEvent.change(await nameField(), { target: { value: 'Handal' } });
  fireEvent.click(await startButton());
};

const progressShown = (position: number, total: number): Promise<HTMLElement> =>
  present(
    () => screen.queryByText(`Huruf ${String(position)} dari ${String(total)}`),
    `"Huruf ${String(position)} dari ${String(total)}" tidak ditampilkan`,
  );

const romajiInput = (): Promise<HTMLElement> =>
  present(() => screen.queryByLabelText('Romaji'), 'input berlabel "Romaji" tidak ditemukan');

const answerTyped = async (text: string): Promise<void> => {
  fireEvent.change(await romajiInput(), { target: { value: text } });
  fireEvent.click(
    await present(() => screen.queryByRole('button', { name: 'Kirim' }), 'tombol "Kirim" tidak ditemukan'),
  );
};

const clickLanjut = async (): Promise<void> => {
  fireEvent.click(
    await present(() => screen.queryByRole('button', { name: 'Lanjut' }), 'tombol "Lanjut" tidak ditemukan'),
  );
};

const correctAnswerShown = (romaji: string): boolean => {
  const pattern = new RegExp(`Jawaban yang benar:\\s*${romaji}(?![a-z])`, 'u');
  return screen.queryAllByText((_content, element) => element !== null && pattern.test(element.textContent)).length > 0;
};

const headingShown = (name: string): Promise<HTMLElement> =>
  present(() => screen.queryByRole('heading', { level: 1, name }), `judul "${name}" tidak ditampilkan`);

const silenceConsoleError = (): void => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  onTestFinished(() => {
    spy.mockRestore();
  });
};

describe('OnboardingPage — profile step', () => {
  it('should show the name field, the five daily targets with 30 menit selected, and keep "Mulai uji cepat" disabled until the trimmed name is not empty', async () => {
    await renderApp({ path: '/mulai' });

    await headingShown('Selamat datang');
    const name = await nameField();
    assert.instanceOf(name, HTMLInputElement);
    const target = await present(
      () => screen.queryByLabelText('Target per hari'),
      'pilihan "Target per hari" tidak ditemukan',
    );
    assert.instanceOf(target, HTMLSelectElement);
    const options = within(target).getAllByRole('option');
    expect(options.map((option) => option.textContent.trim())).toEqual([
      '15 menit',
      '20 menit',
      '30 menit',
      '45 menit',
      '60 menit',
    ]);
    expect(options.map((option) => option.getAttribute('value'))).toEqual(DAILY_TARGET_MIN_OPTIONS.map(String));
    expect(target.value).toBe('30');

    const start = await startButton();
    assert.instanceOf(start, HTMLButtonElement);
    expect(name.value).toBe('');
    expect(start.disabled).toBe(true);

    fireEvent.change(name, { target: { value: '   ' } });
    expect(start.disabled).toBe(true);

    fireEvent.change(name, { target: { value: 'Handal' } });
    expect(start.disabled).toBe(false);
  });
});

describe('OnboardingPage — quick test', () => {
  it('should ask ね as "Huruf 1 dari 2" before the katakana ソ when only ね and ソ have no review state', async () => {
    await renderApp({ path: '/mulai', seed: seedAllKanaExcept([NE, SO]) });

    await startQuickTest();

    await headingShown('Uji cepat kana');
    await progressShown(1, 2);
    expect(screen.queryByText('Bagaimana bacaan huruf ini?')).not.toBeNull();
    const glyph = screen.queryByText('ね');
    assert.isNotNull(glyph, 'glyph ね tidak ditampilkan');
    expect(glyph.closest('[lang="ja"]')).not.toBeNull();
    expect(screen.queryByText('ソ')).toBeNull();
    expect(await romajiInput()).toBeInstanceOf(HTMLInputElement);
    expect(screen.queryByRole('button', { name: 'Belum kenal' })).not.toBeNull();
  });

  it('should commit ね as Again with confusedWith れ, bring れ due forward to now, and move to ソ when ね is answered as re', async () => {
    const { db } = await renderApp({
      path: '/mulai',
      seed: async (repository) => {
        await seedAllKanaExcept([NE, SO])(repository);
        await repository.commitReview([reviewState(RE, futureDue())], []);
      },
    });
    await startQuickTest();
    await progressShown(1, 2);

    await answerTyped('re');

    await present(() => screen.queryByText('Belum tepat'), '"Belum tepat" tidak ditampilkan');
    expect(correctAnswerShown('ne')).toBe(true);
    await clickLanjut();

    const logs = await waitFor(async () => {
      const written = await db.reviewLogs.where('itemId').equals(NE).toArray();
      expect(written).toHaveLength(1);
      return written;
    }, WAIT);
    const answeredBy = Date.now();
    expect(logs[0]).toMatchObject({ itemId: NE, rating: RATING.again, confusedWith: RE });
    expect(await db.reviewStates.get(NE)).toMatchObject({ itemId: NE });
    const partner = await db.reviewStates.get(RE);
    assert.isDefined(partner, 'state れ hilang');
    expect(partner.due.getTime()).toBeLessThanOrEqual(answeredBy);

    await progressShown(2, 2);
    expect(screen.queryByText('ソ')).not.toBeNull();
    expect(screen.queryByText('ね')).toBeNull();
  });

  it('should commit ソ as at least Good and reach "Hampir selesai" after the automatic continue when ソ is the only unseen kana and is answered so', async () => {
    const { db } = await renderApp({ path: '/mulai', seed: seedAllKanaExcept([SO]) });
    await startQuickTest();
    await progressShown(1, 1);
    expect(screen.queryByText('ソ')).not.toBeNull();

    await answerTyped('so');

    await present(() => screen.queryByText('Benar'), '"Benar" tidak ditampilkan');
    await headingShown('Hampir selesai');
    const logs = await db.reviewLogs.where('itemId').equals(SO).toArray();
    expect(logs).toHaveLength(1);
    const [log] = logs;
    assert.isDefined(log, 'log ソ tidak ditulis');
    expect(log).toMatchObject({ itemId: SO, confusedWith: null });
    expect(log.rating).toBeGreaterThanOrEqual(RATING.good);
    expect(await db.reviewStates.get(SO)).toMatchObject({ itemId: SO });
  });

  it('should write no state and no log for ね and move to ソ when "Belum kenal" is pressed', async () => {
    const { db } = await renderApp({ path: '/mulai', seed: seedAllKanaExcept([NE, SO]) });
    await startQuickTest();
    await progressShown(1, 2);

    fireEvent.click(
      await present(
        () => screen.queryByRole('button', { name: 'Belum kenal' }),
        'tombol "Belum kenal" tidak ditemukan',
      ),
    );

    await progressShown(2, 2);
    expect(screen.queryByText('ソ')).not.toBeNull();
    expect(await db.reviewStates.get(NE)).toBeUndefined();
    expect(await db.reviewLogs.where('itemId').equals(NE).toArray()).toHaveLength(0);
    expect(await db.reviewLogs.count()).toBe(0);
  });

  it('should go from "Mulai uji cepat" straight to "Hampir selesai" when every kana already has a review state', async () => {
    await renderApp({ path: '/mulai', seed: seedAllKanaExcept([]) });

    await startQuickTest();

    await headingShown('Hampir selesai');
    expect(screen.queryByRole('heading', { name: 'Uji cepat kana' })).toBeNull();
    expect(screen.queryByLabelText('Romaji')).toBeNull();
  });

  it('should stay on ね with an empty drill, show "Jawaban gagal disimpan. Coba jawab lagi." and write nothing when commitReview fails', async () => {
    const reDue = futureDue();
    const { db } = await renderApp({
      path: '/mulai',
      seed: async (repository) => {
        await seedAllKanaExcept([NE, SO])(repository);
        await repository.commitReview([reviewState(RE, reDue)], []);
      },
      beforeRender: (opened) => {
        opened.reviewLogs.hook('creating', () => {
          throw new Dexie.UnknownError('injected');
        });
      },
    });
    await startQuickTest();
    await progressShown(1, 2);

    await answerTyped('re');
    await present(() => screen.queryByText('Belum tepat'), '"Belum tepat" tidak ditampilkan');
    await clickLanjut();

    const alert = await present(() => screen.queryByRole('alert'), 'tidak ada role="alert"');
    expect(alert.textContent).toContain('Jawaban gagal disimpan. Coba jawab lagi.');
    expect(screen.queryByText('Huruf 1 dari 2')).not.toBeNull();
    expect(screen.queryByText('ね')).not.toBeNull();
    const input = await romajiInput();
    assert.instanceOf(input, HTMLInputElement);
    expect(input.value).toBe('');
    expect(screen.queryByText('Belum tepat')).toBeNull();
    expect(await db.reviewStates.get(NE)).toBeUndefined();
    expect(await db.reviewLogs.count()).toBe(0);
    expect((await db.reviewStates.get(RE))?.due.getTime()).toBe(reDue.getTime());
  });

  it('should show the route error "Terjadi kesalahan" when the review states cannot be read', async () => {
    silenceConsoleError();
    await renderApp({
      path: '/mulai',
      seed: seedAllKanaExcept([NE, SO]),
      beforeRender: (opened) => {
        opened.reviewStates.hook('reading', () => {
          throw new Dexie.UnknownError('gagal baca');
        });
      },
    });

    const first = await waitFor(() => {
      const error = screen.queryByRole('heading', { level: 1, name: 'Terjadi kesalahan' });
      const start = screen.queryByRole('button', { name: 'Mulai uji cepat' });
      const shown = error ?? start;
      assert.isNotNull(shown, 'halaman tidak menampilkan error maupun tombol "Mulai uji cepat"');
      return shown;
    }, WAIT);
    if (first.tagName === 'BUTTON') {
      fireEvent.change(await nameField(), { target: { value: 'Handal' } });
      fireEvent.click(first);
    }

    await headingShown('Terjadi kesalahan');
    expect(screen.queryByLabelText('Romaji')).toBeNull();
  });
});
