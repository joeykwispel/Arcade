## Everything the game says, in English and Dutch.
class_name Text
extends RefCounted

const T := {
	"en": {
		"title": "Localhost Golf",
		"tagline": "Mini golf through web pages. The hole is the 404.",
		"how": "Drag back from anywhere and let go to shoot. Keyboard: ← → aim, hold Space for power.",
		"start": "Click, tap or press Space to tee off",
		"hole": "hole",
		"par": "par",
		"strokes": "strokes",
		"total": "total",
		"best": "best",
		"splash": "Splash! The ball fell into an <iframe>. +1 stroke",
		"limit": "Ten strokes. Let's call that a timeout.",
		"next": "Click or press Space for the next page",
		"done": "All pages visited",
		"again": "Click or press Space to play again",
		"new_best": "New best round!",
		"ace": "Hole in one!",
		"albatross": "Albatross!",
		"eagle": "Eagle!",
		"birdie": "Birdie!",
		"par_word": "Par",
		"bogey": "Bogey",
		"double": "Double bogey",
		"over": "404: par not found",
	},
	"nl": {
		"title": "Localhost Golf",
		"tagline": "Minigolf door webpagina's. De hole is de 404.",
		"how": "Sleep ergens naar achteren en laat los om te slaan. Toetsenbord: ← → richten, spatie ingedrukt voor kracht.",
		"start": "Klik, tik of druk op spatie om af te slaan",
		"hole": "hole",
		"par": "par",
		"strokes": "slagen",
		"total": "totaal",
		"best": "record",
		"splash": "Plons! De bal viel in een <iframe>. +1 slag",
		"limit": "Tien slagen. Noem het maar een timeout.",
		"next": "Klik of druk op spatie voor de volgende pagina",
		"done": "Alle pagina's bezocht",
		"again": "Klik of druk op spatie om opnieuw te spelen",
		"new_best": "Nieuw record!",
		"ace": "Hole-in-one!",
		"albatross": "Albatros!",
		"eagle": "Eagle!",
		"birdie": "Birdie!",
		"par_word": "Par",
		"bogey": "Bogey",
		"double": "Dubbele bogey",
		"over": "404: par niet gevonden",
	},
}


static func t(lang: String, key: String) -> String:
	return T[lang][key]


## The shout for a score on a hole, from Rules.name_of.
static func score_word(lang: String, name: String) -> String:
	return t(lang, "par_word" if name == "par" else name)
