import {
  COMMUNITY_GUIDELINES_MARKDOWN,
  PRIVACY_POLICY_MARKDOWN,
  TERMS_OF_USE_MARKDOWN,
} from '../../content/legal';
import { parseLegalMarkdown } from '../legalMarkdown';

describe('parseLegalMarkdown', () => {
  it('parses headings, paragraphs, lists, bold, and links', () => {
    const blocks = parseLegalMarkdown(`# Title

Intro with **bold** and [mail](mailto:support@skateu.app).

## Section

- First item
- Second **item**
`);

    expect(blocks[0]).toEqual({ type: 'h1', text: 'Title' });
    expect(blocks[1]).toEqual({
      type: 'paragraph',
      inlines: [
        { type: 'text', value: 'Intro with ' },
        { type: 'bold', value: 'bold' },
        { type: 'text', value: ' and ' },
        { type: 'link', label: 'mail', href: 'mailto:support@skateu.app' },
        { type: 'text', value: '.' },
      ],
    });
    expect(blocks[2]).toEqual({ type: 'h2', text: 'Section' });
    expect(blocks[3]?.type).toBe('list');
  });

  it('keeps indented nested bullets as list items', () => {
    const blocks = parseLegalMarkdown(`- Parent
  - Child one
  - Child two`);

    expect(blocks).toEqual([
      {
        type: 'list',
        items: [
          [{ type: 'text', value: 'Parent' }],
          [{ type: 'text', value: 'Child one' }],
          [{ type: 'text', value: 'Child two' }],
        ],
      },
    ]);
  });

  it('renders the live policy documents with the expected titles', () => {
    expect(parseLegalMarkdown(TERMS_OF_USE_MARKDOWN)[0]).toEqual({
      type: 'h1',
      text: 'Terms of Use',
    });
    expect(parseLegalMarkdown(PRIVACY_POLICY_MARKDOWN)[0]).toEqual({
      type: 'h1',
      text: 'Privacy Policy',
    });
    expect(parseLegalMarkdown(COMMUNITY_GUIDELINES_MARKDOWN)[0]).toEqual({
      type: 'h1',
      text: 'Community Guidelines',
    });
    expect(TERMS_OF_USE_MARKDOWN).toContain('support@skateu.app');
    expect(TERMS_OF_USE_MARKDOWN).toContain(
      'a sole proprietor doing business as SkateU in Virginia'
    );
    expect(TERMS_OF_USE_MARKDOWN).toContain(
      'laws of the Commonwealth of Virginia'
    );
    expect(TERMS_OF_USE_MARKDOWN).not.toContain(
      '[JURISDICTION / LEGAL ENTITY TO BE DETERMINED]'
    );
    expect(PRIVACY_POLICY_MARKDOWN).toContain('support@skateu.app');
    expect(PRIVACY_POLICY_MARKDOWN).toContain(
      'a sole proprietor doing business as SkateU in Virginia'
    );
    expect(PRIVACY_POLICY_MARKDOWN).not.toContain(
      '[JURISDICTION / LEGAL ENTITY TO BE DETERMINED]'
    );
    expect(PRIVACY_POLICY_MARKDOWN).toContain(
      'Legal acceptance records are not public and are not used for analytics.'
    );
    expect(PRIVACY_POLICY_MARKDOWN).toContain(
      'We do not ask for or store your date of birth.'
    );
    expect(COMMUNITY_GUIDELINES_MARKDOWN).toContain('support@skateu.app');
    expect(COMMUNITY_GUIDELINES_MARKDOWN).toContain(
      'SkateU accounts are for people 13 and older.'
    );
    expect(COMMUNITY_GUIDELINES_MARKDOWN).toContain(
      'Do not post sexual content, including nudity or sexually suggestive material.'
    );
    expect(COMMUNITY_GUIDELINES_MARKDOWN).not.toContain(
      'sexual content involving anyone under 18'
    );
  });
});
