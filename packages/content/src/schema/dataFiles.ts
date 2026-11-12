import { z } from 'zod';
import { contentIdSchema } from './id';

const isNfc = (value: string): boolean => value === value.normalize('NFC');

const hasNoDuplicates = (values: ReadonlyArray<string>): boolean =>
  new Set(values).size === values.length;

export const confusionGroupSchema = z.object({
  id: z
    .string()
    .min(1, 'Id grup kebingungan tidak boleh kosong')
    .refine(isNfc, 'Id grup kebingungan harus dalam bentuk NFC'),
  items: z
    .array(contentIdSchema)
    .min(2, 'Grup kebingungan harus berisi minimal dua item')
    .refine(hasNoDuplicates, 'Grup kebingungan tidak boleh berisi item yang sama dua kali')
    .readonly(),
});

export const confusionGroupsFileSchema = z.array(confusionGroupSchema).readonly();

export const seedFileSchema = z.object({
  items: z
    .array(contentIdSchema)
    .min(1, 'Berkas seed harus berisi minimal satu item')
    .refine(hasNoDuplicates, 'Berkas seed tidak boleh berisi item yang sama dua kali')
    .readonly(),
});

export const i18nFileSchema = z
  .record(
    z.string().min(1, 'Kunci i18n tidak boleh kosong'),
    z
      .string()
      .min(1, 'Teks i18n tidak boleh kosong')
      .refine((value) => value.trim().length > 0, 'Teks i18n tidak boleh hanya berisi spasi')
      .refine((value) => value === value.trim(), 'Teks i18n tidak boleh diawali atau diakhiri spasi')
      .refine(isNfc, 'Teks i18n harus dalam bentuk NFC'),
  )
  .readonly();

export type ConfusionGroup = z.infer<typeof confusionGroupSchema>;
export type SeedFile = z.infer<typeof seedFileSchema>;
export type I18nFile = z.infer<typeof i18nFileSchema>;
