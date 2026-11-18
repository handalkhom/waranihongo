import type { LocalDate } from '@wara/core';

export function toLocalDate(now: Date): LocalDate {
  return `${String(now.getFullYear())}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
