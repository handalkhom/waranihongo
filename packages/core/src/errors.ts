export { ContentValidationError } from '@wara/content/schema';

export interface ImportIssue {
  readonly path: string;
  readonly message: string;
}

const LISTED_ISSUE_LIMIT = 5;

export class ImportFormatError extends Error {
  override readonly name = 'ImportFormatError';
  readonly issues: ReadonlyArray<ImportIssue>;

  constructor(issues: ReadonlyArray<ImportIssue>) {
    super(
      `Berkas impor tidak valid (${String(issues.length)} masalah): ${issues
        .slice(0, LISTED_ISSUE_LIMIT)
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join('; ')}${issues.length > LISTED_ISSUE_LIMIT ? '; …' : ''}`,
    );
    this.issues = issues;
  }
}

export class RepositoryError extends Error {
  override readonly name = 'RepositoryError';
  readonly operation: string;
  readonly ids: ReadonlyArray<string>;

  constructor({
    operation,
    ids,
    cause,
  }: {
    operation: string;
    ids: ReadonlyArray<string>;
    cause: unknown;
  }) {
    super(`Operasi penyimpanan gagal: ${operation} (${String(ids.length)} id)`, { cause });
    this.operation = operation;
    this.ids = ids;
  }
}
