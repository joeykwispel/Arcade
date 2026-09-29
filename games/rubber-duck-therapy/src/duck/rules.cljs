(ns duck.rules
  "The rules of Rubber Duck Therapy, as pure functions on a plain map: no DOM in here, so the tests can play it.

  You explain a case to the duck, line by line, in any order. Explaining the buggy line makes you realise it (the
  aha moment); then you pick the fix. Blaming something else (an excuse) or picking a wrong fix costs the duck's
  patience. Every explanation costs a minute; the score is the minutes you needed, fewer is better."
  (:require [duck.cases :refer [cases]]))

(def start-patience 5)
(def excuse-minutes 5)
(def wrong-fix-minutes 5)

(defn new-game []
  {:case 0
   :explained #{}   ; line indices explained in this case
   :phase :explaining ; :explaining → :aha → (next case) … → :done, or :left when patience runs out
   :patience start-patience
   :minutes 0
   :log []})        ; what happened, for the page to show: [kind case line-or-nil]

(defn current [g] (get cases (:case g)))

(defn- lose-patience [g minutes kind]
  (let [g (-> g
              (update :patience dec)
              (update :minutes + minutes)
              (update :log conj [kind (:case g) nil]))]
    (if (<= (:patience g) 0) (assoc g :phase :left) g)))

(defn explain
  "Explain line i to the duck."
  [g i]
  (let [c (current g)
        line (get-in c [:lines i])]
    (if (or (not= (:phase g) :explaining) (nil? line) (contains? (:explained g) i))
      g
      (cond-> (-> g
                  (update :explained conj i)
                  (update :minutes inc)
                  (update :log conj [:explain (:case g) i]))
        (:bug line) (assoc :phase :aha)))))

(defn excuse
  "Blame something else. The duck says nothing, but it notices."
  [g]
  (if (= (:phase g) :explaining) (lose-patience g excuse-minutes :excuse) g))

(defn fix
  "Pick fix j for the bug you just found."
  [g j]
  (if (not= (:phase g) :aha)
    g
    (if (get-in (current g) [:fixes j :right])
      (let [next-case (inc (:case g))
            g (update g :log conj [:fixed (:case g) j])]
        (if (>= next-case (count cases))
          (assoc g :phase :done :case (dec next-case))
          (assoc g :case next-case :explained #{} :phase :explaining)))
      (-> (lose-patience g wrong-fix-minutes :wrong-fix)
          ;; a wrong fix is only a setback, you still know where the bug is
          (update :phase #(if (= % :left) :left :aha))))))

(defn best-possible
  "The fewest minutes a perfect player needs: one line explained per case, the right fix straight away."
  []
  (count cases))
