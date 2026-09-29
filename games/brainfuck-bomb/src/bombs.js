// The bombs: a Brainf*ck program each, and how long you get. The code to type is whatever the program prints: the
// page runs it in bf.wasm (bf.wat, hand-written WebAssembly) to check you, so nothing here stores the answer.

export const BOMBS = [
  { program: '++++++++[>++++++<-]>.', seconds: 60 },
  { program: '+++++[>++++++++++<-]>+++.', seconds: 55 },
  { program: '++++++[>++++++++<-]>+.+.+.', seconds: 55 },
  { program: '>+++++++++[<++++++++>-]<.+.', seconds: 50 },
  { program: '+++++++++[>+++++++++<-]>--.----.', seconds: 50 },
  { program: '++++++[>++++++++<-]>++++.----.++++.', seconds: 45 }
];

/** A wrong code costs this many seconds. */
export const WRONG = 10;

/** Loads bf.wasm's exports: run(program) returns the output as a string, or throws on an endless or broken program. */
export function interpreter(instance) {
  const { memory, run, out_ptr } = instance.exports;
  return (program) => {
    const bytes = new TextEncoder().encode(program);
    new Uint8Array(memory.buffer, 0, bytes.length).set(bytes);
    const n = run(bytes.length);
    if (n === -1) throw new Error('endless loop');
    if (n === -2) throw new Error('unmatched bracket');
    return new TextDecoder().decode(new Uint8Array(memory.buffer, out_ptr(), n));
  };
}
