# Tests for the rules. ruby.wasm without the standard library has no minitest, so this is a tiny assert of our own;
# test/run.mjs loads Ruby in Node, runs golf.rb and this file, and fails when FAILURES isn't empty.

FAILURES = []
CHECKS = [0]

def check(ok, what)
  CHECKS[0] += 1
  FAILURES << what unless ok
end

include RegexGolf

HOLES.each_with_index do |h, i|
  label = h[:name][:en]
  solved, hits, misses, error = RegexGolf.check(i, h[:solution])
  check(error.empty?, "#{label}: the solution is a valid regex (#{error})")
  check(solved, "#{label}: the solution hits every green word (#{hits.inspect}) and no red one (#{misses.inspect})")
  check(RegexGolf.par(i) == h[:solution].length, "#{label}: par is the solution's length")
  check(h[:hit].size >= 3 && h[:miss].size >= 3, "#{label}: at least three words on each side")
  check((h[:hit] & h[:miss]).empty?, "#{label}: no word is both green and red")
  check(!RegexGolf.check(i, '.')[0], "#{label}: . alone doesn't solve it")
  %i[en nl].each do |l|
    check(!h[:name][l].to_s.empty? && !h[:tip][l].to_s.empty?, "#{label}: text in #{l}")
  end
end

# a broken regex gets Ruby's own error message
_, _, _, error = RegexGolf.check(0, '[a-')
check(error.include?('premature end of char-class'), "Ruby's error for [a- (#{error})")

# empty input is not an error, and not solved
check(RegexGolf.check(0, '') == [false, [], [], ''], 'empty regex')

# catastrophic backtracking hits a timeout instead of hanging the page (Ruby 3.2+ memoizes most of it anyway)
check(Regexp.timeout == 0.2, 'regexes time out after 0.2 s')

# scorecard words
check(RegexGolf.verdict(4, 4) == 'par' && RegexGolf.verdict(3, 4) == 'birdie' && RegexGolf.verdict(6, 4) == 'over', 'verdicts')
check(RegexGolf.verdict(1, 5) == 'ace', 'ace')

# the bridge: valid JSON for JavaScript, strings escaped
json = RegexGolf.check_json(1, '"\d\\')
check(json.start_with?('{"solved":false'), "check_json: #{json}")
check(RegexGolf.js("a\"b\\c\nd") == '"a\"b\\\\c\nd"', 'strings are escaped')
check(RegexGolf.holes_json('nl').include?('"Afslag"'), 'holes in Dutch')
check(RegexGolf.total_par == HOLES.each_index.sum { RegexGolf.par(_1) }, 'total par')

"#{CHECKS[0] - FAILURES.size}/#{CHECKS[0]} ok" + FAILURES.map { "\n  FAIL #{_1}" }.join
