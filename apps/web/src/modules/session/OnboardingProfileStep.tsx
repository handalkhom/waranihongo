import { useId, useState, type ReactElement } from 'react';
import { DAILY_TARGET_MIN_OPTIONS, DEFAULT_AVAILABLE_MIN } from '@wara/core';
import { TYPOGRAPHY } from '@/lib/typography';

export interface OnboardingProfileStepProps {
  readonly onStart: (profile: { readonly name: string; readonly dailyTargetMin: number }) => void;
}

const FIELD_CLASS =
  'h-11 w-full rounded-md border bg-transparent px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:h-9 md:text-sm';

export function OnboardingProfileStep({ onStart }: OnboardingProfileStepProps): ReactElement {
  const nameId = useId();
  const targetId = useId();
  const [name, setName] = useState('');
  const [dailyTargetMin, setDailyTargetMin] = useState<number>(DEFAULT_AVAILABLE_MIN);
  const blank = name.trim() === '';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className={TYPOGRAPHY.pageTitle}>Selamat datang</h1>
        <p className="text-sm text-muted-foreground">
          Isi nama panggilan dan target harian. Setelah itu ada uji cepat: ketik romaji untuk tiap huruf hiragana dan
          katakana dasar. Tekan &quot;Belum kenal&quot; untuk huruf yang belum Anda kenal.
        </p>
      </div>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (blank) return;
          onStart({ name: name.trim(), dailyTargetMin });
        }}
      >
        <div className="flex flex-col gap-2">
          <label htmlFor={nameId} className="text-sm font-medium">
            Nama panggilan
          </label>
          <input
            id={nameId}
            type="text"
            value={name}
            maxLength={40}
            autoComplete="nickname"
            onChange={(event) => {
              setName(event.target.value);
            }}
            className={FIELD_CLASS}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={targetId} className="text-sm font-medium">
            Target per hari
          </label>
          <select
            id={targetId}
            value={String(dailyTargetMin)}
            onChange={(event) => {
              const selected = DAILY_TARGET_MIN_OPTIONS.find((option) => String(option) === event.target.value);
              if (selected !== undefined) setDailyTargetMin(selected);
            }}
            className={FIELD_CLASS}
          >
            {DAILY_TARGET_MIN_OPTIONS.map((option) => (
              <option key={option} value={String(option)}>
                {option} menit
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={blank}
          className="h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 md:h-9"
        >
          Mulai uji cepat
        </button>
      </form>
    </div>
  );
}
