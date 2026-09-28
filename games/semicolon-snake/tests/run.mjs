// Runs the Lua tests (tests/*.lua) with Fengari, the same Lua VM the game uses in the browser.
import { readdirSync } from 'node:fs';
import { lauxlib, lua, lualib, to_luastring } from 'fengari';

let failed = false;
for (const file of readdirSync('tests').filter((f) => f.endsWith('.lua'))) {
  const L = lauxlib.luaL_newstate();
  lualib.luaL_openlibs(L);
  if (lauxlib.luaL_dofile(L, to_luastring(`tests/${file}`)) !== lua.LUA_OK) {
    console.error(lua.lua_tojsstring(L, -1));
    failed = true;
  }
}
process.exit(failed ? 1 : 0);
