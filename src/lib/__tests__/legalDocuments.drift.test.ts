import fs from 'fs';
import path from 'path';
import {
  COMMUNITY_GUIDELINES_MARKDOWN,
  PRIVACY_POLICY_MARKDOWN,
  TERMS_OF_USE_MARKDOWN,
} from '../../content/legal';

const root = path.join(__dirname, '../../..');

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('legal document copies stay in sync', () => {
  it('keeps Terms of Use identical in docs and the app', () => {
    expect(readRepoFile('docs/terms-of-use.md')).toBe(TERMS_OF_USE_MARKDOWN);
  });

  it('keeps the Privacy Policy identical across docs, app, and landing', () => {
    expect(readRepoFile('docs/privacy-policy.md')).toBe(PRIVACY_POLICY_MARKDOWN);
    expect(
      readRepoFile('apps/landing-page/content/legal/privacy-policy.md')
    ).toBe(PRIVACY_POLICY_MARKDOWN);
  });

  it('keeps Community Guidelines identical in docs and the app', () => {
    expect(readRepoFile('docs/community-guidelines.md')).toBe(
      COMMUNITY_GUIDELINES_MARKDOWN
    );
  });
});
