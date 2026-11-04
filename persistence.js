'use strict';
const GameSession = (() => {
  const X = typeof module !== 'undefined' && module.exports ? require('./engine.js') : Xiangqi;
  const defaults = { flipped: false, faceToFace: false, hints: true, sound: true };
  function newGame() { return {board: X.initial(), turn: 'r', moves: [], history: [], last: null}; }
  function play(game, from, to) {
    if (!Number.isInteger(from) || !Number.isInteger(to) || game.board[from]?.s !== game.turn ||
        X.state(game.board, game.turn).over || !X.legal(game.board, from).includes(to)) {
      throw new Error('非法走子');
    }
    return {board: X.apply(game.board, from, to), turn: X.other(game.turn),
      moves: [...game.moves, {from, to}], history: [...game.history, {board: game.board, turn: game.turn, last: game.last}], last: [from, to]};
  }
  function undo(game) {
    if (!game.history.length) return game;
    return {...game.history[game.history.length - 1], moves: game.moves.slice(0, -1), history: game.history.slice(0, -1)};
  }
  function preferences(input) {
    return Object.fromEntries(Object.entries(defaults).map(([key, value]) =>
      [key, typeof input?.[key] === 'boolean' ? input[key] : value]));
  }
  function serialize(game, prefs) { return JSON.stringify({version: 2, moves: game.moves, preferences: preferences(prefs)}); }
  function restore(raw) {
    if (typeof raw !== 'string' || raw.length > 2000000) throw new Error('存档无效');
    const data = JSON.parse(raw);
    if (!data || data.version !== 2 || !Array.isArray(data.moves) || data.moves.length > 10000) throw new Error('存档版本无效');
    let game = newGame();
    for (const move of data.moves) {
      if (!move || !Number.isInteger(move.from) || !Number.isInteger(move.to)) throw new Error('棋谱无效');
      game = play(game, move.from, move.to);
    }
    return {game, preferences: preferences(data.preferences)};
  }
  return {newGame, play, undo, preferences, serialize, restore};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = GameSession;
