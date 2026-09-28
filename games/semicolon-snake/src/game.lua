-- game.lua: the browser side of Semicolon Snake, also in Lua. Fengari's `js` library gives Lua the page:
-- the canvas, keys and touches, the HUD, the theme and language from the hub, and the best score in localStorage.

local js = require "js"
local window = js.global
local document = window.document
local snake = assert(load(window.SEMICOLON_SNAKE_RULES, "=snake.lua"))()

local BEST_KEY = "play:semicolon-snake:best"
local MONO = "'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace"

-- ---------- text ----------

local TEXT = {
  en = {
    title = "Semicolon Snake",
    tagline = "Your body is a line of code. Eat the tokens in an order that still compiles.",
    start = "Press Space or tap to start",
    controls = "Arrows or WASD to turn; swipe on a phone. ; runs the statement. P pauses.",
    paused = "Paused",
    resume = "Space or tap to continue",
    retry = "> lua snake.lua  (Space or tap)",
    score = "score",
    best = "best",
    lines = "lines",
    program = "program.lua",
    empty = "-- nothing ran yet",
    expects = "expects",
    want = {
      statement = "local, print, return or a name",
      name = "a name",
      ["="] = "=",
      ["("] = "(",
      value = "a value: name, number or string",
      op_or_semi = "; or + or ..",
      op_or_close = ") or + or ..",
      [";"] = ";",
    },
    wall = "Segmentation fault: you left the buffer",
    self = "Stack overflow: you ran into yourself",
    syntax = "SyntaxError: unexpected '%s'",
    result = "%d points, %d lines ran",
    newBest = "New best: %d points!",
    sayRan = "Ran: %s",
  },
  nl = {
    title = "Semicolon Snake",
    tagline = "Je lijf is een regel code. Eet de tokens in een volgorde die nog compileert.",
    start = "Druk op spatie of tik om te beginnen",
    controls = "Pijltjes of WASD om te draaien; veeg op je telefoon. ; voert de regel uit. P pauzeert.",
    paused = "Gepauzeerd",
    resume = "Spatie of tik om verder te gaan",
    retry = "> lua snake.lua  (spatie of tik)",
    score = "score",
    best = "record",
    lines = "regels",
    program = "program.lua",
    empty = "-- nog niets uitgevoerd",
    expects = "verwacht",
    want = {
      statement = "local, print, return of een naam",
      name = "een naam",
      ["="] = "=",
      ["("] = "(",
      value = "een waarde: naam, getal of string",
      op_or_semi = "; of + of ..",
      op_or_close = ") of + of ..",
      [";"] = ";",
    },
    wall = "Segmentation fault: je ging de buffer uit",
    self = "Stack overflow: je liep tegen jezelf aan",
    syntax = "SyntaxError: onverwacht '%s'",
    result = "%d punten, %d regels uitgevoerd",
    newBest = "Nieuw record: %d punten!",
    sayRan = "Uitgevoerd: %s",
  },
}

-- ---------- page ----------

local function el(id) return document:getElementById(id) end
local stage, canvas = el("stage"), el("game")
local ctx = canvas:getContext("2d")
local html = document.documentElement

local function storageGet(key)
  local ok, v = pcall(function() return window.localStorage:getItem(key) end)
  if ok and v ~= js.null then return v end
  return nil
end
local function storageSet(key, value)
  pcall(function() window.localStorage:setItem(key, value) end)
end

local params = js.new(window.URLSearchParams, window.location.search)
local lang = params:get("lang")
if lang ~= "en" and lang ~= "nl" then
  lang = window.navigator.language:sub(1, 2) == "nl" and "nl" or "en"
end
html:setAttribute("lang", lang)
-- on its own page, not in the hub's iframe (proxies of the same JS object aren't equal in Lua, so no top == self)
if window.frameElement == js.null then html.classList:add("standalone") end

local colors = {}
local function readColors()
  local cs = window:getComputedStyle(html)
  for _, name in ipairs({ "bg", "grid", "text", "muted", "faint", "accent", "keyword", "name", "number", "string",
    "punct", "danger", "panel", "ink" }) do
    colors[name] = cs:getPropertyValue("--c-" .. name):gsub("^%s+", ""):gsub("%s+$", "")
  end
end

local function setTheme(theme)
  html:setAttribute("data-theme", theme == "light" and "light" or "dark")
  readColors()
end
local cookie = document.cookie:match("jo%-theme=(%a+)")
setTheme(cookie or storageGet("theme"))

-- ---------- state ----------

local best = tonumber(storageGet(BEST_KEY)) or 0
local g = snake.new()
local newBest = false
local endedAt = 0

local function colorOf(tok)
  local c = snake.class(tok)
  if c == "keyword" or c == "name" or c == "number" or c == "string" then return colors[c] end
  return colors.punct
end

-- ---------- HUD (plain DOM, readable by screen readers) ----------

local function span(parent, text, color)
  local s = document:createElement("span")
  s.textContent = text
  if color then s.style.color = color end
  parent:appendChild(s)
  return s
end

local function showLine()
  local t = TEXT[lang]
  local line = el("line")
  line:replaceChildren()
  span(line, "> ", colors.muted)
  for _, tok in ipairs(g.line) do span(line, tok .. " ", colorOf(tok)) end
  span(line, "▌", colors.accent).className = "caret"
  el("expects").textContent = t.expects .. ": " .. t.want[snake.expects(g.state)]
end

local function showProgram()
  local t = TEXT[lang]
  el("program-title").textContent = t.program
  local list = el("program")
  list:replaceChildren()
  local from = math.max(1, #g.program - 7)
  if #g.program == 0 then
    local li = document:createElement("li")
    span(li, t.empty, colors.faint)
    list:appendChild(li)
  end
  for i = from, #g.program do
    local li = document:createElement("li")
    span(li, string.format("%2d ", i), colors.faint)
    for tok in g.program[i]:gmatch("%S+") do span(li, tok .. " ", colorOf(tok)) end
    list:appendChild(li)
  end
end

local function showScore()
  local t = TEXT[lang]
  el("score").textContent = t.score .. " " .. g.score
  el("best").textContent = t.best .. " " .. math.max(best, g.score)
  el("count").textContent = t.lines .. " " .. #g.program
end

local function showOverlay()
  local t = TEXT[lang]
  local o = el("overlay")
  o.hidden = g.phase == "running"
  o:setAttribute("data-phase", g.phase)
  stage:setAttribute("data-phase", g.phase)
  local title, sub, hint = "", "", ""
  if g.phase == "ready" then
    title, sub, hint = t.title, t.tagline, t.start
  elseif g.phase == "paused" then
    title, sub, hint = t.paused, "", t.resume
  elseif g.phase == "over" then
    title = g.reason == "syntax" and string.format(t.syntax, g.bad) or t[g.reason]
    sub = newBest and string.format(t.newBest, g.score) or string.format(t.result, g.score, #g.program)
    hint = t.retry
  end
  el("title").textContent = title
  el("sub").textContent = sub
  el("hint").textContent = hint
  el("controls").textContent = g.phase == "ready" and t.controls or ""
end

local function showAll()
  showLine()
  showProgram()
  showScore()
  showOverlay()
end

-- ---------- drawing ----------

local view = { cell = 32, ox = 0, oy = 0, dpr = 1 }

local function fit()
  local r = canvas:getBoundingClientRect()
  local dpr = math.min(window.devicePixelRatio or 1, 3)
  canvas.width = math.floor(r.width * dpr)
  canvas.height = math.floor(r.height * dpr)
  local cell = math.floor(math.min(r.width / snake.W, r.height / snake.H))
  view = { cell = cell, ox = (r.width - cell * snake.W) / 2, oy = (r.height - cell * snake.H) / 2, dpr = dpr }
end

local function roundRect(x, y, w, h, r, color)
  ctx.fillStyle = color
  ctx:beginPath()
  ctx:roundRect(x, y, w, h, r)
  ctx:fill()
end

--- A token's text, as large as fits in a cell
local function label(tok, x, y, size, color)
  local fs = math.min(size * 0.5, size * 1.3 / math.max(1, #tok))
  ctx.font = "700 " .. fs .. "px " .. MONO
  ctx.fillStyle = color
  ctx:fillText(tok, x + size / 2, y + size / 2 + 1)
end

local function draw(time)
  local c, ox, oy = view.cell, view.ox, view.oy
  ctx:setTransform(view.dpr, 0, 0, view.dpr, 0, 0)
  ctx:clearRect(0, 0, canvas.width, canvas.height)
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"

  -- the buffer: a panel with faint dots, like an empty editor
  roundRect(ox - 4, oy - 4, c * snake.W + 8, c * snake.H + 8, 8, colors.panel)
  ctx.fillStyle = colors.grid
  for gx = 0, snake.W - 1 do
    for gy = 0, snake.H - 1 do
      ctx:fillRect(ox + gx * c + c / 2 - 1, oy + gy * c + c / 2 - 1, 2, 2)
    end
  end

  -- tokens on the board; the ones that fit glow while you learn (the first two statements)
  local learning = #g.program < 2
  for _, tk in ipairs(g.tokens) do
    local x, y = ox + tk.x * c, oy + tk.y * c
    local color = colorOf(tk.tok)
    if learning and snake.accepts(g.state, tk.tok) then
      ctx.globalAlpha = 0.25 + 0.15 * math.sin(time * 5)
      roundRect(x - 3, y - 3, c + 6, c + 6, 10, color)
      ctx.globalAlpha = 1
    end
    roundRect(x + 2, y + 2, c - 4, c - 4, 7, colors.bg)
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx:beginPath()
    ctx:roundRect(x + 2.5, y + 2.5, c - 5, c - 5, 7)
    ctx:stroke()
    label(tk.tok, x, y, c, color)
  end

  -- the snake: the line of code, read from tail to head; the head is a text cursor
  local n = #g.body
  for i = n, 1, -1 do
    local s = g.body[i]
    local x, y = ox + s.x * c, oy + s.y * c
    local tok = g.line[#g.line - (i - 2)] -- segment 2 holds the newest token
    if i == 1 then
      roundRect(x + 1, y + 1, c - 2, c - 2, 8, colors.accent)
      if g.phase ~= "over" and math.floor(time * 2.5) % 2 == 0 then
        ctx.fillStyle = colors.ink
        ctx:fillRect(x + c / 2 - 2, y + c * 0.22, 4, c * 0.56)
      end
    elseif tok then
      roundRect(x + 1, y + 1, c - 2, c - 2, 6, colorOf(tok))
      label(tok, x, y, c, colors.ink)
    else
      ctx.globalAlpha = 0.55
      roundRect(x + 3, y + 3, c - 6, c - 6, 6, colors.accent)
      ctx.globalAlpha = 1
    end
  end

  if g.phase == "over" and g.reason == "syntax" then
    local h = g.body[1]
    ctx.strokeStyle = colors.danger
    ctx.lineWidth = 3
    ctx:beginPath()
    ctx:roundRect(ox + h.x * c - 2, oy + h.y * c - 2, c + 4, c + 4, 9)
    ctx:stroke()
  end
end

-- ---------- input ----------

local function press()
  if g.phase == "ready" then
    snake.start(g)
  elseif g.phase == "paused" then
    snake.pause(g)
  elseif g.phase == "over" then
    if window.performance:now() - endedAt < 500 then return end
    g = snake.new()
    newBest = false
    snake.start(g)
  end
  showAll()
end

local KEYS = {
  ArrowUp = "up", KeyW = "up", ArrowDown = "down", KeyS = "down",
  ArrowLeft = "left", KeyA = "left", ArrowRight = "right", KeyD = "right",
}

window:addEventListener("keydown", function(_, e)
  if e.ctrlKey or e.metaKey or e.altKey then return end
  local dir = KEYS[e.code]
  if dir then
    e:preventDefault()
    if g.phase == "ready" then press() end
    snake.turn(g, dir)
  elseif e.code == "Space" or e.code == "Enter" then
    e:preventDefault()
    if not e["repeat"] then press() end
  elseif e.code == "KeyP" or e.code == "Escape" then
    snake.pause(g)
    showOverlay()
  end
end)

-- touch: swipe to turn, tap to start
local touch = nil
stage:addEventListener("pointerdown", function(_, e)
  if not e.isPrimary then return end
  e:preventDefault()
  window:focus()
  touch = { x = e.clientX, y = e.clientY }
  if g.phase ~= "running" then press() end
end)
stage:addEventListener("pointerup", function(_, e)
  if not touch then return end
  local dx, dy = e.clientX - touch.x, e.clientY - touch.y
  touch = nil
  if math.max(math.abs(dx), math.abs(dy)) < 24 then return end
  if math.abs(dx) > math.abs(dy) then
    snake.turn(g, dx > 0 and "right" or "left")
  else
    snake.turn(g, dy > 0 and "down" or "up")
  end
end)

local function pause()
  if g.phase == "running" then
    snake.pause(g)
    showOverlay()
  end
end
window:addEventListener("blur", pause)
document:addEventListener("visibilitychange", function()
  if document.hidden then pause() end
end)

-- settings from the hub (optional), same origin only
window:addEventListener("message", function(_, e)
  if e.origin ~= window.location.origin or e.data == js.null or e.data == nil then return end
  if e.data.type ~= "play:settings" then return end
  if e.data.theme == "light" or e.data.theme == "dark" then
    setTheme(e.data.theme)
    showAll()
  end
  if e.data.lang == "en" or e.data.lang == "nl" then
    lang = e.data.lang
    html:setAttribute("lang", lang)
    showAll()
  end
end)
window:addEventListener("storage", function(_, e)
  if e.key == "theme" then
    setTheme(e.newValue)
    showAll()
  end
end)

-- ---------- loop ----------

local last = window.performance:now()
local size = ""

local function frame(_, now)
  local dt = math.min(0.1, (now - last) / 1000)
  last = now
  local r = canvas:getBoundingClientRect()
  local key = r.width .. "x" .. r.height
  if key ~= size then
    size = key
    fit()
  end

  snake.update(g, dt)
  if #g.events > 0 then
    for _, ev in ipairs(g.events) do
      if ev == "ran" then
        el("live").textContent = string.format(TEXT[lang].sayRan, g.program[#g.program])
      elseif ev == "over" then
        endedAt = now
        newBest = g.score > best
        if newBest then
          best = g.score
          storageSet(BEST_KEY, tostring(best))
        end
        el("live").textContent = el("title").textContent
      end
    end
    g.events = {}
    showAll()
    if g.phase == "over" then el("live").textContent = el("title").textContent .. ". " .. el("sub").textContent end
  end

  draw(now / 1000)
  window:requestAnimationFrame(frame)
end

showAll()
window:requestAnimationFrame(frame)
