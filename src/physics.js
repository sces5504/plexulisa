// Physics: the maze is static in its own frame and gravity is rotated into
// that frame. The glass itself is an exact analytic sphere, so the marble can
// roll anywhere on the inside of the globe and never leaves the world.
import RAPIER from '@dimforge/rapier3d-compat';
import { R, BALL_R } from './world.js';

export const G = 12;

export async function createPhysics(world) {
  await RAPIER.init();
  const pw = new RAPIER.World({ x: 0, y: -G, z: 0 });
  const flags = RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES_TWO_SIDED;
  const mesh = (c) => RAPIER.ColliderDesc.trimesh(c.vertices, c.indices, flags).setFriction(0.8).setRestitution(0.3);

  const ground = pw.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  pw.createCollider(mesh(world.collision), ground);
  // decks made of a special surface (kit.js SURFACES): ice is slick, rubber throws the marble back
  for (const sf of world.surfaces || []) {
    if (!sf.collision.indices.length) continue;
    const c = RAPIER.ColliderDesc.trimesh(sf.collision.vertices, sf.collision.indices, flags).setFriction(sf.friction).setRestitution(sf.restitution);
    c.setFrictionCombineRule(sf.friction < 0.5 ? RAPIER.CoefficientCombineRule.Min : RAPIER.CoefficientCombineRule.Max);
    c.setRestitutionCombineRule(sf.restitution > 0.5 ? RAPIER.CoefficientCombineRule.Max : RAPIER.CoefficientCombineRule.Min);
    pw.createCollider(c, ground);
  }

  const movers = world.movers.map((m) => {
    if (m.kind === 'hinge') {
      // a freely swinging part: a real body on a real hinge, moved by gravity, by its return
      // spring and by the marble's weight — so it responds to how the globe is held
      const body = pw.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(m.pivot.x, m.pivot.y, m.pivot.z).setCanSleep(false).setAngularDamping(m.damping ?? 1.0).setLinearDamping(0.2));
      for (const b of m.boxes) pw.createCollider(RAPIER.ColliderDesc.cuboid(b.h[0], b.h[1], b.h[2]).setTranslation(b.p[0], b.p[1], b.p[2]).setRotation({ x: b.q[0], y: b.q[1], z: b.q[2], w: b.q[3] }).setMass(b.mass).setFriction(0.8).setRestitution(0.1), body);
      const joint = pw.createImpulseJoint(RAPIER.JointData.revolute({ x: m.pivot.x, y: m.pivot.y, z: m.pivot.z }, { x: 0, y: 0, z: 0 }, { x: m.axis.x, y: m.axis.y, z: m.axis.z }), ground, body, true);
      if (m.limits) joint.setLimits(m.limits[0], m.limits[1]);
      if (m.stiffness) { joint.configureMotorModel(RAPIER.MotorModel.ForceBased); joint.configureMotorPosition(m.target ?? 0, m.stiffness, m.springDamping ?? 0.3); }   // a real spring: torque per radian
      return { def: m, body, angle: 0, offset: 0, clock: 0 };
    }
    const body = pw.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(m.pivot.x, m.pivot.y, m.pivot.z));
    if (m.collision) pw.createCollider(mesh(m.collision), body);      // a purely decorative mover (a mobile) has nothing to touch
    return { def: m, body, angle: m.phase || 0, offset: 0, clock: 0 };
  });

  const body = pw.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setCcdEnabled(true).setCanSleep(false).setLinearDamping(0.03).setAngularDamping(0.3));
  const ballCollider = pw.createCollider(RAPIER.ColliderDesc.ball(BALL_R).setDensity(7).setFriction(0.8).setRestitution(0.3), body);

  const LIM = R - BALL_R, boosts = world.boosts || [], drags = world.drags || [];
  const state = { impact: 0, onGlass: false };

  function step(dt, g) {
    pw.gravity = { x: g.x * G, y: g.y * G, z: g.z * G };
    pw.timestep = dt;
    for (const m of movers) {
      if (m.def.kind === 'hinge') continue;
      if (m.def.kind === 'lift') {
        // dwell at the bottom, glide up, dwell at the top, glide down
        const { rise, dwell, travel, pivot, axis } = m.def, T = 2 * (rise + dwell);
        m.clock = (m.clock + dt) % T;
        const t = m.clock;
        let s = t < dwell ? 0 : t < dwell + rise ? (t - dwell) / rise : t < 2 * dwell + rise ? 1 : 1 - (t - 2 * dwell - rise) / rise;
        s = s * s * (3 - 2 * s);
        m.offset = s * travel;
        m.body.setNextKinematicTranslation({ x: pivot.x + axis.x * m.offset, y: pivot.y + axis.y * m.offset, z: pivot.z + axis.z * m.offset });
        continue;
      }
      if (m.def.kind === 'swing') { m.clock += dt; m.angle = m.def.amplitude * Math.sin((2 * Math.PI * m.clock) / m.def.period + (m.def.phase || 0)); }
      else m.angle += m.def.speed * dt;
      const h = m.angle / 2, s = Math.sin(h), a = m.def.axis;
      m.body.setNextKinematicRotation({ x: a.x * s, y: a.y * s, z: a.z * s, w: Math.cos(h) });
    }
    const v0 = body.linvel();
    pw.step();
    const p = body.translation(), v = body.linvel();
    let dvx = v.x - v0.x - g.x * G * dt, dvy = v.y - v0.y - g.y * G * dt, dvz = v.z - v0.z - g.z * G * dt;

    // the glass
    const d = Math.hypot(p.x, p.y, p.z);
    state.onGlass = d > LIM - 0.01;
    if (d > LIM) {
      const nx = p.x / d, ny = p.y / d, nz = p.z / d;
      body.setTranslation({ x: nx * LIM, y: ny * LIM, z: nz * LIM }, true);
      const vn = v.x * nx + v.y * ny + v.z * nz;
      if (vn > 0) {
        const k = (vn > 1.2 ? 1.3 : 1) * vn;
        const f = 1 - 0.25 * dt;
        const nv = { x: (v.x - k * nx) * f, y: (v.y - k * ny) * f, z: (v.z - k * nz) * f };
        body.setLinvel(nv, true);
        // roll without slipping on the glass (contact normal = -n)
        body.setAngvel({ x: -(ny * nv.z - nz * nv.y) / BALL_R, y: -(nz * nv.x - nx * nv.z) / BALL_R, z: -(nx * nv.y - ny * nv.x) / BALL_R }, true);
        if (vn > 1.2) { dvx += k * nx; dvy += k * ny; dvz += k * nz; }
      }
    }
    // bumpers: kick the marble straight back out
    for (const b of world.bumpers || []) {
      const q = body.translation(), dx = q.x - b.pos.x, dy = q.y - b.pos.y, dz = q.z - b.pos.z, d = Math.hypot(dx, dy, dz), lim = b.r + BALL_R;
      if (d < lim && d > 1e-4) {
        const nx = dx / d, ny = dy / d, nz = dz / d, w = body.linvel(), vn = w.x * nx + w.y * ny + w.z * nz, kick = Math.max(3.6, -vn * 1.1) - vn;
        body.setTranslation({ x: b.pos.x + nx * lim, y: b.pos.y + ny * lim, z: b.pos.z + nz * lim }, true);
        body.setLinvel({ x: w.x + nx * kick, y: w.y + ny * kick, z: w.z + nz * kick }, true);
        state.impact = Math.max(state.impact, 6);
      }
    }
    // boost strips: drive the marble along the track up to the strip's speed
    if (boosts.length) {
      const q = body.translation();
      let best = null, bd = 0.3;
      for (const b of boosts) { const d2 = (q.x - b.pos.x) ** 2 + (q.y - b.pos.y) ** 2 + (q.z - b.pos.z) ** 2; if (d2 < bd) { bd = d2; best = b; } }
      if (best) {
        const w = body.linvel(), along = w.x * best.dir.x + w.y * best.dir.y + w.z * best.dir.z;
        if (along < best.speed) { const a = Math.min(best.speed - along, 16 * dt); body.setLinvel({ x: w.x + best.dir.x * a, y: w.y + best.dir.y * a, z: w.z + best.dir.z * a }, true); }
      }
    }
    // felt and the like: rolling resistance while the marble is on that stretch
    if (drags.length) {
      const q = body.translation();
      let k = 0;
      for (const d of drags) if ((q.x - d.pos.x) ** 2 + (q.y - d.pos.y) ** 2 + (q.z - d.pos.z) ** 2 < 0.16) { k = d.drag; break; }
      if (k) { const w = body.linvel(), f = Math.exp(-k * dt); body.setLinvel({ x: w.x * f, y: w.y * f, z: w.z * f }, true); }
    }
    // a little air drag: slides stay fast and fun but top out at a speed the track can hold
    const v2 = body.linvel(), sp = Math.hypot(v2.x, v2.y, v2.z);
    if (sp > 0.5) { const k = Math.min(1, 32 / sp) / (1 + 0.04 * sp * dt); body.setLinvel({ x: v2.x * k, y: v2.y * k, z: v2.z * k }, true); }
    state.impact = Math.max(state.impact, Math.hypot(dvx, dvy, dvz));
  }

  // nearest supporting surface: { nx, ny, nz } pointing from surface to ball, or null
  function contact() {
    const p = body.translation();
    const d = Math.hypot(p.x, p.y, p.z);
    const pr = pw.projectPoint(p, true, undefined, undefined, ballCollider);
    if (pr) {
      const dx = p.x - pr.point.x, dy = p.y - pr.point.y, dz = p.z - pr.point.z;
      const l = Math.hypot(dx, dy, dz);
      if (l < BALL_R + 0.03 && l > 1e-5) return { x: dx / l, y: dy / l, z: dz / l, glass: false };
    }
    if (d > LIM - 0.02) return { x: -p.x / d, y: -p.y / d, z: -p.z / d, glass: true };
    return null;
  }

  function rayDist(origin, dir, max) {
    const hit = pw.castRay(new RAPIER.Ray(origin, dir), max, true, undefined, undefined, ballCollider);
    return hit ? hit.timeOfImpact : max;
  }

  function place(p) {
    body.setTranslation({ x: p.x, y: p.y, z: p.z }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  return { step, contact, rayDist, place, body, movers, state };
}
