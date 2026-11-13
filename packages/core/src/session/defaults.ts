import type { RomajiAid } from '../domain';

export const RATE_TYPED_EASY_MAX_MS = 2500;
export const RATE_TYPED_GOOD_MAX_MS = 6000;
export const RATE_CHOICE_GOOD_MAX_MS = 4000;

export const KANA_EXIT_WORD_COUNT = 50;
export const KANA_EXIT_TIME_LIMIT_MS = 120_000;

export const JLPT_SIM_PASS_SCORE = { n5: 0.8, n4: 0.7 } as const;

export const DEFAULT_AVAILABLE_MIN = 30;
export const SESSION_SPLIT_MIN = { review: 5, newMaterial: 15, production: 10 } as const;

export const REVIEW_ITEM_SEC = 10;
export const NEW_ITEM_SEC = 30;
export const PRODUCTION_ITEM_SEC = 20;

export const NEW_ITEMS_PER_DAY = { phase0: 20, later: 10 } as const;
export const BACKLOG_HALVE_NEW_ABOVE = 100;
export const BACKLOG_STOP_NEW_ABOVE = 200;

export const FSRS_DESIRED_RETENTION = 0.9;
export const FSRS_ENABLE_FUZZ = false;

export const ROMAJI_AID_DEFAULT = { phase0: 'on-demand', later: 'off' } as const satisfies Record<'phase0' | 'later', RomajiAid>;
export const ROMAJI_AID_AUTO_OFF_ACCURACY = 0.95;
export const ROMAJI_AID_AUTO_OFF_WINDOW = 200;
