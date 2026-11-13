import { createBuilder } from '../kit.js';
import { buildTrack } from './crownfall/track.js';
import { buildScene } from './crownfall/scene.js';

function build() {
  const builder = createBuilder({ supports: false });
  const layout = buildTrack(builder);
  buildScene(builder, layout);
  return builder.finish();
}

export default {
  id: 'crownfall',
  name: '霜焰王城',
  blurb: '循河谷穿越冰川與火山，翻過懸橋，從發光的礦洞回到山脊王城。',
  build,
};
