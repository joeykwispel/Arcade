;; A Brainf*ck interpreter, written by hand in WebAssembly text. The bomb's code is checked by running the bomb's
;; program here, and the tests run this same module.
;;
;; Memory (one 64 KiB page):
;;   0      … 4095     the program (the page writes it there)
;;   4096   … 36863    the tape: 32768 cells of one byte, wrapping like the original
;;   40960  … 45055    the output
;;
;; run(length) interprets the program's first `length` bytes and returns how many bytes it printed, or -1 when it
;; ran out of steps (an endless loop) and -2 when its brackets don't match.

(module
  (memory (export "memory") 1)

  (global $TAPE i32 (i32.const 4096))
  (global $TAPE_SIZE i32 (i32.const 32768))
  (global $OUT i32 (i32.const 40960))
  (global $OUT_SIZE i32 (i32.const 4096))
  (global $MAX_STEPS i32 (i32.const 10000000))

  ;; Find the matching bracket, scanning from $pc in direction $dir (+1 or -1). Returns its index, or -1.
  (func $match (param $pc i32) (param $len i32) (param $dir i32) (result i32)
    (local $depth i32)
    (local $c i32)
    (local.set $depth (i32.const 1))
    (block $done
      (loop $scan
        (local.set $pc (i32.add (local.get $pc) (local.get $dir)))
        ;; ran off either end: no match
        (br_if $done (i32.lt_s (local.get $pc) (i32.const 0)))
        (br_if $done (i32.ge_s (local.get $pc) (local.get $len)))
        (local.set $c (i32.load8_u (local.get $pc)))
        (if (i32.eq (local.get $c) (i32.const 91)) ;; [
          (then (local.set $depth (i32.add (local.get $depth) (local.get $dir)))))
        (if (i32.eq (local.get $c) (i32.const 93)) ;; ]
          (then (local.set $depth (i32.sub (local.get $depth) (local.get $dir)))))
        (if (i32.eqz (local.get $depth)) (then (return (local.get $pc))))
        (br $scan)))
    (i32.const -1))

  ;; 1 when every [ has its ], else 0. Checked before running, so a stray [ is an error even if it never jumps.
  (func $balanced (param $len i32) (result i32)
    (local $i i32)
    (local $depth i32)
    (local $c i32)
    (block $done
      (loop $scan
        (br_if $done (i32.ge_s (local.get $i) (local.get $len)))
        (local.set $c (i32.load8_u (local.get $i)))
        (if (i32.eq (local.get $c) (i32.const 91)) (then (local.set $depth (i32.add (local.get $depth) (i32.const 1)))))
        (if (i32.eq (local.get $c) (i32.const 93))
          (then
            (local.set $depth (i32.sub (local.get $depth) (i32.const 1)))
            (if (i32.lt_s (local.get $depth) (i32.const 0)) (then (return (i32.const 0))))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $scan)))
    (i32.eqz (local.get $depth)))

  (func (export "run") (param $len i32) (result i32)
    (local $pc i32)
    (local $ptr i32)
    (local $out i32)
    (local $steps i32)
    (local $c i32)
    (local $cell i32)
    (local $jump i32)

    (if (i32.eqz (call $balanced (local.get $len))) (then (return (i32.const -2))))

    ;; a fresh tape
    (memory.fill (global.get $TAPE) (i32.const 0) (global.get $TAPE_SIZE))

    (block $end
      (loop $step
        (br_if $end (i32.ge_s (local.get $pc) (local.get $len)))
        (local.set $steps (i32.add (local.get $steps) (i32.const 1)))
        (if (i32.gt_s (local.get $steps) (global.get $MAX_STEPS)) (then (return (i32.const -1))))

        (local.set $c (i32.load8_u (local.get $pc)))
        (local.set $cell (i32.add (global.get $TAPE) (local.get $ptr)))

        ;; + and -: change the cell (it wraps at 256 by itself: it's one byte)
        (if (i32.eq (local.get $c) (i32.const 43))
          (then (i32.store8 (local.get $cell) (i32.add (i32.load8_u (local.get $cell)) (i32.const 1)))))
        (if (i32.eq (local.get $c) (i32.const 45))
          (then (i32.store8 (local.get $cell) (i32.sub (i32.load8_u (local.get $cell)) (i32.const 1)))))

        ;; > and <: move along the tape, which wraps around at both ends
        (if (i32.eq (local.get $c) (i32.const 62))
          (then (local.set $ptr (i32.and (i32.add (local.get $ptr) (i32.const 1)) (i32.const 32767)))))
        (if (i32.eq (local.get $c) (i32.const 60))
          (then (local.set $ptr (i32.and (i32.sub (local.get $ptr) (i32.const 1)) (i32.const 32767)))))

        ;; . prints the cell
        (if (i32.eq (local.get $c) (i32.const 46))
          (then
            (if (i32.lt_s (local.get $out) (global.get $OUT_SIZE))
              (then
                (i32.store8 (i32.add (global.get $OUT) (local.get $out)) (i32.load8_u (local.get $cell)))
                (local.set $out (i32.add (local.get $out) (i32.const 1)))))))

        ;; [ jumps past its ] when the cell is 0
        (if (i32.eq (local.get $c) (i32.const 91))
          (then
            (if (i32.eqz (i32.load8_u (local.get $cell)))
              (then
                (local.set $jump (call $match (local.get $pc) (local.get $len) (i32.const 1)))
                (if (i32.lt_s (local.get $jump) (i32.const 0)) (then (return (i32.const -2))))
                (local.set $pc (local.get $jump))))))

        ;; ] jumps back to its [ while the cell isn't 0
        (if (i32.eq (local.get $c) (i32.const 93))
          (then
            (if (i32.ne (i32.load8_u (local.get $cell)) (i32.const 0))
              (then
                (local.set $jump (call $match (local.get $pc) (local.get $len) (i32.const -1)))
                (if (i32.lt_s (local.get $jump) (i32.const 0)) (then (return (i32.const -2))))
                (local.set $pc (local.get $jump))))))

        (local.set $pc (i32.add (local.get $pc) (i32.const 1)))
        (br $step)))
    (local.get $out))

  (func (export "out_ptr") (result i32) (global.get $OUT)))
