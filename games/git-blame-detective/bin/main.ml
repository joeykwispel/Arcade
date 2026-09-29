(* The bridge for the page: js_of_ocaml exports these as globalThis.detective. Everything goes out as JSON strings. *)
open Js_of_ocaml

let () =
  Js.export "detective"
    (object%js
       method start (lang : Js.js_string Js.t) =
         Detective.start (Js.to_string lang);
         Js.string (Detective.respond (Detective.intro ()))

       method run (line : Js.js_string Js.t) = Js.string (Detective.respond (Detective.run (Js.to_string line)))

       method setLang (lang : Js.js_string Js.t) = Detective.st.lang <- (if Js.to_string lang = "nl" then "nl" else "en")
    end)
