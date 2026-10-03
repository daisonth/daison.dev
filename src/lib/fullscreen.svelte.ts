/**
 * Shared fullscreen state/behavior for tools that need it — an in-page
 * overlay (not the browser Fullscreen API), bookmarkable via a
 * ?fullscreen URL param, Esc to exit, body scroll locked while open.
 * First built inline in FormatterTool.svelte; extracted here once a
 * second tool (TypingTest) needed the exact same mechanics — each tool
 * still owns its own overlay markup, only the state/behavior is shared.
 *
 * A `.svelte.ts` module, not a component: Svelte 5 runes ($state,
 * $effect) work in plain exported functions in files with this suffix,
 * as long as the function is called during a component's own setup (not
 * later, not conditionally) so Svelte can tie the effects to that
 * component's lifecycle.
 */

export function createFullscreen(paramName = "fullscreen") {
  function readFromUrl(): boolean {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).has(paramName);
  }

  // Reading the URL here — not in onMount — matters: this runs during the
  // client hydration pass itself, so a bookmarked ?fullscreen link renders
  // straight into fullscreen on first paint instead of flashing the
  // compact view first.
  let isFullscreen = $state(readFromUrl());

  /**
   * Moves the fullscreen overlay to be a direct child of <body>. Required,
   * not cosmetic: BaseLayout's <main> has `relative z-10`, which makes it
   * its own stacking context — a z-index on an element nested inside main
   * is compared only within that context, so it can NEVER outrank a
   * sibling stacking context like <footer> (also `relative z-10`) no
   * matter how high the number is. Rendering at the body level instead
   * puts the overlay in the same flat stacking comparison as header/main/
   * footer, where z-index actually works as expected.
   */
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() {
        node.remove();
      },
    };
  }

  // Esc exits fullscreen, same as a toggle button; only listens while
  // actually in fullscreen.
  $effect(() => {
    if (!isFullscreen) return;
    function onKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") isFullscreen = false;
    }
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  });

  // The overlay already fills the viewport — this just stops the page
  // behind it from also scrolling while it's open.
  $effect(() => {
    if (!isFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  });

  // Keeps the URL in sync with fullscreen state in both directions: not
  // just "a ?fullscreen link opens fullscreen" but also "entering
  // fullscreen from a button makes the current URL bookmarkable as one."
  // replaceState, not pushState — toggling shouldn't pile up history.
  $effect(() => {
    const url = new URL(window.location.href);
    if (isFullscreen) url.searchParams.set(paramName, "1");
    else url.searchParams.delete(paramName);
    history.replaceState(history.state, "", url);
  });

  return {
    get isFullscreen() {
      return isFullscreen;
    },
    set isFullscreen(value: boolean) {
      isFullscreen = value;
    },
    toggle() {
      isFullscreen = !isFullscreen;
    },
    portal,
  };
}
