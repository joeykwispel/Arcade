# Regex Sniper: write one regex that matches every green word and none of the red ones. The shorter, the better.
#
# The rules only. The page (web/main.js) runs this file in ruby.wasm, Ruby 3.4 compiled to WebAssembly, so the
# regexes are real Ruby regexes (Onigmo), with Ruby's own error messages. The tests (ruby/sniper_test.rb) run it
# the same way, in Node.
#
# ruby.wasm without the standard library has no JSON, so results go back to JavaScript as a small hand-built string.

module RegexSniper
  # Catastrophic backtracking stops here instead of freezing the tab.
  Regexp.timeout = 0.2

  # Each level: words to hit, words to miss, and a known short solution. Its length is the target.
  LEVELS = [
    {
      name: { en: 'Warm-up', nl: 'Opwarmen' },
      tip: { en: 'Everything that starts with foo.', nl: 'Alles wat met foo begint.' },
      hit: %w[foo food fool foot foobar],
      miss: %w[bar fob oof afoo],
      solution: '^foo'
    },
    {
      name: { en: 'Semver', nl: 'Semver' },
      tip: { en: 'Three numbers, two dots, nothing else.', nl: 'Drie getallen, twee punten, verder niets.' },
      hit: %w[1.0.0 2.10.3 0.0.1 10.20.30],
      miss: %w[1.0 v1.0.0 1.0.0.0 1.0.0-beta],
      solution: '^\d+(\.\d+){2}$'
    },
    {
      name: { en: 'Hex colours', nl: 'Hexkleuren' },
      tip: { en: 'Three or six hex digits after a #. Ruby has \h for hex.', nl: 'Drie of zes hexcijfers na een #. Ruby heeft \h voor hex.' },
      hit: %w[#fff #7dd3c0 #C3B1FF #000],
      miss: %w[#ffff fff #ggg #12345 #1234567],
      solution: '^#(\h{3}){1,2}$'
    },
    {
      name: { en: 'camelCase', nl: 'camelCase' },
      tip: { en: 'Lowercase first, then letters and digits. No _ or -.', nl: 'Eerst een kleine letter, dan letters en cijfers. Geen _ of -.' },
      hit: %w[getUser parseJSON toString x1],
      miss: %w[GetUser get_user get-user 1x],
      solution: '^[a-z][^\W_]*$'
    },
    {
      name: { en: 'TODO finder', nl: 'TODO-zoeker' },
      tip: { en: 'Real TODOs only. Not todos, not TODOS.', nl: 'Alleen echte TODO\'s. Geen todo, geen TODOS.' },
      hit: ['// TODO fix this', '# TODO: later', '/* TODO */', 'TODO'],
      miss: ['// todo lowercase', 'TODOS', '// done', 'MASTODON'],
      solution: 'TODO\b'
    },
    {
      name: { en: 'Double trouble', nl: 'Dubbel op' },
      tip: { en: 'A letter, then the same letter again.', nl: 'Een letter, en dan dezelfde letter nog eens.' },
      hit: %w[coffee balloon success bookkeeper],
      miss: %w[code regex java ruby],
      solution: '(.)\1'
    },
    {
      name: { en: 'Status codes', nl: 'Statuscodes' },
      tip: { en: 'The ones that wake you up at night: 4xx and 5xx.', nl: 'De codes die je \'s nachts wakker maken: 4xx en 5xx.' },
      hit: %w[404 418 451 500 503],
      miss: %w[200 201 301 304 42 4040],
      solution: '^[45]\d\d$'
    },
    {
      name: { en: 'On call', nl: 'Piketdienst' },
      tip: { en: 'The log lines that page you.', nl: 'De logregels waarvoor je gebeld wordt.' },
      hit: ['ERROR disk full', 'FATAL out of memory', 'WARN slow query'],
      miss: ['INFO started', 'DEBUG x = 1', 'TRACE enter', 'INFO ERRORS: 0'],
      solution: '^[EWF]'
    },
    {
      name: { en: 'Final: e-mail', nl: 'Finale: e-mail' },
      tip: { en: 'Good enough for a signup form. Not for an RFC.', nl: 'Goed genoeg voor een aanmeldformulier. Niet voor een RFC.' },
      hit: ['a@b.co', 'dev@joeyoosenbrug.nl', 'x.y+z@mail.io'],
      miss: ['@b.co', 'a@b', 'a b@c.de', 'a@@b.co'],
      solution: '^[^@ ]+@\w+\.\w+$'
    }
  ].freeze

  # Skipping a level costs its target length plus this.
  SKIP = 10

  module_function

  def target(i) = LEVELS[i][:solution].length

  def total_target = LEVELS.each_index.sum { target(_1) }

  # Checks a regex against level i. Returns [solved, hits, misses, error]: which green words it matches, which red
  # ones it (wrongly) matches, and Ruby's error message if it isn't a valid regex.
  def check(i, source)
    level = LEVELS[i]
    return [false, [], [], ''] if source.empty?

    re = Regexp.new(source)
    hits = level[:hit].map { re.match?(_1) }
    misses = level[:miss].map { re.match?(_1) }
    [hits.all? && misses.none?, hits, misses, '']
  rescue RegexpError => e
    [false, [], [], e.message]
  rescue Regexp::TimeoutError
    [false, [], [], 'Regexp::TimeoutError: that took over 0.2 s. Catastrophic backtracking?']
  end

  # How sharp a solution was, compared to the target length.
  def verdict(length, target)
    return 'sharper' if length < target
    return 'target' if length == target
    length <= target + 3 ? 'close' : 'loose'
  end

  # ---------- the bridge for JavaScript (no JSON library in ruby.wasm without stdlib) ----------

  def js(value)
    case value
    when true, false, Integer then value.to_s
    when String then '"' + value.gsub(/["\\\n]/) { |c| { '"' => '\"', '\\' => '\\\\', "\n" => '\n' }[c] } + '"'
    when Symbol then js(value.to_s)
    when Array then '[' + value.map { js(_1) }.join(',') + ']'
    when Hash then '{' + value.map { |k, v| "#{js(k.to_s)}:#{js(v)}" }.join(',') + '}'
    else js(value.to_s)
    end
  end

  def levels_json(lang)
    l = lang.to_sym
    js(LEVELS.each_with_index.map do |h, i|
      { name: h[:name][l], tip: h[:tip][l], hit: h[:hit], miss: h[:miss], target: target(i) }
    end)
  end

  def check_json(i, source)
    solved, hits, misses, error = check(i, source)
    js({ solved:, hits:, misses:, error:, length: source.length })
  end
end
