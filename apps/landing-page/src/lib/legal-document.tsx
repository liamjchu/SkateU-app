import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";

import { parseLegalMarkdown, type LegalInline } from "./legal-markdown";

function readLegalFile(filename: string): string {
  return readFileSync(join(process.cwd(), "content/legal", filename), "utf8");
}

function Inline({ inlines }: { inlines: LegalInline[] }): ReactNode {
  return inlines.map((inline, index) => {
    if (inline.type === "bold") {
      return (
        <strong key={index} className="font-bold text-ink">
          {inline.value}
        </strong>
      );
    }

    if (inline.type === "link") {
      const external = /^https?:/i.test(inline.href);
      return (
        <a
          key={index}
          href={inline.href}
          className="font-semibold text-ink underline underline-offset-2"
          {...(external
            ? { target: "_blank", rel: "noopener noreferrer" }
            : undefined)}
        >
          {inline.label}
        </a>
      );
    }

    return <span key={index}>{inline.value}</span>;
  });
}

export function LegalDocument({ filename }: { filename: string }) {
  const blocks = parseLegalMarkdown(readLegalFile(filename));

  return (
    <article className="mx-auto w-full max-w-[720px] px-5 py-12 sm:px-10 sm:py-16">
      {blocks.map((block, index) => {
        if (block.type === "h1") {
          return (
            <h1
              key={index}
              className="font-black uppercase tracking-[-0.04em] text-[clamp(1.75rem,6vw,3rem)] leading-[0.95] text-ink"
            >
              {block.text}
            </h1>
          );
        }

        if (block.type === "h2") {
          return (
            <h2
              key={index}
              className="mt-10 text-xl font-bold leading-7 text-ink sm:text-2xl"
            >
              {block.text}
            </h2>
          );
        }

        if (block.type === "h3") {
          return (
            <h3 key={index} className="mt-6 text-lg font-bold leading-6 text-ink">
              {block.text}
            </h3>
          );
        }

        if (block.type === "list") {
          return (
            <ul key={index} className="mt-4 list-disc space-y-2 pl-5 text-base leading-7 text-ink">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <Inline inlines={item} />
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={index} className="mt-4 text-pretty text-base leading-7 text-ink sm:text-lg">
            <Inline inlines={block.inlines} />
          </p>
        );
      })}
    </article>
  );
}
