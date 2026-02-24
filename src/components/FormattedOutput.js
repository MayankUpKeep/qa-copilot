"use client";

function parseTable(lines) {
  const rows = lines
    .filter((l) => !l.trim().match(/^\|[\s\-:|]+\|$/))
    .map((l) =>
      l
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim())
    );

  if (rows.length < 1) return null;

  const header = rows[0];
  const body = rows.slice(1);

  return { header, body };
}

const ALIGNMENT_TAGS = {
  "[ALIGNED]": { label: "ALIGNED", cls: "bg-green-100 text-green-800 border-green-300" },
  "[PLAN A ONLY]": { label: "PLAN A ONLY", cls: "bg-amber-100 text-amber-800 border-amber-300" },
  "[PLAN B ONLY]": { label: "PLAN B ONLY", cls: "bg-blue-100 text-blue-800 border-blue-300" },
};

function renderAlignmentBadge(tag, key) {
  const info = ALIGNMENT_TAGS[tag];
  if (!info) return null;
  return (
    <span key={key} className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded border mr-1.5 ${info.cls}`}>
      {info.label}
    </span>
  );
}

function renderInlineMarkdown(text) {
  if (!text) return text;

  const parts = [];
  let remaining = text;
  let key = 0;

  for (const tag of Object.keys(ALIGNMENT_TAGS)) {
    if (remaining.startsWith(tag)) {
      parts.push(renderAlignmentBadge(tag, key++));
      remaining = remaining.slice(tag.length).trimStart();
      break;
    }
  }

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    if (boldMatch) {
      const idx = boldMatch.index;
      if (idx > 0) {
        parts.push(<span key={key++}>{remaining.slice(0, idx)}</span>);
      }
      parts.push(<strong key={key++} className="font-semibold">{boldMatch[1]}</strong>);
      remaining = remaining.slice(idx + boldMatch[0].length);
    } else {
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }
  }

  return parts;
}

function renderCellInline(text) {
  if (!text) return text;
  return renderInlineMarkdown(text);
}

function classifyLine(line) {
  const trimmed = line.trimStart();
  const fullyTrimmed = line.trim();

  if (fullyTrimmed.startsWith("|") && fullyTrimmed.endsWith("|") && fullyTrimmed.length > 2) return "table";

  if (/^\d+\.\s/.test(trimmed)) return "ol";

  if (/^[-*]\s/.test(trimmed) && !trimmed.match(/^\|/)) return "ul";

  if (
    /^#{1,4}\s/.test(trimmed) ||
    (/^[A-Z][\w\s/&()]+:$/.test(trimmed) && trimmed.length < 80) ||
    (/^TP\s/.test(trimmed) && trimmed.endsWith(":"))
  ) {
    return "heading";
  }

  if (trimmed === "") return "blank";

  return "text";
}

function parseBlocks(lines) {
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const type = classifyLine(lines[i]);

    if (type === "table") {
      const tableLines = [];
      while (i < lines.length) {
        const lt = classifyLine(lines[i]);
        if (lt === "table") {
          tableLines.push(lines[i]);
          i++;
        } else if (lt === "blank") {
          let peek = i + 1;
          while (peek < lines.length && classifyLine(lines[peek]) === "blank") peek++;
          if (peek < lines.length && classifyLine(lines[peek]) === "table") {
            i = peek;
          } else {
            break;
          }
        } else {
          break;
        }
      }
      const table = parseTable(tableLines);
      if (table && table.header.length > 0) {
        blocks.push({ type: "table", data: table });
      } else {
        blocks.push({ type: "text", lines: tableLines });
      }
      continue;
    }

    if (type === "ul") {
      const items = [];
      while (i < lines.length && classifyLine(lines[i]) === "ul") {
        items.push(lines[i].trimStart().replace(/^[-*]\s/, ""));
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    if (type === "ol") {
      const items = [];
      while (i < lines.length && classifyLine(lines[i]) === "ol") {
        items.push(lines[i].trimStart().replace(/^\d+\.\s/, ""));
        i++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    if (type === "heading") {
      const raw = lines[i].trimStart().replace(/^#{1,4}\s/, "");
      blocks.push({ type: "heading", text: raw });
      i++;
      continue;
    }

    if (type === "blank") {
      blocks.push({ type: "blank" });
      i++;
      continue;
    }

    const textLines = [];
    while (i < lines.length && classifyLine(lines[i]) === "text") {
      textLines.push(lines[i]);
      i++;
    }
    blocks.push({ type: "text", lines: textLines });
  }

  return blocks;
}

export default function FormattedOutput({ text }) {
  if (!text) return null;

  const lines = text.split("\n");
  const blocks = parseBlocks(lines);

  return (
    <div className="text-gray-900 text-sm leading-7">
      {blocks.map((block, idx) => {
        switch (block.type) {
          case "table":
            return (
              <div key={idx} className="overflow-x-auto my-3">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      {block.data.header.map((cell, ci) => (
                        <th
                          key={ci}
                          className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700 text-xs"
                        >
                          {renderCellInline(cell)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.data.body.map((row, ri) => (
                      <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        {row.map((cell, ci) => (
                          <td key={ci} className="border border-gray-300 px-3 py-2 text-gray-800 text-xs">
                            {renderCellInline(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );

          case "heading":
            return (
              <h3 key={idx} className="font-bold text-gray-900 mt-4 mb-1 text-sm">
                {renderInlineMarkdown(block.text)}
              </h3>
            );

          case "ul":
            return (
              <ul key={idx} className="list-disc list-outside pl-5 my-1 space-y-0.5">
                {block.items.map((item, li) => (
                  <li key={li}>{renderInlineMarkdown(item)}</li>
                ))}
              </ul>
            );

          case "ol":
            return (
              <ol key={idx} className="list-decimal list-outside pl-5 my-1 space-y-0.5">
                {block.items.map((item, li) => (
                  <li key={li}>{renderInlineMarkdown(item)}</li>
                ))}
              </ol>
            );

          case "blank":
            return <div key={idx} className="h-3" />;

          case "text":
            return (
              <p key={idx} className="my-0.5">
                {block.lines.map((line, li) => (
                  <span key={li}>
                    {li > 0 && <br />}
                    {renderInlineMarkdown(line)}
                  </span>
                ))}
              </p>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}
