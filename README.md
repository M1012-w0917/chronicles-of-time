# chronicles-of-time

岁月史书 · Chronicles of Time：一个可进入的静态网页，复刻藏在乌鲁鲁岩腔中的那本书。致敬《成龙历险记》的非官方作品，Kiroween 2026 Costume Contest 方向。

## 打开
双击 `index.html` 即可（file:// 直接可用）。不需要服务器、联网或构建步骤。

## 文件
- `index.html`：页面结构，以及岩口、石室、石台的内联 SVG
- `style.css`：全部视觉，包括羊皮纸、皮面封面、书槽、光柱、动画和减少动态
- `app.js`：原生 JS，中英文案内联；负责翻页、试笔页和浮尘 canvas

## 操作
- 入洞：点击画面或按 Enter
- 开书：点书或按 Enter
- 翻页：点页角、按 ← / →，或点底部的「前页 / 后页」
- 切换语言：点书顶的红色书签
- 试笔页（最后一页）：写一句话（最多 200 字），点「落笔」或按 Enter；点「撕下页角」恢复原文
- 合书：点「合上书」或按 Esc

系统开启「减少动态」时，翻页和场景切换改为淡入淡出。

## 素材与字体
- 不含任何图片、音频或字体文件；纹理均由 CSS 渐变和 SVG `feTurbulence` 程序生成。
- 字体只用系统字体回退：中文为宋体系（Songti SC / STSong / Noto Serif CJK SC / Source Han Serif SC / SimSun），英文为衬线体（Iowan Old Style / Palatino / Book Antiqua / Georgia）。
- 正文、英文铭文和图案均为原创；中文铭文「既已写下，便将如此。」为需求方提供的译句。

## 本地存储
- `chronicles-of-time.trial.v1`：试笔页写下的一句话
- `chronicles-of-time.lang.v1`：语言（zh / en）

数据只保存在当前浏览器，不会上传。
