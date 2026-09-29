(ns duck.rules-test
  (:require [cljs.test :refer [deftest is testing]]
            [duck.cases :refer [cases excuses]]
            [duck.rules :as r]))

(deftest every-case-has-one-bug-and-one-right-fix
  (doseq [c cases]
    (is (= 1 (count (filter :bug (:lines c)))) (get-in c [:title :en]))
    (is (= 1 (count (filter :right (:fixes c)))) (get-in c [:title :en]))
    (doseq [l (:lines c)]
      (is (seq (:code l)))
      (is (seq (get-in l [:think :en])))
      (is (seq (get-in l [:think :nl]))))
    (doseq [l (filter :bug (:lines c))]
      (is (seq (get-in l [:does :en])))
      (is (seq (get-in l [:does :nl]))))
    (is (seq (get-in c [:aha :nl])))))

(defn bug-line [c] (first (keep-indexed (fn [i l] (when (:bug l) i)) (:lines c))))
(defn right-fix [c] (first (keep-indexed (fn [i f] (when (:right f) i)) (:fixes c))))

(deftest explaining-lines-costs-a-minute-each-and-the-bug-line-is-the-aha
  (let [c (first cases)
        ok-line (first (keep-indexed (fn [i l] (when-not (:bug l) i)) (:lines c)))
        g (r/explain (r/new-game) ok-line)]
    (is (= :explaining (:phase g)))
    (is (= 1 (:minutes g)))
    (testing "explaining the same line twice does nothing"
      (is (= g (r/explain g ok-line))))
    (let [g (r/explain g (bug-line c))]
      (is (= :aha (:phase g)))
      (is (= 2 (:minutes g))))))

(deftest the-right-fix-moves-on-and-a-wrong-one-costs-patience
  (let [c (first cases)
        g (r/explain (r/new-game) (bug-line c))
        wrong (first (keep-indexed (fn [i f] (when-not (:right f) i)) (:fixes c)))
        g2 (r/fix g wrong)]
    (is (= :aha (:phase g2)))
    (is (= (dec r/start-patience) (:patience g2)))
    (let [g3 (r/fix g2 (right-fix c))]
      (is (= 1 (:case g3)))
      (is (= :explaining (:phase g3)))
      (is (empty? (:explained g3))))))

(deftest excuses-cost-patience-and-the-duck-eventually-leaves
  (let [g (nth (iterate r/excuse (r/new-game)) r/start-patience)]
    (is (= :left (:phase g)))
    (is (= 0 (:patience g)))
    (is (= (* r/start-patience r/excuse-minutes) (:minutes g)))
    (is (= 4 (count excuses)))))

(deftest a-perfect-run-solves-every-case-in-one-minute-each
  (let [g (reduce (fn [g c] (-> g (r/explain (bug-line c)) (r/fix (right-fix c)))) (r/new-game) cases)]
    (is (= :done (:phase g)))
    (is (= (r/best-possible) (:minutes g)))
    (is (= r/start-patience (:patience g)))))
