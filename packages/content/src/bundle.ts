import { z } from 'zod';
import { confusionGroupsFileSchema, i18nFileSchema, seedFileSchema } from './schema/dataFiles';
import { ContentValidationError, type ContentIssue } from './schema/errors';
import { dataItemSchema } from './schema/item';
import { validateBundle, type ContentBundle } from './validate/validateBundle';

export interface RawContentFiles {
  readonly itemFiles: ReadonlyArray<{ readonly path: string; readonly data: unknown }>;
  readonly confusionGroups: unknown;
  readonly seed: unknown;
  readonly i18n: unknown;
}

const itemFileSchema = z.array(dataItemSchema).readonly();

const renderPath = (label: string, path: ReadonlyArray<PropertyKey>): string =>
  label +
  path.map((segment) => (typeof segment === 'number' ? `[${String(segment)}]` : `.${String(segment)}`)).join('');

const issuesOf = (label: string, result: z.ZodSafeParseResult<unknown>): ReadonlyArray<ContentIssue> =>
  result.success
    ? []
    : result.error.issues.map((issue) => ({ path: renderPath(label, issue.path), message: issue.message }));

export function parseBundle(raw: RawContentFiles): ContentBundle {
  const itemResults = raw.itemFiles.map((file) => ({
    path: file.path,
    result: itemFileSchema.safeParse(file.data),
  }));
  const confusionGroups = confusionGroupsFileSchema.safeParse(raw.confusionGroups);
  const seed = seedFileSchema.safeParse(raw.seed);
  const i18n = i18nFileSchema.safeParse(raw.i18n);
  const schemaIssues = [
    ...itemResults.flatMap(({ path, result }) => issuesOf(path, result)),
    ...issuesOf('confusion-groups.json', confusionGroups),
    ...issuesOf('seed/alan-weak.json', seed),
    ...issuesOf('i18n/id.json', i18n),
  ];
  if (schemaIssues.length > 0 || !confusionGroups.success || !seed.success || !i18n.success) {
    throw new ContentValidationError(schemaIssues);
  }
  const bundle: ContentBundle = {
    items: itemResults.flatMap(({ result }) => (result.success ? result.data : [])),
    confusionGroups: confusionGroups.data,
    seed: seed.data,
    i18n: i18n.data,
  };
  const crossFileIssues = validateBundle(bundle);
  if (crossFileIssues.length > 0) {
    throw new ContentValidationError(crossFileIssues);
  }
  return bundle;
}
