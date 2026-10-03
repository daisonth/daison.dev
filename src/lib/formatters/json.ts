import type { FoldableNode } from "./foldTree";

export function formatJson(input: string): string {
  return JSON.stringify(JSON.parse(input), null, 2);
}

export function minifyJson(input: string): string {
  return JSON.stringify(JSON.parse(input));
}

export function validateJson(input: string): string | null {
  try {
    JSON.parse(input);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid JSON";
  }
}

function buildJsonNode(
  value: unknown,
  keyPrefix: string,
  trailing: string,
  idPath: string,
): FoldableNode {
  if (value !== null && typeof value === "object") {
    const isArray = Array.isArray(value);
    const entries: [string, unknown][] = isArray
      ? (value as unknown[]).map((item, i) => [String(i), item])
      : Object.entries(value as Record<string, unknown>);
    const open = isArray ? "[" : "{";
    const close = isArray ? "]" : "}";

    if (entries.length === 0) {
      return { id: idPath, openLabel: `${keyPrefix}${open}${close}`, trailing };
    }

    const children = entries.map(([key, item], i) => {
      const childPrefix = isArray ? "" : `${JSON.stringify(key)}: `;
      const childTrailing = i < entries.length - 1 ? "," : "";
      return buildJsonNode(item, childPrefix, childTrailing, `${idPath}.${key}`);
    });

    return {
      id: idPath,
      openLabel: `${keyPrefix}${open}`,
      children,
      collapsedLabel: `…${close}`,
      closeLabel: close,
      trailing,
    };
  }

  return { id: idPath, openLabel: `${keyPrefix}${JSON.stringify(value)}`, trailing };
}

export function buildJsonTree(input: string): FoldableNode {
  return buildJsonNode(JSON.parse(input), "", "", "root");
}
