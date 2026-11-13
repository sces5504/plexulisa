// Entry point kept for the engine: which globe, and the constants everything shares.
export { R, BALL_R } from './kit.js';
import { getGlobe } from './globes/index.js';
export { GLOBES, getGlobe } from './globes/index.js';

export function buildWorld(id) {
  const globe = getGlobe(id);
  return { ...globe.build(), id: globe.id, name: globe.name };
}
