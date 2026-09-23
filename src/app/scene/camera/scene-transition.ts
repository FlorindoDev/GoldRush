export const SCENE_TRANSITION_SECONDS = 1.1;

export function transitionProgress(elapsed: number, reducedMotion: boolean): number {
  return reducedMotion ? 1 : Math.min(1, elapsed / SCENE_TRANSITION_SECONDS);
}

export function easeTransition(progress: number): number {
  return progress * progress * (3 - 2 * progress);
}
