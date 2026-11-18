import { useId, useState, type ReactElement } from 'react';
import type { KanaItem } from '@wara/content/schema';
import { ROMAJI_AID_DEFAULT, type RomajiAid } from '@wara/core';
import { TYPOGRAPHY } from '@/lib/typography';
import type { OnboardingSaveInput, OnboardingSaving } from './useOnboarding';

export interface WeakSeedStepProps {
  readonly seedChoices: ReadonlyArray<KanaItem>;
  readonly saving: OnboardingSaving;
  readonly onSave: (choice: OnboardingSaveInput) => void;
}

const ROMAJI_AID_OPTIONS: ReadonlyArray<{ readonly value: RomajiAid; readonly label: string }> = [
  { value: 'always', label: 'Selalu tampil' },
  { value: 'on-demand', label: 'Tampil saat diminta' },
  { value: 'off', label: 'Tidak tampil' },
];

export function WeakSeedStep({ seedChoices, saving, onSave }: WeakSeedStepProps): ReactElement {
  const radioName = useId();
  const [unchecked, setUnchecked] = useState<ReadonlySet<string>>(() => new Set());
  const [romajiAid, setRomajiAid] = useState<RomajiAid>(ROMAJI_AID_DEFAULT.phase0);

  const toggle = (id: string, checked: boolean): void => {
    setUnchecked((previous) => {
      const next = new Set(previous);
      if (checked) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (saving === 'saving') return;
        onSave({
          weakSeeds: seedChoices.flatMap((item) => (unchecked.has(item.id) ? [] : [item.id])),
          romajiAid,
        });
      }}
    >
      <h1 className={TYPOGRAPHY.pageTitle}>Hampir selesai</h1>
      {seedChoices.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className={TYPOGRAPHY.sectionTitle}>Huruf yang masih lemah</h2>
          <p className="text-sm text-muted-foreground">
            Huruf ini belum teruji. Yang dicentang diperkenalkan paling awal sebagai materi baru.
          </p>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {seedChoices.map((item) => (
              <label
                key={item.id}
                className="flex min-h-20 cursor-pointer items-center justify-center gap-3 rounded-md border bg-background p-3 hover:bg-accent has-checked:border-primary has-checked:bg-accent has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-offset-2"
              >
                <input
                  type="checkbox"
                  checked={!unchecked.has(item.id)}
                  onChange={(event) => {
                    toggle(item.id, event.target.checked);
                  }}
                  className="size-5 shrink-0 accent-primary focus-visible:outline-none"
                />
                <span lang="ja" className="text-5xl leading-none">
                  {item.data.char}
                </span>
              </label>
            ))}
          </div>
        </section>
      )}
      <fieldset className="flex flex-col gap-1">
        <legend className={`${TYPOGRAPHY.sectionTitle} mb-2`}>Bantuan romaji</legend>
        {ROMAJI_AID_OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex h-11 cursor-pointer items-center gap-3 rounded-md px-2 text-sm hover:bg-accent has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-offset-2 md:h-9"
          >
            <input
              type="radio"
              name={radioName}
              value={option.value}
              checked={romajiAid === option.value}
              onChange={() => {
                setRomajiAid(option.value);
              }}
              className="size-4 shrink-0 accent-primary focus-visible:outline-none"
            />
            {option.label}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-col gap-2">
        <button
          type="submit"
          disabled={saving === 'saving'}
          className="h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 md:h-9"
        >
          {saving === 'saving' ? 'Menyimpan…' : 'Simpan'}
        </button>
        {saving === 'failed' && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            Profil gagal disimpan. Coba lagi.
          </p>
        )}
      </div>
    </form>
  );
}
