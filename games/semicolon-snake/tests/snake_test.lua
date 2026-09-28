-- Tests for the rules, in Lua. `npm test` runs them with Fengari in Node (tests/run.mjs).
local snake = dofile("src/snake.lua")

local passed, failed = 0, 0
local function test(name, fn)
  local ok, err = pcall(fn)
  if ok then
    passed = passed + 1
    print("  ok   " .. name)
  else
    failed = failed + 1
    print("  FAIL " .. name .. "\n       " .. tostring(err))
  end
end
local function eq(a, b, msg)
  if a ~= b then error((msg or "") .. ": expected " .. tostring(b) .. ", got " .. tostring(a), 2) end
end

--- Deterministic random numbers (a small LCG), so every run plays the same board
local function seeded(seed)
  local s = seed
  return function()
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  end
end

--- Feeds tokens through the grammar; returns whether all were accepted and the final state
local function parse(tokens)
  local st = { at = "start", open = 0 }
  for _, t in ipairs(tokens) do
    if not snake.accepts(st, t) then return false, st end
    st = snake.advance(st, t)
  end
  return true, st
end

--- A game with an empty board and one token put where the head will be after the next step
local function ahead(g, tok)
  g.tokens = {}
  local h = g.body[1]
  g.tokens[1] = { x = h.x + 1, y = h.y, tok = tok }
end

print("semicolon snake")

test("accepts the four kinds of statement", function()
  for _, s in ipairs({
    { "local", "x", "=", "42", ";" },
    { "duck", "=", "duck", "+", "1", ";" },
    { "print", "(", '"hi"', "..", "x", ")", ";" },
    { "return", "404", ";" },
  }) do
    local ok, st = parse(s)
    eq(ok, true, table.concat(s, " "))
    eq(st.at, "start", "back at the start after ;")
  end
end)

test("rejects what isn't valid", function()
  for _, s in ipairs({
    { ";" },
    { "local", "=", "1" },
    { "local", "42" },
    { "print", "x" },
    { "print", "(", "x", ";" },
    { "return", "+" },
    { "x", "=", "1", ")" },
  }) do
    eq(parse(s), false, table.concat(s, " "))
  end
end)

test("always leaves at least two tokens that fit on the board", function()
  local g = snake.new(seeded(7))
  for _ = 1, 50 do
    g.state = snake.advance(g.state, snake.valid(g)[1])
    g.tokens = {}
    snake.fill(g)
    local fits = 0
    for _, t in ipairs(g.tokens) do
      if snake.accepts(g.state, t.tok) then fits = fits + 1 end
    end
    eq(fits >= 2, true, "tokens that fit")
    eq(#g.tokens, snake.ON_BOARD, "tokens on the board")
  end
end)

test("eating a token that fits adds it to the line and grows the snake", function()
  local g = snake.new(seeded(1))
  snake.start(g)
  ahead(g, "local")
  snake.step(g)
  eq(g.phase, "running")
  eq(g.line[1], "local")
  eq(#g.body, snake.BASE + 1, "one longer")
end)

test("a ; runs the statement: points for its length squared, and the snake shrinks", function()
  local g = snake.new(seeded(1))
  snake.start(g)
  for _, t in ipairs({ "return", "42", ";" }) do
    ahead(g, t)
    snake.step(g)
  end
  eq(g.score, 9, "3 tokens")
  eq(g.program[1], "return 42 ;")
  eq(#g.line, 0)
  eq(#g.body, snake.BASE + 1, "base length plus one per statement")
end)

test("a token that doesn't fit is a SyntaxError", function()
  local g = snake.new(seeded(1))
  snake.start(g)
  ahead(g, ";")
  snake.step(g)
  eq(g.phase, "over")
  eq(g.reason, "syntax")
  eq(g.bad, ";")
end)

test("the wall is a segfault, your own body a stack overflow", function()
  local g = snake.new(seeded(2))
  snake.start(g)
  g.tokens = {}
  for _ = 1, snake.W do snake.step(g) end
  eq(g.reason, "wall")

  local h = snake.new(seeded(2))
  snake.start(h)
  h.tokens = {}
  h.body = { { x = 5, y = 5 }, { x = 4, y = 5 }, { x = 4, y = 6 }, { x = 5, y = 6 }, { x = 6, y = 6 } }
  h.dir = "down"
  snake.step(h)
  eq(h.reason, "self")
end)

test("can't turn straight back, and keeps two quick turns", function()
  local g = snake.new(seeded(3))
  snake.turn(g, "left") -- going right: ignored
  eq(#g.queue, 0)
  snake.turn(g, "up")
  snake.turn(g, "left")
  eq(#g.queue, 2)
end)

test("speeds up with every statement, to a limit", function()
  local g = snake.new(seeded(3))
  local slow = snake.interval(g)
  for i = 1, 40 do g.program[i] = "return 1 ;" end
  eq(snake.interval(g) < slow, true, "faster")
  eq(snake.interval(g), 0.075, "limit")
end)

print(string.format("\n%d passed, %d failed", passed, failed))
if failed > 0 then error("tests failed") end
