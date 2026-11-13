// The shelf of globes. To add one: write src/globes/<id>.js (see lighthouse.js, or copy
// practice.js as a starting point), then list it here. The first entry is the default.
import lighthouse from './lighthouse.js';
import practice from './practice.js';
import orrery from './orrery.js';
import crownfall from './crownfall.js';
import atelier from './atelier.js';
import yearwheel from './yearwheel.js';

export const GLOBES = [lighthouse, practice, orrery, crownfall, atelier, yearwheel];
export const getGlobe = (id) => GLOBES.find((g) => g.id === id) || GLOBES[0];
