import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {meta,lessons,glossary,keywordMap} from './src/content.mjs';
import {interviews} from './src/interviews.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const project=path.resolve(here,'../..');
const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:project,encoding:'utf8'}).trim();
const snapshot=[];
for(const lesson of lessons){
  for(const ref of lesson.refs){
    const absolute=path.resolve(project,ref.file);
    if(!absolute.startsWith(project+path.sep))throw new Error('Source outside project');
    const raw=await fs.readFile(absolute,'utf8');
    const lines=raw.replace(/\r\n/g,'\n').split('\n');
    const index=lines.findIndex(line=>line.includes(ref.anchor));
    if(index<0)throw new Error(`Source anchor missing: ${ref.file} / ${ref.anchor}`);
    ref.start=index+1;ref.end=Math.min(index+ref.count,lines.length);ref.lines=lines.slice(index,ref.end);
    ref.url=`${meta.repo}/blob/${commit}/${ref.file}#L${ref.start}`;
    snapshot.push({lesson:lesson.id,file:ref.file,start:ref.start,end:ref.end,sha256:crypto.createHash('sha256').update(raw).digest('hex')});
  }
}
const corpus=[];
for(const document of ['SOP-VAC-01','SOP-TEMP-02','SOP-MES-03']){
  const raw=await fs.readFile(path.join(project,'knowledge',document+'.md'),'utf8');
  const pieces=raw.replace(/\r\n/g,'\n').split('\n## ');
  const title=pieces[0].split('\n')[0].replace(/^#\s*/,'').trim();
  const split=pieces[1].indexOf('\n'),heading=pieces[1].slice(0,split),content=pieces[1].slice(split+1).trim();
  corpus.push({id:document+'#'+crypto.createHash('sha256').update(content).digest('hex').slice(0,8),document,title:title+' / '+heading,content});
}
const css=await fs.readFile(path.join(here,'src/course.css'),'utf8');
const diagrams=await fs.readFile(path.join(here,'src/diagrams.js'),'utf8');
const app=await fs.readFile(path.join(here,'src/course.js'),'utf8');
const data={meta:{...meta,commit,repoVisibility:'PUBLIC',sourceSnapshot:snapshot},lessons,glossary,keywordMap,interviews,corpus};
const serialized=JSON.stringify(data).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
const html=`<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="${meta.description}"><meta name="referrer" content="no-referrer"><title>${meta.title}</title><style>${css}</style></head>
<body><a class="screen-reader" href="#course-main">跳到課程內容</a><div id="learning-app"><header class="topbar"><button class="brand" data-nav="welcome">FabOps 從零到面試<small>15 課 · 圖解 · 演練</small></button><div class="top-actions"><button id="menu-toggle" class="menu-button" aria-expanded="false" aria-controls="sidebar">課程</button><button id="font-toggle" aria-label="切換閱讀字級">字級</button><button id="print-page" class="desktop-only">列印本頁</button></div></header><div class="shell"><aside id="sidebar" class="sidebar" aria-label="教材導覽"><div class="progress-copy"><div class="progress-track"><div id="progress-fill" class="progress-fill"></div></div><div id="progress-copy">已標記閱讀 0 / 15 課</div></div><label class="screen-reader" for="lesson-search">搜尋課程</label><input type="search" id="lesson-search" placeholder="搜尋課程／關鍵字"><nav id="side-nav" class="side-nav"></nav><div class="footer"><p id="storage-status">進度與回答只存於本機瀏覽器。</p><button id="reset-progress" class="linklike">清除學習紀錄</button></div></aside><main id="course-main" class="content" tabindex="-1"></main></div><div id="toast" class="toast" role="status" hidden></div></div>
<dialog id="term-dialog" aria-labelledby="term-title"><div class="dialog-top"><h2 id="term-title">名詞解釋</h2><button class="btn" data-close>關閉</button></div><p id="term-body"></p><button class="btn primary" data-term-lesson="story">回到相關課程</button></dialog>
<dialog id="diagram-dialog" aria-labelledby="zoom-title"><div class="dialog-top"><h2 id="zoom-title">圖解</h2><button class="btn" data-close>關閉</button></div><div id="zoom-body" class="diagram-scroll" tabindex="0" aria-label="放大圖解，可左右捲動"></div></dialog>
<noscript><div class="no-js"><h1>FabOps 從零到面試</h1><p>本教材需要瀏覽器允許JavaScript來呈現課程與互動。所有資料已包含在這一個檔案，不需要啟動AI或網路服務。</p></div></noscript>
<script>const COURSE=${serialized};\n${diagrams}\n${app}</script></body></html>`;
await fs.writeFile(path.join(here,'index.html'),html,'utf8');
// The generated file is self-contained and can be copied independently.
console.log(JSON.stringify({lessons:lessons.length,questions:interviews.length,glossary:glossary.length,keywordRows:keywordMap.length,sourceExcerpts:snapshot.length,bytes:Buffer.byteLength(html),commit}));
