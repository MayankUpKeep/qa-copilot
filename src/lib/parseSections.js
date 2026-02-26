/**
 * Parse LLM test plan output into a map of section names to content.
 * TP sections map to Jira custom fields.
 * Non-TP sections (scenarios, regression, etc.) are appended to the
 * most recent TP section — typically "TP Testing Approach".
 */
export function parseTestPlanSections(text) {
  const sections = {};

  const headerRegex = /^(?:\*\*|#{1,3}\s*)?((?:TP )?[A-Z][^:\n]*?)(?:\*\*)?:\s*$/gm;

  const headerPositions = [];
  let match;

  while ((match = headerRegex.exec(text)) !== null) {
    const name = match[1].trim();
    if (name.length < 3 || name.length > 80) continue;

    headerPositions.push({
      name,
      start: match.index,
      headerEnd: match.index + match[0].length,
      isTP: name.startsWith("TP "),
    });
  }

  if (headerPositions.length === 0) {
    return { "TP Testing Approach": text.trim() };
  }

  let preamble = "";
  if (headerPositions[0].start > 0) {
    preamble = text.slice(0, headerPositions[0].start).trim();
  }

  let lastTPSection = null;

  for (let i = 0; i < headerPositions.length; i++) {
    const header = headerPositions[i];
    const nextStart = i + 1 < headerPositions.length ? headerPositions[i + 1].start : text.length;
    const content = text.slice(header.headerEnd, nextStart).trim();

    if (header.isTP) {
      sections[header.name] = content;
      lastTPSection = header.name;
    } else if (lastTPSection) {
      sections[lastTPSection] += `\n\n${header.name}:\n${content}`;
    } else {
      preamble += `\n\n${header.name}:\n${content}`;
    }
  }

  if (preamble.trim()) {
    if (sections["TP Feature Dependencies & Risks"]) {
      sections["TP Feature Dependencies & Risks"] = preamble.trim() + "\n\n" + sections["TP Feature Dependencies & Risks"];
    } else {
      sections._description = preamble.trim();
    }
  }

  return sections;
}
