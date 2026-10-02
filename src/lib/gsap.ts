import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

let registered = false;

/**
 * Client-only GSAP accessor. Registers plugins exactly once per page load —
 * call this from any Svelte island instead of importing gsap directly, so
 * ScrollTrigger never gets registered twice during Astro's client hydration.
 */
export function getGsap() {
  if (!registered) {
    gsap.registerPlugin(ScrollTrigger);
    registered = true;
  }
  return { gsap, ScrollTrigger };
}
