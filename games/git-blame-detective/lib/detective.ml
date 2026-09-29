(* Git Blame Detective: the rules. Three bug reports; investigate each with git log, git blame, git show and cat,
   then accuse the commit that did it. Every command costs time; a wrong accusation costs more.

   No browser in here: js_of_ocaml compiles bin/main.ml (which wraps this) to JavaScript for the page, and the tests
   run it natively. Output goes to the page as JSON: lines of (text, kind) pieces, like a terminal. *)

type kind = Plain | Hash | File | Author | Add | Del | Dim | Err | Ok_ | Head

type commit = {
  hash : string;
  author : string;
  date : string;
  msg : string;
  file : string;
  diff : string list;  (* lines starting with '+', '-' or ' ' *)
}

type case = {
  title : string * string;  (* en, nl *)
  report : string * string;
  files : (string * (string * string) list) list;  (* file -> lines: (hash of the commit that wrote it, code) *)
  commits : commit list;  (* newest first, like git log *)
  culprit : string;
  reveal : string * string;
}

let c hash author date msg file diff = { hash; author; date; msg; file; diff }

let cases =
  [
    {
      title = ("Checkout crashes on an empty cart", "Afrekenen crasht bij een lege winkelwagen");
      report =
        ( "Customers with an empty cart get a white screen at checkout. It worked last month.",
          "Klanten met een lege winkelwagen krijgen een wit scherm bij het afrekenen. Vorige maand werkte het nog." );
      files =
        [
          ( "checkout.js",
            [
              ("a1f09c2", "export function total(cart) {");
              ("e5d21b7", "  const first = cart.items[0];");
              ("e5d21b7", "  const currency = first.currency;");
              ("3b77a10", "  return sum(cart.items) + ' ' + currency;");
              ("a1f09c2", "}");
            ] );
          ("README.md", [ ("9c0ffee", "# Shop"); ("9c0ffee", "Run npm start.") ]);
        ];
      commits =
        [
          c "9c0ffee" "Sanne" "2 days ago" "Update README" "README.md" [ "-Run yarn start."; "+Run npm start." ];
          c "e5d21b7" "Dave" "3 weeks ago" "Show the currency with the total" "checkout.js"
            [ "   export function total(cart) {"; "-  if (!cart.items.length) return '0';"; "+  const first = cart.items[0];";
              "+  const currency = first.currency;"; "   return sum(cart.items) + ' ' + currency;" ];
          c "3b77a10" "Mark" "5 weeks ago" "Refactor: use sum()" "checkout.js"
            [ "-  let t = 0; for (const i of cart.items) t += i.price;"; "+  return sum(cart.items) + ' ' + currency;" ];
          c "a1f09c2" "Priya" "2 months ago" "Add checkout" "checkout.js" [ "+export function total(cart) {"; "+}" ];
        ];
      culprit = "e5d21b7";
      reveal =
        ( "Dave removed the empty-cart check: cart.items[0] is undefined when the cart is empty.",
          "Dave haalde de check op een lege winkelwagen weg: cart.items[0] is undefined als de wagen leeg is." );
    };
    {
      title = ("Invoices are dated a month late", "Facturen zijn een maand te laat gedateerd");
      report =
        ( "Every invoice since the last release shows next month's date.",
          "Elke factuur sinds de laatste release staat op de datum van volgende maand." );
      files =
        [
          ( "invoice.js",
            [
              ("71c4e02", "export function invoiceDate(y, m, d) {");
              ("b8a3f55", "  return new Date(y, m, d);");
              ("71c4e02", "}");
            ] );
          ( "format.js",
            [ ("d0e1a44", "export const fmt = (date) =>"); ("d0e1a44", "  date.toLocaleDateString('nl-NL');") ] );
        ];
      commits =
        [
          c "d0e1a44" "Lotte" "4 days ago" "Format dates the Dutch way" "format.js"
            [ "-  date.toISOString().slice(0, 10);"; "+  date.toLocaleDateString('nl-NL');" ];
          c "b8a3f55" "Tom" "2 weeks ago" "Drop moment.js, use native Date" "invoice.js"
            [ "-  return moment({ year: y, month: m - 1, day: d }).toDate();"; "+  return new Date(y, m, d);" ];
          c "71c4e02" "Priya" "3 months ago" "Add invoices" "invoice.js" [ "+export function invoiceDate(y, m, d) {"; "+}" ];
        ];
      culprit = "b8a3f55";
      reveal =
        ( "Tom dropped the m - 1: native Date months start at 0, so every invoice is a month late.",
          "Tom liet de m - 1 weg: maanden in een native Date beginnen bij 0, dus elke factuur is een maand te laat." );
    };
    {
      title = ("Passwords in the logs", "Wachtwoorden in de logs");
      report =
        ( "Security found plain-text passwords in the production logs. Nobody knows since when.",
          "Security vond wachtwoorden in platte tekst in de productielogs. Niemand weet sinds wanneer." );
      files =
        [
          ( "login.js",
            [
              ("4de5a91", "export async function login(email, password) {");
              ("f00d1e5", "  const ok = await check(email, password);");
              ("0bad5e4", "  if (!ok) console.log('login failed', email, password);");
              ("4de5a91", "  return ok;");
              ("4de5a91", "}");
            ] );
          ("logger.js", [ ("c0ffee1", "export const log = (...a) => console.log(new Date(), ...a);") ]);
        ];
      commits =
        [
          c "c0ffee1" "Mark" "1 week ago" "Timestamps in the logs" "logger.js"
            [ "-export const log = console.log;"; "+export const log = (...a) => console.log(new Date(), ...a);" ];
          c "f00d1e5" "Sanne" "1 month ago" "Rate-limit login checks" "login.js"
            [ "-  const ok = check(email, password);"; "+  const ok = await check(email, password);" ];
          c "0bad5e4" "you" "3 months ago" "debug: log failed logins (REMOVE BEFORE MERGE)" "login.js"
            [ "   const ok = await check(email, password);"; "+  if (!ok) console.log('login failed', email, password);" ];
          c "4de5a91" "Priya" "6 months ago" "Add login" "login.js" [ "+export async function login(email, password) {"; "+}" ];
        ];
      culprit = "0bad5e4";
      reveal =
        ( "It was you. Three months ago. \"REMOVE BEFORE MERGE\". Nobody removed it before merge.",
          "Jij was het. Drie maanden geleden. \"REMOVE BEFORE MERGE\". Niemand haalde het weg voor de merge." );
    };
  ]

type phase = Investigating | Solved | Done

type state = {
  mutable lang : string;
  mutable case_i : int;
  mutable commands : int;  (* investigating commands in this case *)
  mutable wrong : int;
  mutable score : int;
  mutable phase : phase;
}

let st = { lang = "en"; case_i = 0; commands = 0; wrong = 0; score = 0; phase = Investigating }

let pick (en, nl) = if st.lang = "nl" then nl else en
let current () = List.nth cases st.case_i

(* Points for a solved case: 100, minus 4 per command, minus 30 per wrong accusation, at least 10. *)
let case_points commands wrong = max 10 (100 - (4 * commands) - (30 * wrong))

let start lang =
  st.lang <- (if lang = "nl" then "nl" else "en");
  st.case_i <- 0;
  st.commands <- 0;
  st.wrong <- 0;
  st.score <- 0;
  st.phase <- Investigating

let intro () =
  let k = current () in
  [
    [ (Printf.sprintf "#%d  %s" (st.case_i + 1) (pick k.title), Head) ];
    [ (pick k.report, Plain) ];
    [ ((if st.lang = "nl" then "Typ help, of tik op een naam." else "Type help, or tap a name."), Dim) ];
  ]

let find_commit k h =
  List.find_opt (fun c -> String.length h >= 4 && String.length c.hash >= String.length h && String.sub c.hash 0 (String.length h) = h) k.commits

let diff_line l =
  let kind = if l = "" then Plain else match l.[0] with '+' -> Add | '-' -> Del | _ -> Plain in
  [ (l, kind) ]

let help () =
  let nl = st.lang = "nl" in
  List.map
    (fun (cmd, what) -> [ (cmd, Ok_); ("  " ^ what, Dim) ])
    [
      ("ls", if nl then "de bestanden" else "the files");
      ("git log", if nl then "alle commits, nieuwste eerst" else "every commit, newest first");
      ("git blame <file>", if nl then "welke commit schreef elke regel" else "which commit wrote each line");
      ("git show <hash>", if nl then "wat een commit veranderde" else "what a commit changed");
      ("cat <file>", if nl then "een bestand lezen" else "read a file");
      ("accuse <hash>", if nl then "wijs de schuldige commit aan" else "name the guilty commit");
    ]

let err msg = [ [ (msg, Err) ] ]

let investigate () = st.commands <- st.commands + 1

let run line =
  let words = String.split_on_char ' ' (String.trim line) |> List.filter (( <> ) "") in
  let k = current () in
  match (st.phase, words) with
  | _, [] -> []
  | _, [ "help" ] -> help ()
  | Done, _ -> err (if st.lang = "nl" then "Alle zaken zijn opgelost." else "All cases are closed.")
  | Solved, [ "next" ] ->
      if st.case_i + 1 >= List.length cases then (
        st.phase <- Done;
        [])
      else (
        st.case_i <- st.case_i + 1;
        st.commands <- 0;
        st.wrong <- 0;
        st.phase <- Investigating;
        intro ())
  | Solved, _ -> err (if st.lang = "nl" then "Zaak opgelost. Typ next." else "Case closed. Type next.")
  | Investigating, [ "ls" ] -> [ List.concat_map (fun (f, _) -> [ (f, File); ("  ", Plain) ]) k.files ]
  | Investigating, [ "git"; "log" ] ->
      investigate ();
      List.map
        (fun c -> [ (c.hash, Hash); ("  " ^ c.date ^ "  ", Dim); (c.author, Author); ("  " ^ c.msg, Plain) ])
        k.commits
  | Investigating, [ ("git" | "blame"); "blame"; f ] | Investigating, [ "blame"; f ] -> (
      match List.assoc_opt f k.files with
      | None -> err (Printf.sprintf "fatal: no such path '%s' in HEAD" f)
      | Some lines ->
          investigate ();
          List.map
            (fun (h, code) ->
              let author = match find_commit k h with Some c -> c.author | None -> "?" in
              [ (h, Hash); (Printf.sprintf " (%-6s) " author, Author); (code, Plain) ])
            lines)
  | Investigating, [ "git"; "show"; h ] -> (
      match find_commit k h with
      | None -> err (Printf.sprintf "fatal: bad object %s" h)
      | Some c ->
          investigate ();
          [ [ ("commit ", Dim); (c.hash, Hash) ]; [ ("Author: ", Dim); (c.author, Author) ]; [ ("Date:   " ^ c.date, Dim) ];
            [ ("    " ^ c.msg, Plain) ]; [ ("--- a/", Dim); (c.file, File) ] ]
          @ List.map diff_line c.diff)
  | Investigating, [ "cat"; f ] -> (
      match List.assoc_opt f k.files with
      | None -> err (Printf.sprintf "cat: %s: No such file or directory" f)
      | Some lines ->
          investigate ();
          List.map (fun (_, code) -> [ (code, Plain) ]) lines)
  | Investigating, [ "accuse"; h ] -> (
      match find_commit k h with
      | None -> err (Printf.sprintf "fatal: bad object %s" h)
      | Some c when c.hash = k.culprit ->
          let pts = case_points st.commands st.wrong in
          st.score <- st.score + pts;
          st.phase <- Solved;
          [
            [ ((if st.lang = "nl" then "Gevonden! " else "Got it! ") ^ c.hash ^ " by " ^ c.author ^ ".", Ok_) ];
            [ (pick k.reveal, Plain) ];
            [ (Printf.sprintf "+%d" pts, Ok_); ((if st.lang = "nl" then "  (typ next)" else "  (type next)"), Dim) ];
          ]
      | Some c ->
          st.wrong <- st.wrong + 1;
          err
            (if st.lang = "nl" then Printf.sprintf "%s is onschuldig. %s kijkt je beledigd aan." c.hash c.author
             else Printf.sprintf "%s is innocent. %s looks at you, offended." c.hash c.author))
  | Investigating, cmd :: _ -> err (Printf.sprintf "%s: command not found" cmd)

(* ---------- JSON for the page ---------- *)

let kind_name = function
  | Plain -> "" | Hash -> "hash" | File -> "file" | Author -> "author" | Add -> "add" | Del -> "del"
  | Dim -> "dim" | Err -> "err" | Ok_ -> "ok" | Head -> "head"

let json_string s =
  let b = Buffer.create (String.length s + 2) in
  Buffer.add_char b '"';
  String.iter
    (function
      | '"' -> Buffer.add_string b "\\\"" | '\\' -> Buffer.add_string b "\\\\" | '\n' -> Buffer.add_string b "\\n"
      | c -> Buffer.add_char b c)
    s;
  Buffer.add_char b '"';
  Buffer.contents b

let json_lines lines =
  "["
  ^ String.concat ","
      (List.map
         (fun line ->
           "[" ^ String.concat "," (List.map (fun (t, k) -> "[" ^ json_string t ^ "," ^ json_string (kind_name k) ^ "]") line) ^ "]")
         lines)
  ^ "]"

let phase_name = function Investigating -> "investigating" | Solved -> "solved" | Done -> "done"

let json_state () =
  Printf.sprintf "{\"case\":%d,\"cases\":%d,\"commands\":%d,\"wrong\":%d,\"score\":%d,\"phase\":%s}" (st.case_i + 1)
    (List.length cases) st.commands st.wrong st.score (json_string (phase_name st.phase))

let respond lines = Printf.sprintf "{\"lines\":%s,\"state\":%s}" (json_lines lines) (json_state ())
