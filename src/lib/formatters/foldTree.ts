/**
 * One line in the read-only collapsible tree view. `children` present
 * means the node is foldable (a JSON object/array with entries, or an XML
 * element with child elements) — a leaf (scalar, empty object, text-only
 * element) has none and is never collapsible.
 */
export interface FoldableNode {
  id: string;
  openLabel: string;
  children?: FoldableNode[];
  collapsedLabel?: string;
  closeLabel?: string;
  trailing?: string;
}

export function collectFoldableIds(node: FoldableNode, acc: string[] = []): string[] {
  if (node.children) {
    acc.push(node.id);
    for (const child of node.children) collectFoldableIds(child, acc);
  }
  return acc;
}

/** One rendered, currently-visible row in the tree view — what a line
 *  number actually numbers. Collapsing a node removes its descendants'
 *  rows entirely, so this has to be recomputed from the live collapse
 *  state rather than baked into the tree once. */
export interface FoldRow {
  id: string;
  depth: number;
  isFoldable: boolean;
  isCollapsed: boolean;
  text: string;
}

export function flattenTree(
  node: FoldableNode,
  depth: number,
  collapsed: Set<string>,
  rows: FoldRow[] = [],
): FoldRow[] {
  const isFoldable = !!node.children && node.children.length > 0;
  const isCollapsed = isFoldable && collapsed.has(node.id);

  if (isFoldable && isCollapsed) {
    rows.push({
      id: node.id,
      depth,
      isFoldable,
      isCollapsed,
      text: `${node.openLabel}${node.collapsedLabel}${node.trailing ?? ""}`,
    });
  } else if (isFoldable) {
    rows.push({ id: node.id, depth, isFoldable, isCollapsed, text: node.openLabel });
    for (const child of node.children ?? []) flattenTree(child, depth + 1, collapsed, rows);
    rows.push({
      id: `${node.id}:close`,
      depth,
      isFoldable: false,
      isCollapsed: false,
      text: `${node.closeLabel}${node.trailing ?? ""}`,
    });
  } else {
    rows.push({
      id: node.id,
      depth,
      isFoldable: false,
      isCollapsed: false,
      text: `${node.openLabel}${node.trailing ?? ""}`,
    });
  }

  return rows;
}
