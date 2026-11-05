'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const X = require('../engine.js');
const S = require('../persistence.js');
let passed = 0;
function test(name, run) { run(); passed++; console.log('PASS', name); }
function roundtrip(game, prefs) { return S.restore(S.serialize(game, prefs)); }
function twoMoves() { return S.play(S.play(S.newGame(), 54, 45), 27, 36); }

test('save/replay restores turn, board, record and undo history', () => {
  const game = twoMoves();
  const saved = S.serialize(game, {flipped:true, faceToFace:true, hints:false, sound:false});
  assert(!saved.includes('"board"'), 'save must store moves instead of trusting a saved board');
  const restored = S.restore(saved);
  assert.deepEqual(restored.game, game);
  assert.deepEqual(restored.preferences, {flipped:true, faceToFace:true, hints:false, sound:false});
  assert.equal(restored.game.turn, 'r');
  assert.equal(S.undo(restored.game).turn, 'b');
  assert.deepEqual(S.undo(S.undo(restored.game)), S.newGame());
});
test('play is immutable and undo restores captures', () => {
  const start = S.newGame(), original = JSON.stringify(start);
  let game = S.play(start, 64, 1); // Red cannon captures Black horse over Black cannon.
  assert.equal(JSON.stringify(start), original);
  assert.equal(game.board[1].t, 'C');
  assert.equal(game.board[64], null);
  assert.deepEqual(S.undo(game), start);
  assert.equal(S.undo(start), start);
});
test('invalid moves, wrong turns and non-integer indices are rejected', () => {
  const game = S.newGame();
  for (const move of [[27,36],[54,55],[54,63],[-1,45],[90,0],[54.5,45],[54,'45'],[54,54]]) {
    assert.throws(() => S.play(game, ...move));
  }
  assert.deepEqual(game, S.newGame());
});
test('corrupt, unknown, oversized and illegal replay data is rejected', () => {
  for (const raw of [null, '', '{', 'null', '{}', '{"version":1,"moves":[]}', '{"version":2,"moves":{}}',
    '{"version":2,"moves":[null]}', '{"version":2,"moves":[{"from":54.1,"to":45}]}',
    '{"version":2,"moves":[{"from":54,"to":55}]}',
    '{"version":2,"moves":[{"from":54,"to":45},{"from":56,"to":47}]}',
    ' '.repeat(2000001),
    JSON.stringify({version:2,moves:Array(10001).fill({from:54,to:45})})]) assert.throws(() => S.restore(raw));
});
test('preferences whitelist booleans and do not trust saved board or turn', () => {
  const prefs = S.preferences({flipped:'true', hints:0, sound:false, faceToFace:true, injected:'oops'});
  assert.deepEqual(prefs, {flipped:false, faceToFace:true, hints:true, sound:false});
  const restored = S.restore(JSON.stringify({version:2,moves:[],board:[],turn:'b',preferences:null}));
  assert.deepEqual(restored.game, S.newGame());
  assert.deepEqual(restored.preferences, S.preferences());
});
test('a saved deterministic 80-ply game replays identically and unwinds', () => {
  let game = S.newGame(), seed = 17;
  for (let ply = 0; ply < 80; ply++) {
    const moves = [];
    game.board.forEach((piece,from) => {
      if (piece?.s === game.turn) for (const to of X.legal(game.board,from)) moves.push({from,to});
    });
    if (!moves.length) break;
    seed = (seed*1664525+1013904223)>>>0;
    const move = moves[seed%moves.length];
    game = S.play(game,move.from,move.to);
  }
  let restored = roundtrip(game).game;
  assert.deepEqual(restored,game);
  while (restored.moves.length) restored = S.undo(restored);
  assert.deepEqual(restored,S.newGame());
});

// This DOM stub tests event wiring and state transitions. It is not browser/layout QA.
function harness(raw = null, failStorage = false) {
  const html = fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  const elements = {};
  let document;
  class Element {
    constructor(tag = 'div') {
      this.tagName = tag.toUpperCase(); this.children = []; this.style = {};
      this.attributes = {}; this._text = ''; this.parentElement = null;
      this.hidden = false; this.disabled = false; this.checked = false; this.open = false;
    }
    get firstElementChild() { return this.children[0] || null; }
    set textContent(value) { this._text = String(value); this.children = []; }
    get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
    set innerHTML(value) { this._html = value; this.children = []; this._text = ''; }
    append(...children) {
      for (let child of children) {
        if (typeof child === 'string') { const text = new Element('#text'); text.textContent=child; child=text; }
        if (child.parentElement) child.parentElement.children = child.parentElement.children.filter(item=>item!==child);
        child.parentElement = this; this.children.push(child);
      }
    }
    replaceChildren(...children) {
      for (const child of this.children) child.parentElement = null;
      this.children = []; this._text = ''; this.append(...children);
    }
    setAttribute(key,value) { this.attributes[key] = String(value); }
    getAttribute(key) { return this.attributes[key]; }
    focus() { document.activeElement = this; }
    showModal() { this.open = true; }
    close() { this.open = false; }
  }
  for (const [,id] of html.matchAll(/\bid="([^"]+)"/g)) elements[id] = new Element();
  document = {
    activeElement:null,
    getElementById(id) { assert(elements[id], 'Missing HTML element: '+id); return elements[id]; },
    createElement(tag) { return new Element(tag); },
    createTextNode(text) { const node = new Element('#text'); node.textContent=text; return node; },
    querySelectorAll() { return []; }
  };
  let stored = raw;
  const localStorage = {
    getItem() { return stored; },
    setItem(key,value) { if (failStorage) throw new Error('QuotaExceededError'); stored=value; }
  };
  const app = fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
  vm.runInNewContext(app, {Xiangqi:X,GameSession:S,document,localStorage,window:{},console});
  const squares = [...elements.board.children];
  return {elements,squares,document,stored:()=>stored,game:()=>S.restore(stored).game};
}

test('UI selects, highlights, moves and undoes without replacing square buttons', () => {
  const h = harness(), refs = [...h.squares];
  assert.equal(h.squares.length,90);
  assert.equal(h.squares.filter(button=>button.firstElementChild.textContent).length,32);
  assert.equal(h.elements.status.textContent,'红方先行');
  assert(h.elements.undo.disabled);
  h.squares[54].onclick();
  assert(h.squares[45].className.includes('legal'));
  h.squares[45].onclick();
  assert.equal(h.game().turn,'b');
  assert.equal(h.elements.status.textContent,'黑方走棋');
  assert.equal(h.elements.undo.disabled,false);
  assert.equal(h.squares[45].firstElementChild.textContent,'兵');
  assert.equal(h.squares[54].firstElementChild.textContent,'');
  assert.deepEqual(h.elements.board.children,refs);
  h.elements.undo.onclick();
  assert.deepEqual(h.game(),S.newGame());
});
test('UI rejects illegal destinations and works with hints disabled', () => {
  const h = harness();
  h.squares[54].onclick(); h.squares[55].onclick();
  assert.equal(h.stored(),null);
  assert(h.elements.notice.textContent.includes('不能落子'));
  h.elements['show-hints'].onchange({target:{checked:false}});
  assert(!h.squares[45].className.includes('legal'));
  h.squares[45].onclick();
  assert.equal(h.game().moves.length,1);
});
test('flip preserves the focused square and reorders navigation', () => {
  const h = harness();
  h.squares[54].focus();
  h.elements.flip.onclick();
  assert.equal(h.document.activeElement,h.squares[54]);
  assert.equal(h.elements.board.children[0],h.squares[89]);
  assert.equal(h.elements.flip.getAttribute('aria-pressed'),'true');
  let prevented = false;
  h.squares[54].onkeydown({key:'ArrowLeft',preventDefault(){prevented=true;}});
  assert(prevented);
  assert.equal(h.document.activeElement,h.squares[55]);
});
test('UI resumes a saved game and recovers from corrupt storage', () => {
  const saved = S.serialize(twoMoves(), {sound:false,faceToFace:true});
  const resumed = harness(saved);
  assert(resumed.elements.notice.textContent.includes('已续'));
  assert.equal(resumed.squares[45].firstElementChild.textContent,'兵');
  assert.equal(resumed.squares[36].firstElementChild.textContent,'卒');
  const corrupt = harness('{not-json');
  assert.equal(corrupt.elements.status.textContent,'红方先行');
  assert(corrupt.elements.notice.textContent.includes('存档不可用'));
  corrupt.squares[54].onclick(); corrupt.squares[45].onclick();
  assert.equal(corrupt.game().turn,'b');
});
test('storage failures preserve gameplay and report unavailable saves', () => {
  const h = harness(null,true);
  h.squares[54].onclick(); h.squares[45].onclick();
  assert.equal(h.elements.status.textContent,'黑方走棋');
  assert.equal(h.elements['save-state'].textContent,'保存不可用');
  assert(h.elements.notice.textContent.includes('无法保存'));
  h.elements.undo.onclick();
  assert.equal(h.elements.status.textContent,'红方先行');
});
test('new game requires confirmation and cancel keeps current game', () => {
  const h = harness();
  h.squares[54].onclick(); h.squares[45].onclick();
  h.elements.restart.onclick();
  assert(h.elements['restart-dialog'].open);
  h.elements['cancel-restart'].onclick();
  assert.equal(h.game().moves.length,1);
  h.elements.restart.onclick(); h.elements['confirm-restart'].onclick();
  assert.equal(h.elements['restart-dialog'].open,false);
  assert.deepEqual(h.game(),S.newGame());
});
console.log(passed+' application/session tests passed (DOM simulation, not browser QA).');
