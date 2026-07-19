import { readFile } from "node:fs/promises";
import path from "node:path";

import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

type Block =
  | { type: "h1"; text: string }
  | { type: "h2"; text: string }
  | { type: "li"; text: string }
  | { type: "p"; text: string };

function parseMarkdown(markdown: string): Block[] {
  const blocks: Block[] = [];

  for (const rawLine of markdown.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith("## ")) {
      blocks.push({ type: "h2", text: line.slice(3) });
    } else if (line.startsWith("# ")) {
      blocks.push({ type: "h1", text: line.slice(2) });
    } else if (line.startsWith("- ")) {
      blocks.push({ type: "li", text: line.slice(2) });
    } else {
      blocks.push({ type: "p", text: line });
    }
  }

  return blocks;
}

function renderInline(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "$1");
}

export default async function ChangelogPage() {
  const changelogPath = path.join(process.cwd(), "CHANGELOG.md");
  const markdown = await readFile(changelogPath, "utf-8");
  const blocks = parseMarkdown(markdown);

  let currentList: Block[] | null = null;
  const rendered: (Block | { type: "ul"; items: Block[] })[] = [];

  for (const block of blocks) {
    if (block.type === "li") {
      if (!currentList) {
        currentList = [];
        rendered.push({ type: "ul", items: currentList });
      }
      currentList.push(block);
    } else {
      currentList = null;
      rendered.push(block);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Changelog</h1>
        <Badge variant="secondary">MVP · Pilot</Badge>
      </header>
      <p className="text-sm text-muted-foreground">
        This is an MVP — things change daily. Feedback via the Ideas button.
      </p>

      <div className="flex flex-col gap-2">
        {rendered.map((block, index) => {
          if (block.type === "h1") {
            return (
              <h2
                key={index}
                className="mt-2 text-xl font-semibold tracking-tight"
              >
                {renderInline(block.text)}
              </h2>
            );
          }
          if (block.type === "h2") {
            return (
              <h3
                key={index}
                className="mt-4 text-base font-semibold text-foreground"
              >
                {renderInline(block.text)}
              </h3>
            );
          }
          if (block.type === "ul") {
            return (
              <ul key={index} className="list-disc space-y-1 pl-5 text-sm">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex} className="text-foreground">
                    {renderInline(item.text)}
                  </li>
                ))}
              </ul>
            );
          }
          return (
            <p key={index} className="text-sm text-muted-foreground">
              {renderInline(block.text)}
            </p>
          );
        })}
      </div>
    </div>
  );
}
