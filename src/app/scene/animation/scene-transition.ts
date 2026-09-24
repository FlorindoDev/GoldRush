import { GAME_BALANCE } from '../../config/game-balance';

export const SCENE_TRANSITION_SECONDS = GAME_BALANCE.animation.transitionSeconds;

export function transitionProgress(elapsed: number, reducedMotion: boolean): number {
  return reducedMotion ? 1 : Math.min(1, elapsed / SCENE_TRANSITION_SECONDS);
}

export function easeTransition(progress: number): number {
  return progress * progress * (3 - 2 * progress);
}
