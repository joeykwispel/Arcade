/**
 * Pixel sprites as strings: one character per pixel, '.' is empty.
 * The letters map to theme colors in render.js, so both themes can recolor every sprite.
 *   # duck body   o beak/feet   + wing   e eye   k ink (outlines, antennae)
 *   b bug shell   s bug stripe  p paper   r red badge   w invite wings
 */

/** @typedef {{ w: number, h: number, rows: string[] }} Sprite */

/** @param {string[]} rows @returns {Sprite} */
function sprite(rows) {
  const w = Math.max(...rows.map((r) => r.length));
  return { w, h: rows.length, rows: rows.map((r) => r.padEnd(w, '.')) };
}

// The duck, facing right. The body is shared; only the feet change while running.
const duckBody = [
  '..........####....',
  '.........######...',
  '.........###e##...',
  '.........#######oo',
  '..........#####ooo',
  '...........####...',
  '#.........#####...',
  '##......########..',
  '###..###########..',
  '################..',
  '####++++########..',
  '.###+++++#######..',
  '..#############...',
  '...###########....',
  '....#########.....'
];

export const duck = {
  run: [sprite([...duckBody, '......oo..o.......', '..........oo......']), sprite([...duckBody, '......o..oo.......', '.....oo...........'])],
  stand: sprite([...duckBody, '......o...o.......', '.....oo..oo.......']),
  /** Literally ducking: flat, head forward. */
  duck: [
    sprite([
      '................####..',
      '#..............######.',
      '##...#########.##e###.',
      '###################ooo',
      '####++++###########oo.',
      '.###+++++#########....',
      '..##############......',
      '...###########........',
      '.....oo..o............',
      '.........oo...........'
    ]),
    sprite([
      '................####..',
      '#..............######.',
      '##...#########.##e###.',
      '###################ooo',
      '####++++###########oo.',
      '.###+++++#########....',
      '..##############......',
      '...###########........',
      '.....o..oo............',
      '....oo................'
    ])
  ]
};

/** A beetle, seen from the front. */
export const bug = sprite([
  '..k.......k..',
  '...k.....k...',
  '....kkkkk....',
  'k..bbbbbbb..k',
  '.kbbbbsbbbbk.',
  '..bbbbsbbbb..',
  'k.bbbbsbbbb.k',
  '.kbbbbsbbbbk.',
  '..bbbbsbbbb..',
  '.k.bbbsbbb.k.',
  'k...bbbbb...k'
]);

const envelope = [
  'kkkkkkkkkkkkkr',
  'kkppppppppppkk',
  'kpkppppppppkpk',
  'kppkppppppkppk',
  'kpppkppppkpppk',
  'kppppkkkkppppk',
  'kppppppppppppk',
  'kppppppppppppk',
  'kkkkkkkkkkkkkk'
];
const blank = '..............';

/** A meeting invite that flies in to ruin your flow. The envelope stays put; only the wings flap. */
export const invite = [
  sprite(['ww..........ww', '.www......www.', '..wwwwwwwwww..', ...envelope, blank, blank, blank]),
  sprite([blank, blank, blank, ...envelope, '..wwwwwwwwww..', '.www......www.', 'ww..........ww'])
];

/** Rows of the invite that are the envelope, for its hitbox. */
export const inviteBody = { top: 3, height: envelope.length };
