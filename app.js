'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const X = Xiangqi, S = GameSession, KEY = 'xiangqi:game:v2';
  const names = {r:{K:'帅',A:'仕',E:'相',H:'马',R:'车',C:'炮',P:'兵'},b:{K:'将',A:'士',E:'象',H:'马',R:'车',C:'炮',P:'卒'}};
  const side = s => s === 'r' ? '红方' : '黑方';
  const coord = i => 'ABCDEFGHI'[i % 9] + (10 - Math.floor(i / 9));
  let game = S.newGame(), prefs = S.preferences(), selected = null, targets = [], status;
  let saveError = false, restored = false;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const saved = S.restore(raw); game = saved.game; prefs = saved.preferences; restored = game.moves.length > 0; }
  } catch (error) {
    saveError = true;
    $('notice').textContent = '存档不可用，已安全打开新棋局。';
  }
  function save() {
    try { localStorage.setItem(KEY, S.serialize(game, prefs)); saveError = false; }
    catch (error) { saveError = true; $('notice').textContent = '暂时无法保存，请勿关闭当前棋局。'; }
    $('save-state').textContent = saveError ? '保存不可用' : '✓ 棋局已保存';
  }
  let audio;
  function sound(capture) {
    if (!prefs.sound) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      audio ||= new Audio();
      if (audio.state === 'suspended') audio.resume().catch(() => {});
      const osc = audio.createOscillator(), gain = audio.createGain(), time = audio.currentTime;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(capture ? 410 : 600, time);
      osc.frequency.exponentialRampToValueAtTime(150, time + .09);
      gain.gain.setValueAtTime(.08, time);
      gain.gain.exponentialRampToValueAtTime(.001, time + .12);
      osc.connect(gain); gain.connect(audio.destination); osc.start(time); osc.stop(time + .13);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    } catch (error) { /* Sound is optional; chess never depends on audio availability. */ }
  }
  function grid() {
    let paths = '';
    for (let y = 0; y < 10; y++) paths += '<path d="M50 ' + (50+y*100) + 'H850"/>';
    for (let x = 0; x < 9; x++) {
      const xx = 50+x*100;
      paths += '<path d="M' + xx + ' 50V' + (x === 0 || x === 8 ? '950' : '450M'+xx+' 550V950') + '"/>';
    }
    paths += '<path d="M350 50L550 250M550 50L350 250M350 750L550 950M550 750L350 950"/>';
    for (const y of [2,3,6,7]) for (const x of (y===2||y===7?[1,7]:[0,2,4,6,8])) {
      const a = 50+x*100, b = 50+y*100;
      for (const dx of [-1,1]) if (x+dx >= 0 && x+dx <= 8)
        paths += '<path d="M'+(a+dx*9)+' '+(b-23)+'V'+(b-9)+'H'+(a+dx*23)+'M'+(a+dx*9)+' '+(b+23)+'V'+(b+9)+'H'+(a+dx*23)+'"/>';
    }
    return '<svg viewBox="0 0 900 1000" aria-hidden="true"><g stroke="var(--grid)" stroke-width="2" fill="none">'+paths+'</g><g fill="var(--grid)" font-family="serif" font-size="34" letter-spacing="18"><text x="210" y="513">楚河</text><text x="575" y="513">汉界</text></g></svg>';
  }
  $('board').innerHTML = grid();
  let renderedFlip = false;
  const squares = Array.from({length:90}, (_,i) => {
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'square';
    const span = document.createElement('span'); span.setAttribute('aria-hidden','true'); btn.append(span);
    btn.onclick = () => click(i);
    btn.onkeydown = event => {
      const step = {ArrowLeft:-1, ArrowRight:1, ArrowUp:-9, ArrowDown:9}[event.key];
      if (!step) return;
      const display = prefs.flipped ? 89-i : i, dest = display+step;
      event.preventDefault();
      if (dest < 0 || dest >= 90 || (Math.abs(step) === 1 && Math.floor(dest/9) !== Math.floor(display/9))) return;
      squares[prefs.flipped ? 89-dest : dest].focus({preventScroll:true});
    };
    $('board').append(btn); return btn;
  });
  function lost(s) {
    const total = {R:2,H:2,E:2,A:2,C:2,P:5};
    game.board.forEach(p => { if (p?.s === s && p.t !== 'K') total[p.t]--; });
    return Object.entries(total).map(([t,n]) => names[s][t].repeat(Math.max(0,n))).join('');
  }
  function playerRow(element, s, bottom) {
    element.className = 'player-row' + (bottom?' bottom':'') + (!status.over && game.turn===s?' active':'');
    element.replaceChildren();
    const label = document.createElement('span'); label.className = 'player-name';
    const dot = document.createElement('i'); dot.className = 'side-dot' + (s==='r'?' red':''); dot.setAttribute('aria-hidden','true');
    label.append(dot, document.createTextNode(side(s)));
    const captured = document.createElement('span'); captured.className = 'lost-pieces'; captured.textContent = lost(s);
    captured.setAttribute('aria-label', side(s) + '已失棋子：' + (captured.textContent || '无'));
    element.append(label,captured);
  }
  function render() {
    status = X.state(game.board, game.turn);
    for (let i = 0; i < 90; i++) {
      const btn = squares[i], p = game.board[i], display = prefs.flipped ? 89-i : i;
      const isTarget = prefs.hints && targets.includes(i);
      btn.style.left = ((display%9+.5)/9*100)+'%';
      btn.style.top = ((Math.floor(display/9)+.5)/10*100)+'%';
      btn.style.order = display;
      btn.className = 'square' + (selected===i?' selected':'') + (isTarget?p?' legal capture':' legal':'') +
        (game.last?.includes(i)?' last':'') + (p?.t==='K' && p.s===game.turn && status.checked?' checked':'');
      btn.setAttribute('aria-label',coord(i)+'，'+(p?side(p.s)+names[p.s][p.t]:'空位')+(isTarget?'，可走位置':''));
      btn.setAttribute('aria-pressed',String(selected===i));
      const span = btn.firstElementChild;
      span.className = p?'piece'+(p.s==='r'?' red':'')+(prefs.faceToFace && p.s===(prefs.flipped?'r':'b')?' facing-away':''):'';
      span.textContent = p?names[p.s][p.t]:'';
    }
    // Match visual order when navigating the board with Tab or assistive technology.
    if (renderedFlip !== prefs.flipped) {
      const focused = squares.indexOf(document.activeElement);
      [...squares].sort((a,b)=>Number(a.style.order)-Number(b.style.order)).forEach(btn=>$('board').append(btn));
      renderedFlip = prefs.flipped;
      if (focused >= 0) squares[focused].focus({preventScroll:true});
    }
    const winner = status.winner;
    $('turn-piece').textContent = status.over ? names[winner].K : names[game.turn].K;
    $('turn-piece').className = 'turn-piece' + ((winner || game.turn)==='r'?' red':'');
    $('turn-count').textContent = status.over ? '本局结束 · 共 '+game.moves.length+' 手' : '同屏双人 · 第 '+(game.moves.length+1)+' 手';
    $('status').textContent = status.over ? side(winner)+'获胜 · '+(status.reason==='Checkmate'?'将死':'困毙') : side(game.turn)+(game.moves.length===0?'先行':'走棋');
    $('check-badge').hidden = !status.checked || status.over;
    $('hint').textContent = status.over ? '好棋，下局再会。可悔棋复盘，或开始新对局。' :
      status.checked ? '将军！请选择能解除将军的走法。' :
      selected!==null ? '已选中'+names[game.turn][game.board[selected].t]+' · '+targets.length+' 个可走位置' :
      '点击己方棋子'+(prefs.hints?'，查看可走位置。':'，再点击目标位置。');
    $('undo').disabled = !game.moves.length;
    $('flip').setAttribute('aria-pressed',String(prefs.flipped));
    $('save-state').textContent = saveError?'保存不可用':game.moves.length?'✓ 棋局已保存':'自动保存';
    playerRow($('top-player'),prefs.flipped?'r':'b',false);
    playerRow($('bottom-player'),prefs.flipped?'b':'r',true);
    $('move-total').textContent = game.moves.length+' 手';
    $('face-to-face').checked = prefs.faceToFace;
    $('show-hints').checked = prefs.hints;
    $('play-sound').checked = prefs.sound;
    renderRecord();
  }
  function renderRecord() {
    $('moves').replaceChildren();
    if (!game.moves.length) {
      const li = document.createElement('li'); li.className = 'empty-record';
      li.textContent = '棋盘已就绪，故事从第一手开始。'; $('moves').append(li); return;
    }
    game.moves.forEach((move,i) => {
      const before = game.history[i].board, p = before[move.from], li = document.createElement('li');
      const num = document.createElement('span'); num.className = 'move-number'; num.textContent = String(i+1).padStart(2,'0');
      const name = document.createElement('span'); name.className = 'move-side'+(p.s==='r'?' red':''); name.textContent = side(p.s)+' · '+names[p.s][p.t];
      const position = document.createElement('span'); position.className = 'move-coordinates'; position.textContent = coord(move.from)+' → '+coord(move.to)+(before[move.to]?' ×':'');
      li.append(num,name,position); $('moves').append(li);
    });
    $('moves').scrollTop = $('moves').scrollHeight;
  }
  function click(i) {
    $('notice').textContent = '';
    if (status.over) { $('notice').textContent = '本局已结束，可以悔棋或开始新局。'; return; }
    if (selected!==null && targets.includes(i)) {
      const capture = Boolean(game.board[i]);
      game = S.play(game,selected,i); selected = null; targets = [];
      save(); sound(capture);
    } else if (game.board[i]?.s === game.turn) {
      selected = selected===i?null:i; targets = selected===null?[]:X.legal(game.board,i);
      if (selected!==null && !targets.length) $('notice').textContent = '这枚棋子暂时没有合法走法。';
    } else if (selected!==null) {
      $('notice').textContent = '此处不能落子，请选择其他位置。';
    } else {
      $('notice').textContent = '现在轮到'+side(game.turn)+'，请先选择己方棋子。';
    }
    render();
  }
  function reset() {
    game = S.newGame(); selected = null; targets = []; $('notice').textContent = '';
    save(); render();
  }
  $('undo').onclick = () => {
    if (!game.moves.length) return;
    game = S.undo(game); selected = null; targets = []; $('notice').textContent = '已退回一手。';
    save(); render();
  };
  $('flip').onclick = () => { prefs.flipped = !prefs.flipped; save(); render(); };
  $('restart').onclick = () => { if (!game.moves.length) reset(); else $('restart-dialog').showModal(); };
  $('confirm-restart').onclick = () => { $('restart-dialog').close(); reset(); };
  $('cancel-restart').onclick = () => $('restart-dialog').close();
  $('settings').onclick = () => $('settings-dialog').showModal();
  document.querySelectorAll('[data-close]').forEach(btn => btn.onclick = () => btn.closest('dialog').close());
  for (const [id,key] of [['face-to-face','faceToFace'],['show-hints','hints'],['play-sound','sound']]) {
    $(id).onchange = event => { prefs[key] = event.target.checked; save(); render(); };
  }
  if (restored) $('notice').textContent = '已续上次棋局，轮到'+side(game.turn)+'。';
  render();
})();
