module EngineTest exposing (suite)

import Dict
import Engine exposing (Event(..), Generator, GenId(..), State)
import Expect
import Json.Decode as D
import Test exposing (Test, describe, test)


gen : GenId -> Generator
gen id =
    Engine.generators |> List.filter (\g -> g.id == id) |> List.head |> Maybe.withDefault { id = Intern, key = "intern", cost = 15, rate = 0.2 }


intern : Generator
intern =
    gen Intern


fresh : State
fresh =
    Engine.newState 0 0 0


withOwned : List ( String, Int ) -> State -> State
withOwned list s =
    { s | owned = Dict.fromList list }


{-| No incident and no good news: randomness that never fires
-}
quiet : State -> State
quiet s =
    Engine.tick 1 0.5 0.999 s |> Tuple.first


suite : Test
suite =
    describe "economy"
        [ test "prices climb 15% per purchase, and a bulk price is the sum" <|
            \_ ->
                let
                    sum =
                        List.range 0 9 |> List.map (\i -> 15 * 1.15 ^ toFloat i) |> List.sum
                in
                Expect.all
                    [ \_ -> Expect.equal 15 (Engine.cost intern 0 1)
                    , \_ -> Expect.equal (toFloat (ceiling (15 * 1.15))) (Engine.cost intern 1 1)
                    , \_ -> Expect.equal (toFloat (ceiling sum)) (Engine.cost intern 0 10)
                    ]
                    ()
        , test "buying the max buys exactly what you can afford" <|
            \_ ->
                [ 14, 15, 1000, 123456, 9.9e9 ]
                    |> List.map
                        (\cash ->
                            let
                                n =
                                    Engine.affordable intern 3 cash
                            in
                            Engine.cost intern 3 n <= cash && Engine.cost intern 3 (n + 1) > cash
                        )
                    |> Expect.equal [ True, True, True, True, True ]
        , test "earns from clicks, and from generators over time" <|
            \_ ->
                let
                    ( clicked, v ) =
                        Engine.push fresh

                    earning =
                        clicked |> withOwned [ ( "junior", 10 ) ] |> quiet |> quiet
                in
                Expect.all
                    [ \_ -> Expect.equal 1 v
                    , \_ -> Expect.within (Expect.Absolute 1.0e-6) 21 earning.money
                    ]
                    ()
        , test "upgrades double generators and grow clicks" <|
            \_ ->
                let
                    rich =
                        { fresh | money = 1.0e9, earned = 1.0e6 } |> withOwned [ ( "junior", 1 ) ]

                    upgraded =
                        rich |> Engine.buyUpgrade "junior-0" |> Maybe.andThen (Engine.buyUpgrade "keyboard")
                in
                case upgraded of
                    Just s ->
                        Expect.all
                            [ \_ -> Expect.equal 2 (Engine.rate s)
                            , \_ -> Expect.equal 2 (Engine.clickValue s)
                            , \_ -> Expect.equal Nothing (Engine.buyUpgrade "keyboard" s)
                            , \_ -> Expect.equal Nothing (Engine.buyUpgrade "junior-3" s)
                            ]
                            ()

                    Nothing ->
                        Expect.fail "could not buy the upgrades"
        , test "an incident cuts income until you roll back, or the SRE does" <|
            \_ ->
                let
                    s0 =
                        { fresh | nextIncident = 0.5 } |> withOwned [ ( "junior", 10 ) ]

                    ( down, events ) =
                        Engine.tick 1 0.5 0.999 s0

                    withSre =
                        { down | upgrades = [ "sre" ] }

                    ( _, later ) =
                        Engine.tick 11 0.5 0.999 withSre
                in
                Expect.all
                    [ \_ -> Expect.equal [ IncidentStarted ] events
                    , \_ -> Expect.equal 2 (Engine.rate down)
                    , \_ -> Expect.equal (Just 10) (Engine.rollback down |> Maybe.map Engine.rate)
                    , \_ -> Expect.equal [ Resolved True ] later
                    ]
                    ()
        , test "pays for time away: half speed, at most eight hours" <|
            \_ ->
                let
                    ( back, seconds, got ) =
                        Engine.offline (24 * 3600 * 1000) (fresh |> withOwned [ ( "junior", 10 ) ])

                    ( _, _, again ) =
                        Engine.offline (24 * 3600 * 1000 + 30000) back
                in
                Expect.all
                    [ \_ -> Expect.equal (8 * 3600) seconds
                    , \_ -> Expect.equal (10 * 8 * 3600 * 0.5) got
                    , \_ -> Expect.equal 0 again
                    ]
                    ()
        , test "goes public for stock options, and keeps them" <|
            \_ ->
                let
                    big =
                        { fresh | earned = Engine.ipoAt * 10, allTime = Engine.ipoAt * 10 } |> withOwned [ ( "intern", 50 ) ]

                    after =
                        Engine.ipo 0 big
                in
                Expect.all
                    [ \_ -> Expect.equal False (Engine.canIpo fresh)
                    , \_ -> Expect.equal True (Engine.canIpo big)
                    , \_ -> Expect.greaterThan 0 after.options
                    , \_ -> Expect.equal 0 (Engine.owned after intern)
                    , \_ -> Expect.equal big.allTime after.allTime
                    , \_ -> Expect.greaterThan 1 (Engine.clickValue after)
                    ]
                    ()
        , test "reaches the IPO in a reasonable time with a simple strategy" <|
            \_ ->
                let
                    -- click 5×/s, buy every upgrade, then the generator with the best $/s per $, roll back after 5 s
                    step s =
                        let
                            clicked =
                                List.foldl (\_ acc -> Tuple.first (Engine.push acc)) s (List.range 1 5)

                            upgraded =
                                List.foldl (\u acc -> Engine.buyUpgrade u.id acc |> Maybe.withDefault acc) clicked (Engine.visibleUpgrades clicked)

                            best =
                                Engine.generators
                                    |> List.filter (\g -> upgraded.money >= Engine.cost g (Engine.owned upgraded g) 1)
                                    |> List.sortBy (\g -> Engine.cost g (Engine.owned upgraded g) 1 / g.rate)
                                    |> List.head

                            bought =
                                case best of
                                    Just g ->
                                        Tuple.first (Engine.buy g 1 upgraded)

                                    Nothing ->
                                        upgraded

                            ( ticked, _ ) =
                                Engine.tick 1 0.37 0.999 bought
                        in
                        if ticked.incident >= 5 then
                            Engine.rollback ticked |> Maybe.withDefault ticked

                        else
                            ticked

                    run t s =
                        if s.earned >= Engine.ipoAt || t >= 6 * 3600 then
                            t

                        else
                            run (t + 1) (step s)

                    seconds =
                        run 0 fresh
                in
                Expect.all
                    [ \_ -> Expect.greaterThan (20 * 60) seconds
                    , \_ -> Expect.lessThan (4 * 3600) seconds
                    ]
                    ()
        , test "survives a broken or old save" <|
            \_ ->
                let
                    json =
                        """{"money": 50, "owned": {"intern": 3}, "upgrades": ["keyboard", "nope"], "clicks": "x"}"""
                in
                case D.decodeString (Engine.decoder 0) json of
                    Ok s ->
                        Expect.all
                            [ \_ -> Expect.equal 50 s.money
                            , \_ -> Expect.equal 3 (Engine.owned s intern)
                            , \_ -> Expect.equal 0 (Engine.owned s (gen Datacenter))
                            , \_ -> Expect.equal [ "keyboard" ] s.upgrades
                            , \_ -> Expect.equal 0 s.clicks
                            ]
                            ()

                    Err e ->
                        Expect.fail (D.errorToString e)
        , test "formats money short" <|
            \_ ->
                List.map Engine.money [ 0, 2.5, 999, 1234, 56700000, 4.2e15 ]
                    |> Expect.equal [ "0", "2.5", "999", "1.23K", "56.7M", "4.20Qa" ]
        ]
