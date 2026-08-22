import { describe, expect, it } from "vitest";

import { parseLegalMarkdown } from "./legal-markdown";

describe("parseLegalMarkdown", () => {
  it("parses headings, paragraphs, links, and lists", () => {
    const blocks = parseLegalMarkdown(`# Privacy Policy

Contact [support@skateu.app](mailto:support@skateu.app).

## Children

- First item
- Second item
`);

    expect(blocks[0]).toEqual({ type: "h1", text: "Privacy Policy" });
    expect(blocks[1]).toEqual({
      type: "paragraph",
      inlines: [
        { type: "text", value: "Contact " },
        {
          type: "link",
          label: "support@skateu.app",
          href: "mailto:support@skateu.app",
        },
        { type: "text", value: "." },
      ],
    });
    expect(blocks[2]).toEqual({ type: "h2", text: "Children" });
    expect(blocks[3]?.type).toBe("list");
  });
});
