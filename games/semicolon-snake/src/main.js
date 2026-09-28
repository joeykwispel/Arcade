/**
 * Starts Semicolon Snake. The game is Lua (snake.lua: the rules, game.lua: the page); Fengari runs it in the browser.
 * This file only hands the Lua sources to Fengari; Vite bundles them in as text.
 */
import '@fontsource-variable/jetbrains-mono';
import './style.css';
import { load } from 'fengari-web';
import rules from './snake.lua?raw';
import game from './game.lua?raw';

// game.lua loads the rules from here (Lua's `require` can't read Vite's bundle)
window.SEMICOLON_SNAKE_RULES = rules;
try {
  load(game, '=game.lua')();
} catch (err) {
  console.error(err);
  document.getElementById('fallback').hidden = false;
}
