/* 岁月史书 · Chronicles of Time — 静态演示脚本
   原生 JS，无依赖、无模块、无网络请求；所有文案内联于此，便于 file:// 直接打开。 */
(function () {
  'use strict';

  var STORE_TRIAL = 'chronicles-of-time.trial.v1';
  var STORE_LANG = 'chronicles-of-time.lang.v1';
  var MAX_CHARS = 200;
  var SPREADS = 5;

  /* ---------- 存储（localStorage 不可用时静默降级） ---------- */
  var store = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del: function (k) { try { window.localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };

  /* ---------- 界面文案 ---------- */
  var UI = {
    zh: {
      entranceLabel: '岩腔入口',
      caveLabel: '进入岩腔',
      enterHint1: '岩腔深处有光',
      enterHint2: '点击岩口，或按 Enter 进入',
      chamberLabel: '乌鲁鲁岩腔石室',
      chamberHint1: '石台上有一本书',
      chamberHint2: '点击书，或按 Enter 翻开',
      bookLabel: '岁月史书',
      coverLabel: '翻开岁月史书',
      cornerPrev: '翻回上一页',
      cornerNext: '翻到下一页',
      ribbon: 'EN',
      ribbonLabel: 'Switch to English',
      navLabel: '翻阅',
      prev: '前页',
      next: '后页',
      close: '合上书',
      keys: '← → 翻页　Esc 合上',
      portrait: '横置屏幕或放宽窗口，书页更易读。',
      indicator: function (n) { return '第 ' + n + ' / ' + SPREADS + ' 对页'; },
      spreads: ['扉页', '书之来历', '沙下之钟', '未写完的一日', '后来者须知 · 试笔之页'],
      opened: '书已翻开。',
      closed: '书已合上，回到石室。',
      entered: '你进入了岩腔。石台上有一本合着的书。',
      trialTitle: '试笔之页',
      trialOrig: '今夜无人来到岩腔。石台上的书，始终合着。',
      trialLabel: '写下一句（最多 200 字）',
      trialPlaceholder: '在此落笔……',
      write: '落笔',
      tear: '撕下页角',
      needText: '纸上还没有字。',
      inked: '墨已渗入纸面，落定了。只保存在本浏览器。',
      inkedNoStore: '墨已落定，但此浏览器不允许保存，刷新后会消失。',
      torn: '页角已撕下。此页回到原文。',
      langDone: '已切换为中文。'
    },
    en: {
      entranceLabel: 'Mouth of the hollow',
      caveLabel: 'Enter the hollow',
      enterHint1: 'There is light deep inside the rock',
      enterHint2: 'Click the opening, or press Enter',
      chamberLabel: 'Sandstone chamber inside Uluru',
      chamberHint1: 'A book lies on the stone table',
      chamberHint2: 'Click the book, or press Enter to open it',
      bookLabel: 'Chronicles of Time',
      coverLabel: 'Open the Chronicles of Time',
      cornerPrev: 'Turn back a page',
      cornerNext: 'Turn the page',
      ribbon: '中',
      ribbonLabel: '切换为中文',
      navLabel: 'Reading',
      prev: 'Back',
      next: 'Turn',
      close: 'Close the book',
      keys: '← → turn   Esc close',
      portrait: 'Turn your screen sideways or widen the window for easier reading.',
      indicator: function (n) { return 'Spread ' + n + ' of ' + SPREADS; },
      spreads: ['Title page', 'How the Book Came Here', 'The Bell Beneath the Sand', 'The Unfinished Day', 'For Those Who Come After · The Trial Page'],
      opened: 'The book is open.',
      closed: 'The book is closed. You are back in the chamber.',
      entered: 'You have entered the hollow. A closed book lies on a stone table.',
      trialTitle: 'The Trial Page',
      trialOrig: 'Tonight no one came to the hollow. The book on the stone table stayed shut.',
      trialLabel: 'Write one sentence (up to 200 characters)',
      trialPlaceholder: 'Set your pen here…',
      write: 'Set the ink',
      tear: 'Tear off the corner',
      needText: 'There is nothing on the page yet.',
      inked: 'The ink has sunk in and settled. It is kept in this browser only.',
      inkedNoStore: 'The ink has settled, but this browser will not keep it; it will vanish on reload.',
      torn: 'The corner is torn away. The page has returned to its original text.',
      langDone: 'Switched to English.'
    }
  };

  /* ---------- 版面片段 ---------- */
  var ORN = '<svg class="orn" viewBox="0 0 240 24" aria-hidden="true" focusable="false">' +
    '<path d="M6 12 H98 M142 12 H234"/><path class="solid" d="M120 3 L129 12 L120 21 L111 12 Z"/>' +
    '<circle cx="104" cy="12" r="2.4"/><circle cx="136" cy="12" r="2.4"/></svg>';

  var SEAL = '<svg class="seal" viewBox="0 0 200 200" aria-hidden="true" focusable="false">' +
    '<circle cx="100" cy="100" r="92"/><circle cx="100" cy="100" r="84"/>' +
    '<path d="M38 112 C70 100 130 104 162 92 M34 128 C76 118 128 124 166 110 M44 146 C80 138 122 142 158 130 M60 162 C90 156 118 158 142 150"/>' +
    '<path d="M100 22 V96"/><circle cx="100" cy="70" r="20"/><path d="M58 70 H80 M120 70 H142"/></svg>';

  var EMBLEM = '<svg class="emblem" viewBox="0 0 200 200" aria-hidden="true" focusable="false">' +
    '<circle cx="100" cy="100" r="88" stroke-width="2"/><circle cx="100" cy="100" r="78" stroke-width="1"/>' +
    (function () {
      var s = '';
      for (var i = 0; i < 24; i++) {
        var a = i * Math.PI / 12, r1 = i % 2 ? 80 : 76, r2 = 86;
        s += '<path stroke-width="' + (i % 2 ? 1 : 2) + '" d="M' + (100 + r1 * Math.cos(a)).toFixed(1) + ' ' + (100 + r1 * Math.sin(a)).toFixed(1) +
          ' L' + (100 + r2 * Math.cos(a)).toFixed(1) + ' ' + (100 + r2 * Math.sin(a)).toFixed(1) + '"/>';
      }
      return s;
    })() +
    '<circle cx="100" cy="100" r="58" stroke-width="1.5"/>' +
    '<path stroke-width="1.4" d="M46 108 C70 98 130 104 154 94 M44 122 C78 112 124 120 156 108 M50 136 C84 128 118 134 150 124 M62 150 C90 144 114 148 138 140"/>' +
    '<path stroke-width="1.6" d="M100 42 V100 M100 100 L82 74"/><circle cx="100" cy="100" r="3" stroke-width="2"/></svg>';

  function paras(list) {
    return list.map(function (t, i) { return '<p' + (i === 0 ? ' class="dropcap"' : '') + '>' + t + '</p>'; }).join('');
  }
  function plain(list) {
    return list.map(function (t) { return '<p>' + t + '</p>'; }).join('');
  }
  function running(t) { return '<p class="running">' + t + '</p>'; }

  /* ---------- 书页正文（原创） ---------- */
  var PAGES = {
    cover: {
      zh: '<div class="cover-art"><span class="hinge"></span><span class="frame f1"></span><span class="frame f2"></span>' + EMBLEM +
        '<span class="cover-title">岁月史书</span><span class="brass b1"></span><span class="brass b2"></span><span class="brass b3"></span><span class="brass b4"></span></div>',
      en: '<div class="cover-art"><span class="hinge"></span><span class="frame f1"></span><span class="frame f2"></span>' + EMBLEM +
        '<span class="cover-title">Chronicles of Time</span><span class="brass b1"></span><span class="brass b2"></span><span class="brass b3"></span><span class="brass b4"></span></div>'
    },
    p0: {
      zh: '<div class="page-inner ex-libris">' + SEAL + '<p class="ex-line">藏于南方大陆，赤岩之腹。</p><p class="ex-line small">凡开此卷者，所见皆为已书之事。</p></div>',
      en: '<div class="page-inner ex-libris">' + SEAL + '<p class="ex-line">Kept in the belly of the red rock, in the great southern land.</p><p class="ex-line small">Whoever opens this volume sees only what has already been written.</p></div>'
    },
    p1: {
      zh: '<div class="page-inner title-page"><p class="tp-kicker">卷　无纪年</p><h1 class="tp-title">岁月史书</h1>' + ORN +
        '<p class="tp-motto">「既已写下，便将如此。」</p><p class="tp-foot">致敬《成龙历险记》的非官方作品</p></div>',
      en: '<div class="page-inner title-page"><p class="tp-kicker">Volume · Undated</p><h1 class="tp-title">Chronicles of Time</h1>' + ORN +
        '<p class="tp-motto">“Once written, so it shall be.”</p><p class="tp-foot">An unofficial tribute to <cite>Jackie Chan Adventures</cite></p></div>'
    },
    p2: {
      zh: '<div class="page-inner"><h2 class="pg-title">书之来历</h2>' + paras([
        '此书无署名，亦无纪年。最早的记载说，它并非被人带进岩腔，而是岩腔围着它长成了今天的样子：红砂一层一层落下，风一年一年打磨，直到石头合拢成室，把书留在正中。',
        '书页不知为何物所制，似皮非皮，似纸非纸。火烤不卷，水浸不皱。翻动时的声音，像很远的地方有人在叹气。'
      ]) + '</div><span class="folio">一</span>',
      en: '<div class="page-inner"><h2 class="pg-title">How the Book Came Here</h2>' + paras([
        'The book bears no author’s name and no year. The oldest account says it was never carried into the hollow at all. The hollow grew around it instead: red sand settling layer on layer, wind polishing year after year, until the stone closed into a chamber with the book at its centre.',
        'No one knows what its leaves are made of. Not quite skin, not quite paper. Fire will not curl them; water will not wrinkle them. When a page turns, it sounds like someone sighing a long way off.'
      ]) + '</div><span class="folio">i</span>'
    },
    p3: {
      zh: '<div class="page-inner">' + running('书之来历') + plain([
        '书中所载，皆为已经发生之事，然而并非全部。凡被写进去的，便被定了下来；凡被抹去的，世上便再无人记得它曾存在。',
        '守书的规矩只有三条，刻在石台背面：不可带离，不可焚毁，不可在正文上落笔。',
        '前两条从无人违背。至于第三条，石台背面没有写违背的人后来怎样。'
      ]) + '</div><span class="folio">二</span>',
      en: '<div class="page-inner">' + running('How the Book Came Here') + plain([
        'Everything in the book has already happened, though not everything that happened is in the book. What is written into it becomes fixed. What is scraped out of it is forgotten by the whole world, as if it had never been.',
        'There are only three rules for keeping the book, cut into the back of the stone table: do not carry it away, do not burn it, do not set a pen to its text.',
        'No one has ever broken the first two. As for the third, the back of the table does not say what became of those who did.'
      ]) + '</div><span class="folio">ii</span>'
    },
    p4: {
      zh: '<div class="page-inner"><h2 class="pg-title">沙下之钟</h2>' + paras([
        '南方旷野中曾有一座小镇，镇心立着一座钟楼。钟每到整点便响，三里外的井边也听得见。',
        '某年雨季，一个过路人在此书中翻到这座钟楼的记载，看了很久，用指甲在那一行上轻轻刮了一下。',
        '第二天清晨，镇上的人醒来，只见镇心一片平整的空地，长着矮草，像是从来就是这样。'
      ]) + '</div><span class="folio">三</span>',
      en: '<div class="page-inner"><h2 class="pg-title">The Bell Beneath the Sand</h2>' + paras([
        'Out on the southern plain there was once a small town with a clock tower at its heart. Every hour the bell rang, and it could be heard at the well three miles off.',
        'One wet season a traveller found the tower recorded in this book. He looked at the line for a long time, then drew his fingernail lightly across it.',
        'Next morning the town woke to find only a level patch of ground at its centre, covered in low grass, as though it had always been so.'
      ]) + '</div><span class="folio">iii</span>'
    },
    p5: {
      zh: '<div class="page-inner">' + running('沙下之钟') + plain([
        '没有人记得那里有过钟楼。孩子们在空地上踢球，老人们坐在边上晒太阳。',
        '只是每到整点，人们会不约而同地停下手里的事，抬头望一眼空地上方，像在等什么。等了一会儿，什么也没有，便又低下头去。',
        '那一行至今还在书里，只缺了一道，像被风吹淡的沙痕。若在整点把耳朵贴在这一页上，能听见很轻的一声。'
      ]) + '<p class="p-end">· 终 ·</p></div><span class="folio">四</span>',
      en: '<div class="page-inner">' + running('The Bell Beneath the Sand') + plain([
        'No one remembered a tower ever standing there. Children kicked a ball across the empty ground; old men sat at its edge in the sun.',
        'Only, on every hour, people would stop what they were doing at the same moment and glance up at the air above the grass, as if waiting for something. When nothing came, they looked down again.',
        'The line is still in the book, missing one stroke, like a ripple of sand worn faint by wind. Lay your ear to this page on the hour, and you will hear a single, very quiet note.'
      ]) + '<p class="p-end">· end ·</p></div><span class="folio">iv</span>'
    },
    p6: {
      zh: '<div class="page-inner"><h2 class="pg-title">未写完的一日</h2>' + paras([
        '有个采赭石的女人在暴雨里躲进岩腔，借着闪电看见了这本书。书摊开着，墨迹还湿。',
        '她读到的第一句是：“她躲进岩腔，借着闪电看见了这本书。”',
        '她以为是巧合，往下读：“她以为是巧合。”她抬手去翻页，书上先写下了“她抬手去翻页”，纸页才在她指下动起来。'
      ]) + '</div><span class="folio">五</span>',
      en: '<div class="page-inner"><h2 class="pg-title">The Unfinished Day</h2>' + paras([
        'A woman who gathered ochre sheltered in the hollow from a storm, and by the lightning she saw this book. It lay open. The ink was still wet.',
        'The first line she read was: “She sheltered in the hollow, and by the lightning she saw this book.”',
        'She thought it a coincidence, and read on: “She thought it a coincidence.” She raised her hand to turn the page. The book wrote “She raised her hand to turn the page” first, and only then did the leaf move under her fingers.'
      ]) + '</div><span class="folio">v</span>'
    },
    p7: {
      zh: '<div class="page-inner">' + running('未写完的一日') + plain([
        '她不敢再读，又忍不住。字永远比她早一步，像一个走在前面、从不回头的人。',
        '读到天色将晚，最后一行写着：“雨停了，她合上书，走出岩腔，看见”——句子停在这里，后面是空白。',
        '她在石台前站了很久，终究没有合上书。据说那一页至今摊开，墨迹始终未干。'
      ]) + '<p class="p-end">· 未完 ·</p></div><span class="folio">六</span>',
      en: '<div class="page-inner">' + running('The Unfinished Day') + plain([
        'She did not dare read further, and could not stop. The words were always one step ahead of her, like someone walking in front who never looks back.',
        'By dusk she reached the last line: “The rain stopped. She closed the book, walked out of the hollow, and saw” — and there the sentence ended. After it, nothing.',
        'She stood before the stone table a long while, and in the end she did not close the book. They say that page lies open still, and the ink has never dried.'
      ]) + '<p class="p-end">· unfinished ·</p></div><span class="folio">vi</span>'
    },
    p8: {
      zh: '<div class="page-inner"><h2 class="pg-title">后来者须知</h2>' + plain([
        '正文诸页，墨已入骨，任何笔都写不上去。',
        '唯有末页留白，供后来者试笔。你写下的字会渗进纸里，但只留在你这一盏灯下，也就是这个浏览器里，不会传到别处。',
        '若是反悔，撕下页角，此页便回到原来的样子。',
        '书不会记得你撕过。'
      ]) + '</div><span class="folio">七</span>',
      en: '<div class="page-inner"><h2 class="pg-title">For Those Who Come After</h2>' + plain([
        'The ink of the text has gone into the bone of these pages. No pen will take on them.',
        'Only the last page is left bare, for those who come after to try their hand. What you write will sink into the paper, but it stays beneath your own lamp, which is to say this browser, and goes nowhere else.',
        'If you think better of it, tear off the corner, and the page will return to what it was.',
        'The book will not remember that you tore it.'
      ]) + '</div><span class="folio">vii</span>'
    }
  };

  /* 每一叶：[正面（右页）, 背面（左页）] */
  var LEAVES = [['cover', 'p0'], ['p1', 'p2'], ['p3', 'p4'], ['p5', 'p6'], ['p7', 'p8'], ['trial', 'blank']];

  /* ---------- 状态 ---------- */
  var state = {
    scene: 'entrance',   // entrance | chamber
    book: 'table',       // table | near | open
    spread: 0,           // 已翻过的叶数；0 = 合上
    busy: false,
    lang: store.get(STORE_LANG) === 'en' ? 'en' : 'zh',
    written: null
  };

  var $ = function (id) { return document.getElementById(id); };
  var body = document.body;
  var leavesWrap = $('leaves');
  var castEl = $('cast');
  var leafEls = [];
  var trial = {};
  var rmQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  function reduced() { return !!rmQuery.matches; }
  function T() { return UI[state.lang]; }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function nextFrame() { return new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); }); }

  var liveTimer = 0;
  function announce(msg) {
    var live = $('live');
    live.textContent = '';
    clearTimeout(liveTimer);
    liveTimer = setTimeout(function () { live.textContent = msg; }, 60);
  }

  /* ---------- 构建书叶 ---------- */
  function faceClass(id) {
    if (id === 'cover') return 'cover-out';
    if (id === 'p0') return 'cover-in';
    return 'page';
  }
  function buildLeaves() {
    var anchor = leavesWrap.querySelector('.gutter');
    LEAVES.forEach(function (pair, i) {
      var leaf = document.createElement('div');
      leaf.className = 'leaf' + (i === 0 ? ' cover' : '');
      var front = document.createElement('div');
      var back = document.createElement('div');
      front.className = 'face front ' + faceClass(pair[0]);
      back.className = 'face back ' + faceClass(pair[1]);
      front.setAttribute('data-page', pair[0]);
      back.setAttribute('data-page', pair[1]);
      if (pair[1] === 'blank') back.setAttribute('aria-hidden', 'true');
      leaf.appendChild(front);
      leaf.appendChild(back);
      leavesWrap.insertBefore(leaf, anchor);
      leafEls.push(leaf);
      restLeaf(i, false);
    });
    buildTrial(leafEls[5].querySelector('.front'));
  }
  function front(i) { return leafEls[i].querySelector('.front'); }
  function back(i) { return leafEls[i].querySelector('.back'); }

  function renderPages() {
    var lang = state.lang;
    leavesWrap.querySelectorAll('.face[data-page]').forEach(function (face) {
      var id = face.getAttribute('data-page');
      var data = PAGES[id];
      if (!data) return;
      face.innerHTML = id === 'p0' ? '<div class="pastedown">' + data[lang] + '</div>' : data[lang];
    });
  }

  /* ---------- 文案切换 ---------- */
  function applyUI() {
    var t = T();
    document.documentElement.lang = state.lang === 'zh' ? 'zh-Hans' : 'en';
    document.querySelectorAll('[data-t]').forEach(function (el) {
      var v = t[el.getAttribute('data-t')];
      if (typeof v === 'string') el.textContent = v;
    });
    document.querySelectorAll('[data-t-aria]').forEach(function (el) {
      var v = t[el.getAttribute('data-t-aria')];
      if (typeof v === 'string') el.setAttribute('aria-label', v);
    });
    if (trial.input) trial.input.placeholder = t.trialPlaceholder;
    updateCount();
  }
  function setLang(lang) {
    state.lang = lang;
    store.set(STORE_LANG, lang);
    renderPages();
    applyUI();
    updateUI();
    announce(T().langDone);
  }

  /* ---------- 书叶静止状态 ---------- */
  function restLeaf(i, flipped) {
    var leaf = leafEls[i];
    leaf.classList.toggle('flipped', flipped);
    leaf.style.transform = '';
    leaf.style.removeProperty('--sf');
    leaf.style.removeProperty('--sb');
    leaf.style.zIndex = flipped ? 10 + i : 100 - i;
  }

  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  /* 用 rAF 驱动的翻页：绕书脊转动 + 轻微弯折 + 正反面明暗 + 投在下层纸上的影子 */
  function flipLeaf(i, forward, dur) {
    return new Promise(function (resolve) {
      var leaf = leafEls[i];
      var start = null;
      leaf.classList.remove('flipped');
      leaf.style.zIndex = forward ? 200 + i : 200 + (LEAVES.length - i);
      function frame(now) {
        if (start === null) start = now;
        var t = Math.min(1, (now - start) / dur);
        var e = ease(t);
        var p = forward ? e : 1 - e;           // 0 = 在右，1 = 在左
        var angle = -180 * p;
        var bend = Math.sin(Math.PI * p);
        var skew = (forward ? -1 : 1) * bend * 0.9;
        leaf.style.transform = 'rotateY(' + angle.toFixed(2) + 'deg) skewY(' + skew.toFixed(2) + 'deg)';
        leaf.style.setProperty('--sf', (Math.min(1, p * 1.4) * 0.85).toFixed(3));
        leaf.style.setProperty('--sb', (Math.min(1, (1 - p) * 1.4) * 0.85).toFixed(3));
        drawCast(p, bend, i === 0);
        if (t < 1) {
          requestAnimationFrame(frame);
        } else {
          castEl.style.background = 'none';
          restLeaf(i, forward);
          resolve();
        }
      }
      requestAnimationFrame(frame);
    });
  }
  function drawCast(p, bend, isCover) {
    if (isCover && state.book !== 'open') { castEl.style.background = 'none'; return; }
    var x = 50 + 50 * Math.cos(Math.PI * p);   // 翻动叶外缘在整对页中的横向位置（%）
    var a = (0.42 * bend).toFixed(3);
    var w = 4 + 10 * bend;
    if (p < 0.5) {
      castEl.style.background = 'linear-gradient(to right, transparent ' + x.toFixed(2) + '%, rgba(20,8,0,' + a + ') ' + x.toFixed(2) + '%, transparent ' + Math.min(100, x + w).toFixed(2) + '%)';
    } else {
      castEl.style.background = 'linear-gradient(to left, transparent ' + (100 - x).toFixed(2) + '%, rgba(20,8,0,' + a + ') ' + (100 - x).toFixed(2) + '%, transparent ' + Math.min(100, 100 - x + w).toFixed(2) + '%)';
    }
  }

  /* 减少动态：淡出 → 瞬间改变 → 淡入 */
  function fadeSwap(fn) {
    body.classList.add('rm-fade');
    return wait(400).then(function () {
      fn();
      return nextFrame();
    }).then(function () {
      body.classList.remove('rm-fade');
      return wait(400);
    });
  }

  function setBook(s) {
    state.book = s;
    body.classList.remove('book-table', 'book-near', 'book-open');
    body.classList.add('book-' + s);
  }

  /* ---------- 焦点与可见性 ---------- */
  function updateUI() {
    var open = state.book === 'open' && state.spread >= 1;
    var s = state.spread;
    leafEls.forEach(function (leaf, i) {
      var f = front(i), b = back(i);
      var fVisible = open && i === s;
      var bVisible = open && i === s - 1;
      f.inert = !fVisible;
      b.inert = !bVisible;
    });
    $('corner-prev').hidden = !open || s <= 1;
    $('corner-next').hidden = !open || s >= SPREADS;
    $('btn-prev').disabled = !open || s <= 1;
    $('btn-next').disabled = !open || s >= SPREADS;
    $('indicator').textContent = T().indicator(Math.max(1, s));
    $('controls').inert = !open;
    $('ribbon').inert = !open;
    $('cover-hit').inert = !(state.scene === 'chamber' && state.book === 'table');
    $('entrance').inert = state.scene !== 'entrance';
    $('chamber').inert = state.scene !== 'chamber';
  }
  function announceSpread() {
    announce(T().indicator(state.spread) + '：' + T().spreads[state.spread - 1]);
  }
  function focusEl(el) { if (el && !el.disabled) { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } } }

  /* ---------- 入洞 ---------- */
  function enterCave() {
    if (state.busy || state.scene !== 'entrance') return;
    state.busy = true;
    var go = function () {
      state.scene = 'chamber';
      body.classList.remove('scene-entrance', 'entering');
      body.classList.add('scene-chamber');
      startDust();
      updateUI();
      focusEl($('cover-hit'));
      announce(T().entered);
      return wait(reduced() ? 1400 : 1800);
    };
    var p;
    if (reduced()) {
      p = go();
    } else {
      body.classList.add('entering');
      p = wait(1250).then(go);
    }
    p.then(function () { state.busy = false; });
  }

  /* ---------- 开书 ---------- */
  function openBook() {
    if (state.busy || state.scene !== 'chamber' || state.book !== 'table') return;
    state.busy = true;
    var p;
    if (reduced()) {
      p = fadeSwap(function () { setBook('open'); restLeaf(0, true); state.spread = 1; updateUI(); });
    } else {
      setBook('near');
      updateUI();
      p = wait(1300).then(function () {
        setBook('open');
        return flipLeaf(0, true, 1500);
      }).then(function () { state.spread = 1; });
    }
    p.then(function () {
      state.busy = false;
      updateUI();
      announce(T().opened + ' ' + T().indicator(1) + '：' + T().spreads[0]);
      focusEl($('btn-next'));
    });
  }

  /* ---------- 翻页 ---------- */
  function turn(dir) {
    if (state.busy || state.book !== 'open') return;
    var s = state.spread;
    if (dir > 0 && s >= SPREADS) return;
    if (dir < 0 && s <= 1) return;
    state.busy = true;
    var active = document.activeElement;
    var p;
    if (reduced()) {
      p = fadeSwap(function () {
        if (dir > 0) restLeaf(s, true); else restLeaf(s - 1, false);
        state.spread = s + dir;
        updateUI();
      });
    } else {
      p = (dir > 0 ? flipLeaf(s, true, 1050) : flipLeaf(s - 1, false, 1050)).then(function () { state.spread = s + dir; });
    }
    p.then(function () {
      state.busy = false;
      updateUI();
      announceSpread();
      // 焦点若落在已隐藏的页角上，移到对应的按钮
      if (!active || active === document.body || active.closest('.leaf') || (active.classList && active.classList.contains('corner') && active.hidden)) {
        focusEl(dir > 0 ? ($('btn-next').disabled ? $('btn-prev') : $('btn-next')) : ($('btn-prev').disabled ? $('btn-next') : $('btn-prev')));
      } else if (active.disabled) {
        focusEl(dir > 0 ? $('btn-prev') : $('btn-next'));
      }
    });
  }

  /* ---------- 合书 ---------- */
  function closeBook() {
    if (state.busy || state.book !== 'open') return;
    state.busy = true;
    var s = state.spread;
    leafEls.forEach(function (l, i) { front(i).inert = true; back(i).inert = true; });
    $('controls').inert = true;
    $('corner-prev').hidden = true;
    $('corner-next').hidden = true;
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    var p;
    if (reduced()) {
      p = fadeSwap(function () {
        for (var i = 0; i < LEAVES.length; i++) restLeaf(i, false);
        state.spread = 0;
        setBook('table');
      });
    } else {
      var riffles = [];
      for (var k = s - 1, d = 0; k >= 1; k--, d += 120) {
        (function (k, d) { riffles.push(wait(d).then(function () { return flipLeaf(k, false, 560); })); })(k, d);
      }
      p = Promise.all(riffles).then(function () {
        setBook('near');
        return flipLeaf(0, false, 1300);
      }).then(function () {
        state.spread = 0;
        setBook('table');
        return wait(1300);
      });
    }
    p.then(function () {
      state.busy = false;
      body.classList.add('returned');
      updateUI();
      announce(T().closed);
      focusEl($('cover-hit'));
    });
  }

  /* ---------- 试笔页 ---------- */
  function buildTrial(face) {
    face.innerHTML =
      '<div class="page-inner trial">' +
        '<h2 class="pg-title" data-t="trialTitle"></h2>' +
        '<div class="trial-record" id="trial-record">' +
          '<p class="trial-orig" id="trial-orig" data-t="trialOrig"></p>' +
          '<p class="trial-written" id="trial-written" hidden></p>' +
        '</div>' +
        '<div class="trial-form">' +
          '<label class="trial-label" for="quill" data-t="trialLabel"></label>' +
          '<textarea id="quill" rows="2" maxlength="' + MAX_CHARS + '" spellcheck="false" autocomplete="off" aria-describedby="quill-count"></textarea>' +
          '<div class="trial-row"><span class="trial-count" id="quill-count"></span>' +
          '<button type="button" class="ink-btn" id="ink-btn" data-t="write"></button></div>' +
        '</div>' +
      '</div>' +
      '<button type="button" class="tear-btn" id="tear-btn"><span data-t="tear"></span></button>';
    trial.face = face;
    trial.orig = face.querySelector('#trial-orig');
    trial.written = face.querySelector('#trial-written');
    trial.input = face.querySelector('#quill');
    trial.count = face.querySelector('#quill-count');
    trial.ink = face.querySelector('#ink-btn');
    trial.tear = face.querySelector('#tear-btn');

    trial.input.addEventListener('input', function () {
      var chars = Array.from(trial.input.value);
      if (chars.length > MAX_CHARS) trial.input.value = chars.slice(0, MAX_CHARS).join('');
      updateCount();
    });
    trial.input.addEventListener('keydown', function (e) {
      // 只写一句：Enter 直接落笔，不换行（输入法组字时不拦截）
      if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); writeLine(); }
    });
    trial.ink.addEventListener('click', writeLine);
    trial.tear.addEventListener('click', tearCorner);

    var saved = null;
    try { saved = JSON.parse(store.get(STORE_TRIAL) || 'null'); } catch (e) { saved = null; }
    if (saved && typeof saved.text === 'string' && saved.text.trim()) {
      showWritten(Array.from(saved.text).slice(0, MAX_CHARS).join(''), false);
    } else {
      trial.tear.disabled = true;
    }
  }
  function updateCount() {
    if (!trial.count) return;
    trial.count.textContent = Array.from(trial.input.value).length + ' / ' + MAX_CHARS;
  }
  function writeLine() {
    var text = Array.from(trial.input.value.replace(/\s+/g, ' ').trim()).slice(0, MAX_CHARS).join('');
    if (!text) { announce(T().needText); focusEl(trial.input); return; }
    var ok = store.set(STORE_TRIAL, JSON.stringify({ text: text, at: Date.now() }));
    showWritten(text, true);
    trial.input.value = '';
    updateCount();
    announce(ok ? T().inked : T().inkedNoStore);
  }
  function showWritten(text, animate) {
    var w = trial.written;
    state.written = text;
    w.textContent = '';
    w.classList.remove('seeping');
    var chars = Array.from(text);
    if (animate) {
      var step = Math.min(55, 2600 / Math.max(1, chars.length));
      chars.forEach(function (c, i) {
        var span = document.createElement('span');
        span.className = 'ch';
        span.style.setProperty('--d', Math.round(i * step) + 'ms');
        span.textContent = c;
        w.appendChild(span);
      });
      void w.offsetWidth;
      w.classList.add('seeping');
    } else {
      w.textContent = text;
    }
    trial.orig.classList.add('gone');
    var reveal = function () { trial.orig.hidden = true; w.hidden = false; };
    if (animate && !reduced()) {
      w.hidden = false;
      w.style.position = 'absolute'; w.style.left = '.1em'; w.style.right = '.1em'; w.style.top = '.2em';
      setTimeout(function () { w.style.position = ''; w.style.left = ''; w.style.right = ''; w.style.top = ''; reveal(); }, 1200);
    } else {
      reveal();
    }
    trial.tear.disabled = false;
  }
  function tearCorner() {
    if (!state.written) return;
    store.del(STORE_TRIAL);
    state.written = null;
    var face = trial.face;
    var hole = document.createElement('div');
    hole.className = 'torn-hole';
    var piece = document.createElement('div');
    piece.className = 'torn-piece';
    face.appendChild(hole);
    face.appendChild(piece);
    setTimeout(function () { piece.remove(); }, 1700);
    setTimeout(function () { hole.remove(); }, 3500);

    trial.written.hidden = true;
    trial.written.textContent = '';
    trial.written.classList.remove('seeping');
    trial.orig.hidden = false;
    trial.orig.classList.add('gone');
    void trial.orig.offsetWidth;
    setTimeout(function () { trial.orig.classList.remove('gone'); }, reduced() ? 50 : 900);
    trial.input.value = '';
    updateCount();
    trial.tear.disabled = true;
    focusEl(trial.input);
    announce(T().torn);
  }

  /* ---------- 浮尘 ---------- */
  var dust = { running: false };
  function initDust() {
    var c = $('dust');
    var ctx = c.getContext('2d');
    var W = 0, H = 0, parts = [], last = 0;
    // 光柱在 SVG viewBox(1600×1000) 中的几何：上口与地面
    var SY0 = 132, SY1 = 785, SX0 = 463, SX1 = 800, SW0 = 62, SW1 = 190;
    var map = { s: 1, ox: 0, oy: 0 };

    function resize() {
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      W = window.innerWidth; H = window.innerHeight;
      c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      map.s = Math.max(W / 1600, H / 1000);
      map.ox = (W - 1600 * map.s) / 2;
      map.oy = (H - 1000 * map.s) / 2;
      var n = Math.round(Math.min(320, (W * H) / 5200));
      parts = [];
      for (var i = 0; i < n; i++) parts.push(spawn(true));
      if (reduced()) draw(0, 0);
    }
    function spawn(anywhere) {
      return {
        x: Math.random() * W,
        y: anywhere ? Math.random() * H : -5,
        z: Math.random(),
        vx: (Math.random() - 0.5) * 0.012,
        vy: 0.002 + Math.random() * 0.01,
        ph: Math.random() * Math.PI * 2,
        tw: 0.4 + Math.random() * 1.4
      };
    }
    function inShaft(x, y) {
      var vx = (x - map.ox) / map.s, vy = (y - map.oy) / map.s;
      var t = (vy - SY0) / (SY1 - SY0);
      if (t < -0.02 || t > 1.05) return 0;
      t = Math.max(0, Math.min(1, t));
      var cx = SX0 + (SX1 - SX0) * t, hw = SW0 + (SW1 - SW0) * t;
      var d = Math.abs(vx - cx) / hw;
      if (d >= 1.25) return 0;
      return Math.pow(1 - d / 1.25, 1.5) * (1 - t * 0.45);
    }
    function draw(now, dt) {
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        if (dt) {
          p.vx += (Math.random() - 0.5) * 0.0016;
          p.vx = Math.max(-0.03, Math.min(0.03, p.vx));
          p.vy += (Math.random() - 0.5) * 0.0012;
          p.vy = Math.max(-0.006, Math.min(0.02, p.vy));
          p.x += p.vx * dt; p.y += p.vy * dt;
          if (p.y > H + 5 || p.x < -10 || p.x > W + 10 || p.y < -10) { parts[i] = spawn(false); parts[i].x = Math.random() * W; parts[i].y = Math.random() < 0.5 ? -5 : Math.random() * H; continue; }
        }
        var lit = inShaft(p.x, p.y);
        var tw = 0.55 + 0.45 * Math.sin(now * 0.001 * p.tw + p.ph);
        var a = (0.035 + lit * 0.75) * tw * (0.45 + p.z * 0.55);
        if (a < 0.01) continue;
        var r = 0.5 + p.z * 1.5 + lit * 0.4;
        ctx.fillStyle = 'rgba(255,' + (200 + Math.round(30 * lit)) + ',' + (150 + Math.round(40 * lit)) + ',' + a.toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    function loop(now) {
      if (!dust.running) return;
      var dt = last ? Math.min(64, now - last) : 16;
      last = now;
      if (!reduced()) draw(now, dt);
      requestAnimationFrame(loop);
    }
    window.addEventListener('resize', resize);
    resize();
    dust.start = function () {
      if (dust.running) return;
      dust.running = true;
      last = 0;
      if (reduced()) draw(0, 0);
      requestAnimationFrame(loop);
    };
    if (rmQuery.addEventListener) rmQuery.addEventListener('change', function () { draw(0, 0); });
  }
  function startDust() { if (dust.start) dust.start(); }

  /* ---------- 入口星空（静态、固定种子） ---------- */
  function buildStars() {
    var g = $('stars');
    if (!g) return;
    var seed = 20261031;
    var rnd = function () { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    var ns = 'http://www.w3.org/2000/svg';
    for (var i = 0; i < 110; i++) {
      var x = rnd() * 1600, y = rnd() * 330;
      var c = document.createElementNS(ns, 'circle');
      c.setAttribute('cx', x.toFixed(1));
      c.setAttribute('cy', y.toFixed(1));
      c.setAttribute('r', (0.5 + rnd() * 1.1).toFixed(2));
      c.setAttribute('fill', rnd() < 0.2 ? '#ffe2c4' : '#cdd6ff');
      c.setAttribute('opacity', (0.15 + rnd() * 0.5 * (1 - y / 400)).toFixed(2));
      g.appendChild(c);
    }
  }

  /* ---------- 事件 ---------- */
  function isControl(el) {
    if (!el || !el.tagName) return false;
    var tag = el.tagName;
    return tag === 'BUTTON' || tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'A' || tag === 'SELECT';
  }
  function bind() {
    $('cave-btn').addEventListener('click', enterCave);
    $('cover-hit').addEventListener('click', openBook);
    $('btn-next').addEventListener('click', function () { turn(1); });
    $('btn-prev').addEventListener('click', function () { turn(-1); });
    $('corner-next').addEventListener('click', function () { turn(1); });
    $('corner-prev').addEventListener('click', function () { turn(-1); });
    $('btn-close').addEventListener('click', closeBook);
    $('ribbon').addEventListener('click', function () { setLang(state.lang === 'zh' ? 'en' : 'zh'); });

    document.addEventListener('keydown', function (e) {
      var t = e.target;
      var typing = t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT');
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (state.scene === 'entrance') {
        if (e.key === 'Enter' && !isControl(t)) { e.preventDefault(); enterCave(); }
        return;
      }
      if (state.book === 'table') {
        if (e.key === 'Enter' && !isControl(t)) { e.preventDefault(); openBook(); }
        return;
      }
      if (state.book === 'open' && !typing) {
        if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); turn(1); }
        else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); turn(-1); }
        else if (e.key === 'Escape') { e.preventDefault(); closeBook(); }
      }
    });
  }

  /* ---------- 启动 ---------- */
  buildLeaves();
  renderPages();
  applyUI();
  buildStars();
  initDust();
  bind();
  updateUI();
  // 不主动抢焦点：页面上直接按 Enter 即可进入，Tab 可聚焦岩口

  // 供自动化验证使用的只读状态
  window.__chronicles = { state: state };
})();
