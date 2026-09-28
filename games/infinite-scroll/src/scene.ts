/**
 * The 3D side: a tunnel lined with scrolling code, the obstacles and pickups from world.ts, and you (a blinking
 * cursor) at the bottom. The tunnel turns around you, so you always stay at the bottom of the screen.
 * Meshes are pooled per kind and reused; nothing is created while a run is going.
 */
import {
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  DoubleSide,
  BackSide,
  Fog,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  RepeatWrapping,
  RingGeometry,
  Scene,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TorusGeometry,
  WebGLRenderer,
  type Material,
  type Texture
} from 'three';
import { SPAN, type Thing, type World } from './world';

const R = 5;
const LEN = 130;
const RING_GAP = 12;
/** How far into the tunnel you ride, in front of the camera; things reach you here */
const PLAYER_Z = -3.5;
const MONO = "'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace";

export interface Colors {
  bg: string;
  code: string;
  keyword: string;
  str: string;
  comment: string;
  accent: string;
  accent2: string;
  danger: string;
  warn: string;
  info: string;
  success: string;
  /** text on the colored obstacles */
  ink: string;
}

const LINES = [
  'function scroll(forever) {',
  '  while (true) {',
  '    const line = next(buffer);',
  "    if (!line) throw new Error('EOF');",
  '    render(line); // TODO: optimize',
  '  }',
  '}',
  'export async function deploy(env) {',
  "  await git.push('--force');",
  '  return null; // ¯\\_(ツ)_/¯',
  '}',
  'const bugs = new Set(); // it grows',
  'for (let i = 0; i <= arr.length; i++) {',
  '  total += arr[i]; // off by one?',
  '}',
  "import { everything } from './utils';",
  'class InfiniteScroll extends Component {',
  '  onBottom() { this.load(++this.page); }',
  '}',
  '// 404: comment not found',
  'let retries = Infinity;',
  'catch (e) { console.log(e); }',
  "await sleep(1000); // 'works'",
  'return new Promise(() => {}); // never'
];

function codeTexture(c: Colors): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1024;
  const g = canvas.getContext('2d')!;
  g.fillStyle = c.bg;
  g.fillRect(0, 0, 1024, 1024);
  g.font = `500 26px ${MONO}`;
  g.textBaseline = 'top';
  const kw = /\b(function|const|let|while|if|throw|new|return|export|async|await|for|import|from|class|extends|catch)\b/;
  for (let i = 0; i < 24; i++) {
    const line = LINES[i % LINES.length];
    const y = 16 + i * 42;
    g.fillStyle = c.comment;
    g.fillText(String(i + 1).padStart(3, ' '), 12, y);
    // a rough highlight: comments, strings, keywords, the rest
    let x = 80;
    for (const part of line.split(/(\/\/.*$|'[^']*'|\s+)/)) {
      if (!part) continue;
      g.fillStyle = part.startsWith('//') ? c.comment : part.startsWith("'") ? c.str : kw.test(part) ? c.keyword : c.code;
      g.fillText(part, x, y);
      x += g.measureText(part).width;
    }
  }
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  // negative: the tunnel is seen from the inside, which would mirror the text
  t.repeat.set(-3, 5);
  t.anisotropy = 4;
  return t;
}

function label(text: string, color: string, width = 512, height = 128, size = 64): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d')!;
  g.font = `800 ${size}px ${MONO}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = color;
  g.fillText(text, width / 2, height / 2);
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** A piece of the tunnel wall's inner rim, as a flat band facing you: `span` radians wide, centered at the bottom. */
function band(span: number, center = -Math.PI / 2) {
  return new RingGeometry(R - 1.7, R - 0.02, Math.max(6, Math.round(span * 12)), 1, center - span / 2, span);
}

/** Puts a pickup just above the tunnel floor (at the bottom, where you ride). */
function onFloor<T extends Object3D>(o: T): T {
  o.position.set(0, -R + 0.7, 0);
  return o;
}

export class TunnelScene {
  readonly renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(70, 1, 0.1, 200);
  private tube = new Group();
  private tunnel!: Mesh;
  private rings: Mesh[] = [];
  private player = new Group();
  private shieldMesh!: Mesh;
  private pools = new Map<Thing['kind'], Object3D[]>();
  private live = new Map<number, Object3D>();
  private disposables: (Material | Texture)[] = [];
  private colors!: Colors;

  constructor(canvas: HTMLCanvasElement, colors: Colors) {
    const small = Math.min(window.innerWidth, window.innerHeight) < 600;
    this.renderer = new WebGLRenderer({ canvas, antialias: !small, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2));
    this.camera.position.set(0, -R * 0.4, 3);
    this.camera.lookAt(0, -R * 0.2, -30);
    this.player.position.z = PLAYER_Z;
    this.scene.add(this.tube, this.player);
    this.setColors(colors);
  }

  /** (Re)builds everything that has a color, for the first frame and when the theme changes. */
  setColors(c: Colors) {
    this.colors = c;
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
    this.tube.clear();
    this.player.clear();
    this.pools.clear();
    this.live.clear();
    this.rings = [];

    this.scene.fog = new Fog(c.bg, 18, 95);
    this.renderer.setClearColor(c.bg);

    const map = codeTexture(c);
    const wall = this.material({ map, side: BackSide });
    const geo = new CylinderGeometry(R, R, LEN, 36, 1, true);
    geo.rotateX(Math.PI / 2);
    this.tunnel = new Mesh(geo, wall);
    this.tunnel.position.z = -LEN / 2 + 6;
    this.tube.add(this.tunnel);

    const ringMat = this.material({ color: c.accent, transparent: true, opacity: 0.35 });
    for (let i = 0; i < LEN / RING_GAP; i++) {
      const ring = new Mesh(new TorusGeometry(R - 0.03, 0.025, 4, 48), ringMat);
      this.rings.push(ring);
      this.tube.add(ring);
    }

    // you: a blinking text cursor, with a glow and a shield ring
    const cursor = new Mesh(new BoxGeometry(0.16, 0.55, 0.16), this.material({ color: c.accent }));
    const glow = new Mesh(new BoxGeometry(0.36, 0.8, 0.36), this.material({ color: c.accent, transparent: true, opacity: 0.2 }));
    this.shieldMesh = new Mesh(new TorusGeometry(0.6, 0.04, 6, 32), this.material({ color: c.info }));
    for (const m of [cursor, glow, this.shieldMesh]) m.position.set(0, -R + 0.5, 0);
    this.player.add(cursor, glow, this.shieldMesh);
  }

  private material(opts: ConstructorParameters<typeof MeshBasicMaterial>[0]) {
    const m = new MeshBasicMaterial(opts);
    this.disposables.push(m);
    if (opts?.map) this.disposables.push(opts.map);
    return m;
  }

  private sprite(tex: Texture, w: number, h: number) {
    const m = new SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    this.disposables.push(m, tex);
    const s = new Sprite(m);
    s.scale.set(w, h, 1);
    return s;
  }

  /** A new object for a kind of thing, built at angle 0 (the bottom), 0 ahead. */
  private make(kind: Thing['kind']): Object3D {
    const c = this.colors;
    const g = new Group();
    const wallPiece = (span: number, color: string, text: string, center = -Math.PI / 2) => {
      const m = new Mesh(band(span, center), this.material({ color, transparent: true, opacity: 0.82, side: DoubleSide }));
      g.add(m);
      // one label in the middle, more along wide pieces so one is always in view
      const mid = R - 0.85;
      const spots = span > Math.PI ? [-span / 3, 0, span / 3] : [0];
      const tex = label(text, c.ink);
      for (const off of spots) {
        const t = this.sprite(tex, 2.4, 0.6);
        t.position.set(Math.cos(center + off) * mid, Math.sin(center + off) * mid, 0.05);
        g.add(t);
      }
    };
    switch (kind) {
      case 'block': {
        const w = R * SPAN.block * 0.95;
        const box = new Mesh(new BoxGeometry(w, 1.4, 1.1), this.material({ color: c.danger }));
        box.position.y = -R + 0.7;
        const t = new Mesh(
          new PlaneGeometry(w * 0.95, w * 0.24),
          this.material({ map: label('NullPointerException', c.ink, 1024, 160, 70), transparent: true })
        );
        t.position.set(0, -R + 0.9, 0.56);
        g.add(box, t);
        break;
      }
      case 'ring': {
        // everything but the gap, which is at the bottom
        wallPiece(Math.PI * 2 - SPAN.ring, c.warn, '404', Math.PI / 2);
        break;
      }
      case 'half':
        wallPiece(SPAN.half, c.accent2, '// TODO');
        break;
      case 'spin':
        wallPiece(SPAN.spin, c.info, 'while(true)');
        wallPiece(SPAN.spin, c.info, 'while(true)', Math.PI / 2);
        break;
      case 'semi':
        g.add(onFloor(this.sprite(label(';', c.success, 128, 128, 110), 0.9, 0.9)));
        break;
      case 'shield':
        g.add(onFloor(this.sprite(label('{ }', c.info, 256, 128, 100), 1.4, 0.7)));
        break;
      case 'coffee':
        g.add(onFloor(this.sprite(label('☕', c.warn, 128, 128, 96), 0.9, 0.9)));
        break;
    }
    return g;
  }

  private take(kind: Thing['kind']) {
    const pool = this.pools.get(kind) ?? [];
    this.pools.set(kind, pool);
    const o = pool.pop() ?? this.make(kind);
    this.tube.add(o);
    return o;
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // narrow screens: a wider view, so the tunnel still fits
    this.camera.fov = w / h < 0.9 ? 88 : 70;
    this.camera.updateProjectionMatrix();
  }

  render(world: World, steer: number, time: number) {
    // the tunnel turns so that you are always at the bottom
    this.tube.rotation.z = -world.angle;
    this.camera.rotation.z += (steer * 0.06 - this.camera.rotation.z) * 0.15;
    const map = (this.tunnel.material as MeshBasicMaterial).map!;
    map.offset.y = (world.distance / LEN) * map.repeat.y;
    this.rings.forEach((r, i) => (r.position.z = -((i * RING_GAP - (world.distance % RING_GAP) + LEN) % LEN) + 6));

    // things: reuse meshes by id
    const seen = new Set<number>();
    for (const t of world.things) {
      if (t.z < -3 || t.z > LEN - 12) continue;
      seen.add(t.id);
      let o = this.live.get(t.id);
      if (!o) {
        o = this.take(t.kind);
        o.userData.kind = t.kind;
        this.live.set(t.id, o);
      }
      o.position.z = PLAYER_Z - t.z;
      o.rotation.z = t.angle;
      if (t.kind === 'semi' || t.kind === 'shield' || t.kind === 'coffee') o.children[0].position.y = -R + 0.7 + Math.sin(time * 5 + t.id) * 0.08;
    }
    for (const [id, o] of this.live) {
      if (seen.has(id)) continue;
      this.tube.remove(o);
      this.pools.get(o.userData.kind as Thing['kind'])!.push(o);
      this.live.delete(id);
    }

    // the cursor blinks while waiting, and the shield spins when you have one
    const blink = world.phase === 'running' || Math.floor(time * 2) % 2 === 0;
    this.player.visible = blink || world.phase === 'over';
    this.shieldMesh.visible = world.shield;
    this.shieldMesh.rotation.y = time * 3;
    this.player.children[0].rotation.y = world.safeFor > 0 ? time * 20 : 0;
    this.renderer.render(this.scene, this.camera);
  }
}
