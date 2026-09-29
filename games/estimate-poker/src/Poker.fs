/// Estimate Poker: the rules, in plain F#. No browser in here: Fable compiles this file to JavaScript for the page,
/// and the xUnit tests run it on .NET.
///
/// A ticket comes in. While you think, scope keeps creeping in, a line at a time. The true size is the whole ticket,
/// including the creep you haven't seen yet. Voting early is a gamble; waiting costs meeting time.
module Poker

type Lang =
    | En
    | Nl

/// A scope line: what it says, and how many points it really adds.
type Creep = { En: string; Nl: string; Points: int }

type Ticket =
    { Title: string
      Base: int
      Creep: Creep list }

/// The planning poker deck (story points).
let deck = [ 1; 2; 3; 5; 8; 13; 21 ]

/// Seconds between scope lines.
let creepEvery = 2.5

let private c en nl points = { En = en; Nl = nl; Points = points }

let tickets =
    [ { Title = "Add a dark mode toggle"
        Base = 1
        Creep =
          [ c "…it should remember the choice." "…hij moet de keuze onthouden." 1
            c "…and follow the system setting." "…en de systeeminstelling volgen." 1
            c "…in the emails too." "…ook in de e-mails." 3 ] }
      { Title = "Change the button text to 'Buy now'"
        Base = 1
        Creep =
          [ c "…in all 14 languages." "…in alle 14 talen." 2
            c "…legal needs to approve the wording." "…juridische zaken moet de tekst goedkeuren." 2 ] }
      { Title = "Export the report as CSV"
        Base = 2
        Creep =
          [ c "…and Excel." "…en Excel." 3
            c "…with the charts in it." "…met de grafieken erin." 5
            c "…scheduled, by e-mail, every Monday." "…ingepland, per e-mail, elke maandag." 3 ] }
      { Title = "Fix the typo on the login page"
        Base = 1
        Creep = [] }
      { Title = "Log in with Google"
        Base = 3
        Creep =
          [ c "…and Apple, and GitHub." "…en Apple, en GitHub." 3
            c "…merging with existing accounts." "…gekoppeld aan bestaande accounts." 5
            c "…the auth code is legacy, from 2014." "…de auth-code is legacy, uit 2014." 8 ] }
      { Title = "Make the app faster"
        Base = 3
        Creep =
          [ c "…nobody knows which part is slow." "…niemand weet welk deel traag is." 5
            c "…without changing the database." "…zonder de database te veranderen." 5 ] }
      { Title = "Add a footer link to the privacy policy"
        Base = 1
        Creep =
          [ c "…there is no privacy policy yet." "…er is nog geen privacyverklaring." 3 ] }
      { Title = "Upgrade the framework to the latest version"
        Base = 5
        Creep =
          [ c "…it's three major versions behind." "…hij loopt drie majorversies achter." 8
            c "…half the plugins are abandoned." "…de helft van de plugins is verlaten." 5 ] } ]

/// The true size: the base plus every scope line, seen or not.
let size (t: Ticket) = t.Base + (t.Creep |> List.sumBy _.Points)

/// The card closest to a number of points (ties go to the bigger card: engineers are optimists, but not that much).
let nearestCard n =
    deck |> List.minBy (fun card -> abs (card - n) * 2 - (if card >= n then 1 else 0))

/// How many cards apart two cards are in the deck.
let distance a b =
    let index x = deck |> List.findIndex ((=) x)
    abs (index a - index b)

/// How many scope lines are visible after `seconds` of discussion.
let visible (t: Ticket) (seconds: float) =
    min t.Creep.Length (int (seconds / creepEvery))

/// Points for a vote: 100 for the right card, less for each card off, and less for every second of the meeting.
let score (t: Ticket) (card: int) (seconds: float) =
    let off = distance card (nearestCard (size t))
    max 0 (100 - 30 * off - int (seconds * 4.0))

/// What your colleagues vote, and why. The same every time for the same ticket.
let colleagues (t: Ticket) =
    let truth = nearestCard (size t)
    [ "Dave", 1, (if t.Base = 1 then "It's just a button." else "Can't be that hard.")
      "Priya", truth, "I read the whole ticket."
      "Mark", nearestCard (t.Base * 3), "Times three, always." ]

let text lang (c: Creep) =
    match lang with
    | En -> c.En
    | Nl -> c.Nl
