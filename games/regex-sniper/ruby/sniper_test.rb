# Tests for the rules. ruby.wasm without the standard library has no minitest, so this is a tiny assert of our own;
# test/run.mjs loads Ruby in Node, runs sniper.rb and this file, and fails when FAILURES isn't empty.

FAILURES = []
CHECKS = [0]

def check(ok, what)
  CHECKS[0] += 1
  FAILURES << what unless ok
end

include RegexSniper

LEVELS.each_with_index do |h, i|
  label = h[:name][:en]
  solved, hits, misses, error = RegexSniper.check(i, h[:solution])
  check(error.empty?, "#{label}: the solution is a valid regex (#{error})")
  check(solved, "#{label}: the solution hits every green word (#{hits.inspect}) and no red one (#{misses.inspect})")
  check(RegexSniper.target(i) == h[:solution].length, "#{label}: the target is the solution's length")
  check(h[:hit].size >= 3 && h[:miss].size >= 3, "#{label}: at least three words on each side")
  check((h[:hit] & h[:miss]).empty?, "#{label}: no word is both green and red")
  check(!RegexSniper.check(i, '.')[0], "#{label}: . alone doesn't solve it")
  %i[en nl].each do |l|
    check(!h[:name][l].to_s.empty? && !h[:tip][l].to_s.empty?, "#{label}: text in #{l}")
  end
end

# a broken regex gets Ruby's own error message
_, _, _, error = RegexSniper.check(0, '[a-')
check(error.include?('premature end of char-class'), "Ruby's error for [a- (#{error})")

# empty input is not an error, and not solved
check(RegexSniper.check(0, '') == [false, [], [], ''], 'empty regex')

# catastrophic backtracking hits a timeout instead of hanging the page (Ruby 3.2+ memoizes most of it anyway)
check(Regexp.timeout == 0.2, 'regexes time out after 0.2 s')

# how sharp a solution was
check(RegexSniper.verdict(3, 4) == 'sharper' && RegexSniper.verdict(4, 4) == 'target', 'sharper, on target')
check(RegexSniper.verdict(7, 4) == 'close' && RegexSniper.verdict(8, 4) == 'loose', 'close, loose')

# the bridge: valid JSON for JavaScript, strings escaped
json = RegexSniper.check_json(1, '"\d\\')
check(json.start_with?('{"solved":false'), "check_json: #{json}")
check(RegexSniper.js("a\"b\\c\nd") == '"a\"b\\\\c\nd"', 'strings are escaped')
check(RegexSniper.levels_json('nl').include?('"Opwarmen"'), 'levels in Dutch')
check(RegexSniper.total_target == LEVELS.each_index.sum { RegexSniper.target(_1) }, 'total target')

"#{CHECKS[0] - FAILURES.size}/#{CHECKS[0]} ok" + FAILURES.map { "\n  FAIL #{_1}" }.join
