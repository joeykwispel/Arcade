module Texts exposing (Lang(..), Text, fill, fromCode, text)

{-| Every word Deploy Tycoon shows, in English and Dutch.
-}

import Engine exposing (GenId(..), Round(..))


type Lang
    = En
    | Nl


fromCode : String -> Maybe Lang
fromCode code =
    case code of
        "en" ->
            Just En

        "nl" ->
            Just Nl

        _ ->
            Nothing


type alias Text =
    { title : String
    , cash : String
    , perSec : String
    , push : String
    , perPush : String
    , team : String
    , upgrades : String
    , noUpgrades : String
    , each : String
    , buyMode : String
    , max : String
    , feed : String
    , stats : String
    , clicks : String
    , played : String
    , options : String
    , optionsBonus : String
    , ipo : String
    , ipoDesc : String
    , ipoLocked : String
    , ipoConfirm : String
    , cancel : String
    , welcome : String
    , welcomeDesc : String
    , nice : String
    , reset : String
    , resetConfirm : String
    , incidentFix : String
    , incidentDesc : String
    , incidentAuto : String
    , resolved : String
    , autoResolved : String
    , newRound : String
    , bought : String
    , gen : GenId -> ( String, String )
    , tiers : List String
    , tierDesc : String
    , special : String -> ( String, String )
    , round : Round -> String
    , news : List String
    , incidents : List String
    }


{-| Replaces `{key}` with its value.
-}
fill : List ( String, String ) -> String -> String
fill vars s =
    List.foldl (\( k, v ) acc -> String.replace ("{" ++ k ++ "}") v acc) s vars


text : Lang -> Text
text lang =
    case lang of
        En ->
            en

        Nl ->
            nl


en : Text
en =
    { title = "Deploy Tycoon"
    , cash = "cash"
    , perSec = "/s"
    , push = "$ git push"
    , perPush = "+${n} per push"
    , team = "team & infra"
    , upgrades = "upgrades"
    , noUpgrades = "Nothing to buy yet. Keep shipping."
    , each = "each"
    , buyMode = "buy"
    , max = "max"
    , feed = "feed"
    , stats = "stats"
    , clicks = "pushes"
    , played = "played"
    , options = "stock options"
    , optionsBonus = "+{p}% on all income"
    , ipo = "Go public (IPO)"
    , ipoDesc = "Start a new company and keep {n} new stock options: +{p}% on all income, forever."
    , ipoLocked = "Reach ${n} this run to go public."
    , ipoConfirm = "Ring the bell"
    , cancel = "cancel"
    , welcome = "Welcome back"
    , welcomeDesc = "While you were away for {time}, your team earned ${n}."
    , nice = "nice"
    , reset = "rm -rf company"
    , resetConfirm = "Really? Everything goes, stock options too."
    , incidentFix = "git revert HEAD"
    , incidentDesc = "Income is down to 20% until you roll back."
    , incidentAuto = "Your on-call SRE is on it."
    , resolved = "✓ Rolled back. Prod is up."
    , autoResolved = "✓ The SRE rolled it back. Prod is up."
    , newRound = "🎉 {round} closed!"
    , bought = "+ {n}× {name}"
    , gen =
        \id ->
            case id of
                Intern ->
                    ( "Intern", "Fixes typos. Eats all the snacks." )

                Junior ->
                    ( "Junior dev", "Ships fast. Asks a lot." )

                Senior ->
                    ( "Senior dev", "Says \"it depends\". Is right." )

                Lead ->
                    ( "Tech lead", "Turns meetings into roadmaps." )

                Ci ->
                    ( "CI pipeline", "Deploys while you sleep." )

                K8s ->
                    ( "Kubernetes cluster", "Nobody knows how it works. It works." )

                Agent ->
                    ( "AI agent", "Writes code, reviews its own code." )

                Datacenter ->
                    ( "Datacenter", "Your own cloud. Heats a small town." )
    , tiers = [ "Onboarding", "Mentoring", "Promotions", "Stock grants" ]
    , tierDesc = "{name}: twice the output."
    , special =
        \id ->
            case id of
                "keyboard" ->
                    ( "Mechanical keyboard", "git push earns twice as much." )

                "vim" ->
                    ( "Vim keybindings", "git push earns twice as much again." )

                "copilot" ->
                    ( "Copilot", "Every push also earns 5% of your income per second." )

                "monorepo" ->
                    ( "Monorepo", "Another 5% of income per second on every push." )

                "coffee" ->
                    ( "Coffee machine", "+10% on all income." )

                "desks" ->
                    ( "Standing desks", "+10% on all income." )

                "remote" ->
                    ( "Remote work", "+20% on all income." )

                "fourday" ->
                    ( "Four-day week", "+25% on all income." )

                "sre" ->
                    ( "On-call SRE", "Rolls back incidents by itself after 10 seconds." )

                _ ->
                    ( "Chaos engineering", "Half as many incidents." )
    , round = roundName "Seed round"
    , news =
        [ "Front page of Hacker News!"
        , "A tweet about you went viral."
        , "A big client signed a three-year deal."
        , "Your open source repo hit 10k stars."
        , "A YouTuber reviewed your product. Positively."
        , "Your conference talk got a standing ovation."
        , "The competitor went down. Everyone came to you."
        , "Someone called your API \"actually pleasant\"."
        ]
    , incidents =
        [ "Production is down!"
        , "The database is on fire."
        , "DNS. It's always DNS."
        , "Someone deployed on a Friday."
        , "The TLS certificate expired."
        , "The intern ran DROP TABLE."
        ]
    }


nl : Text
nl =
    { title = "Deploy Tycoon"
    , cash = "kas"
    , perSec = "/s"
    , push = "$ git push"
    , perPush = "+${n} per push"
    , team = "team & infra"
    , upgrades = "upgrades"
    , noUpgrades = "Nog niets te koop. Blijf shippen."
    , each = "per stuk"
    , buyMode = "koop"
    , max = "max"
    , feed = "feed"
    , stats = "stats"
    , clicks = "pushes"
    , played = "gespeeld"
    , options = "aandelenopties"
    , optionsBonus = "+{p}% op alle inkomsten"
    , ipo = "Naar de beurs (IPO)"
    , ipoDesc = "Begin een nieuw bedrijf en houd {n} nieuwe aandelenopties: +{p}% op alle inkomsten, voor altijd."
    , ipoLocked = "Verdien ${n} in deze ronde om naar de beurs te gaan."
    , ipoConfirm = "Luid de bel"
    , cancel = "annuleer"
    , welcome = "Welkom terug"
    , welcomeDesc = "Je was {time} weg. Je team verdiende intussen ${n}."
    , nice = "lekker"
    , reset = "rm -rf company"
    , resetConfirm = "Echt? Alles gaat weg, ook je aandelenopties."
    , incidentFix = "git revert HEAD"
    , incidentDesc = "Inkomsten staan op 20% tot je terugrolt."
    , incidentAuto = "Je SRE met piketdienst is ermee bezig."
    , resolved = "✓ Teruggerold. Productie draait weer."
    , autoResolved = "✓ De SRE heeft teruggerold. Productie draait weer."
    , newRound = "🎉 {round} rond!"
    , bought = "+ {n}× {name}"
    , gen =
        \id ->
            case id of
                Intern ->
                    ( "Stagiair", "Fixt typo's. Eet alle snacks op." )

                Junior ->
                    ( "Junior dev", "Shipt snel. Vraagt veel." )

                Senior ->
                    ( "Senior dev", "Zegt \"het hangt ervan af\". Heeft gelijk." )

                Lead ->
                    ( "Tech lead", "Maakt van meetings roadmaps." )

                Ci ->
                    ( "CI-pipeline", "Deployt terwijl jij slaapt." )

                K8s ->
                    ( "Kubernetes-cluster", "Niemand snapt hoe het werkt. Het werkt." )

                Agent ->
                    ( "AI-agent", "Schrijft code, reviewt zijn eigen code." )

                Datacenter ->
                    ( "Datacenter", "Je eigen cloud. Verwarmt een klein dorp." )
    , tiers = [ "Onboarding", "Mentoring", "Promoties", "Aandelen" ]
    , tierDesc = "{name}: dubbele output."
    , special =
        \id ->
            case id of
                "keyboard" ->
                    ( "Mechanisch toetsenbord", "git push levert twee keer zoveel op." )

                "vim" ->
                    ( "Vim-sneltoetsen", "git push levert nog eens twee keer zoveel op." )

                "copilot" ->
                    ( "Copilot", "Elke push levert ook 5% van je inkomen per seconde op." )

                "monorepo" ->
                    ( "Monorepo", "Nog eens 5% van je inkomen per seconde bij elke push." )

                "coffee" ->
                    ( "Koffiemachine", "+10% op alle inkomsten." )

                "desks" ->
                    ( "Sta-bureaus", "+10% op alle inkomsten." )

                "remote" ->
                    ( "Thuiswerken", "+20% op alle inkomsten." )

                "fourday" ->
                    ( "Vierdaagse werkweek", "+25% op alle inkomsten." )

                "sre" ->
                    ( "SRE met piketdienst", "Rolt incidenten na 10 seconden zelf terug." )

                _ ->
                    ( "Chaos engineering", "Half zoveel incidenten." )
    , round = roundName "Seedronde"
    , news =
        [ "Voorpagina van Hacker News!"
        , "Een tweet over jullie ging viraal."
        , "Een grote klant tekende voor drie jaar."
        , "Je open source repo heeft 10k sterren."
        , "Een YouTuber reviewde je product. Positief."
        , "Je conferentietalk kreeg een staande ovatie."
        , "De concurrent lag plat. Iedereen kwam naar jou."
        , "Iemand noemde je API \"eigenlijk best prettig\"."
        ]
    , incidents =
        [ "Productie ligt plat!"
        , "De database staat in brand."
        , "DNS. Het is altijd DNS."
        , "Iemand heeft op vrijdag gedeployd."
        , "Het TLS-certificaat is verlopen."
        , "De stagiair heeft DROP TABLE gedraaid."
        ]
    }


roundName : String -> Round -> String
roundName seed round =
    case round of
        Garage ->
            "~/garage"

        Seed ->
            seed

        SeriesA ->
            "Series A"

        SeriesB ->
            "Series B"

        SeriesC ->
            "Series C"

        Unicorn ->
            "Unicorn"
