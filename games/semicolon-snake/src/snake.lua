-- snake.lua: the rules of Semicolon Snake, with no browser code.
--
-- You are a snake on a grid, and your body is the line of code you're writing. Tokens lie on the board; eat them in
-- an order that is still valid code. A ";" runs the statement: points, and the snake shrinks back. A token that
-- doesn't fit is a SyntaxError; the wall is a segfault; biting yourself is a stack overflow.

local M = {}

M.W, M.H = 20, 12
M.BASE = 3 -- body length with an empty line
M.ON_BOARD = 5 -- tokens lying around at once

-- ---------- tokens ----------

M.NAMES = { "x", "y", "n", "duck", "bug", "todo" }
M.NUMBERS = { "0", "1", "7", "42", "404" }
M.STRINGS = { '"hi"', '"lua"', '"ok"' }

local KEYWORDS = { ["local"] = true, print = true, ["return"] = true }

local function member(list, v)
  for _, x in ipairs(list) do
    if x == v then return true end
  end
  return false
end

--- The class of a token: keyword, name, number, string, or the token itself for punctuation.
function M.class(tok)
  if KEYWORDS[tok] then return "keyword" end
  if member(M.NAMES, tok) then return "name" end
  if member(M.NUMBERS, tok) then return "number" end
  if member(M.STRINGS, tok) then return "string" end
  return tok
end

-- every token that can ever be on the board
M.ALL = { "local", "print", "return", "=", "+", "..", "(", ")", ";" }
for _, list in ipairs({ M.NAMES, M.NUMBERS, M.STRINGS }) do
  for _, t in ipairs(list) do M.ALL[#M.ALL + 1] = t end
end

-- ---------- the grammar ----------
-- Four kinds of statement, with values joined by + or ..:
--   local <name> = <value> ;      <name> = <value> ;      print ( <value> ) ;      return <value> ;
-- The parser is a small state machine; `accepts` says which tokens may come next.

local VALUE = { name = true, number = true, string = true }

--- Whether `tok` may come next in state `st` (a table: { at = ..., open = number of open parens }).
function M.accepts(st, tok)
  local c = M.class(tok)
  local at = st.at
  if at == "start" then return c == "keyword" or c == "name" end
  if at == "decl" then return c == "name" end
  if at == "eq" then return tok == "=" end
  if at == "paren" then return tok == "(" end
  if at == "value" then return VALUE[c] == true end
  if at == "after" then
    if tok == "+" or tok == ".." then return true end
    if st.open > 0 then return tok == ")" end
    return tok == ";"
  end
  if at == "closed" then return tok == ";" end
  return false
end

--- The state after `tok` (which must be accepted).
function M.advance(st, tok)
  local c = M.class(tok)
  local at, open = st.at, st.open
  if at == "start" then
    if tok == "local" then return { at = "decl", open = 0 } end
    if tok == "print" then return { at = "paren", open = 0 } end
    if tok == "return" then return { at = "value", open = 0 } end
    return { at = "eq", open = 0 } -- an assignment: name = ...
  elseif at == "decl" then
    return { at = "eq", open = 0 }
  elseif at == "eq" then
    return { at = "value", open = 0 }
  elseif at == "paren" then
    return { at = "value", open = 1 }
  elseif at == "value" then
    return { at = "after", open = open }
  elseif at == "after" then
    if tok == ")" then return { at = "closed", open = open - 1 } end
    if tok == ";" then return { at = "start", open = 0 } end
    return { at = "value", open = open }
  elseif at == "closed" then
    return { at = "start", open = 0 }
  end
  error("unexpected state " .. tostring(at) .. " for " .. tostring(c))
end

--- What the parser wants next, as a word for the HUD: keyword, name, "=", "(", value, operator.
function M.expects(st)
  local at = st.at
  if at == "start" then return "statement" end
  if at == "decl" then return "name" end
  if at == "eq" then return "=" end
  if at == "paren" then return "(" end
  if at == "value" then return "value" end
  if at == "after" then return st.open > 0 and "op_or_close" or "op_or_semi" end
  if at == "closed" then return ";" end
  return "?"
end

-- ---------- the game ----------

local DIRS = { up = { 0, -1 }, down = { 0, 1 }, left = { -1, 0 }, right = { 1, 0 } }
local OPPOSITE = { up = "down", down = "up", left = "right", right = "left" }

--- A new game. `rand()` returns a number in [0, 1); pass a seeded one for tests.
function M.new(rand)
  local g = {
    rand = rand or math.random,
    phase = "ready", -- ready, running, paused, over
    body = {}, -- head first: { x, y }
    dir = "right",
    queue = {}, -- turns asked for, applied one per step
    line = {}, -- the tokens of the statement being written
    state = { at = "start", open = 0 },
    tokens = {}, -- on the board: { x, y, tok }
    program = {}, -- statements that ran
    score = 0,
    clock = 0,
    reason = nil, -- why it ended: "wall", "self" or "syntax"
    bad = nil, -- the token that didn't fit
    events = {},
  }
  local cy = M.H // 2
  for i = 0, M.BASE - 1 do
    g.body[#g.body + 1] = { x = 6 - i, y = cy }
  end
  M.fill(g)
  return g
end

local function occupied(g, x, y)
  for _, s in ipairs(g.body) do
    if s.x == x and s.y == y then return true end
  end
  for _, t in ipairs(g.tokens) do
    if t.x == x and t.y == y then return true end
  end
  return false
end

local function pick(g, list)
  return list[math.floor(g.rand() * #list) + 1]
end

local function place(g, tok)
  local head = g.body[1]
  for _ = 1, 200 do
    local x = math.floor(g.rand() * M.W)
    local y = math.floor(g.rand() * M.H)
    -- not on anything, and not right in front of your nose
    if not occupied(g, x, y) and (math.abs(x - head.x) + math.abs(y - head.y)) > 2 then
      g.tokens[#g.tokens + 1] = { x = x, y = y, tok = tok }
      return
    end
  end
end

--- Tokens that fit right now.
function M.valid(g)
  local out = {}
  for _, t in ipairs(M.ALL) do
    if M.accepts(g.state, t) then out[#out + 1] = t end
  end
  return out
end

--- Tops the board up to ON_BOARD tokens, with at least two that fit (so there is always a way forward).
function M.fill(g)
  local fits = 0
  for _, t in ipairs(g.tokens) do
    if M.accepts(g.state, t.tok) then fits = fits + 1 end
  end
  local valid = M.valid(g)
  while fits < 2 do
    place(g, pick(g, valid))
    fits = fits + 1
  end
  while #g.tokens < M.ON_BOARD do
    place(g, pick(g, M.ALL))
  end
end

--- Seconds per step: faster with every statement that ran.
function M.interval(g)
  return math.max(0.075, 0.16 - #g.program * 0.006)
end

function M.start(g)
  if g.phase == "ready" then g.phase = "running" end
end

function M.pause(g)
  if g.phase == "running" then
    g.phase = "paused"
  elseif g.phase == "paused" then
    g.phase = "running"
  end
end

--- Asks to turn; the turn happens on the next step. At most two turns wait, so quick double turns work.
function M.turn(g, dir)
  if not DIRS[dir] or #g.queue >= 2 then return end
  local last = g.queue[#g.queue] or g.dir
  if dir ~= last and dir ~= OPPOSITE[last] then g.queue[#g.queue + 1] = dir end
end

local function over(g, reason)
  g.phase = "over"
  g.reason = reason
  g.events[#g.events + 1] = "over"
end

--- One step of the snake.
function M.step(g)
  if g.phase ~= "running" then return end
  if #g.queue > 0 then g.dir = table.remove(g.queue, 1) end
  local d = DIRS[g.dir]
  local head = g.body[1]
  local nx, ny = head.x + d[1], head.y + d[2]

  if nx < 0 or ny < 0 or nx >= M.W or ny >= M.H then return over(g, "wall") end
  -- the tail moves away this step, so running into where it is now is fine
  for i = 1, #g.body - 1 do
    if g.body[i].x == nx and g.body[i].y == ny then return over(g, "self") end
  end

  table.insert(g.body, 1, { x = nx, y = ny })

  local eaten
  for i, t in ipairs(g.tokens) do
    if t.x == nx and t.y == ny then
      eaten = table.remove(g.tokens, i)
      break
    end
  end

  if not eaten then
    table.remove(g.body)
    return
  end
  if not M.accepts(g.state, eaten.tok) then
    g.bad = eaten.tok
    return over(g, "syntax")
  end

  g.state = M.advance(g.state, eaten.tok)
  g.line[#g.line + 1] = eaten.tok
  if eaten.tok == ";" then
    -- the statement runs: points for its length, squared, and the snake shrinks back
    local n = #g.line
    g.score = g.score + n * n
    g.program[#g.program + 1] = table.concat(g.line, " ")
    g.line = {}
    local keep = M.BASE + #g.program
    while #g.body > keep do table.remove(g.body) end
    g.events[#g.events + 1] = "ran"
  else
    g.events[#g.events + 1] = "ate"
  end
  M.fill(g)
end

--- Advances time; steps as often as the speed says.
function M.update(g, dt)
  if g.phase ~= "running" then return end
  g.clock = g.clock + dt
  local every = M.interval(g)
  while g.clock >= every and g.phase == "running" do
    g.clock = g.clock - every
    M.step(g)
  end
end

return M
