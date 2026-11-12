import type { ConfusionGroup, I18nFile, SeedFile } from '../schema/dataFiles';
import type { ContentIssue } from '../schema/errors';
import type { DataItem } from '../schema/item';

export interface ContentBundle {
  readonly items: ReadonlyArray<DataItem>;
  readonly confusionGroups: ReadonlyArray<ConfusionGroup>;
  readonly seed: SeedFile;
  readonly i18n: I18nFile;
}

const isRepeat = (ids: ReadonlyArray<string>, id: string, index: number): boolean => ids.indexOf(id) !== index;

const missingItems = (
  ids: ReadonlyArray<string>,
  itemIds: ReadonlySet<string>,
  pathOf: (index: number) => string,
): ReadonlyArray<ContentIssue> =>
  ids.flatMap((id, index) =>
    itemIds.has(id) ? [] : [{ path: pathOf(index), message: `"${id}" tidak ada di daftar item` }],
  );

const meaningIssues = (item: DataItem, index: number, i18n: I18nFile): ReadonlyArray<ContentIssue> => {
  switch (item.type) {
    case 'kana':
      return [];
    case 'vocab':
      return Object.hasOwn(i18n, item.data.meaningId)
        ? []
        : [
            {
              path: `items[${String(index)}].data.meaningId`,
              message: `meaningId "${item.data.meaningId}" tidak ada di i18n`,
            },
          ];
    default:
      return item satisfies never;
  }
};

const itemIssues = (
  item: DataItem,
  index: number,
  itemIds: ReadonlyArray<string>,
  knownIds: ReadonlySet<string>,
  i18n: I18nFile,
): ReadonlyArray<ContentIssue> => [
  ...(item.supersededBy === undefined || knownIds.has(item.supersededBy)
    ? []
    : [
        {
          path: `items[${String(index)}].supersededBy`,
          message: `supersededBy "${item.supersededBy}" tidak ada di daftar item`,
        },
      ]),
  ...meaningIssues(item, index, i18n),
  ...(isRepeat(itemIds, item.id, index)
    ? [{ path: `items[${String(index)}].id`, message: `id "${item.id}" ganda` }]
    : []),
];

const groupIssues = (
  group: ConfusionGroup,
  index: number,
  groupIds: ReadonlyArray<string>,
  knownIds: ReadonlySet<string>,
): ReadonlyArray<ContentIssue> => [
  ...missingItems(group.items, knownIds, (member) => `confusionGroups[${String(index)}].items[${String(member)}]`),
  ...(isRepeat(groupIds, group.id, index)
    ? [{ path: `confusionGroups[${String(index)}].id`, message: `id grup kebingungan "${group.id}" ganda` }]
    : []),
];

export function validateBundle(bundle: ContentBundle): ReadonlyArray<ContentIssue> {
  const itemIds = bundle.items.map((item) => item.id);
  const knownIds = new Set(itemIds);
  const groupIds = bundle.confusionGroups.map((group) => group.id);
  return [
    ...bundle.items.flatMap((item, index) => itemIssues(item, index, itemIds, knownIds, bundle.i18n)),
    ...bundle.confusionGroups.flatMap((group, index) => groupIssues(group, index, groupIds, knownIds)),
    ...missingItems(bundle.seed.items, knownIds, (index) => `seed.items[${String(index)}]`),
  ];
}
