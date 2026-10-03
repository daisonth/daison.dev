import type { FoldableNode } from "./foldTree";

function stripWhitespaceBetweenTags(xml: string): string {
  return xml.replace(/>\s+</g, "><").trim();
}

export function minifyXml(input: string): string {
  return stripWhitespaceBetweenTags(input);
}

function isClosingTag(token: string): boolean {
  return token.startsWith("</");
}

// Self-closing tags, declarations, comments, and CDATA print as-is with no
// indent change — they never nest further content.
function isSelfContained(token: string): boolean {
  return (
    (token.startsWith("<") && token.endsWith("/>")) ||
    token.startsWith("<?") ||
    token.startsWith("<!--") ||
    token.startsWith("<![CDATA[")
  );
}

function isOpeningTag(token: string): boolean {
  return token.startsWith("<") && !isClosingTag(token) && !isSelfContained(token);
}

/**
 * Lightweight regex-tokenizer pretty-printer — not a full XML processor.
 * Handles ordinary nested elements, self-closing tags, comments, and CDATA
 * correctly; a tag attribute value containing a literal ">" would confuse
 * the tokenizer. That's an accepted limit for a simple formatting tool.
 */
export function formatXml(input: string): string {
  const compact = stripWhitespaceBetweenTags(input);
  const tokens = (compact.match(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<[^>]+>|[^<]+/g) ?? []).filter(
    (token) => token.startsWith("<") || token.trim().length > 0,
  );

  const INDENT = "  ";
  const lines: string[] = [];
  let depth = 0;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (isClosingTag(token)) {
      depth = Math.max(depth - 1, 0);
      lines.push(INDENT.repeat(depth) + token);
      continue;
    }

    if (isOpeningTag(token)) {
      const next = tokens[i + 1];
      const afterNext = tokens[i + 2];
      const nextIsText = next !== undefined && !next.startsWith("<");
      const afterIsMatchingClose = afterNext !== undefined && isClosingTag(afterNext);

      // Collapse "<name>John</name>" onto one line instead of three.
      if (nextIsText && afterIsMatchingClose) {
        lines.push(INDENT.repeat(depth) + token + next.trim() + afterNext);
        i += 2;
        continue;
      }

      lines.push(INDENT.repeat(depth) + token);
      depth += 1;
      continue;
    }

    lines.push(INDENT.repeat(depth) + token.trim());
  }

  return lines.join("\n");
}

export function validateXml(input: string): string | null {
  const doc = new DOMParser().parseFromString(input, "application/xml");
  const errorNode = doc.querySelector("parsererror");
  if (!errorNode) return null;
  return errorNode.textContent?.replace(/\s+/g, " ").trim() || "Invalid XML";
}

function buildXmlElementNode(el: Element, idPath: string): FoldableNode {
  const attrs = Array.from(el.attributes)
    .map((attr) => ` ${attr.name}="${attr.value}"`)
    .join("");
  const childElements = Array.from(el.children);

  if (childElements.length === 0) {
    const text = el.textContent?.trim() ?? "";
    if (text) {
      return { id: idPath, openLabel: `<${el.tagName}${attrs}>${text}</${el.tagName}>` };
    }
    return { id: idPath, openLabel: `<${el.tagName}${attrs}/>` };
  }

  const children = childElements.map((child, i) => buildXmlElementNode(child, `${idPath}.${i}`));

  return {
    id: idPath,
    openLabel: `<${el.tagName}${attrs}>`,
    children,
    collapsedLabel: `…</${el.tagName}>`,
    closeLabel: `</${el.tagName}>`,
  };
}

/** Only called once `validateXml` has confirmed the input parses cleanly. */
export function buildXmlTree(input: string): FoldableNode {
  const doc = new DOMParser().parseFromString(input, "application/xml");
  return buildXmlElementNode(doc.documentElement, "root");
}
