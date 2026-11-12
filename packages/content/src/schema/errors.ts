export interface ContentIssue {
  readonly path: string;
  readonly message: string;
}

const LISTED_ISSUE_LIMIT = 5;

export class ContentValidationError extends Error {
  override readonly name = 'ContentValidationError';
  readonly issues: ReadonlyArray<ContentIssue>;

  constructor(issues: ReadonlyArray<ContentIssue>) {
    super(
      `Konten tidak valid (${String(issues.length)} masalah): ${issues
        .slice(0, LISTED_ISSUE_LIMIT)
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join('; ')}${issues.length > LISTED_ISSUE_LIMIT ? '; …' : ''}`,
    );
    this.issues = issues;
  }
}
