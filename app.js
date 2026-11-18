/* 岁月史书 · Chronicles of Time — 改写历史的古书
   原生 JS，无依赖、无模块、无网络请求；所有文案内联，便于 file:// 直接打开。

   核心循环：选一件事 → 点朱笔圈出之处 → 择一种写法 → 按住落笔（书会抵抗）
            → 连锁反应写出 → 书收走一样东西（文字、结尾或岩腔的光）→ 记入改写记录。 */
(function () {
  'use strict';

  var STORE = 'chronicles-of-time.ledger.v2';
  var STORE_LANG = 'chronicles-of-time.lang.v1';
  var SPREADS = 5;
  var INK = 3;

  var store = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del: function (k) { try { window.localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmt(s, o) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return o && o[k] != null ? o[k] : m; }); }

  /* =====================================================================
     史事（原创）。paras 中的数字是可改之处（节点）的序号。
     改写某一处后，该处之后的原文全部被冲掉，由连锁反应接续。
     ===================================================================== */
  var EVENTS = [
    {
      num: { zh: '壹', en: 'I' },
      title: { zh: '沙下之钟', en: 'The Bell Beneath the Sand' },
      paras: {
        zh: [['南方旷野中有一座小镇，镇心立着钟楼。钟每到整点便响，三里外的井边也听得见。某年雨季，', 0, '。第二天清晨，镇心只剩一片平整的矮草。'], ['此后，', 1, '。']],
        en: [['Out on the southern plain stood a small town with a clock tower at its heart. Every hour the bell rang, and it carried to the well three miles off. One wet season, ', 0, '. By morning the centre of town was a level patch of low grass.'], ['From then on, ', 1, '.']]
      },
      tail: { zh: '孩子们在空地上踢球，没有人记得那里有过什么。', en: 'Children kick a ball across the grass now, and no one remembers that anything stood there.' },
      nodes: [
        {
          orig: { zh: '一个过路人在此书中刮去了钟楼那一行', en: 'a traveller scraped the tower’s line out of this book' },
          alts: [
            { t: { zh: '过路人的指甲停在半空，没有落下', en: 'the traveller’s fingernail stopped in mid-air and never touched the page' },
              chain: { zh: ['钟楼留了下来，钟声照常响过三里外的井。', '过路人走出岩腔时，影子没有跟上他。', '他在旷野里找了一辈子自己的影子。'],
                       en: ['The tower stayed, and the bell still reached the well three miles off.', 'When the traveller left the hollow, his shadow did not follow him.', 'He spent the rest of his life on the plain, looking for it.'] } },
            { t: { zh: '过路人刮去的不是钟楼，而是那口井', en: 'the traveller scraped out the well instead of the tower' },
              chain: { zh: ['钟楼还在，三里外的井却从没存在过。', '没有水，镇子一年后就搬空了。', '钟独自响了四十年，对着空房子报时。'],
                       en: ['The tower stood, but the well three miles off had never existed.', 'Without water, the town emptied within a year.', 'The bell rang on for forty years, telling the hour to empty houses.'] } }
          ]
        },
        {
          orig: { zh: '每到整点，镇上的人都会抬头望一眼空处，像在等什么', en: 'on every hour the townsfolk glanced up at the empty air, as if waiting' },
          alts: [
            { t: { zh: '镇上的人忘得干干净净，再没有人抬头', en: 'the townsfolk forgot it completely, and no one looked up again' },
              chain: { zh: ['整点成了寻常的时刻。', '空地上方的那一小块天，慢慢变成了别处的颜色。', '除了这本书，世上再没有任何东西记得那座钟楼。'],
                       en: ['The hour became an ordinary hour.', 'The small patch of sky above the grass slowly turned the colour of somewhere else.', 'Nothing in the world but this book remembers the tower now.'] } },
            { t: { zh: '镇上有一个孩子，真的在整点听见了钟声', en: 'one child in the town truly heard the bell on the hour' },
              chain: { zh: ['她说空地上方有钟在响，没有人信她。', '她每个整点都去空地上等。', '第七年，她在整点走进空地，没有出来。镇心又有了一座钟楼。'],
                       en: ['She said a bell was ringing above the empty ground. No one believed her.', 'She went and waited there on every hour.', 'In the seventh year she walked onto the grass on the hour and did not come back. The town had a clock tower again.'] } }
          ]
        }
      ]
    },
    {
      num: { zh: '贰', en: 'II' },
      title: { zh: '未写完的一日', en: 'The Unfinished Day' },
      paras: {
        zh: [['采赭石的女人在暴雨里躲进岩腔，看见这本书摊开着，墨迹还湿。她读到的每一句，都比她早一步发生。读到天色将晚，', 0, '。'], [1, '，那一页至今未干。']],
        en: [['A woman who gathered ochre sheltered in the hollow from a storm and found this book lying open, its ink still wet. Every line she read happened a moment before she did it. Near dusk, ', 0, '.'], [1, ', and that page has never dried.']]
      },
      tail: { zh: '据说在雨夜，还能听见有人在岩腔里翻页。', en: 'On rainy nights, they say, someone can still be heard turning pages in the hollow.' },
      nodes: [
        {
          orig: { zh: '最后一行停在“她合上书，走出岩腔，看见”', en: 'the last line stopped at “She closed the book, walked out, and saw”' },
          alts: [
            { t: { zh: '最后一行写完了：她看见了雨停后的旷野', en: 'the last line was finished: she saw the plain after the rain' },
              chain: { zh: ['句子写完，墨立刻干了。', '她合上书，走出岩腔，看见雨停后的旷野。', '此后她做的每件事都早已写在书里，她再没能做一件书上没有的事。'],
                       en: ['The sentence ended, and the ink dried at once.', 'She closed the book, walked out, and saw the plain after the rain.', 'From then on, everything she did was already written. She never again did a thing the book had not.'] } },
            { t: { zh: '最后一行写着：她看见了正在读这一行的人', en: 'the last line read: she saw whoever is reading this line' },
              chain: { zh: ['她抬起头，望向书外。', '她站在石台前，等着读到她的人翻页。', '此后每个打开这本书的人，都会觉得身后有人在读同一页。'],
                       en: ['She looked up, out of the book.', 'She stood at the stone table, waiting for whoever was reading her to turn the page.', 'Since then, everyone who opens this book feels someone behind them, reading the same page.'] } }
          ]
        },
        {
          orig: { zh: '她终究没有合上书', en: 'In the end she did not close the book' },
          alts: [
            { t: { zh: '她终究合上了书', en: 'In the end she closed the book' },
              chain: { zh: ['那一页的墨终于干了。', '她走出岩腔，再没有人见过她。', '岩腔外多了一块赭红色的石头，形状像一个弯着腰的人。'],
                       en: ['The ink on that page finally dried.', 'She walked out of the hollow, and no one saw her again.', 'Outside the hollow there is now an ochre-red stone shaped like a person bent over.'] } },
            { t: { zh: '她终究撕下了那一页', en: 'In the end she tore the page out' },
              chain: { zh: ['撕口处渗出赭红色的墨，像伤口。', '她带着那一页走了。纸上的字一直在写，写的是她。', '书少了一页。从那天起，它总想从别人那里补回来。'],
                       en: ['Ochre-red ink seeped from the torn edge like a wound.', 'She carried the page away. The words on it kept writing, and they wrote about her.', 'The book was a page short. Ever since, it has tried to take one back from someone else.'] } }
          ]
        }
      ]
    },
    {
      num: { zh: '叁', en: 'III' },
      title: { zh: '无名之河', en: 'The River With No Name' },
      paras: {
        zh: [['很久以前，一条河从赤岩脚下流过，两岸的人靠一只渡船往来。某年大旱，', 0, '。当夜降雨，河水暴涨。'], [1, '，从此这条河没有名字。']],
        en: [['Long ago a river ran at the foot of the red rock, and the people of both banks crossed it on a single ferry. In a year of drought, ', 0, '. That night it rained, and the river rose.'], [1, ', and since then the river has had no name.']]
      },
      tail: { zh: '如今河床干涸，只在雨后湿上一夜。', en: 'Now the bed is dry, and wet for only one night after rain.' },
      nodes: [
        {
          orig: { zh: '摆渡人把船凿沉，献给了河', en: 'the ferryman holed his boat and gave it to the river' },
          alts: [
            { t: { zh: '摆渡人没有凿船，只是坐在船头等雨', en: 'the ferryman did not hole the boat, but sat in the bow and waited for rain' },
              chain: { zh: ['雨没有来。', '旱到第三年，两岸的人沿着河床往北走了。', '河床上留下一行脚印，至今没被风吹平。'],
                       en: ['The rain did not come.', 'In the third year of drought, both banks walked north along the riverbed.', 'A line of footprints is still there, and the wind has never smoothed it.'] } },
            { t: { zh: '摆渡人把船撑到对岸，送给了那边的人', en: 'the ferryman poled the boat across and gave it to the far bank' },
              chain: { zh: ['当夜照样下了雨，没有人知道为什么。', '对岸的人渡了过来，再也没有回去。', '此岸的村子从此不在任何记载里。'],
                       en: ['It rained that night anyway, and no one knew why.', 'The people of the far bank crossed over and never went back.', 'The near village does not appear in any record after that.'] } }
          ]
        },
        {
          orig: { zh: '最后一个知道河名的人随船沉了', en: 'The last person who knew its name went down with the boat' },
          alts: [
            { t: { zh: '沉船前，摆渡人把河名刻在了船底', en: 'Before the boat sank, the ferryman carved the river’s name into its hull' },
              chain: { zh: ['船被冲上下游的沙洲。', '后来有人翻过船，念出了那个名字。', '名字一被念出，河就干了。它原本只想没有名字。'],
                       en: ['The boat washed up on a sandbar downstream.', 'Years later someone turned it over and read the name aloud.', 'The moment the name was spoken, the river dried. It had only wanted to have no name.'] } },
            { t: { zh: '河把自己的名字藏进了水里', en: 'The river hid its own name in the water' },
              chain: { zh: ['每到雨夜，河水里反复传出同一个词。', '听见的人，第二天都想不起自己的名字。', '两岸的人从此只用编号称呼彼此。'],
                       en: ['On rainy nights the water repeats a single word.', 'Whoever hears it cannot recall their own name the next morning.', 'The people of both banks now call each other by numbers.'] } }
          ]
        }
      ]
    }
  ];
  var PERIOD = { zh: '。', en: '.' };
  var ORIGIN_SENTENCE = { zh: '翻动时的声音，像很远的地方有人在叹气。', en: 'When a page turns, it sounds like someone sighing a long way off.' };

  /* =====================================================================
     界面文案
     ===================================================================== */
  var UI = {
    zh: {
      entranceLabel: '岩腔入口', caveLabel: '进入岩腔',
      enterHint1: '岩腔深处有光', enterHint2: '点击岩口，或按 Enter 进入',
      chamberLabel: '乌鲁鲁岩腔石室',
      chamberHint1: function () {
        if (lightTaken()) return '光没有了。只有书还亮着';
        if (rw().length) return '石台上的书，比你离开时更重了';
        return '石台上有一本书';
      },
      chamberHint2: '点击书，或按 Enter 翻开',
      bookLabel: '岁月史书', coverLabel: '翻开岁月史书',
      cornerPrev: '翻回上一页', cornerNext: '翻到下一页',
      ribbon: 'EN', ribbonLabel: 'Switch to English',
      navLabel: '翻阅', prev: '前页', next: '后页', close: '合上书',
      keys: '← → 翻页　按住落笔　Esc 合上',
      portrait: '横置屏幕或放宽窗口，书页更易读。',
      indicator: function (n) { return '第 ' + n + ' / ' + SPREADS + ' 对页'; },
      spreads: function () { return ['扉页', '书之来历', '改写之法 · 可改之事', '「' + title(state.event) + '」', '改写记录']; },
      opened: '书已翻开。', closed: '书已合上，回到石室。',
      entered: '你进入了岩腔。石台上有一本合着的书。',

      lightLine: '你也已被写下。',
      originTitle: '书之来历', rulesRun: '书之来历',
      origin1: '此书无署名，亦无纪年。最早的记载说，它并非被人带进岩腔，而是岩腔围着它长成了今天的样子：红砂一层一层落下，风一年一年打磨，直到石头合拢成室，把书留在正中。',
      origin2: '书页不知为何物所制，似皮非皮，似纸非纸。火烤不卷，水浸不皱。',
      rules: ['书中所载，皆为已经发生之事。凡被写进去的，便被定了下来；凡被抹去的，世上便再无人记得。', '守书的规矩刻在石台背面，只有三条：不可带离，不可焚毁；凡改一事，必失一物。'],
      rulesLast: '失去的是什么，由书来定。它从不先问。',
      methodTitle: '改写之法',
      method: ['在右页选一件事。', '左页上朱笔圈出之处，可以改。', '择一种写法，按住落笔。书会推你的手；松开，它便不写。', '墨只够三笔。每落一笔，书要拿走一样东西。', '改过的事，前后两种写法都留在「改写记录」里。'],
      methodNums: ['一', '二', '三', '四', '五'],
      indexTitle: '可改之事',
      ink: '余墨',
      statusOrig: '原载，未经改动', statusDone: '已改：', statusTaken: '结尾已被书取走',
      toLedger: '改写记录', toIndex: '回目录',
      viewOrig: '原载', viewNow: '今载', viewGroup: '查看',
      viewNoteOrig: '原载：此事最初被写下的样子',
      viewNoteSame: '此事尚未被改动',
      rwTitle: '改写', rwHere: '此处', rwFixed: '此处已定',
      hold: '按住落笔',
      holdHint: function (n) { return '书会抵抗。需按住约 ' + (holdMs(n) / 1000).toFixed(1) + ' 秒，每多写一笔，它推得更用力。'; },
      forbid: '让这件事从未发生',
      chain: '连锁', priceHist: '史中之价', priceBook: '书取之物',
      nodeLabel: function (t) { return '可改之处：' + t; },
      erasedSr: '（此后的文字已随改写消失）', takenSr: '（此句已被书取走）',
      ledTitle: '改写记录', entryN: function (n) { return '第' + ['一', '二', '三'][n] + '笔'; },
      cmpTitle: '对照', cmpEmpty: '改写之后，原载与今载会并排写在这里。',
      was: '原', now: '今', seeOrig: '看原载', seeNow: '看今载',
      tear: '撕下此页，归还一切',
      tornCount: function (n) { return '此页曾被撕下 ' + n + ' 次。书都记得。'; },
      toll0: function (s) { return '书取走了「书之来历」中的一句：「' + s + '」'; },
      toll1: function (t, s) { return '书取走了「' + t + '」的结尾：「' + s + '」'; },
      toll2: '书取走了岩腔里的光。',
      tollPrefix: '代价：',
      ord: ['一', '二', '三'],

      /* 书的声音 */
      v_indexIdle: '它知道你会选哪一件。',
      v_predictIndex: function (t) { return '你会先翻开「' + t + '」。'; },
      v_predictHit: '如书所料。',
      v_predictMiss: function (t) { return '书划掉了自己的预言，改成「' + t + '」。改过的墨，反而比原来的旧。'; },
      v_evPrompt: '朱笔圈出之处，可以改。',
      v_optPrompt: '择一种写法。',
      v_optForetold: function (n) { return '你会选第' + n + '种。'; },
      v_optBackdated: '页边那一行墨，比你的手指更早干透。',
      v_optMiss: '它改了口，又说自己从未说错。',
      v_optForbid: '你想让它没发生过。试试看。',
      v_holdStart: '它在推你的手。',
      v_holdForetell: '结果已经开始写了，在你写完之前。',
      v_holdEarly: '你松手了。书在等。',
      v_holdTap: '要按住。书不认轻轻一点。',
      v_refuse: '不。这件事不能没有。没有它，便没有这一页。',
      v_done: '已写下。便将如此。',
      worldCap: ['一笔落下，旧世界裂开了。', '黑暗里，世界被重新写下。', '代价站在新世界里，望着你。'],
      worldSkip: '跳过', worldReplay: '重看这一笔', worldLabel: '世界被改写',
      v_inkOut: '墨尽了。',
      v_locked: '此事已改，墨已干。',
      v_ledEmpty: '尚无改写。书页还是干净的。',
      v_tearDone: '书把它们收了回去。但它记得你撕过。',
      v_allDone: '它已经没有可以预言的了。'
    },
    en: {
      entranceLabel: 'Mouth of the hollow', caveLabel: 'Enter the hollow',
      enterHint1: 'There is light deep inside the rock', enterHint2: 'Click the opening, or press Enter',
      chamberLabel: 'Sandstone chamber inside Uluru',
      chamberHint1: function () {
        if (lightTaken()) return 'The light is gone. Only the book still glows';
        if (rw().length) return 'The book on the table is heavier than you left it';
        return 'A book lies on the stone table';
      },
      chamberHint2: 'Click the book, or press Enter to open it',
      bookLabel: 'Chronicles of Time', coverLabel: 'Open the Chronicles of Time',
      cornerPrev: 'Turn back a page', cornerNext: 'Turn the page',
      ribbon: '中', ribbonLabel: '切换为中文',
      navLabel: 'Reading', prev: 'Back', next: 'Turn', close: 'Close the book',
      keys: '← → turn   hold to write   Esc close',
      portrait: 'Turn your screen sideways or widen the window for easier reading.',
      indicator: function (n) { return 'Spread ' + n + ' of ' + SPREADS; },
      spreads: function () { return ['Title page', 'How the Book Came Here', 'The Way of Rewriting · What May Be Changed', '“' + title(state.event) + '”', 'Ledger of Changes']; },
      opened: 'The book is open.', closed: 'The book is closed. You are back in the chamber.',
      entered: 'You have entered the hollow. A closed book lies on a stone table.',

      lightLine: 'You have been written too.',
      originTitle: 'How the Book Came Here', rulesRun: 'How the Book Came Here',
      origin1: 'The book bears no author’s name and no year. The oldest account says it was never carried into the hollow at all. The hollow grew around it instead: red sand settling layer on layer, wind polishing year after year, until the stone closed into a chamber with the book at its centre.',
      origin2: 'No one knows what its leaves are made of. Not quite skin, not quite paper. Fire will not curl them; water will not wrinkle them.',
      rules: ['Everything in the book has already happened. What is written into it becomes fixed; what is scraped out of it, the world forgets.', 'The rules for keeping it are cut into the back of the stone table, and there are only three: do not carry it away; do not burn it; for every thing you change, you lose another.'],
      rulesLast: 'What you lose is for the book to decide. It never asks first.',
      methodTitle: 'The Way of Rewriting',
      method: ['Choose an account on the facing page.', 'Where the red pen has circled, the text may be changed.', 'Choose a new reading and hold to write. The book pushes back; let go, and it writes nothing.', 'There is ink for three strokes. For each, the book takes something.', 'What was and what is are both kept in the Ledger of Changes.'],
      methodNums: ['I', 'II', 'III', 'IV', 'V'],
      indexTitle: 'What May Be Changed',
      ink: 'Ink left',
      statusOrig: 'As first written', statusDone: 'Rewritten: ', statusTaken: 'Its ending taken by the book',
      toLedger: 'Ledger of changes', toIndex: 'Contents',
      viewOrig: 'As first written', viewNow: 'As it now reads', viewGroup: 'View',
      viewNoteOrig: 'As this account was first written',
      viewNoteSame: 'This account has not been changed',
      rwTitle: 'Rewrite', rwHere: 'Here', rwFixed: 'This is now fixed',
      hold: 'Hold to write',
      holdHint: function (n) { return 'The book resists. Hold for about ' + (holdMs(n) / 1000).toFixed(1) + ' s; with each stroke it pushes harder.'; },
      forbid: 'Let this never have happened',
      chain: 'What follows', priceHist: 'Price in history', priceBook: 'What the book took',
      nodeLabel: function (t) { return 'May be changed: ' + t; },
      erasedSr: '(the text that followed has vanished with the rewrite)', takenSr: '(this sentence was taken by the book)',
      ledTitle: 'Ledger of Changes', entryN: function (n) { return 'Stroke ' + (n + 1); },
      cmpTitle: 'Before and After', cmpEmpty: 'Once something is rewritten, what was and what is will be set side by side here.',
      was: 'Was', now: 'Now', seeOrig: 'As first written', seeNow: 'As it now reads',
      tear: 'Tear it out. Give it all back.',
      tornCount: function (n) { return 'This page has been torn out ' + (n === 1 ? 'once' : n + ' times') + '. The book remembers.'; },
      toll0: function (s) { return 'The book took a sentence from “How the Book Came Here”: “' + s + '”'; },
      toll1: function (t, s) { return 'The book took the ending of “' + t + '”: “' + s + '”'; },
      toll2: 'The book took the light from the hollow.',
      tollPrefix: 'The price: ',
      ord: ['first', 'second', 'third'],

      v_indexIdle: 'It knows which one you will choose.',
      v_predictIndex: function (t) { return 'You will open “' + t + '” first.'; },
      v_predictHit: 'Just as the book foretold.',
      v_predictMiss: function (t) { return 'The book struck out its own prophecy and wrote “' + t + '” instead. The new ink looks older than the old.'; },
      v_evPrompt: 'Where the red pen has circled, you may change.',
      v_optPrompt: 'Choose how it will read.',
      v_optForetold: function (n) { return 'You will choose the ' + n + '.'; },
      v_optBackdated: 'The line in the margin was dry before your finger moved.',
      v_optMiss: 'It changed its answer, and insists it never erred.',
      v_optForbid: 'You want it never to have happened. Try.',
      v_holdStart: 'It is pushing your hand back.',
      v_holdForetell: 'The outcome is already being written, before you finish.',
      v_holdEarly: 'You let go. The book is waiting.',
      v_holdTap: 'You must hold. The book ignores a light touch.',
      v_refuse: 'No. This cannot be unmade. Without it, there is no page.',
      v_done: 'It is written. So it shall be.',
      worldCap: ['One stroke, and the old world splits open.', 'In the dark, the world is written again.', 'The cost stands in the new world, watching you.'],
      worldSkip: 'Skip', worldReplay: 'Replay this stroke', worldLabel: 'The world is rewritten',
      v_inkOut: 'The ink is spent.',
      v_locked: 'This has been changed. The ink is dry.',
      v_ledEmpty: 'Nothing rewritten yet. The pages are still clean.',
      v_tearDone: 'The book has taken them back. But it remembers that you tore it.',
      v_allDone: 'There is nothing left for it to foretell.'
    }
  };

  /* =====================================================================
     状态
     ===================================================================== */
  var led = loadLedger();          // 持久：{ rewrites: [...], torn: n }
  var state = {
    scene: 'entrance', book: 'table', spread: 0, busy: false,
    lang: store.get(STORE_LANG) === 'en' ? 'en' : 'zh',
    event: 0, view: 'now', node: null, opt: null,
    optPredict: null, optNote: null,          // 选项预言
    idxPredict: undefined, idxChosen: null,   // 目录预言
    refused: {}, entry: 0,
    voice: {}                                  // 每页的「书的声音」：{ k, a, fresh }
  };

  function loadLedger() {
    var d = null;
    try { d = JSON.parse(store.get(STORE) || 'null'); } catch (e) { d = null; }
    if (!d || !Array.isArray(d.rewrites)) d = { rewrites: [], torn: 0 };
    d.rewrites = d.rewrites.filter(function (r) {
      return r && EVENTS[r.e] && EVENTS[r.e].nodes[r.n] && EVENTS[r.e].nodes[r.n].alts[r.a] && r.toll && typeof r.toll.k === 'number';
    }).slice(0, INK);
    d.torn = d.torn | 0;
    return d;
  }
  function saveLedger() { return store.set(STORE, JSON.stringify(led)); }

  function T() { return UI[state.lang]; }
  function L() { return state.lang; }
  function rw() { return led.rewrites; }
  function title(e) { return EVENTS[e].title[L()]; }
  function rewriteOf(e) { for (var i = 0; i < rw().length; i++) if (rw()[i].e === e) return rw()[i]; return null; }
  function tailTaken(e) { return rw().some(function (r) { return r.toll.k === 1 && r.toll.target === e; }); }
  function originTaken() { return rw().some(function (r) { return r.toll.k === 0; }); }
  function lightTaken() { return rw().some(function (r) { return r.toll.k === 2; }); }
  function holdMs(n) { return 1400 + 700 * n; }

  var $ = function (id) { return document.getElementById(id); };
  var body = document.body;
  var bookEl = $('book');
  var leavesWrap = $('leaves');
  var castEl = $('cast');
  var leafEls = [];
  var faceOf = {};
  var rmQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  function reduced() { return !!rmQuery.matches; }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function nextFrame() { return new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); }); }

  var liveTimer = 0;
  function announce(msg) {
    var live = $('live');
    live.textContent = '';
    clearTimeout(liveTimer);
    liveTimer = setTimeout(function () { live.textContent = msg; }, 60);
  }

  /* =====================================================================
     版面片段
     ===================================================================== */
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
    '<g class="hands"><path stroke-width="1.6" d="M100 42 V100 M100 100 L82 74"/></g><circle cx="100" cy="100" r="3" stroke-width="2"/></svg>';

  function folio(zh, en) { return '<span class="folio">' + (L() === 'zh' ? zh : en) + '</span>'; }
  function takenHTML(s) { return '<span class="taken" aria-hidden="true">' + esc(s) + '</span><span class="sr-only">' + esc(T().takenSr) + '</span>'; }
  function erasedHTML(s, anim) { return '<span class="erased' + (anim ? ' erasing' : '') + '" aria-hidden="true">' + esc(s) + '</span>'; }
  function inkChars(t) {
    var cs = Array.from(t), step = Math.min(60, 1800 / Math.max(1, cs.length));
    return cs.map(function (c, i) { return '<span class="ch" style="--d:' + Math.round(i * step) + 'ms">' + esc(c) + '</span>'; }).join('');
  }
  function drops() {
    var left = INK - rw().length, s = '';
    for (var i = 0; i < INK; i++) s += '<i class="drop' + (i < left ? '' : ' spent') + '"></i>';
    return '<p class="ink-line">' + esc(T().ink) + ' <span class="drops" aria-hidden="true">' + s + '</span><span class="sr-only">' + left + ' / ' + INK + '</span></p>';
  }
  function voiceText(v) {
    if (!v) return '';
    var t = T(), x = t['v_' + v.k];
    if (v.k === 'toll') return t.tollPrefix + tollText(rw()[v.a]);
    if (typeof x === 'function') {
      if (v.k === 'predictIndex' || v.k === 'predictMiss') return x(title(v.a));
      if (v.k === 'optForetold') return x(t.ord[v.a]);
      return x(v.a);
    }
    return x || '';
  }
  function voiceHTML(page, fallbackKey) {
    var v = state.voice[page] || (fallbackKey ? { k: fallbackKey } : null);
    var fresh = v && v.fresh;
    if (v) v.fresh = false;
    return '<p class="voice' + (fresh ? ' fresh' : '') + '" data-voice="' + page + '">' + esc(voiceText(v)) + '</p>';
  }
  function setVoice(page, k, a, opts) {
    state.voice[page] = { k: k, a: a, fresh: true };
    var el = leavesWrap.querySelector('[data-voice="' + page + '"]');
    if (el && !(opts && opts.noDom)) {
      el.textContent = voiceText(state.voice[page]);
      el.classList.remove('fresh'); void el.offsetWidth; el.classList.add('fresh');
      state.voice[page].fresh = false;
    }
    announce(voiceText(state.voice[page]));
  }
  function tollText(r) {
    if (!r) return '';
    var t = T();
    if (r.toll.k === 0) return t.toll0(ORIGIN_SENTENCE[L()]);
    if (r.toll.k === 1) return t.toll1(title(r.toll.target), EVENTS[r.toll.target].tail[L()]);
    return t.toll2;
  }

  /* —— 史事记载（原载 / 今载） —— */
  function recordHTML(e, view, anim) {
    var ev = EVENTS[e], lang = L(), done = rewriteOf(e), r = view === 'now' ? done : null;
    var paras = ev.paras[lang].concat([['__tail']]);
    var out = [], erasing = false, chained = false, anyErased = false;
    paras.forEach(function (para, pi) {
      var html = '', buf = '';
      para.forEach(function (part) {
        var text = part === '__tail' ? ev.tail[lang] : (typeof part === 'number' ? ev.nodes[part].orig[lang] : part);
        if (erasing) { buf += text; return; }
        if (part === '__tail') {
          html += (view === 'now' && tailTaken(e)) ? takenHTML(text) : esc(text);
        } else if (typeof part === 'number') {
          if (r && r.n === part) {
            var alt = ev.nodes[part].alts[r.a].t[lang];
            html += '<del class="ghost">' + esc(text) + '</del><ins class="fresh' + (anim ? ' seep' : '') + '">' + (anim ? inkChars(alt) : esc(alt)) + '</ins>' + esc(PERIOD[lang]);
            erasing = true;
          } else if (view === 'now' && !done) {
            var on = state.node === part;
            html += '<span class="node' + (on ? ' on' : '') + '" role="button" tabindex="0" data-act="node" data-n="' + part + '" data-k="node' + part + '" aria-pressed="' + on + '" aria-label="' + esc(T().nodeLabel(text)) + '">' + esc(text) + '</span>';
          } else {
            html += '<span class="node-mark">' + esc(text) + '</span>';
          }
        } else {
          html += esc(text);
        }
      });
      if (buf) { html += erasedHTML(buf, anim); anyErased = true; }
      if (html) out.push('<p' + (pi === 0 ? ' class="dropcap"' : '') + '>' + html + '</p>');
      if (erasing && !chained) {
        chained = true;
        var lines = ev.nodes[r.n].alts[r.a].chain[lang];
        out.push('<p class="chain-hist' + (anim ? ' writing' : '') + '">' + lines.map(function (l, j) {
          return '<span class="cl' + (j === lines.length - 1 ? ' cost' : '') + '" style="--i:' + j + '">' + esc(l) + '</span>';
        }).join(lang === 'en' ? ' ' : '') + '</p>');
      }
    });
    if (anyErased) out.push('<span class="sr-only">' + esc(T().erasedSr) + '</span>');
    return out.join('');
  }

  function chainList(lines, cls, anim) {
    return '<ol class="chain' + (cls ? ' ' + cls : '') + (anim ? ' writing' : '') + '"' + (cls === 'foretell' ? ' aria-hidden="true"' : '') + '>' + lines.map(function (l, j) {
      var last = j === lines.length - 1;
      return '<li class="' + (last ? 'cost' : '') + '" style="--i:' + j + '">' + (last && cls !== 'foretell' ? '<span class="lbl">' + esc(T().priceHist) + '</span>' : '') + esc(l) + '</li>';
    }).join('') + '</ol>';
  }

  /* =====================================================================
     各页渲染
     ===================================================================== */
  var RENDER = {
    cover: function () {
      return '<div class="cover-art"><span class="hinge"></span><span class="frame f1"></span><span class="frame f2"></span>' + EMBLEM +
        '<span class="cover-title">' + (L() === 'zh' ? '岁月史书' : 'Chronicles of Time') + '</span>' +
        '<span class="brass b1"></span><span class="brass b2"></span><span class="brass b3"></span><span class="brass b4"></span></div>';
    },
    p0: function () {
      return L() === 'zh'
        ? '<div class="page-inner ex-libris">' + SEAL + '<p class="ex-line">藏于南方大陆，赤岩之腹。</p><p class="ex-line small">凡开此卷者，所见皆为已书之事。</p></div>'
        : '<div class="page-inner ex-libris">' + SEAL + '<p class="ex-line">Kept in the belly of the red rock, in the great southern land.</p><p class="ex-line small">Whoever opens this volume sees only what has already been written.</p></div>';
    },
    p1: function () {
      var extra = lightTaken() ? '<p class="tp-written">' + esc(T().lightLine) + '</p>' : '';
      return L() === 'zh'
        ? '<div class="page-inner title-page"><p class="tp-kicker">卷　无纪年</p><h1 class="tp-title">岁月史书</h1>' + ORN +
          '<p class="tp-motto">「既已写下，便将如此。」</p>' + extra + '<p class="tp-foot">致敬《成龙历险记》的非官方作品</p></div>'
        : '<div class="page-inner title-page"><p class="tp-kicker">Volume · Undated</p><h1 class="tp-title">Chronicles of Time</h1>' + ORN +
          '<p class="tp-motto">“Once written, so it shall be.”</p>' + extra + '<p class="tp-foot">An unofficial tribute to <cite>Jackie Chan Adventures</cite></p></div>';
    },
    p2: function () {
      var t = T(), s = ORIGIN_SENTENCE[L()], sp = L() === 'en' ? ' ' : '';
      return '<div class="page-inner"><h2 class="pg-title">' + esc(t.originTitle) + '</h2>' +
        '<p class="dropcap">' + esc(t.origin1) + '</p>' +
        '<p>' + esc(t.origin2) + sp + (originTaken() ? takenHTML(s) : esc(s)) + '</p></div>' + folio('一', 'i');
    },
    p3: function () {
      var t = T();
      return '<div class="page-inner"><p class="running">' + esc(t.rulesRun) + '</p>' +
        t.rules.map(function (x) { return '<p>' + esc(x) + '</p>'; }).join('') +
        '<p class="rule-last">' + esc(t.rulesLast) + '</p></div>' + folio('二', 'ii');
    },
    p4: function () {
      var t = T();
      return '<div class="page-inner method"><h2 class="pg-title">' + esc(t.methodTitle) + '</h2>' +
        t.method.map(function (x, i) { return '<p><span class="n">' + t.methodNums[i] + '</span>' + esc(x) + '</p>'; }).join('') +
        '</div>' + folio('三', 'iii');
    },
    index: function () {
      var t = T();
      ensureIdxPredict();
      var items = EVENTS.map(function (ev, i) {
        var r = rewriteOf(i), taken = tailTaken(i), st = [];
        if (r) st.push(t.statusDone + ev.nodes[r.n].alts[r.a].t[L()]);
        if (taken) st.push(t.statusTaken);
        if (!st.length) st.push(t.statusOrig);
        return '<li><button type="button" class="ev-btn' + (r ? ' done' : '') + (taken ? ' wounded' : '') + '" data-act="event" data-i="' + i + '" data-k="ev' + i + '">' +
          '<span class="num" aria-hidden="true">' + ev.num[L()] + '</span><span class="et">' + esc(ev.title[L()]) + '</span>' +
          '<span class="es">' + esc(st.join(L() === 'zh' ? '；' : '; ')) + '</span></button></li>';
      }).join('');
      return '<div class="page-inner idx"><h2 class="pg-title">' + esc(t.indexTitle) + '</h2>' + drops() +
        '<ol class="events">' + items + '</ol>' + voiceHTML('index', 'indexIdle') +
        '<div class="rw-foot"><button type="button" class="ink-btn" data-act="ledger" data-k="idx-ledger">' + esc(t.toLedger) + '</button></div></div>' +
        '<div class="margin-note" aria-hidden="true">' + idxNoteHTML() + '</div>' + folio('四', 'iv');
    },
    evL: function (o) {
      var t = T(), e = state.event, changed = !!rewriteOf(e) || tailTaken(e);
      var tabs = '<div class="viewtabs" role="group" aria-label="' + esc(t.viewGroup) + '">' +
        '<button type="button" data-act="view" data-v="orig" data-k="view-orig" aria-pressed="' + (state.view === 'orig') + '">' + esc(t.viewOrig) + '</button>' +
        '<button type="button" data-act="view" data-v="now" data-k="view-now" aria-pressed="' + (state.view === 'now') + '">' + esc(t.viewNow) + '</button></div>';
      var note = state.view === 'orig' ? t.viewNoteOrig : (changed ? '' : t.viewNoteSame);
      return '<div class="page-inner ev"><h2 class="pg-title">' + esc(title(e)) + '</h2>' + tabs +
        '<div class="ev-record rw-body">' + recordHTML(e, state.view, o.anim) +
        (note ? '<p class="view-note">' + esc(note) + '</p>' : '') + '</div></div>' + folio('五', 'v');
    },
    evR: function (o) {
      var t = T(), e = state.event, ev = EVENTS[e], r = rewriteOf(e), html = '';
      if (r) {
        var node = ev.nodes[r.n], alt = node.alts[r.a];
        html += '<p class="rw-label">' + esc(t.rwFixed) + '</p>' +
          '<p class="rw-quote"><del>' + esc(node.orig[L()]) + '</del>' + (L() === 'zh' ? '　→　' : ' → ') + '<ins>' + esc(alt.t[L()]) + '</ins></p>' +
          voiceHTML('evR', 'locked') +
          '<p class="rw-label">' + esc(t.chain) + '</p>' + chainList(alt.chain[L()], '', o.anim) +
          '<p class="rw-toll' + (o.anim ? ' writing' : '') + '"><span class="lbl">' + esc(t.priceBook) + '</span>' + esc(tollText(r)) + '</p>';
      } else if (state.node == null) {
        html += '<p class="rw-prompt">' + esc(t.v_evPrompt) + '</p>';
      } else {
        var nd = ev.nodes[state.node], key = e + ':' + state.node;
        var opts = nd.alts.map(function (a, i) {
          return '<button type="button" class="opt" data-act="opt" data-a="' + i + '" data-k="opt' + i + '" aria-pressed="' + (state.opt === i) + '">' + esc(a.t[L()]) + '</button>';
        }).join('');
        var refused = !!state.refused[key];
        opts += '<button type="button" class="opt forbid' + (refused ? ' refused' : '') + '" data-act="opt" data-a="2" data-k="opt2" aria-pressed="' + (state.opt === 2) + '"' + (refused ? ' disabled' : '') + '>' + esc(t.forbid) + '</button>';
        var inkOut = rw().length >= INK;
        html += '<p class="rw-label">' + esc(t.rwHere) + '</p><p class="rw-quote">' + (L() === 'zh' ? '「' : '“') + esc(nd.orig[L()]) + (L() === 'zh' ? '」' : '”') + '</p>' +
          '<div class="opts" role="group" aria-label="' + esc(t.rwTitle) + '">' + opts + '</div>' +
          '<button type="button" class="hold" data-act="hold" data-k="hold"' + (state.opt == null || inkOut ? ' disabled' : '') + '><span class="ring" aria-hidden="true"></span><span>' + esc(inkOut ? t.v_inkOut : t.hold) + '</span></button>' +
          '<p class="hold-hint">' + esc(t.holdHint(rw().length)) + '</p>' + voiceHTML('evR', 'evPrompt') +
          (state.opt != null && state.opt < 2 ? chainList(nd.alts[state.opt].chain[L()], 'foretell') : '');
      }
      return '<div class="page-inner rwp"><h2 class="pg-title">' + esc(t.rwTitle) + '</h2>' + drops() +
        '<div class="rw-body">' + html + (r || state.node != null ? '' : voiceHTML('evR', 'evPrompt')) + '</div>' +
        '<div class="rw-foot"><button type="button" class="ink-btn" data-act="index" data-k="to-index">' + esc(t.toIndex) + '</button>' +
        '<button type="button" class="ink-btn" data-act="ledger" data-k="to-ledger">' + esc(t.toLedger) + '</button></div></div>' +
        '<div class="margin-note" aria-hidden="true">' + optNoteHTML() + '</div>' + folio('六', 'vi');
    },
    ledL: function () {
      var t = T(), list;
      if (!rw().length) list = '';
      else list = '<ol class="entries">' + rw().map(function (r, i) {
        var nd = EVENTS[r.e].nodes[r.n];
        return '<li><button type="button" class="entry" data-act="entry" data-r="' + i + '" data-k="entry' + i + '" aria-pressed="' + (state.entry === i) + '">' +
          '<span class="eh">' + esc(t.entryN(i)) + ' · ' + esc(title(r.e)) + '</span>' +
          '<span class="ed"><del>' + esc(nd.orig[L()]) + '</del> → <ins>' + esc(nd.alts[r.a].t[L()]) + '</ins></span>' +
          '<span class="ep">' + esc(tollText(r)) + '</span></button></li>';
      }).join('') + '</ol>';
      return '<div class="page-inner led"><h2 class="pg-title">' + esc(t.ledTitle) + '</h2>' + drops() +
        '<div class="rw-body">' + list + voiceHTML('ledL', rw().length ? null : 'ledEmpty') +
        (led.torn ? '<p class="torn-count">' + esc(t.tornCount(led.torn)) + '</p>' : '') + '</div></div>' + folio('七', 'vii');
    },
    ledR: function () {
      var t = T(), r = rw()[state.entry], html;
      if (!r) {
        html = '<p class="rw-prompt">' + esc(t.cmpEmpty) + '</p>';
      } else {
        var ev = EVENTS[r.e], nd = ev.nodes[r.n], alt = nd.alts[r.a];
        html = '<p class="rw-label">' + esc(t.entryN(state.entry)) + ' · ' + esc(title(r.e)) + '</p>' +
          '<div class="cmp-row was"><span class="k">' + esc(t.was) + '</span><span class="v">' + esc(nd.orig[L()]) + '</span></div>' +
          '<div class="cmp-row now"><span class="k">' + esc(t.now) + '</span><span class="v">' + esc(alt.t[L()]) + '</span></div>' +
          '<p class="rw-label">' + esc(t.chain) + '</p>' + chainList(alt.chain[L()]) +
          '<p class="rw-toll"><span class="lbl">' + esc(t.priceBook) + '</span>' + esc(tollText(r)) + '</p>' +
          '<div class="rw-foot" style="justify-content:flex-start"><button type="button" class="ink-btn" data-act="goto" data-e="' + r.e + '" data-v="orig" data-k="goto-orig">' + esc(t.seeOrig) + '</button>' +
          '<button type="button" class="ink-btn" data-act="goto" data-e="' + r.e + '" data-v="now" data-k="goto-now">' + esc(t.seeNow) + '</button>' +
          '<button type="button" class="ink-btn" data-act="replay" data-r="' + state.entry + '" data-k="replay">' + esc(t.worldReplay) + '</button></div>';
      }
      return '<div class="page-inner rwp has-tear"><h2 class="pg-title">' + esc(t.cmpTitle) + '</h2><div class="rw-body">' + html + '</div></div>' +
        '<button type="button" class="tear-btn" data-act="tear" data-k="tear"' + (rw().length ? '' : ' disabled') + '><span>' + esc(t.tear) + '</span></button>' + folio('八', 'viii');
    },
    blank: function () { return ''; }
  };

  function idxNoteHTML() {
    var t = T(), p = state.idxPredict;
    if (p == null) return rw().length >= EVENTS.length ? esc(t.v_allDone) : '';
    if (state.idxChosen != null && state.idxChosen !== p) {
      return '<s>' + esc(t.v_predictIndex(title(p))) + '</s>' + esc(t.v_predictIndex(title(state.idxChosen)));
    }
    return esc(t.v_predictIndex(title(p)));
  }
  function optNoteHTML() {
    var t = T(), n = state.optNote;
    if (!n || rewriteOf(state.event)) return '';
    if (n.chosen != null && n.chosen !== n.pred && !n.backdated) {
      return '<s>' + esc(t.v_optForetold(t.ord[n.pred])) + '</s>' + esc(t.v_optForetold(t.ord[n.chosen]));
    }
    return esc(t.v_optForetold(t.ord[n.chosen != null ? n.chosen : n.pred]));
  }
  function ensureIdxPredict() {
    if (state.idxPredict !== undefined) return;
    var cands = EVENTS.map(function (e, i) { return i; }).filter(function (i) { return !rewriteOf(i); });
    state.idxPredict = cands.length ? cands[(led.torn + rw().length * 2 + 1) % cands.length] : null;
    state.idxChosen = null;
  }

  /* 每一叶：[正面（右页）, 背面（左页）] */
  var LEAVES = [['cover', 'p0'], ['p1', 'p2'], ['p3', 'p4'], ['index', 'evL'], ['evR', 'ledL'], ['ledR', 'blank']];

  function faceClass(id) { return id === 'cover' ? 'cover-out' : id === 'p0' ? 'cover-in' : 'page'; }
  function buildLeaves() {
    var anchor = $('veins');
    LEAVES.forEach(function (pair, i) {
      var leaf = document.createElement('div');
      leaf.className = 'leaf' + (i === 0 ? ' cover' : '');
      [['front', pair[0]], ['back', pair[1]]].forEach(function (f) {
        var face = document.createElement('div');
        face.className = 'face ' + f[0] + ' ' + faceClass(f[1]);
        face.setAttribute('data-page', f[1]);
        if (f[1] === 'blank') face.setAttribute('aria-hidden', 'true');
        face.innerHTML = '<div class="fc"></div>';
        faceOf[f[1]] = face;
        leaf.appendChild(face);
      });
      leavesWrap.insertBefore(leaf, anchor);
      leafEls.push(leaf);
      restLeaf(i, false);
    });
  }
  function front(i) { return leafEls[i].querySelector('.front'); }
  function back(i) { return leafEls[i].querySelector('.back'); }

  function renderFace(id, o) {
    var face = faceOf[id];
    if (!face) return;
    var fc = face.querySelector('.fc');
    var ae = document.activeElement;
    var key = ae && face.contains(ae) ? ae.getAttribute('data-k') : null;
    var html = RENDER[id](o || {});
    fc.innerHTML = id === 'p0' ? '<div class="pastedown">' + html + '</div>' : html;
    if (key) {
      var el = fc.querySelector('[data-k="' + key + '"]');
      if (el && !el.disabled) focusEl(el);
    }
  }
  function renderAll() { Object.keys(RENDER).forEach(function (id) { renderFace(id); }); }

  /* =====================================================================
     文案、环境
     ===================================================================== */
  function applyUI() {
    var t = T();
    document.documentElement.lang = state.lang === 'zh' ? 'zh-Hans' : 'en';
    document.querySelectorAll('[data-t]').forEach(function (el) {
      var v = t[el.getAttribute('data-t')];
      if (typeof v === 'function') v = v();
      if (typeof v === 'string') el.textContent = v;
    });
    document.querySelectorAll('[data-t-aria]').forEach(function (el) {
      var v = t[el.getAttribute('data-t-aria')];
      if (typeof v === 'string') el.setAttribute('aria-label', v);
    });
  }
  function setLang(lang) {
    releaseHold(true);
    state.lang = lang;
    store.set(STORE_LANG, lang);
    renderAll();
    applyUI();
    updateUI();
    announce(lang === 'zh' ? '已切换为中文。' : 'Switched to English.');
  }
  function applyRot() {
    var k = rw().length;
    body.classList.toggle('rot-ge1', k >= 1);
    body.classList.toggle('rot-ge2', k >= 2);
    body.classList.toggle('rot-ge3', k >= 3);
    body.classList.toggle('light-taken', lightTaken());
    body.style.setProperty('--hand', (-50 * k) + 'deg');
    dust.rise = k >= 2;
    dust.dark = lightTaken();
    applyUI();
  }

  /* 墨脉：固定种子生成，分三层，随改写次数逐层爬出 */
  function buildVeins() {
    var seed = 7031;
    var rnd = function () { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    var ns = '<svg viewBox="0 0 200 136" preserveAspectRatio="none" focusable="false">';
    function tendril(x, y, dx, dy, len, w) {
      var d = 'M' + x.toFixed(1) + ' ' + y.toFixed(1), seg = 6, px = x, py = y;
      for (var i = 0; i < seg; i++) {
        var nx = px + dx * len / seg * (0.6 + rnd() * 0.8) + (dy ? (rnd() - 0.5) * 6 : 0);
        var ny = py + dy * len / seg * (0.6 + rnd() * 0.8) + (dx ? (rnd() - 0.5) * 7 : 0);
        var cx = (px + nx) / 2 + (rnd() - 0.5) * 5, cy = (py + ny) / 2 + (rnd() - 0.5) * 5;
        d += ' Q' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ' ' + nx.toFixed(1) + ' ' + ny.toFixed(1);
        px = nx; py = ny;
      }
      return '<path pathLength="1" stroke-width="' + w.toFixed(2) + '" d="' + d + '"/>';
    }
    var levels = [
      { n: 8, len: 14, w: 0.55, edge: 0, blots: 0 },
      { n: 10, len: 30, w: 0.42, edge: 6, blots: 5 },
      { n: 12, len: 52, w: 0.32, edge: 10, blots: 9 }
    ];
    levels.forEach(function (lv, li) {
      ns += '<g class="lv' + (li + 1) + '">';
      for (var i = 0; i < lv.n; i++) {
        var dir = rnd() < 0.5 ? -1 : 1;
        ns += tendril(100 + dir * rnd() * 2, 4 + rnd() * 128, dir, 0, lv.len * (0.6 + rnd() * 0.7), lv.w * (0.6 + rnd() * 0.8));
      }
      for (var j = 0; j < lv.edge; j++) {
        var top = rnd() < 0.5, x = 6 + rnd() * 188;
        ns += tendril(x, top ? 0 : 136, 0, top ? 1 : -1, 8 + rnd() * 10 * (li + 1), lv.w * 0.8);
      }
      for (var b = 0; b < lv.blots; b++) {
        var bx = rnd() < 0.5 ? 3 + rnd() * 14 : 183 + rnd() * 14;
        ns += '<circle cx="' + bx.toFixed(1) + '" cy="' + (6 + rnd() * 124).toFixed(1) + '" r="' + (0.6 + rnd() * 2.2).toFixed(2) + '"/>';
      }
      ns += '</g>';
    });
    $('veins').innerHTML = ns + '</svg>';
  }

  /* =====================================================================
     三维书：翻页引擎
     ===================================================================== */
  function restLeaf(i, flipped) {
    var leaf = leafEls[i];
    leaf.classList.toggle('flipped', flipped);
    leaf.style.transform = '';
    leaf.style.removeProperty('--sf');
    leaf.style.removeProperty('--sb');
    leaf.style.zIndex = flipped ? 10 + i : 100 - i;
  }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function flipLeaf(i, forward, dur) {
    return new Promise(function (resolve) {
      var leaf = leafEls[i], start = null;
      leaf.classList.remove('flipped');
      leaf.style.zIndex = forward ? 200 + i : 200 + (LEAVES.length - i);
      function frame(now) {
        if (start === null) start = now;
        var t = Math.min(1, (now - start) / dur), p = forward ? ease(t) : 1 - ease(t);
        var bend = Math.sin(Math.PI * p), skew = (forward ? -1 : 1) * bend * 0.9;
        leaf.style.transform = 'rotateY(' + (-180 * p).toFixed(2) + 'deg) skewY(' + skew.toFixed(2) + 'deg)';
        leaf.style.setProperty('--sf', (Math.min(1, p * 1.4) * 0.85).toFixed(3));
        leaf.style.setProperty('--sb', (Math.min(1, (1 - p) * 1.4) * 0.85).toFixed(3));
        drawCast(p, bend, i === 0);
        if (t < 1) requestAnimationFrame(frame);
        else { castEl.style.background = 'none'; restLeaf(i, forward); resolve(); }
      }
      requestAnimationFrame(frame);
    });
  }
  function drawCast(p, bend, isCover) {
    if (isCover && state.book !== 'open') { castEl.style.background = 'none'; return; }
    var x = 50 + 50 * Math.cos(Math.PI * p), a = (0.42 * bend).toFixed(3), w = 4 + 10 * bend;
    castEl.style.background = p < 0.5
      ? 'linear-gradient(to right, transparent ' + x.toFixed(2) + '%, rgba(20,8,0,' + a + ') ' + x.toFixed(2) + '%, transparent ' + Math.min(100, x + w).toFixed(2) + '%)'
      : 'linear-gradient(to left, transparent ' + (100 - x).toFixed(2) + '%, rgba(20,8,0,' + a + ') ' + (100 - x).toFixed(2) + '%, transparent ' + Math.min(100, 100 - x + w).toFixed(2) + '%)';
  }
  function fadeSwap(fn) {
    body.classList.add('rm-fade');
    return wait(400).then(function () { fn(); return nextFrame(); }).then(function () { body.classList.remove('rm-fade'); return wait(400); });
  }
  function setBook(s) {
    state.book = s;
    body.classList.remove('book-table', 'book-near', 'book-open');
    body.classList.add('book-' + s);
  }

  function updateUI() {
    var open = state.book === 'open' && state.spread >= 1, s = state.spread;
    leafEls.forEach(function (leaf, i) {
      front(i).inert = !(open && i === s);
      back(i).inert = !(open && i === s - 1);
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
  function announceSpread() { announce(T().indicator(state.spread) + '：' + T().spreads()[state.spread - 1]); }
  function focusEl(el) { if (el && !el.disabled) { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } } }
  function focusKey(k) {
    var el = k && document.querySelector('.face:not([inert]) [data-k="' + k + '"]');
    if (el && !el.disabled) { focusEl(el); return true; }
    return false;
  }

  /* —— 入洞 —— */
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
      announce(T().entered + (rw().length ? ' ' + T().chamberHint1() + '。' : ''));
      return wait(reduced() ? 1400 : 1800);
    };
    var p;
    if (reduced()) p = go();
    else { body.classList.add('entering'); p = wait(1250).then(go); }
    p.then(function () { state.busy = false; });
  }

  /* —— 开书 —— */
  function openBook() {
    if (state.busy || state.scene !== 'chamber' || state.book !== 'table') return;
    state.busy = true;
    var p;
    if (reduced()) {
      p = fadeSwap(function () { setBook('open'); restLeaf(0, true); state.spread = 1; updateUI(); });
    } else {
      setBook('near');
      updateUI();
      p = wait(1300).then(function () { setBook('open'); return flipLeaf(0, true, 1500); }).then(function () { state.spread = 1; });
    }
    p.then(function () {
      state.busy = false;
      updateUI();
      announce(T().opened + ' ' + T().indicator(1) + '：' + T().spreads()[0]);
      focusEl($('btn-next'));
    });
  }

  /* —— 翻页：单步或连续翻到目标对页 —— */
  function go(target, key) {
    if (state.busy || hold || state.book !== 'open') return Promise.resolve();
    target = Math.max(1, Math.min(SPREADS, target));
    if (target === state.spread) { focusKey(key); return Promise.resolve(); }
    state.busy = true;
    var active = document.activeElement, from = state.spread, dir = target > from ? 1 : -1, n = Math.abs(target - from);
    if (target === 3) ensureIdxPredict();
    var p;
    if (reduced()) {
      p = fadeSwap(function () {
        for (var i = 1; i < LEAVES.length; i++) restLeaf(i, i < target);
        state.spread = target;
        updateUI();
      });
    } else {
      p = Promise.resolve();
      var dur = n > 1 ? 640 : 1050;
      for (var k = 0; k < n; k++) {
        p = p.then(function () {
          var s = state.spread;
          return (dir > 0 ? flipLeaf(s, true, dur) : flipLeaf(s - 1, false, dur)).then(function () { state.spread = s + dir; updateUI(); });
        });
      }
    }
    return p.then(function () {
      state.busy = false;
      updateUI();
      announceSpread();
      if (focusKey(key)) return;
      if (!active || active === document.body || active.closest('.leaf') || active.disabled || (active.classList.contains('corner') && active.hidden)) {
        focusEl(dir > 0 ? ($('btn-next').disabled ? $('btn-prev') : $('btn-next')) : ($('btn-prev').disabled ? $('btn-next') : $('btn-prev')));
      }
    });
  }
  function turn(dir) { go(state.spread + dir); }

  /* —— 合书 —— */
  function closeBook() {
    releaseHold(true);
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
      p = fadeSwap(function () { for (var i = 0; i < LEAVES.length; i++) restLeaf(i, false); state.spread = 0; setBook('table'); });
    } else {
      var riffles = [];
      for (var k = s - 1, d = 0; k >= 1; k--, d += 120) {
        (function (k, d) { riffles.push(wait(d).then(function () { return flipLeaf(k, false, 560); })); })(k, d);
      }
      p = Promise.all(riffles).then(function () { setBook('near'); return flipLeaf(0, false, 1300); })
        .then(function () { state.spread = 0; setBook('table'); return wait(1300); });
    }
    p.then(function () {
      state.busy = false;
      body.classList.add('returned');
      applyUI();
      updateUI();
      announce(T().closed);
      focusEl($('cover-hit'));
    });
  }

  /* =====================================================================
     改写：选事、选处、选写法、按住落笔
     ===================================================================== */
  function chooseEvent(i) {
    if (state.busy || hold) return;
    ensureIdxPredict();
    var pred = state.idxPredict;
    state.event = i; state.view = 'now'; state.node = null; state.opt = null; state.optPredict = null; state.optNote = null;
    if (pred != null && state.idxChosen == null) {
      state.idxChosen = i;
      state.voice.evR = { k: pred === i ? 'predictHit' : 'predictMiss', a: i, fresh: true };
    } else {
      state.voice.evR = { k: rewriteOf(i) ? 'locked' : 'evPrompt', fresh: true };
    }
    renderFace('index'); renderFace('evL'); renderFace('evR');
    go(4, rewriteOf(i) ? 'view-orig' : 'node0').then(function () { announce(voiceText(state.voice.evR)); });
  }

  function selectNode(n) {
    if (state.busy || hold || rewriteOf(state.event)) return;
    state.node = n; state.opt = null; state.optPredict = null; state.optNote = null;
    state.voice.evR = { k: 'optPrompt', fresh: true };
    renderFace('evL'); renderFace('evR');
    focusKey('opt0');
    announce(voiceText(state.voice.evR));
  }

  var dwell = { timer: 0, a: null };
  function dwellStart(a) {
    if (state.opt != null || state.optPredict != null || dwell.a === a) return;
    clearTimeout(dwell.timer);
    dwell.a = a;
    dwell.timer = setTimeout(function () {
      if (state.opt != null || state.optPredict != null) return;
      state.optPredict = a;
      state.optNote = { pred: a, chosen: null, backdated: false };
      refreshOptNote();
    }, 780);
  }
  function dwellEnd() { clearTimeout(dwell.timer); dwell.a = null; }
  function refreshOptNote() {
    var note = faceOf.evR.querySelector('.margin-note');
    if (!note) return;
    note.innerHTML = optNoteHTML();
    note.classList.remove('fresh'); void note.offsetWidth; note.classList.add('fresh');
  }

  function selectOpt(a) {
    if (state.busy || hold || state.node == null) return;
    if (a === 2 && state.refused[state.event + ':' + state.node]) return;
    dwellEnd();
    var k;
    if (a === 2) {
      k = 'optForbid';
    } else if (state.optPredict == null) {
      state.optPredict = a;
      state.optNote = { pred: a, chosen: a, backdated: true };   // 书事后补写，却说早已写下
      k = 'optBackdated';
    } else if (state.optPredict !== a) {
      state.optNote = { pred: state.optPredict, chosen: a, backdated: false };
      k = 'optMiss';
    } else {
      state.optNote = { pred: a, chosen: a, backdated: false };
      k = 'predictHit';
    }
    state.opt = a;
    state.voice.evR = { k: k, fresh: true };
    renderFace('evR');
    focusKey('opt' + a);
    var note = faceOf.evR.querySelector('.margin-note');
    if (note) note.classList.add('fresh');
    announce(voiceText(state.voice.evR));
  }

  /* —— 按住落笔：书会抵抗 —— */
  var hold = null;
  function nodeEl() { return faceOf.evL.querySelector('.node.on'); }
  function startHold() {
    if (hold || state.busy || state.book !== 'open' || state.spread !== 4) return;
    if (state.node == null || state.opt == null || rewriteOf(state.event)) return;
    if (rw().length >= INK) { recoil(); setVoice('evR', 'inkOut'); return; }
    var forbid = state.opt === 2;
    hold = { t0: performance.now(), dur: forbid ? 2400 : holdMs(rw().length), forbid: forbid, p: 0, foretold: false, raf: 0 };
    body.classList.add('holding');
    var n = nodeEl();
    if (n) n.classList.add('resisting');
    setVoice('evR', 'holdStart');
    hold.raf = requestAnimationFrame(holdFrame);
  }
  function holdFrame(now) {
    if (!hold) return;
    var p = Math.min(1, (now - hold.t0) / hold.dur);
    hold.p = p;
    var ring = faceOf.evR.querySelector('.hold .ring');
    if (ring) ring.style.setProperty('--p', p.toFixed(3));
    body.style.setProperty('--hold', p.toFixed(3));
    var n = nodeEl();
    if (n) n.style.setProperty('--r', p.toFixed(3));
    if (!reduced()) {
      var a = p * p * 3.2;
      bookEl.style.transform = 'translate(' + ((Math.random() * 2 - 1) * a).toFixed(2) + 'px,' + ((Math.random() * 2 - 1) * a * 0.6).toFixed(2) + 'px)';
    }
    faceOf.evR.querySelectorAll('.chain.foretell li').forEach(function (li, i) { li.classList.toggle('shown', p > 0.28 + i * 0.22); });
    if (!hold.foretold && !hold.forbid && p > 0.28) { hold.foretold = true; setVoice('evR', 'holdForetell'); }
    if (hold.forbid && p >= 0.62) { stopHoldVisual(); hold = null; refuse(); return; }
    if (p >= 1) { stopHoldVisual(); hold = null; commit(); return; }
    hold.raf = requestAnimationFrame(holdFrame);
  }
  function stopHoldVisual() {
    if (hold) cancelAnimationFrame(hold.raf);
    body.classList.remove('holding');
    body.style.setProperty('--hold', 0);
    bookEl.style.transform = '';
    var n = nodeEl();
    if (n) { n.classList.remove('resisting'); n.style.removeProperty('--r'); }
    var ring = faceOf.evR.querySelector('.hold .ring');
    if (ring) ring.style.setProperty('--p', 0);
    faceOf.evR.querySelectorAll('.chain.foretell li').forEach(function (li) { li.classList.remove('shown'); });
  }
  function releaseHold(silent) {
    if (!hold) return;
    var p = hold.p;
    stopHoldVisual();
    hold = null;
    if (!silent) setVoice('evR', p < 0.08 ? 'holdTap' : 'holdEarly');
  }
  function recoil() {
    if (reduced()) return;
    bookEl.classList.remove('recoil'); void bookEl.offsetWidth; bookEl.classList.add('recoil');
    setTimeout(function () { bookEl.classList.remove('recoil'); }, 600);
  }
  function flashToll(ms) {
    body.classList.add('toll');
    setTimeout(function () { body.classList.remove('toll'); }, ms);
  }

  /* 书拒绝「让这件事从未发生」 */
  function refuse() {
    state.refused[state.event + ':' + state.node] = true;
    state.opt = null;
    recoil();
    flashToll(700);
    state.voice.evR = { k: 'refuse', fresh: true };
    renderFace('evR');
    focusKey('opt0');
    announce(voiceText(state.voice.evR));
  }

  /* 落笔成真：改写、连锁、代价 */
  function commit() {
    state.busy = true;
    var e = state.event, n = state.node, a = state.opt, k = rw().length;
    var toll = { k: k };
    if (k === 1) {
      var others = [1, 2].map(function (d) { return (e + d) % EVENTS.length; });
      var pick = others.filter(function (i) { return !rewriteOf(i) && !tailTaken(i); })[0];
      toll.target = pick != null ? pick : others[0];
    }
    led.rewrites.push({ e: e, n: n, a: a, at: Date.now(), toll: toll });
    saveLedger();
    var idx = led.rewrites.length - 1;
    state.entry = idx;

    // 墨团从落笔处炸开
    var face = faceOf.evL, ne = nodeEl();
    var wx = 0.5, wy = 0.4;
    if (ne) {
      var wr = ne.getBoundingClientRect();
      wx = (wr.left + wr.width / 2) / (window.innerWidth || 1);
      wy = (wr.top + wr.height / 2) / (window.innerHeight || 1);
    }
    if (ne) {
      var fr = face.getBoundingClientRect(), nr = ne.getBoundingClientRect();
      var bloom = document.createElement('div');
      bloom.className = 'bloom';
      bloom.style.left = (((nr.left + nr.width / 2) - fr.left) / fr.width * 100).toFixed(1) + '%';
      bloom.style.top = (((nr.top + nr.height / 2) - fr.top) / fr.height * 100).toFixed(1) + '%';
      face.appendChild(bloom);
      setTimeout(function () { bloom.remove(); }, 2400);
    }
    recoil();
    flashToll(1700);

    state.view = 'now'; state.node = null; state.opt = null; state.optPredict = null; state.optNote = null;
    state.idxPredict = undefined; state.idxChosen = null;
    state.voice.evR = { k: 'done', fresh: true };
    state.voice.ledL = null;
    announce(T().v_done);

    setTimeout(function () {
      renderFace('evL', { anim: true });
      renderFace('evR', { anim: true });
      ['p1', 'p2', 'index', 'ledL', 'ledR'].forEach(function (id) { renderFace(id); });
      applyRot();
      focusKey('to-ledger');
    }, 380);
    // 世界改写：全屏播放，结束（或跳过）后才交还控制
    var rec = led.rewrites[idx];
    var played = playWorld(rec, wx, wy);
    played.then(function () {
      state.busy = false;
      focusKey('to-ledger');
      announce(EVENTS[e].nodes[n].alts[a].chain[L()][2]);
      setTimeout(function () { setVoice('evR', 'toll', idx); }, 500);
    });
  }

  /* 世界改写序列（world.js）。没有 world.js 或出错时退回短暂等待。 */
  function playWorld(rec, x, y) {
    var W = window.ChroniclesWorld;
    if (!W) return wait(2600);
    var t = T();
    try {
      return wait(700).then(function () {
        return W.play({ e: rec.e, n: rec.n, a: rec.a, k: rec.toll.k, x: x, y: y, captions: t.worldCap, skipLabel: t.worldSkip, label: t.worldLabel, reduced: reduced() }).promise;
      }).catch(function () { return null; });
    } catch (err) { return wait(1000); }
  }

  function replayWorld(i) {
    var rec = rw()[i];
    if (!rec || state.busy || hold) return;
    state.busy = true;
    playWorld(rec, 0.5, 0.4).then(function () {
      state.busy = false;
      focusKey('replay');
    });
  }

  /* 撕下记录页：归还一切（书会记得） */
  function tearAll() {
    if (state.busy || !rw().length) return;
    var face = faceOf.ledR;
    var hole = document.createElement('div'), piece = document.createElement('div');
    hole.className = 'torn-hole'; piece.className = 'torn-piece';
    face.appendChild(hole); face.appendChild(piece);
    setTimeout(function () { piece.remove(); }, 1700);
    setTimeout(function () { hole.remove(); }, 3500);
    led.torn += 1;
    led.rewrites = [];
    saveLedger();
    state.entry = 0; state.refused = {}; state.node = null; state.opt = null; state.optPredict = null; state.optNote = null;
    state.idxPredict = undefined; state.idxChosen = null;
    state.voice = { ledL: { k: 'tearDone', fresh: true } };
    flashToll(900);
    renderAll();
    applyRot();
    focusEl($('btn-prev'));
    announce(T().v_tearDone);
  }

  /* =====================================================================
     浮尘：光柱中更亮；墨蚀加深后反向上浮；光被取走后不再被照亮
     ===================================================================== */
  var dust = { running: false, rise: false, dark: false };
  function initDust() {
    var c = $('dust'), ctx = c.getContext('2d');
    var W = 0, H = 0, parts = [], last = 0;
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
      return { x: Math.random() * W, y: anywhere ? Math.random() * H : -5, z: Math.random(),
        vx: (Math.random() - 0.5) * 0.012, vy: 0.002 + Math.random() * 0.01, ph: Math.random() * Math.PI * 2, tw: 0.4 + Math.random() * 1.4 };
    }
    function inShaft(x, y) {
      if (dust.dark) return 0;
      var vx = (x - map.ox) / map.s, vy = (y - map.oy) / map.s, t = (vy - SY0) / (SY1 - SY0);
      if (t < -0.02 || t > 1.05) return 0;
      t = Math.max(0, Math.min(1, t));
      var cx = SX0 + (SX1 - SX0) * t, hw = SW0 + (SW1 - SW0) * t, d = Math.abs(vx - cx) / hw;
      if (d >= 1.25) return 0;
      return Math.pow(1 - d / 1.25, 1.5) * (1 - t * 0.45);
    }
    function draw(now, dt) {
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      var lift = dust.rise ? 0.016 : 0;
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        if (dt) {
          p.vx = Math.max(-0.03, Math.min(0.03, p.vx + (Math.random() - 0.5) * 0.0016));
          p.vy = Math.max(-0.006, Math.min(0.02, p.vy + (Math.random() - 0.5) * 0.0012));
          p.x += p.vx * dt; p.y += (p.vy - lift) * dt;
          if (p.y > H + 5 || p.x < -10 || p.x > W + 10 || p.y < -10) {
            parts[i] = spawn(false); parts[i].x = Math.random() * W;
            parts[i].y = dust.rise ? H + 4 : (Math.random() < 0.5 ? -5 : Math.random() * H);
            continue;
          }
        }
        var lit = inShaft(p.x, p.y);
        var tw = 0.55 + 0.45 * Math.sin(now * 0.001 * p.tw + p.ph);
        var a = ((dust.dark ? 0.022 : 0.035) + lit * 0.75) * tw * (0.45 + p.z * 0.55);
        if (a < 0.01) continue;
        var r = 0.5 + p.z * 1.5 + lit * 0.4;
        ctx.fillStyle = dust.dark ? 'rgba(220,120,90,' + a.toFixed(3) + ')' : 'rgba(255,' + (200 + Math.round(30 * lit)) + ',' + (150 + Math.round(40 * lit)) + ',' + a.toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
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
      dust.running = true; last = 0;
      if (reduced()) draw(0, 0);
      requestAnimationFrame(loop);
    };
    if (rmQuery.addEventListener) rmQuery.addEventListener('change', function () { draw(0, 0); });
  }
  function startDust() { if (dust.start) dust.start(); }

  function buildStars() {
    var g = $('stars');
    if (!g) return;
    var seed = 20261031;
    var rnd = function () { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    var ns = 'http://www.w3.org/2000/svg';
    for (var i = 0; i < 110; i++) {
      var x = rnd() * 1600, y = rnd() * 330, c = document.createElementNS(ns, 'circle');
      c.setAttribute('cx', x.toFixed(1)); c.setAttribute('cy', y.toFixed(1));
      c.setAttribute('r', (0.5 + rnd() * 1.1).toFixed(2));
      c.setAttribute('fill', rnd() < 0.2 ? '#ffe2c4' : '#cdd6ff');
      c.setAttribute('opacity', (0.15 + rnd() * 0.5 * (1 - y / 400)).toFixed(2));
      g.appendChild(c);
    }
  }

  /* =====================================================================
     事件
     ===================================================================== */
  function isControl(el) {
    if (!el || !el.tagName) return false;
    var tag = el.tagName;
    return tag === 'BUTTON' || tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'A' || tag === 'SELECT' || el.getAttribute('role') === 'button';
  }
  function act(el) {
    if (!el || el.disabled) return;
    var a = el.getAttribute('data-act');
    switch (a) {
      case 'event': chooseEvent(+el.getAttribute('data-i')); break;
      case 'node': selectNode(+el.getAttribute('data-n')); break;
      case 'opt': selectOpt(+el.getAttribute('data-a')); break;
      case 'view':
        if (state.busy || hold) return;
        state.view = el.getAttribute('data-v');
        renderFace('evL');
        break;
      case 'index': go(3, 'ev' + state.event); break;
      case 'ledger': go(5, rw().length ? 'entry' + (rw().length - 1) : null); break;
      case 'entry': state.entry = +el.getAttribute('data-r'); renderFace('ledL'); renderFace('ledR'); break;
      case 'goto':
        if (state.busy) return;
        state.event = +el.getAttribute('data-e'); state.view = el.getAttribute('data-v');
        state.node = null; state.opt = null; state.optNote = null;
        state.voice.evR = { k: 'locked', fresh: true };
        renderFace('evL'); renderFace('evR');
        go(4, 'view-' + state.view);
        break;
      case 'replay': replayWorld(+el.getAttribute('data-r')); break;
      case 'tear': tearAll(); break;
    }
  }

  function bind() {
    $('cave-btn').addEventListener('click', enterCave);
    $('cover-hit').addEventListener('click', openBook);
    $('btn-next').addEventListener('click', function () { turn(1); });
    $('btn-prev').addEventListener('click', function () { turn(-1); });
    $('corner-next').addEventListener('click', function () { turn(1); });
    $('corner-prev').addEventListener('click', function () { turn(-1); });
    $('btn-close').addEventListener('click', closeBook);
    $('ribbon').addEventListener('click', function () { if (!state.busy) setLang(state.lang === 'zh' ? 'en' : 'zh'); });

    leavesWrap.addEventListener('click', function (e) {
      var el = e.target.closest('[data-act]');
      if (!el || el.getAttribute('data-act') === 'hold') return;
      act(el);
    });
    leavesWrap.addEventListener('keydown', function (e) {
      var el = e.target.closest && e.target.closest('[data-act]');
      if (!el) return;
      var isHold = el.getAttribute('data-act') === 'hold';
      if (isHold && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        if (!e.repeat) startHold();
      } else if (el.getAttribute('role') === 'button' && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        act(el);
      }
    });
    leavesWrap.addEventListener('keyup', function (e) {
      var el = e.target.closest && e.target.closest('[data-act="hold"]');
      if (el && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); releaseHold(); }
    });
    leavesWrap.addEventListener('pointerdown', function (e) {
      var el = e.target.closest('[data-act="hold"]');
      if (!el || el.disabled || e.button > 0) return;
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      focusEl(el);
      startHold();
    });
    var endPointer = function () { releaseHold(); };
    window.addEventListener('pointerup', endPointer);
    window.addEventListener('pointercancel', endPointer);
    window.addEventListener('blur', function () { releaseHold(true); });
    leavesWrap.addEventListener('focusout', function (e) {
      if (hold && e.target.closest && e.target.closest('[data-act="hold"]')) releaseHold();
    });
    // 预知：在某个写法上停留，书会先在页边写下你的选择
    leavesWrap.addEventListener('pointerover', function (e) {
      var o = e.target.closest('.opt'); if (o && !o.disabled) dwellStart(+o.getAttribute('data-a'));
    });
    leavesWrap.addEventListener('pointerout', function (e) {
      var o = e.target.closest('.opt'); if (o && !o.contains(e.relatedTarget)) dwellEnd();
    });
    leavesWrap.addEventListener('focusin', function (e) {
      var o = e.target.closest && e.target.closest('.opt'); if (o && !o.disabled) dwellStart(+o.getAttribute('data-a'));
    });
    leavesWrap.addEventListener('focusout', function (e) {
      if (e.target.closest && e.target.closest('.opt')) dwellEnd();
    });

    document.addEventListener('keydown', function (e) {
      var t = e.target;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (state.scene === 'entrance') {
        if (e.key === 'Enter' && !isControl(t)) { e.preventDefault(); enterCave(); }
        return;
      }
      if (state.book === 'table') {
        if (e.key === 'Enter' && !isControl(t)) { e.preventDefault(); openBook(); }
        return;
      }
      if (state.book === 'open') {
        if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); turn(1); }
        else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); turn(-1); }
        else if (e.key === 'Escape') { e.preventDefault(); closeBook(); }
      }
    });
  }

  /* =====================================================================
     启动
     ===================================================================== */
  buildLeaves();
  buildVeins();
  renderAll();
  applyUI();
  applyRot();
  buildStars();
  initDust();
  bind();
  updateUI();

  // 供自动化验证使用的只读状态
  window.__chronicles = { state: state, ledger: function () { return JSON.parse(JSON.stringify(led)); } };
})();
