export type LegalInline =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "link"; label: string; href: string };

export type LegalBlock =
  | { type: "h1"; text: string }
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "paragraph"; inlines: LegalInline[] }
  | { type: "list"; items: LegalInline[][] };

const INLINE_TOKEN = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;

export function parseLegalInlines(text: string): LegalInline[] {
  const inlines: LegalInline[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(INLINE_TOKEN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      inlines.push({ type: "text", value: text.slice(lastIndex, index) });
    }

    if (match[1]) {
      inlines.push({ type: "bold", value: match[1] });
    } else if (match[2] && match[3]) {
      inlines.push({ type: "link", label: match[2], href: match[3] });
    }

    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) {
    inlines.push({ type: "text", value: text.slice(lastIndex) });
  }

  return inlines.length > 0 ? inlines : [{ type: "text", value: text }];
}

function headingLevel(line: string): 1 | 2 | 3 | null {
  if (line.startsWith("# ")) {
    return 1;
  }
  if (line.startsWith("## ")) {
    return 2;
  }
  if (line.startsWith("### ")) {
    return 3;
  }
  return null;
}

export function parseLegalMarkdown(markdown: string): LegalBlock[] {
  const blocks: LegalBlock[] = [];
  const chunks = markdown.replace(/\r\n/g, "\n").trim().split(/\n{2,}/);

  for (const chunk of chunks) {
    const lines = chunk
      .split("\n")
      .map((line) => line.trimEnd())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      continue;
    }

    const first = lines[0];
    const level = headingLevel(first);
    if (level && lines.length === 1) {
      const text = first.replace(/^#{1,3}\s+/, "");
      if (level === 1) {
        blocks.push({ type: "h1", text });
      } else if (level === 2) {
        blocks.push({ type: "h2", text });
      } else {
        blocks.push({ type: "h3", text });
      }
      continue;
    }

    if (lines.every((line) => /^\s*-\s/.test(line))) {
      blocks.push({
        type: "list",
        items: lines.map((line) =>
          parseLegalInlines(line.replace(/^\s*-\s/, "")),
        ),
      });
      continue;
    }

    blocks.push({
      type: "paragraph",
      inlines: parseLegalInlines(lines.join(" ")),
    });
  }

  return blocks;
}
