export function isStandaloneApp() {
  return window.matchMedia("(display-mode: standalone)").matches;
}
