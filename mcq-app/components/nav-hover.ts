export function canHover(): boolean {
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}
