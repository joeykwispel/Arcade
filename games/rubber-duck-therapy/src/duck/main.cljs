(ns duck.main
  "The page: the code on the left (each line a button), the duck on the right. The rules are in duck.rules; this only
  draws the state and turns clicks into rule calls. Plain DOM, no React: re-rendering a few dozen nodes is instant."
  (:require [clojure.string :as str]
            [duck.cases :refer [cases excuses]]
            [duck.rules :as r]))

(def text
  {:en {:case "case" :minutes "minutes" :patience "duck's patience" :best "best"
        :title "Rubber Duck Therapy"
        :tagline "Your code has a bug. Explain it to the duck, line by line, until you see it yourself."
        :how "Click a line to explain it. Pick the lines you trust least first: every explanation costs a minute. Blaming something else costs five, and the duck's patience."
        :start "Press Space or tap to pick up the duck"
        :explain "Click a line to explain it to the duck."
        :you "You" :duck "Duck" :actually "Wait. Actually…"
        :aha "Oh." :pick "Which fix?"
        :fine "…yes, it does exactly that."
        :excuses "Or blame something else:"
        :wrong "The duck tilts its head. That's not it."
        :stare "The duck stares at you."
        :solved "Fixed! Thanks, duck."
        :done "All bugs fixed"
        :done-sub "{minutes} minutes of debugging (the best possible is {best})."
        :left "The duck has left the chat"
        :left-sub "It had heard enough excuses."
        :new-best "New best!"
        :again "Press Space or tap to debug again"}
   :nl {:case "case" :minutes "minuten" :patience "geduld van de eend" :best "record"
        :title "Rubber Duck Therapy"
        :tagline "Je code heeft een bug. Leg hem regel voor regel uit aan de eend, tot je hem zelf ziet."
        :how "Klik een regel om hem uit te leggen. Begin met de regels die je het minst vertrouwt: elke uitleg kost een minuut. Iets anders de schuld geven kost er vijf, en het geduld van de eend."
        :start "Druk op spatie of tik om de eend te pakken"
        :explain "Klik een regel om hem aan de eend uit te leggen."
        :you "Jij" :duck "Eend" :actually "Wacht. Eigenlijk…"
        :aha "O." :pick "Welke fix?"
        :fine "…ja, dat doet hij precies."
        :excuses "Of geef iets anders de schuld:"
        :wrong "De eend houdt zijn kop schuin. Dat is het niet."
        :stare "De eend staart je aan."
        :solved "Opgelost! Bedankt, eend."
        :done "Alle bugs opgelost"
        :done-sub "{minutes} minuten debuggen (het beste kan in {best})."
        :left "De eend heeft de chat verlaten"
        :left-sub "Hij had genoeg smoesjes gehoord."
        :new-best "Nieuw record!"
        :again "Druk op spatie of tik om opnieuw te debuggen"}})

(defonce state (atom {:mode :title :game (r/new-game) :lang :en :best 0 :new-best false :said []}))

;; ---------- the browser around the game ----------

(def best-key "play:rubber-duck-therapy:best")

(defn initial-lang []
  (let [p (.get (js/URLSearchParams. (.. js/window -location -search)) "lang")]
    (cond (#{"en" "nl"} p) (keyword p)
          (str/starts-with? (.. js/navigator -language) "nl") :nl
          :else :en)))

(defn load-best []
  (try (or (js/parseInt (.getItem js/localStorage best-key)) 0) (catch :default _ 0)))

(defn save-best! [n]
  (try (.setItem js/localStorage best-key (str n)) (catch :default _ nil)))

(defn set-theme! [t]
  (set! (.. js/document -documentElement -dataset -theme) (if (= t "light") "light" "dark")))

(defn follow-hub! []
  (let [cookie (second (re-find #"(?:^|; )jo-theme=(dark|light)" (.-cookie js/document)))
        stored (try (.getItem js/localStorage "theme") (catch :default _ nil))]
    (set-theme! (or cookie stored)))
  (when (= js/window.top js/window.self)
    (.add (.. js/document -documentElement -classList) "standalone"))
  (.addEventListener js/window "message"
                     (fn [^js e]
                       (let [^js d (.-data e)]
                         (when (and (= (.-origin e) (.. js/location -origin)) d (= (.-type d) "play:settings"))
                           (when (#{"light" "dark"} (.-theme d)) (set-theme! (.-theme d)))
                           (when (#{"en" "nl"} (.-lang d)) (swap! state assoc :lang (keyword (.-lang d)))))))))

;; ---------- a tiny DOM helper ----------

(defn el
  "Makes an element: (el :button {:class \"x\" :on-click f} child …). Children can be strings, elements, nil or seqs."
  [tag attrs & children]
  (let [node (.createElement js/document (name tag))]
    (doseq [[k v] attrs :when (some? v)]
      (cond
        (str/starts-with? (name k) "on-") (.addEventListener node (subs (name k) 3) v)
        (= k :class) (set! (.-className node) v)
        :else (.setAttribute node (name k) (str v))))
    (doseq [c (flatten children) :when (some? c)]
      (.append node (if (string? c) (.createTextNode js/document c) c)))
    node))

(defn fill [s vars] (str/replace s #"\{(\w+)\}" (fn [[_ k]] (str (get vars (keyword k) "")))))

;; ---------- actions ----------

(defn t [k] (get-in text [(:lang @state) k]))
(defn l [m] (get m (:lang @state)))

(defn say! [& lines] (swap! state update :said (fn [s] (vec (take-last 8 (concat s lines))))))

(defn start! []
  (swap! state assoc :mode :playing :game (r/new-game) :new-best false :said []))

(defn finish! [mode]
  (let [{:keys [game best]} @state
        minutes (:minutes game)
        better (and (= mode :done) (or (zero? best) (< minutes best)))]
    (when better (save-best! minutes))
    (swap! state assoc :mode mode :new-best better :best (if better minutes best))))

(defn explain! [i]
  (let [g (:game @state)
        line (get-in (r/current g) [:lines i])
        g2 (r/explain g i)]
    (when (not= g g2)
      (swap! state assoc :game g2)
      (say! [:you (str "“" (str/trim (:code line)) "”: " (l (:think line)))])
      (if (:bug line)
        (say! [:actually (l (:does line))] [:aha (str (t :aha) " " (l (:aha (r/current g))))])
        (say! [:duck (t :fine)])))))

(defn excuse! [j]
  (swap! state update :game r/excuse)
  (say! [:you (l (get excuses j))] [:duck (t :stare)])
  (when (= :left (get-in @state [:game :phase])) (finish! :left)))

(defn fix! [j]
  (let [g (:game @state)
        g2 (r/fix g j)]
    (swap! state assoc :game g2)
    (cond
      (= :left (:phase g2)) (finish! :left)
      (= :done (:phase g2)) (finish! :done)
      (= :aha (:phase g2)) (say! [:duck (t :wrong)])
      :else (swap! state assoc :said [[:duck (t :solved)]]))))

;; ---------- drawing ----------

(defn duck-svg [mood]
  ;; a rubber duck, drawn with SVG shapes (no inline styles: the CSP doesn't allow them)
  (let [svg (.createElementNS js/document "http://www.w3.org/2000/svg" "svg")]
    (.setAttribute svg "viewBox" "0 0 120 110")
    (.setAttribute svg "class" (str "duck " (name mood)))
    (.setAttribute svg "aria-hidden" "true")
    (set! (.-innerHTML svg)
          (str "<ellipse class='body' cx='62' cy='80' rx='46' ry='26'/>"
               "<circle class='body' cx='44' cy='42' r='26'/>"
               "<path class='beak' d='M16 44 q-14 3 -12 10 q10 4 20 -2 z'/>"
               "<g class='eye'><circle cx='40' cy='36' r='5.5'/><circle class='glint' cx='42' cy='34' r='1.8'/></g>"
               "<path class='wing' d='M62 70 q22 -8 34 10 q-18 10 -34 -2 z'/>"))
    svg))

(defn render! []
  (let [{:keys [mode game lang best new-best said]} @state
        root (.getElementById js/document "app")
        c (r/current game)
        phase (:phase game)
        mood (cond (= mode :title) :idle
                   (= phase :aha) :aha
                   (= (first (last said)) :duck) :stare
                   :else :listen)]
    (set! (.. js/document -documentElement -lang) (name lang))
    (.replaceChildren
     root
     (el :main {:class "stage" :data-phase (name (if (= mode :playing) phase mode)) :data-case (inc (:case game))
                :data-minutes (:minutes game)}
         (el :header {:class "hud"}
             (el :p {} (t :case) " " (el :b {} (str (inc (:case game)) "/" (count cases))))
             (el :p {} (t :minutes) " " (el :b {} (str (:minutes game))))
             (el :p {:class "patience" :aria-label (str (t :patience) ": " (:patience game))}
                 (t :patience) " "
                 (for [i (range r/start-patience)] (el :span {:class (if (< i (:patience game)) "on" "off")} "●")))
             (el :p {} (t :best) " " (el :b {} (if (pos? best) (str best) "–"))))
         (el :div {:class "room"}
             (el :section {:class "code" :aria-label (l (:title c))}
                 (el :p {:class "file"} (str "bug." (:lang c)) " · " (el :b {} (l (:title c))))
                 (el :ol {:class "lines"}
                     (map-indexed
                      (fn [i line]
                        (el :li {}
                            (el :button {:type "button"
                                         :class (str "line" (when (contains? (:explained game) i) " done")
                                                     (when (and (:bug line) (#{:aha} phase)) " bug"))
                                         :disabled (when (not= phase :explaining) "")
                                         :on-click #(explain! i)}
                                (el :span {:class "n"} (str (inc i)))
                                (el :code {} (:code line)))))
                      (:lines c)))
                 (el :p {:class "hint"} (when (= phase :explaining) (t :explain))))
             (el :section {:class "chat"}
                 (duck-svg mood)
                 (el :ol {:class "said" :aria-live "polite"}
                     (for [[who line] said]
                       (el :li {:class (str "m-" (name who))}
                           (el :b {} (case who :you (t :you) :duck (t :duck) :actually (t :actually) :aha "💡" ""))
                           " " line)))
                 (if (= phase :aha)
                   (el :div {:class "fixes"}
                       (el :p {} (t :pick))
                       (map-indexed (fn [j f] (el :button {:type "button" :class "fix" :on-click #(fix! j)} (el :code {} (:code f))))
                                    (:fixes c)))
                   (el :div {:class "excuses"}
                       (el :p {} (t :excuses))
                       (map-indexed (fn [j e] (el :button {:type "button" :class "excuse" :disabled (when (not= mode :playing) "")
                                                          :on-click #(excuse! j)} (l e)))
                                    excuses)))))
         (when (not= mode :playing)
           (el :div {:class "overlay" :on-click start!}
               (case mode
                 :title [(el :p {:class "big"} (t :title)) (el :p {:class "sub"} (t :tagline)) (el :p {:class "how"} (t :how))]
                 :done [(el :p {:class "big win"} (t :done))
                        (el :p {:class "sub"} (fill (t :done-sub) {:minutes (:minutes game) :best (r/best-possible)}))
                        (when new-best (el :p {:class "accent"} (t :new-best)))]
                 :left [(el :p {:class "big lose"} (t :left)) (el :p {:class "sub"} (t :left-sub))]
                 nil)
               (el :p {:class "hint"} (if (= mode :title) (t :start) (t :again))))))))
  ;; keep the newest thing said in view
  (when-let [said (.querySelector js/document ".said")]
    (set! (.-scrollTop said) (.-scrollHeight said))))

(defn ^:export init []
  (swap! state assoc :lang (initial-lang) :best (load-best))
  (follow-hub!)
  (add-watch state ::render (fn [_ _ _ _] (render!)))
  (.addEventListener js/window "keydown"
                     (fn [^js e]
                       (when (and (#{" " "Enter"} (.-key e)) (not= (:mode @state) :playing) (not (.-repeat e)))
                         (.preventDefault e)
                         (start!))))
  (render!))
