port module Main exposing (main)

{-| Deploy Tycoon: the Elm app. The Elm Architecture: a Model, messages that change it (update), and a view of it.
It talks to the page through two ports: `save` (to localStorage) and `language` (from the hub).
-}

import Browser
import Browser.Events exposing (Visibility(..))
import Engine exposing (Event(..), Generator, State, Upgrade, UpgradeEffect(..))
import Html exposing (Html, button, dd, div, dl, dt, h1, h2, header, li, main_, p, section, span, text, ul)
import Html.Attributes exposing (attribute, class, classList, disabled, style, title)
import Html.Events exposing (onClick)
import Html.Keyed as Keyed
import Json.Decode as D
import Json.Encode as E
import Process
import Random
import Task
import Texts exposing (Lang(..), Text, fill)
import Time


port save : E.Value -> Cmd msg


port language : (String -> msg) -> Sub msg


main : Program Flags Model Msg
main =
    Browser.element { init = init, update = update, view = view, subscriptions = subscriptions }



-- MODEL


type alias Flags =
    { save : D.Value, lang : String, now : Float, seed : Int }


type BuyMode
    = One
    | Ten
    | Max


type Dialog
    = Welcome Float Float
    | ConfirmIpo
    | ConfirmReset


type alias Line =
    { id : Int, text : String, kind : String }


type alias Float_ =
    { id : Int, text : String, x : Float }


type alias Model =
    { s : State
    , lang : Lang
    , mode : BuyMode
    , feed : List Line
    , floats : List Float_
    , nextId : Int
    , incidentTitle : Int
    , dialog : Maybe Dialog
    , say : String
    , seed : Random.Seed
    , now : Float
    , visible : Bool
    }


init : Flags -> ( Model, Cmd Msg )
init flags =
    let
        loaded =
            D.decodeValue (Engine.decoder flags.now) flags.save
                |> Result.withDefault (Engine.newState 0 0 flags.now)

        ( s, away, got ) =
            Engine.offline flags.now loaded
    in
    ( { s = s
      , lang = Texts.fromCode flags.lang |> Maybe.withDefault En
      , mode = One
      , feed = []
      , floats = []
      , nextId = 0
      , incidentTitle = 0
      , dialog =
            if got > 0 then
                Just (Welcome away got)

            else
                Nothing
      , say = ""
      , seed = Random.initialSeed flags.seed
      , now = flags.now
      , visible = True
      }
    , Cmd.none
    )



-- UPDATE


type Msg
    = Push
    | Buy Generator
    | BuyUpgrade Upgrade
    | Rollback
    | SetMode BuyMode
    | Open Dialog
    | Close
    | GoPublic
    | Reset
    | Tick Time.Posix
    | SaveNow
    | VisibilityChanged Visibility
    | Returned Time.Posix
    | SetLang String
    | DropFloat Int


log : String -> String -> Model -> Model
log kind line m =
    { m | feed = List.drop (List.length m.feed - 40) m.feed ++ [ Line (m.nextId + 1) line kind ], nextId = m.nextId + 1 }


persist : Model -> Cmd Msg
persist m =
    let
        s =
            m.s
    in
    save (Engine.encode { s | lastSeen = m.now })


update : Msg -> Model -> ( Model, Cmd Msg )
update msg m =
    let
        t =
            Texts.text m.lang
    in
    case msg of
        Push ->
            let
                ( s, v ) =
                    Engine.push m.s

                ( x, seed ) =
                    Random.step (Random.float 30 190) m.seed

                id =
                    m.nextId + 1
            in
            ( { m | s = s, seed = seed, nextId = id, floats = List.drop (List.length m.floats - 12) m.floats ++ [ Float_ id ("+$" ++ Engine.money v) x ] }
            , Process.sleep 800 |> Task.perform (\_ -> DropFloat id)
            )

        DropFloat id ->
            ( { m | floats = List.filter (\f -> f.id /= id) m.floats }, Cmd.none )

        Buy g ->
            let
                n =
                    case m.mode of
                        One ->
                            1

                        Ten ->
                            10

                        Max ->
                            1000000

                ( s, got ) =
                    Engine.buy g n m.s
            in
            if got > 0 then
                ( log "buy" (fill [ ( "n", String.fromInt got ), ( "name", Tuple.first (t.gen g.id) ) ] t.bought) { m | s = s }, Cmd.none )

            else
                ( m, Cmd.none )

        BuyUpgrade u ->
            case Engine.buyUpgrade u.id m.s of
                Just s ->
                    ( log "buy" ("+ " ++ Tuple.first (upgradeText t u)) { m | s = s }, Cmd.none )

                Nothing ->
                    ( m, Cmd.none )

        Rollback ->
            case Engine.rollback m.s of
                Just s ->
                    ( log "ok" t.resolved { m | s = s, say = t.resolved }, Cmd.none )

                Nothing ->
                    ( m, Cmd.none )

        SetMode mode ->
            ( { m | mode = mode }, Cmd.none )

        Open d ->
            ( { m | dialog = Just d }, Cmd.none )

        Close ->
            ( { m | dialog = Nothing }, Cmd.none )

        GoPublic ->
            let
                gained =
                    Engine.optionsOnIpo m.s

                next =
                    { m | s = Engine.ipo m.now m.s, dialog = Nothing, feed = [] }
                        |> log "ok" ("🔔 IPO! +" ++ String.fromInt gained ++ " " ++ t.options)
            in
            ( next, persist next )

        Reset ->
            let
                next =
                    { m | s = Engine.newState 0 0 m.now, dialog = Nothing, feed = [] }
            in
            ( next, persist next )

        Tick posix ->
            let
                now =
                    toFloat (Time.posixToMillis posix)

                dt =
                    clamp 0 5 ((now - m.now) / 1000)

                ( ( r1, r2 ), seed ) =
                    Random.step (Random.pair (Random.float 0 1) (Random.float 0 1)) m.seed

                ( s, events ) =
                    Engine.tick dt r1 r2 m.s
            in
            ( List.foldl (handle t r1) { m | s = s, seed = seed, now = now } events, Cmd.none )

        SaveNow ->
            ( m, persist m )

        VisibilityChanged Hidden ->
            ( { m | visible = False }, persist m )

        VisibilityChanged Visible ->
            ( { m | visible = True }, Task.perform Returned Time.now )

        Returned posix ->
            let
                now =
                    toFloat (Time.posixToMillis posix)

                ( s, away, got ) =
                    Engine.offline now m.s
            in
            -- back from another tab: pay out the time away like a closed tab
            ( { m
                | s = s
                , now = now
                , dialog =
                    if got > 0 then
                        Just (Welcome away got)

                    else
                        m.dialog
              }
            , Cmd.none
            )

        SetLang code ->
            ( { m | lang = Texts.fromCode code |> Maybe.withDefault m.lang }, Cmd.none )


handle : Text -> Float -> Event -> Model -> Model
handle t r event m =
    case event of
        IncidentStarted ->
            let
                i =
                    floor (r * toFloat (List.length t.incidents))

                title =
                    nth i t.incidents
            in
            log "err" ("✗ " ++ title) { m | incidentTitle = i, say = title }

        Resolved _ ->
            log "ok" t.autoResolved m

        NewRound round ->
            let
                line =
                    fill [ ( "round", t.round round ) ] t.newRound
            in
            log "ok" line { m | say = line }

        News bonus id ->
            log "news" ("📰 " ++ nth (modBy (List.length t.news) id) t.news ++ " +$" ++ Engine.money bonus) m


nth : Int -> List String -> String
nth i list =
    List.drop i list |> List.head |> Maybe.withDefault ""


upgradeText : Text -> Upgrade -> ( String, String )
upgradeText t u =
    case u.effect of
        GenDouble g ->
            let
                name =
                    Tuple.first (t.gen g.id)
            in
            ( name ++ ": " ++ nth u.tier t.tiers, fill [ ( "name", name ) ] t.tierDesc )

        _ ->
            t.special u.id



-- SUBSCRIPTIONS


subscriptions : Model -> Sub Msg
subscriptions m =
    Sub.batch
        [ if m.visible then
            Time.every 100 Tick

          else
            Sub.none
        , Time.every 2000 (\_ -> SaveNow)
        , Browser.Events.onVisibilityChange VisibilityChanged
        , language SetLang
        ]



-- VIEW


pct : Float -> String
pct x =
    String.fromFloat x ++ "%"


view : Model -> Html Msg
view m =
    let
        t =
            Texts.text m.lang

        s =
            m.s

        nextOptions =
            Engine.optionsOnIpo s

        optionPct n =
            String.fromInt (round (toFloat n * Engine.optionBonus * 100))
    in
    main_ [ class "app", attribute "data-round" (t.round s.round) ]
        [ header [ class "top" ]
            [ div [ class "brand" ] [ p [ class "path" ] [ text (t.round s.round) ], h1 [] [ text t.title ] ]
            , div [ class "cash" ]
                [ p [ class "label" ] [ text t.cash ]
                , p [ class "amount", attribute "data-testid" "cash" ] [ text ("$" ++ Engine.money s.money) ]
                , p [ classList [ ( "rate", True ), ( "down", s.incident >= 0 ) ] ] [ text ("$" ++ Engine.money (Engine.rate s) ++ t.perSec) ]
                ]
            , if s.options > 0 then
                p [ class "options", title (fill [ ( "p", optionPct s.options ) ] t.optionsBonus) ]
                    [ text ("📈 " ++ String.fromInt s.options ++ " "), span [] [ text t.options ] ]

              else
                text ""
            ]
        , section [ class "left" ]
            [ div [ class "push-wrap" ]
                [ button [ class "push", onClick Push, attribute "data-testid" "push" ]
                    ([ span [ class "cmd" ] [ text t.push ]
                     , span [ class "sub" ] [ text (fill [ ( "n", Engine.money (Engine.clickValue s) ) ] t.perPush) ]
                     ]
                        ++ List.map (\f -> span [ class "float", style "left" (String.fromFloat f.x ++ "px"), attribute "aria-hidden" "true" ] [ text f.text ]) m.floats
                    )
                ]
            , if s.incident >= 0 then
                div [ class "incident", attribute "role" "alert" ]
                    [ p [ class "what" ] [ text ("🔥 " ++ nth m.incidentTitle t.incidents) ]
                    , p [ class "desc" ]
                        [ text
                            (if List.member "sre" s.upgrades then
                                t.incidentAuto

                             else
                                t.incidentDesc
                            )
                        ]
                    , button [ class "btn danger", onClick Rollback ] [ text t.incidentFix ]
                    ]

              else
                text ""
            , div [ class "card ipo" ]
                (h2 [] [ text t.ipo ]
                    :: (if Engine.canIpo s then
                            [ p [] [ text (fill [ ( "n", String.fromInt nextOptions ), ( "p", optionPct nextOptions ) ] t.ipoDesc) ]
                            , button [ class "btn primary", onClick (Open ConfirmIpo) ] [ text ("🔔 " ++ t.ipo) ]
                            ]

                        else
                            [ p [ class "muted" ] [ text (fill [ ( "n", Engine.money Engine.ipoAt ) ] t.ipoLocked) ]
                            , div [ class "progress", attribute "aria-hidden" "true" ]
                                [ Html.i [ style "width" (pct (min 100 (s.earned / Engine.ipoAt * 100))) ] [] ]
                            ]
                       )
                )
            , div [ class "card stats" ]
                [ h2 [] [ text t.stats ]
                , dl []
                    [ dt [] [ text t.clicks ]
                    , dd [] [ text (String.fromInt s.clicks) ]
                    , dt [] [ text t.played ]
                    , dd [] [ text (Engine.duration s.played) ]
                    , dt [] [ text t.options ]
                    , dd [] [ text (String.fromInt s.options) ]
                    ]
                , button [ class "link", onClick (Open ConfirmReset) ] [ text t.reset ]
                ]
            ]
        , section [ class "middle" ]
            [ div [ class "head" ]
                [ h2 [] [ text t.team ]
                , div [ class "mode", attribute "role" "group", attribute "aria-label" t.buyMode ]
                    (List.map
                        (\( mode, label ) ->
                            button [ classList [ ( "on", m.mode == mode ) ], attribute "aria-pressed" (boolText (m.mode == mode)), onClick (SetMode mode) ] [ text label ]
                        )
                        [ ( One, "×1" ), ( Ten, "×10" ), ( Max, t.max ) ]
                    )
                ]
            , Keyed.ul [ class "gens" ] (List.map (\g -> ( g.key, viewGen t m g )) (Engine.visibleGens s))
            ]
        , section [ class "right" ]
            [ h2 [] [ text t.upgrades ]
            , case List.take 12 (Engine.visibleUpgrades s) of
                [] ->
                    p [ class "muted" ] [ text t.noUpgrades ]

                ups ->
                    Keyed.ul [ class "ups" ] (List.map (\u -> ( u.id, viewUpgrade t s u )) ups)
            , h2 [] [ text t.feed ]
            , Keyed.node "div" [ class "feed", attribute "role" "log" ] (List.map (\l -> ( String.fromInt l.id, p [ class l.kind ] [ text l.text ] )) (List.drop (List.length m.feed - 8) m.feed))
            ]
        , case m.dialog of
            Just d ->
                viewDialog t m d

            Nothing ->
                text ""
        , p [ class "sr-only", attribute "aria-live" "polite" ] [ text m.say ]
        ]


boolText : Bool -> String
boolText b =
    if b then
        "true"

    else
        "false"


viewGen : Text -> Model -> Generator -> Html Msg
viewGen t m g =
    let
        s =
            m.s

        have =
            Engine.owned s g

        count =
            case m.mode of
                One ->
                    1

                Ten ->
                    10

                Max ->
                    max 1 (Engine.affordable g have s.money)

        price =
            Engine.cost g have count

        ( name, desc ) =
            t.gen g.id

        each =
            "$" ++ Engine.money (g.rate * Engine.genMult s g * Engine.globalMult s) ++ t.perSec ++ " " ++ t.each

        total =
            if have > 0 then
                " · $" ++ Engine.money (Engine.genRate s g) ++ t.perSec

            else
                ""
    in
    li []
        [ button [ class "gen", disabled (s.money < price), onClick (Buy g) ]
            [ span [ class "name" ] [ text name ]
            , span [ class "owned" ] [ text (String.fromInt have) ]
            , span [ class "desc" ] [ text desc ]
            , span [ class "meta" ] [ text (each ++ total) ]
            , span [ class "price" ]
                [ text
                    ((if count > 1 then
                        "×" ++ String.fromInt count ++ " "

                      else
                        ""
                     )
                        ++ "$"
                        ++ Engine.money price
                    )
                ]
            ]
        ]


viewUpgrade : Text -> State -> Upgrade -> Html Msg
viewUpgrade t s u =
    let
        ( name, desc ) =
            upgradeText t u
    in
    li []
        [ button [ class "up", disabled (s.money < u.cost), onClick (BuyUpgrade u), title desc ]
            [ span [ class "name" ] [ text name ]
            , span [ class "desc" ] [ text desc ]
            , span [ class "price" ] [ text ("$" ++ Engine.money u.cost) ]
            ]
        ]


viewDialog : Text -> Model -> Dialog -> Html Msg
viewDialog t m d =
    let
        n =
            Engine.optionsOnIpo m.s

        box children =
            div [ class "backdrop" ]
                [ div [ class "dialog", attribute "role" "dialog", attribute "aria-modal" "true", attribute "aria-labelledby" "dialog-title" ] children ]

        heading s =
            h2 [ Html.Attributes.id "dialog-title" ] [ text s ]
    in
    case d of
        Welcome away got ->
            box
                [ heading t.welcome
                , p [] [ text (fill [ ( "time", Engine.duration away ), ( "n", Engine.money got ) ] t.welcomeDesc) ]
                , button [ class "btn primary", onClick Close ] [ text t.nice ]
                ]

        ConfirmIpo ->
            box
                [ heading ("🔔 " ++ t.ipo)
                , p [] [ text (fill [ ( "n", String.fromInt n ), ( "p", String.fromInt (round (toFloat n * Engine.optionBonus * 100)) ) ] t.ipoDesc) ]
                , div [ class "row" ] [ button [ class "btn primary", onClick GoPublic ] [ text t.ipoConfirm ], button [ class "btn", onClick Close ] [ text t.cancel ] ]
                ]

        ConfirmReset ->
            box
                [ heading t.reset
                , p [] [ text t.resetConfirm ]
                , div [ class "row" ] [ button [ class "btn danger", onClick Reset ] [ text t.reset ], button [ class "btn", onClick Close ] [ text t.cancel ] ]
                ]
