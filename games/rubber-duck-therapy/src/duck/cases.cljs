(ns duck.cases
  "The debugging cases. Each is a little piece of code with one bug. Every line knows what you think it does, and
  what it actually does; for the buggy line those two differ, and that's the moment you find it.")

(def cases
  [{:title {:en "The total is too low" :nl "Het totaal is te laag"}
    :lang "js"
    :lines [{:code "function total(prices) {"
             :think {:en "A function that adds up prices." :nl "Een functie die prijzen optelt."}}
            {:code "  let sum = 0;"
             :think {:en "Start counting from zero." :nl "Begin bij nul."}}
            {:code "  for (let i = 1; i < prices.length; i++) {"
             :think {:en "Go over every price." :nl "Loop over elke prijs."}
             :does {:en "…starting at index 1. The first price, prices[0], is never added."
                    :nl "…vanaf index 1. De eerste prijs, prices[0], wordt nooit opgeteld."}
             :bug true}
            {:code "    sum += prices[i];"
             :think {:en "Add this price to the sum." :nl "Tel deze prijs op bij de som."}}
            {:code "  }"
             :think {:en "End of the loop." :nl "Einde van de lus."}}
            {:code "  return sum;"
             :think {:en "Give back the total." :nl "Geef het totaal terug."}}]
    :fixes [{:code "for (let i = 0; i < prices.length; i++)" :right true}
            {:code "for (let i = 1; i <= prices.length; i++)"}
            {:code "return sum + 1;"}]
    :aha {:en "Arrays start at 0. I started at 1." :nl "Arrays beginnen bij 0. Ik begon bij 1."}}

   {:title {:en "The user has no name" :nl "De gebruiker heeft geen naam"}
    :lang "js"
    :lines [{:code "async function loadUser(id) {"
             :think {:en "An async function that loads a user." :nl "Een async functie die een gebruiker laadt."}}
            {:code "  const res = fetch(`/api/users/${id}`);"
             :think {:en "Get the user from the API." :nl "Haal de gebruiker op bij de API."}
             :does {:en "…but without await: res is a Promise, not a response. res.json is not a function."
                    :nl "…maar zonder await: res is een Promise, geen response. res.json is geen functie."}
             :bug true}
            {:code "  const user = await res.json();"
             :think {:en "Read the JSON body." :nl "Lees de JSON uit."}}
            {:code "  return user.name;"
             :think {:en "Return their name." :nl "Geef de naam terug."}}]
    :fixes [{:code "const res = await fetch(`/api/users/${id}`);" :right true}
            {:code "return user?.name;"}
            {:code "const user = JSON.parse(res);"}]
    :aha {:en "I forgot to await the fetch." :nl "Ik vergat de fetch te awaiten."}}

   {:title {:en "Everyone is an admin" :nl "Iedereen is admin"}
    :lang "js"
    :lines [{:code "function isAdmin(user) {"
             :think {:en "Check whether a user is an admin." :nl "Kijk of een gebruiker admin is."}}
            {:code "  if (user.role = 'admin') {"
             :think {:en "If their role is admin…" :nl "Als hun rol admin is…"}
             :does {:en "…no: one = assigns 'admin' to the role. A non-empty string is truthy, so everyone passes."
                    :nl "…nee: één = kent 'admin' toe aan de rol. Een niet-lege string is truthy, dus iedereen komt erdoor."}
             :bug true}
            {:code "    return true;"
             :think {:en "…say yes." :nl "…zeg ja."}}
            {:code "  }"
             :think {:en "End of the if." :nl "Einde van de if."}}
            {:code "  return false;"
             :think {:en "Everyone else: no." :nl "Alle anderen: nee."}}]
    :fixes [{:code "if (user.role === 'admin') {" :right true}
            {:code "if (user.role == admin) {"}
            {:code "return user.role;"}]
    :aha {:en "One = is assignment. I meant ===." :nl "Eén = is toekennen. Ik bedoelde ===."}}

   {:title {:en "Tags from nowhere" :nl "Tags uit het niets"}
    :lang "py"
    :lines [{:code "def add_tag(tag, tags=[]):"
             :think {:en "Add a tag to a list, a new list by default." :nl "Voeg een tag toe aan een lijst, standaard een nieuwe."}
             :does {:en "…the default list is made once, when the function is defined. Every call shares it."
                    :nl "…de standaardlijst wordt één keer gemaakt, bij het definiëren. Elke aanroep deelt hem."}
             :bug true}
            {:code "    tags.append(tag)"
             :think {:en "Add the tag." :nl "Voeg de tag toe."}}
            {:code "    return tags"
             :think {:en "Return the list." :nl "Geef de lijst terug."}}
            {:code "a = add_tag('red')"
             :think {:en "a is ['red']." :nl "a is ['red']."}}
            {:code "b = add_tag('blue')"
             :think {:en "b is ['blue']…" :nl "b is ['blue']…"}}]
    :fixes [{:code "def add_tag(tag, tags=None): tags = tags or []" :right true}
            {:code "def add_tag(tag, tags=list):"}
            {:code "    return tags.copy()"}]
    :aha {:en "Mutable default argument. Of course. It's always that." :nl "Muteerbaar standaardargument. Natuurlijk. Het is altijd dat."}}

   {:title {:en "The deadline is a month late" :nl "De deadline is een maand te laat"}
    :lang "js"
    :lines [{:code "const deadline = new Date(2026, 9, 1);"
             :think {:en "The deadline: 1 September 2026." :nl "De deadline: 1 september 2026."}
             :does {:en "…months count from 0 in JavaScript. 9 is October."
                    :nl "…maanden tellen vanaf 0 in JavaScript. 9 is oktober."}
             :bug true}
            {:code "const today = new Date();"
             :think {:en "Today's date." :nl "De datum van vandaag."}}
            {:code "if (today > deadline) {"
             :think {:en "If we're past the deadline…" :nl "Als we over de deadline heen zijn…"}}
            {:code "  alert('Too late!');"
             :think {:en "…complain." :nl "…klaag."}}
            {:code "}"
             :think {:en "End of the if." :nl "Einde van de if."}}]
    :fixes [{:code "new Date(2026, 8, 1)" :right true}
            {:code "new Date(2026, 9, 0)"}
            {:code "new Date('1/9/2026')"}]
    :aha {:en "Zero-based months. JavaScript, why." :nl "Maanden vanaf nul. JavaScript, waarom."}}])

(def excuses
  [{:en "It works on my machine." :nl "Bij mij werkt het."}
   {:en "Must be a caching issue." :nl "Vast een cacheprobleem."}
   {:en "The compiler is broken." :nl "De compiler is kapot."}
   {:en "Probably a cosmic ray." :nl "Vast een kosmisch deeltje."}])
