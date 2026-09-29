(* Tests for the rules, natively: dune test *)
open Detective

let text lines = String.concat "\n" (List.map (fun l -> String.concat "" (List.map fst l)) lines)

let contains hay needle =
  let n = String.length needle and h = String.length hay in
  let rec go i = i + n <= h && (String.sub hay i n = needle || go (i + 1)) in
  go 0

let test_every_case_is_solvable () =
  List.iter
    (fun k ->
      Alcotest.(check bool) "the culprit is one of the commits" true (List.exists (fun c -> c.hash = k.culprit) k.commits);
      Alcotest.(check bool) "the culprit's file exists" true
        (List.exists (fun c -> c.hash = k.culprit && List.mem_assoc c.file k.files) k.commits);
      (* every blamed line points at a real commit *)
      List.iter
        (fun (_, lines) -> List.iter (fun (h, _) -> Alcotest.(check bool) h true (find_commit k h <> None)) lines)
        k.files)
    cases

let test_the_last_case_was_you () =
  let k = List.nth cases (List.length cases - 1) in
  let c = List.find (fun c -> c.hash = k.culprit) k.commits in
  Alcotest.(check string) "the author" "you" c.author;
  Alcotest.(check string) "the date" "3 months ago" c.date

let test_investigating_costs_and_accusing_scores () =
  start "en";
  ignore (run "git log");
  ignore (run "git blame checkout.js");
  Alcotest.(check int) "two commands" 2 st.commands;
  let out = text (run "accuse 3b77a10") in
  Alcotest.(check bool) "innocent" true (contains out "innocent");
  Alcotest.(check int) "one wrong" 1 st.wrong;
  let out = text (run "accuse e5d21") in
  Alcotest.(check bool) "got it (a short hash works)" true (contains out "Got it");
  Alcotest.(check int) "score" (case_points 2 1) st.score;
  Alcotest.(check string) "solved" "solved" (phase_name st.phase);
  ignore (run "next");
  Alcotest.(check int) "next case" 1 st.case_i;
  Alcotest.(check int) "counters reset" 0 st.commands

let test_errors_look_like_git () =
  start "en";
  Alcotest.(check bool) "bad object" true (contains (text (run "git show zzzzzz")) "fatal: bad object");
  Alcotest.(check bool) "no path" true (contains (text (run "git blame nope.js")) "fatal: no such path");
  Alcotest.(check bool) "unknown" true (contains (text (run "vim")) "command not found");
  Alcotest.(check int) "errors are free" 0 st.commands

let test_all_cases_then_done () =
  start "nl";
  List.iter
    (fun k ->
      ignore (run ("accuse " ^ k.culprit));
      ignore (run "next"))
    cases;
  Alcotest.(check string) "done" "done" (phase_name st.phase);
  Alcotest.(check int) "perfect score" (100 * List.length cases) st.score

let test_json_is_escaped () =
  let j = json_lines [ [ ("say \"hi\"\\", Plain) ] ] in
  Alcotest.(check string) "escaped" "[[[\"say \\\"hi\\\"\\\\\",\"\"]]]" j

let () =
  Alcotest.run "detective"
    [
      ( "rules",
        [
          Alcotest.test_case "every case is solvable" `Quick test_every_case_is_solvable;
          Alcotest.test_case "the last case was you" `Quick test_the_last_case_was_you;
          Alcotest.test_case "investigating costs, accusing scores" `Quick test_investigating_costs_and_accusing_scores;
          Alcotest.test_case "errors look like git" `Quick test_errors_look_like_git;
          Alcotest.test_case "all cases, then done" `Quick test_all_cases_then_done;
          Alcotest.test_case "JSON is escaped" `Quick test_json_is_escaped;
        ] );
    ]
