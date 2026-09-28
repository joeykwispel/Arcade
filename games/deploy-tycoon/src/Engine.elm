module Engine exposing
    ( Event(..)
    , GenId(..)
    , Generator
    , Round(..)
    , State
    , Upgrade
    , UpgradeEffect(..)
    , affordable
    , baseRate
    , buy
    , buyUpgrade
    , canIpo
    , clickValue
    , cost
    , decoder
    , duration
    , encode
    , genMult
    , genRate
    , generators
    , globalMult
    , incidentFactor
    , ipo
    , ipoAt
    , money
    , newState
    , offline
    , optionBonus
    , optionsOnIpo
    , owned
    , push
    , rate
    , rollback
    , roundFor
    , tick
    , upgrades
    , visibleGens
    , visibleUpgrades
    )

{-| Deploy Tycoon's economy, with no UI: money, generators, upgrades, incidents, funding rounds, the IPO (prestige)
and offline earnings. Every function returns a new state; nothing is changed in place.
-}

import Dict exposing (Dict)
import Json.Decode as D
import Json.Encode as E



-- GENERATORS


type GenId
    = Intern
    | Junior
    | Senior
    | Lead
    | Ci
    | K8s
    | Agent
    | Datacenter


type alias Generator =
    { id : GenId
    , key : String
    , cost : Float -- price of the first one
    , rate : Float -- dollars per second, each
    }


generators : List Generator
generators =
    [ Generator Intern "intern" 15 0.2
    , Generator Junior "junior" 100 1
    , Generator Senior "senior" 1100 8
    , Generator Lead "lead" 12000 47
    , Generator Ci "ci" 130000 260
    , Generator K8s "k8s" 1400000 1400
    , Generator Agent "agent" 20000000 7800
    , Generator Datacenter "datacenter" 330000000 44000
    ]


{-| Every next one costs 15% more.
-}
growth : Float
growth =
    1.15



-- UPGRADES


type UpgradeEffect
    = GenDouble Generator
    | ClickMult Float
    | ClickShare Float
    | AllBonus Float
    | Sre
    | Chaos


type alias Upgrade =
    { id : String
    , cost : Float
    , effect : UpgradeEffect
    , tier : Int -- for generator upgrades: which of the four; -1 otherwise
    , needsOwned : Int -- for generator upgrades
    , needsEarned : Float -- for the others
    }


{-| Each generator doubles at 1, 10, 25 and 50 owned: the classic idle-game tiers.
-}
tiers : List ( Int, Float )
tiers =
    [ ( 1, 10 ), ( 10, 50 ), ( 25, 500 ), ( 50, 50000 ) ]


upgrades : List Upgrade
upgrades =
    let
        genUps =
            generators
                |> List.concatMap
                    (\g ->
                        List.indexedMap
                            (\i ( atOwned, price ) ->
                                Upgrade (g.key ++ "-" ++ String.fromInt i) (g.cost * price) (GenDouble g) i atOwned 0
                            )
                            tiers
                    )

        special id price effect earned =
            Upgrade id price effect -1 0 earned
    in
    genUps
        ++ [ special "keyboard" 100 (ClickMult 2) 50
           , special "vim" 5000 (ClickMult 2) 2000
           , special "copilot" 50000 (ClickShare 0.05) 20000
           , special "monorepo" 5000000 (ClickShare 0.05) 2000000
           , special "coffee" 1000 (AllBonus 0.1) 500
           , special "desks" 25000 (AllBonus 0.1) 10000
           , special "remote" 500000 (AllBonus 0.2) 200000
           , special "fourday" 50000000 (AllBonus 0.25) 20000000
           , special "sre" 10000 Sre 5000
           , special "chaos" 1000000 Chaos 500000
           ]



-- ROUNDS AND CONSTANTS


type Round
    = Garage
    | Seed
    | SeriesA
    | SeriesB
    | SeriesC
    | Unicorn


rounds : List ( Round, Float )
rounds =
    [ ( Garage, 0 ), ( Seed, 1000 ), ( SeriesA, 100000 ), ( SeriesB, 10000000 ), ( SeriesC, 1000000000 ), ( Unicorn, 100000000000 ) ]


{-| You can go public (prestige) from Series B: about an hour into a first run.
-}
ipoAt : Float
ipoAt =
    10000000


{-| Each stock option is +2% on all income, forever.
-}
optionBonus : Float
optionBonus =
    0.02


{-| While prod is down, income drops to this share.
-}
incidentFactor : Float
incidentFactor =
    0.2


{-| Offline: at most 8 hours, at half speed.
-}
offlineCap : Float
offlineCap =
    8 * 3600



-- STATE


type alias State =
    { money : Float
    , earned : Float -- this run: drives unlocks and funding rounds
    , allTime : Float -- over all runs: drives stock options
    , clicks : Int
    , owned : Dict String Int
    , upgrades : List String
    , options : Int
    , round : Round
    , nextIncident : Float -- seconds until the next incident
    , incident : Float -- seconds the current incident has lasted, or -1
    , played : Float
    , lastSeen : Float -- ms since 1970, for offline earnings
    }


newState : Int -> Float -> Float -> State
newState options allTime now =
    { money = 0
    , earned = 0
    , allTime = allTime
    , clicks = 0
    , owned = Dict.empty
    , upgrades = []
    , options = options
    , round = Garage
    , nextIncident = 150
    , incident = -1
    , played = 0
    , lastSeen = now
    }


owned : State -> Generator -> Int
owned s g =
    Dict.get g.key s.owned |> Maybe.withDefault 0


has : State -> String -> Bool
has s id =
    List.member id s.upgrades


effects : State -> List UpgradeEffect
effects s =
    upgrades |> List.filter (\u -> has s u.id) |> List.map .effect



-- NUMBERS


genMult : State -> Generator -> Float
genMult s g =
    effects s
        |> List.foldl
            (\e m ->
                case e of
                    GenDouble x ->
                        if x.id == g.id then
                            m * 2

                        else
                            m

                    _ ->
                        m
            )
            1


{-| Everything that multiplies all income: perks and stock options.
-}
globalMult : State -> Float
globalMult s =
    let
        perks =
            effects s
                |> List.foldl
                    (\e b ->
                        case e of
                            AllBonus x ->
                                b + x

                            _ ->
                                b
                    )
                    0
    in
    (1 + perks) * (1 + toFloat s.options * optionBonus)


{-| Dollars per second of one generator type, all owned together.
-}
genRate : State -> Generator -> Float
genRate s g =
    toFloat (owned s g) * g.rate * genMult s g * globalMult s


{-| Dollars per second, before an incident.
-}
baseRate : State -> Float
baseRate s =
    generators |> List.map (genRate s) |> List.sum


rate : State -> Float
rate s =
    baseRate s
        * (if s.incident >= 0 then
            incidentFactor

           else
            1
          )


clickValue : State -> Float
clickValue s =
    let
        ( mult, share ) =
            effects s
                |> List.foldl
                    (\e ( m, sh ) ->
                        case e of
                            ClickMult x ->
                                ( m * x, sh )

                            ClickShare x ->
                                ( m, sh + x )

                            _ ->
                                ( m, sh )
                    )
                    ( 1, 0 )
    in
    mult * (1 + toFloat s.options * optionBonus) + share * baseRate s


{-| Price of the next `n` of a generator when you own `have`: a geometric series.
-}
cost : Generator -> Int -> Int -> Float
cost g have n =
    toFloat (ceiling (g.cost * growth ^ toFloat have * (growth ^ toFloat n - 1) / (growth - 1)))


{-| How many you can buy with `cash` right now.
-}
affordable : Generator -> Int -> Float -> Int
affordable g have cash =
    let
        first =
            g.cost * growth ^ toFloat have

        guess =
            if cash < first then
                0

            else
                floor (logBase growth (cash * (growth - 1) / first + 1))

        down n =
            if n > 0 && cost g have n > cash then
                down (n - 1)

            else
                n

        up n =
            if cost g have (n + 1) <= cash then
                up (n + 1)

            else
                n
    in
    if cash < first then
        0

    else
        -- floating point at the edges: step to the exact answer
        guess |> down |> up


roundFor : Float -> Round
roundFor earned =
    rounds
        |> List.filter (\( _, at ) -> earned >= at)
        |> List.reverse
        |> List.head
        |> Maybe.map Tuple.first
        |> Maybe.withDefault Garage


{-| Stock options an IPO would give you now (on top of what you have): √ of all money ever earned.
-}
optionsOnIpo : State -> Int
optionsOnIpo s =
    max 0 (floor (sqrt (s.allTime / 1000000)) - s.options)


canIpo : State -> Bool
canIpo s =
    s.earned >= ipoAt && optionsOnIpo s > 0


{-| Generators you can see: bought before, or within reach.
-}
visibleGens : State -> List Generator
visibleGens s =
    generators |> List.indexedMap Tuple.pair |> List.filter (\( i, g ) -> i == 0 || owned s g > 0 || s.earned >= g.cost * 0.5) |> List.map Tuple.second


{-| Upgrades you can see: not bought yet and their condition met, cheapest first.
-}
visibleUpgrades : State -> List Upgrade
visibleUpgrades s =
    upgrades
        |> List.filter
            (\u ->
                not (has s u.id)
                    && (case u.effect of
                            GenDouble g ->
                                owned s g >= u.needsOwned

                            _ ->
                                s.earned >= u.needsEarned
                       )
            )
        |> List.sortBy .cost



-- ACTIONS


type Event
    = IncidentStarted
    | Resolved Bool
    | NewRound Round
    | News Float Int


earn : Float -> State -> State
earn amount s =
    { s | money = s.money + amount, earned = s.earned + amount, allTime = s.allTime + amount }


push : State -> ( State, Float )
push s =
    let
        v =
            clickValue s

        next =
            earn v s
    in
    ( { next | clicks = s.clicks + 1 }, v )


{-| Buys up to `n` of a generator (a huge n: as many as you can afford). Returns how many were bought.
-}
buy : Generator -> Int -> State -> ( State, Int )
buy g n s =
    let
        count =
            min n (affordable g (owned s g) s.money)
    in
    if count <= 0 then
        ( s, 0 )

    else
        ( { s | money = s.money - cost g (owned s g) count, owned = Dict.insert g.key (owned s g + count) s.owned }, count )


buyUpgrade : String -> State -> Maybe State
buyUpgrade id s =
    visibleUpgrades s
        |> List.filter (\u -> u.id == id && s.money >= u.cost)
        |> List.head
        |> Maybe.map (\u -> { s | money = s.money - u.cost, upgrades = s.upgrades ++ [ u.id ] })


rollback : State -> Maybe State
rollback s =
    if s.incident >= 0 then
        Just { s | incident = -1 }

    else
        Nothing


{-| Goes public: a fresh company, but you keep your stock options (and gain new ones).
-}
ipo : Float -> State -> State
ipo now s =
    if canIpo s then
        newState (s.options + optionsOnIpo s) s.allTime now

    else
        s


{-| Advances time by `dt` seconds. `r1` and `r2` are random numbers in [0, 1).
-}
tick : Float -> Float -> Float -> State -> ( State, List Event )
tick dt r1 r2 s0 =
    let
        s1 =
            earn (rate s0 * dt) { s0 | played = s0.played + dt }

        -- incidents: now and then prod goes down, until you roll back (or your SRE does)
        ( s2, incidentEvents ) =
            if s1.incident >= 0 then
                let
                    lasted =
                        s1.incident + dt
                in
                if has s1 "sre" && lasted >= 10 then
                    ( { s1 | incident = -1 }, [ Resolved True ] )

                else
                    ( { s1 | incident = lasted }, [] )

            else if baseRate s1 > 0 && s1.nextIncident - dt <= 0 then
                ( { s1
                    | incident = 0
                    , nextIncident =
                        (90 + r1 * 120)
                            * (if has s1 "chaos" then
                                2

                               else
                                1
                              )
                  }
                , [ IncidentStarted ]
                )

            else if baseRate s1 > 0 then
                ( { s1 | nextIncident = s1.nextIncident - dt }, [] )

            else
                ( s1, [] )

        -- good news, about once every two minutes: a burst of income
        ( s3, newsEvents ) =
            if baseRate s2 > 0 && r2 < dt / 120 then
                let
                    bonus =
                        baseRate s2 * 30
                in
                ( earn bonus s2, [ News bonus (floor (r1 * 1000)) ] )

            else
                ( s2, [] )

        round =
            roundFor s3.earned
    in
    if round /= s3.round then
        ( { s3 | round = round }, incidentEvents ++ newsEvents ++ [ NewRound round ] )

    else
        ( s3, incidentEvents ++ newsEvents )


{-| Money made while the tab was closed: capped at 8 hours, at half speed, and incidents don't count.
Returns the new state and the seconds away and money earned (0 for a short break).
-}
offline : Float -> State -> ( State, Float, Float )
offline now s =
    let
        away =
            clamp 0 offlineCap ((now - s.lastSeen) / 1000)

        seen =
            { s | lastSeen = now }
    in
    if away < 60 then
        ( seen, 0, 0 )

    else
        let
            got =
                baseRate s * away * 0.5
        in
        ( earn got seen, away, got )



-- SAVING


encode : State -> E.Value
encode s =
    E.object
        [ ( "version", E.int 1 )
        , ( "money", E.float s.money )
        , ( "earned", E.float s.earned )
        , ( "allTime", E.float s.allTime )
        , ( "clicks", E.int s.clicks )
        , ( "owned", E.dict identity E.int s.owned )
        , ( "upgrades", E.list E.string s.upgrades )
        , ( "options", E.int s.options )
        , ( "nextIncident", E.float s.nextIncident )
        , ( "incident", E.float s.incident )
        , ( "played", E.float s.played )
        , ( "lastSeen", E.float s.lastSeen )
        ]


{-| Reads a save, filling in anything missing or broken, so an old or hand-edited save still loads.
-}
decoder : Float -> D.Decoder State
decoder now =
    let
        field name dec default =
            D.oneOf [ D.field name dec, D.succeed default ]

        base =
            newState 0 0 now
    in
    D.map8
        (\m e a c o u opts rest ->
            let
                known =
                    List.filter (\id -> List.any (\x -> x.id == id) upgrades) u
            in
            rest { base | money = m, earned = e, allTime = a, clicks = c, owned = o, upgrades = known, options = opts, round = roundFor e }
        )
        (field "money" D.float 0)
        (field "earned" D.float 0)
        (field "allTime" D.float 0)
        (field "clicks" D.int 0)
        (field "owned" (D.dict D.int) Dict.empty)
        (field "upgrades" (D.list D.string) [])
        (field "options" D.int 0)
        (D.map4
            (\ni inc pl ls s -> { s | nextIncident = ni, incident = inc, played = pl, lastSeen = ls })
            (field "nextIncident" D.float 150)
            (field "incident" D.float -1)
            (field "played" D.float 0)
            (field "lastSeen" D.float now)
        )



-- FORMATTING


{-| $1.23M style.
-}
money : Float -> String
money n =
    let
        suffixes =
            [ "", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc" ]

        tier =
            min (List.length suffixes - 1) (floor (logBase 10 n / 3))

        v =
            n / 1000 ^ toFloat tier

        fixed digits x =
            let
                scaled =
                    String.fromInt (round (x * 10 ^ toFloat digits))

                padded =
                    String.padLeft (digits + 1) '0' scaled
            in
            if digits == 0 then
                scaled

            else
                String.dropRight digits padded ++ "." ++ String.right digits padded

        suffix =
            List.drop tier suffixes |> List.head |> Maybe.withDefault ""
    in
    if isNaN n || isInfinite n then
        "∞"

    else if n < 10 then
        let
            s =
                fixed 1 n
        in
        if String.endsWith ".0" s then
            String.dropRight 2 s

        else
            s

    else if n < 1000 then
        String.fromInt (floor n)

    else if v >= 100 then
        fixed 0 v ++ suffix

    else if v >= 10 then
        fixed 1 v ++ suffix

    else
        fixed 2 v ++ suffix


duration : Float -> String
duration seconds =
    let
        h =
            floor seconds // 3600

        m =
            modBy 60 (floor seconds // 60)
    in
    if h > 0 then
        String.fromInt h ++ "h " ++ String.fromInt m ++ "m"

    else
        String.fromInt m ++ "m"
