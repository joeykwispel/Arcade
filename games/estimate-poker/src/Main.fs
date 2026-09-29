/// Estimate Poker: the page. Poker.fs has the rules; this draws the ticket, the creeping scope, your hand of cards
/// and the reveal, with plain DOM through Fable.Browser.Dom. Fable compiles it all to JavaScript.
module Main

open Browser
open Browser.Types
open Fable.Core
open Fable.Core.JsInterop
open Poker

[<Import("followHub", "./host.js")>]
let private followHub: (string -> unit) -> unit = jsNative

[<Import("initialLang", "./host.js")>]
let private initialLang: unit -> string = jsNative

[<Import("loadBest", "./host.js")>]
let private loadBest: unit -> int = jsNative

[<Import("saveBest", "./host.js")>]
let private saveBest: int -> unit = jsNative

type Mode =
    | Title
    | Voting
    | Reveal
    | Done

type State =
    { Mode: Mode
      Ticket: int
      Seconds: float
      Vote: int option
      Total: int
      Lang: Lang
      Best: int
      NewBest: bool }

let private strings lang =
    match lang with
    | En ->
        {| ticket = "ticket"; score = "score"; best = "best"; meeting = "meeting"
           title = "Estimate Poker"
           tagline = "Planning poker, where the ticket keeps growing while you think."
           how = "A ticket comes in, and scope keeps creeping in, a line every few seconds. Its real size is the whole ticket, including the lines you haven't seen yet. Pick a card (or press 1 to 7): the closer and the quicker, the more points."
           start = "Press Space or tap to start the refinement"
           hand = "your estimate"
           reveal = "The ticket was really {0} points. You said {1}: +{2}"
           next = "Next ticket (Space) →"
           finish = "Sprint review (Space) →"
           doneTitle = "Refinement done"
           doneSub = "{0} points out of {1} possible."
           newBest = "New best!"
           again = "Press Space or tap to refine again"
           points = "points" |}
    | Nl ->
        {| ticket = "ticket"; score = "score"; best = "record"; meeting = "meeting"
           title = "Estimate Poker"
           tagline = "Planning poker, waarbij het ticket blijft groeien terwijl je nadenkt."
           how = "Er komt een ticket binnen, en er sluipt steeds meer scope in, elke paar seconden een regel. De echte grootte is het hele ticket, ook de regels die je nog niet zag. Kies een kaart (of druk 1 tot 7): hoe dichterbij en hoe sneller, hoe meer punten."
           start = "Druk op spatie of tik om de refinement te starten"
           hand = "jouw schatting"
           reveal = "Het ticket was eigenlijk {0} punten. Jij zei {1}: +{2}"
           next = "Volgend ticket (spatie) →"
           finish = "Sprint review (spatie) →"
           doneTitle = "Refinement klaar"
           doneSub = "{0} punten van de {1} mogelijke."
           newBest = "Nieuw record!"
           again = "Druk op spatie of tik om opnieuw te refinen"
           points = "punten" |}

let private fmt (s: string) (args: obj list) =
    args |> List.indexed |> List.fold (fun (acc: string) (i, a) -> acc.Replace("{" + string i + "}", string a)) s

let mutable private state =
    { Mode = Title
      Ticket = 0
      Seconds = 0.0
      Vote = None
      Total = 0
      Lang = (if initialLang () = "nl" then Nl else En)
      Best = loadBest ()
      NewBest = false }

let private el (tag: string) (cls: string) (children: Node list) =
    let e = document.createElement tag
    if cls <> "" then e.className <- cls
    for c in children do
        e.appendChild c |> ignore
    e

let private txt (s: string) = document.createTextNode s :> Node

let private button (cls: string) (label: string) (onClick: unit -> unit) =
    let b = document.createElement "button" :?> HTMLButtonElement
    b.``type`` <- "button"
    b.className <- cls
    b.textContent <- label
    b.addEventListener ("click", fun _ -> onClick ())
    b

let rec private render () =
    let s = strings state.Lang
    let t = tickets.[state.Ticket]
    let app = document.getElementById "app"
    document.documentElement.setAttribute ("lang", (if state.Lang = Nl then "nl" else "en"))
    let seen = if state.Mode = Voting then visible t state.Seconds else t.Creep.Length

    let hud =
        el "header" "hud" [
            el "p" "" [ txt (s.ticket + " "); el "b" "" [ txt $"{state.Ticket + 1}/{tickets.Length}" ] ]
            el "p" "" [ txt (s.meeting + " "); el "b" "" [ txt $"{int state.Seconds} s" ] ]
            el "p" "" [ txt (s.score + " "); el "b" "" [ txt (string state.Total) ] ]
            el "p" "" [ txt (s.best + " "); el "b" "" [ txt (if state.Best > 0 then string state.Best else "–") ] ] ]

    let lines =
        t.Creep
        |> List.truncate seen
        |> List.map (fun c -> el "li" "creep" [ txt (text state.Lang c) ] :> Node)

    let ticket =
        el "section" "ticket" [
            el "p" "id" [ txt $"JIRA-{1400 + state.Ticket * 37}" ]
            el "h1" "" [ txt t.Title ]
            el "ul" "scope" lines
            (if state.Mode = Voting && seen < t.Creep.Length then el "p" "typing" [ txt "…" ] :> Node else txt "") ]

    let hand =
        el "section" "hand" [
            el "p" "label" [ txt s.hand ]
            el "div" "cards" (
                deck
                |> List.mapi (fun i card ->
                    let b = button (if state.Vote = Some card then "card picked" else "card") (string card) (fun () -> vote card)
                    b.setAttribute ("aria-label", $"{card} {s.points} ({i + 1})")
                    if state.Mode <> Voting then b.setAttribute ("disabled", "")
                    b :> Node)) ]

    let reveal =
        match state.Mode, state.Vote with
        | Reveal, Some v ->
            let truth = nearestCard (size t)
            let gained = score t v state.Seconds
            (el "section" "reveal" [
                el "ul" "votes" (
                    colleagues t
                    |> List.map (fun (name, card, why) -> el "li" "" [ el "b" "" [ txt $"{name}: {card}" ]; txt $" {why}" ] :> Node))
                el "p" (if v = truth then "verdict good" else "verdict") [ txt (fmt s.reveal [ truth; v; gained ]) ]
                button "next" (if state.Ticket + 1 < tickets.Length then s.next else s.finish) next ]) :> Node
        | _ -> txt ""

    let overlay =
        match state.Mode with
        | Title ->
            let o = el "div" "overlay" [ el "p" "big" [ txt s.title ]; el "p" "sub" [ txt s.tagline ]; el "p" "how" [ txt s.how ]; el "p" "hint" [ txt s.start ] ]
            o.addEventListener ("click", fun _ -> start ())
            o :> Node
        | Done ->
            let possible = 100 * tickets.Length
            let o =
                el "div" "overlay" [
                    el "p" "big" [ txt s.doneTitle ]
                    el "p" "sub" [ txt (fmt s.doneSub [ state.Total; possible ]) ]
                    (if state.NewBest then el "p" "accent" [ txt s.newBest ] :> Node else txt "")
                    el "p" "hint" [ txt s.again ] ]
            o.addEventListener ("click", fun _ -> start ())
            o :> Node
        | _ -> txt ""

    let stage = el "main" "stage" [ hud; el "div" "room" [ ticket; el "div" "side" [ hand; reveal ] ]; overlay ]
    stage.setAttribute ("data-phase", (string state.Mode).ToLowerInvariant())
    stage.setAttribute ("data-ticket", string (state.Ticket + 1))
    stage.setAttribute ("data-score", string state.Total)
    app.innerHTML <- ""
    app.appendChild stage |> ignore

and private start () =
    state <- { state with Mode = Voting; Ticket = 0; Seconds = 0.0; Vote = None; Total = 0; NewBest = false }
    render ()

and private vote (card: int) =
    if state.Mode = Voting then
        let t = tickets.[state.Ticket]
        state <- { state with Mode = Reveal; Vote = Some card; Total = state.Total + score t card state.Seconds }
        render ()

and private next () =
    if state.Mode = Reveal then
        if state.Ticket + 1 < tickets.Length then
            state <- { state with Mode = Voting; Ticket = state.Ticket + 1; Seconds = 0.0; Vote = None }
        else
            let better = state.Total > state.Best
            if better then saveBest state.Total
            state <- { state with Mode = Done; Best = (if better then state.Total else state.Best); NewBest = better }
        render ()

let mutable private last = 0.0

let rec private tick (now: float) =
    let dt = if last = 0.0 then 0.0 else min 0.1 ((now - last) / 1000.0)
    last <- now
    if state.Mode = Voting then
        let before = visible tickets.[state.Ticket] state.Seconds
        let secondsBefore = int state.Seconds
        state <- { state with Seconds = state.Seconds + dt }
        // re-render only when a new scope line appears or the clock ticks a second
        if visible tickets.[state.Ticket] state.Seconds <> before || int state.Seconds <> secondsBefore then render ()
    window.requestAnimationFrame tick |> ignore

let private onKey (e: KeyboardEvent) =
    match e.key with
    | " "
    | "Enter" when not e.repeat ->
        e.preventDefault ()
        match state.Mode with
        | Title
        | Done -> start ()
        | Reveal -> next ()
        | Voting -> ()
    | k when k.Length = 1 && k >= "1" && k <= "7" -> vote deck.[int k - 1]
    | _ -> ()

followHub (fun l ->
    state <- { state with Lang = (if l = "nl" then Nl else En) }
    render ())
window.addEventListener ("keydown", fun e -> onKey (e :?> KeyboardEvent))
render ()
window.requestAnimationFrame tick |> ignore
