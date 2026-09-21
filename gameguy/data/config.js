/* ============================================================
   CONFIG — the knobs.
   ============================================================
   Every number here is safe to change. Change one, save, refresh,
   see what happens. Nothing in this file is logic.
   ============================================================ */

// ---- Screen ----
const TILE      = 32;   // size of one tile in the spritesheet, in pixels
const ZOOM      = 2;    // how much the world is magnified on screen. Try 3.
const VIEW_COLS = 15;   // how many tiles wide the window onto the world is
const VIEW_ROWS = 11;   // ...and how many tall
// The canvas ends up VIEW_COLS * TILE * ZOOM pixels wide (15 * 32 * 2 = 960).
// Menus and text are drawn at full resolution, NOT zoomed, which is why
// the text stays crisp while the world looks chunky.

const UI_FONT = '"Patrick Hand", "Trebuchet MS", "Segoe UI", sans-serif';
// Patrick Hand comes from Google Fonts (see index.html). With no internet
// the game quietly uses the next font in the list.

// ---- Movement ----
const SPEED = 84;       // walking speed, in world pixels per second

// ---- The kid ----
// Which sprite sheet you're drawn from (data/characters.js).
// Set it to null and you go back to being a blocky person built from the colours below.
const PLAYER_SPRITE = 'kid';
// The four colours, used for anyone without a sprite.
const PLAYER_LOOK = { skin: '#997854', hair: '#B3693E', shirt: '#E6DB5A', legs: '#5AE6DA' };

// ---- Time ----
// One real second = this many game minutes. At 1.2, a full day
// (7am to 10pm) lasts about twelve and a half real minutes.
const GAME_MINUTES_PER_SECOND = 1.2;
const DAY_START_HOUR = 7;    // you wake up at 7:00
const SLEEPY_HOUR    = 21;   // a reminder appears at 8pm
const COLLAPSE_HOUR  = 23;   // at 10pm you fall asleep wherever you are
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
// Day 1 is DAY_NAMES[0]. The short names used in conditions ("day:Thu")
// are just the first three letters of these.

// The colour laid over the world at each hour. [hour, 'r,g,b', strength 0-1]
// The game blends smoothly between neighbouring entries.
const SKY_TINT = [
  [ 5, '40,50,110',  0.45],
  [ 7, '255,190,120', 0.18],   // warm early light
  [ 9, '255,255,255', 0.00],   // plain daylight
  [16, '255,255,255', 0.00],
  [18, '255,150,80',  0.22],   // golden hour
  [20, '70,60,140',   0.40],   // dusk
  [22, '20,25,80',    0.58],   // night
];
const INDOOR_TINT_STRENGTH = 0.35;   // indoors only gets this fraction of the tint

// ---- Money ----
const MONEY_NAME     = 'jenni';   // PLACEHOLDER — rename to whatever the island uses
const MONEY_NAME_ONE = 'J';    // ...and what exactly one of them is called

// ---- A new game starts like this ----
const START = {
  map: 'home_upstairs', col: 2, row: 2, facing: 'down',
  money: 1,
  // "Three cards tucked under the pillow where they're safe."
  cards: ['004', '017', '035'],
};

// ---- Cards ----
// Where the full card images live. Only loaded when a card is looked at
// closely (the detail view, a pack opening), never for the whole grid,
// because each image is over half a megabyte.
const CARD_IMAGE_BASE = 'https://hxa.neocities.org/bakemon/cards/';
const PLAYMAT_URL     = 'https://sprowtling.github.io/playbakemon';

// Used for the stand-in card that's drawn when the real image isn't
// available (offline, still loading, or the small grid view).
const TYPE_COLORS = {
  normal: '#b9b3a2', fire: '#e2703a', water: '#3f8fd0', grass: '#5aa858', electric: '#e8c93a',
  fighting: '#b5623a', psychic: '#c25a9a', dark: '#4a4458', steel: '#8fa0ac', dragon: '#5a5ac8',
  fairy: '#e79ac0', item: '#7d8f86',
};

// ---- Saving ----
const SAVE_KEY     = 'bakemon-island-save';
const SAVE_VERSION = 1;
// SHORTCUT: if you change the SHAPE of the save (rename a field in
// js/state.js), bump SAVE_VERSION. Old saves are then ignored rather
// than loaded half-broken. Adding cards, maps, NPCs, jobs does NOT
// need a bump.

// ---- Tinkering tools ----
// While DEBUG is true these keys work during play:
//   1  skip ahead one hour        3  get a free pack
//   2  +5 money                   4  go straight to tomorrow morning
//   0  show collision boxes
const DEBUG = true;
