'use strict';
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pc=v=>v==null?'—':Math.round(v*100)+'%';
const ymd=d=>{const x=new Date(d);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')};
let S,view='home',R={};
const ctx={sk:{task:'',lv:2,a:10,s:0,p:''},pt:{p:'',n:0,type:'game'},td:{min:90,people:20,coaches:2,fatigue:false,pain:[]},pid:null,cands:null};
/* ---- 保存(IndexedDB) ---- */
const DB={open:()=>new Promise((res,rej)=>{const r=indexedDB.open('yakyu',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}),
async get(){const db=await this.open();return new Promise(res=>{const q=db.transaction('kv').objectStore('kv').get('state');q.onsuccess=()=>res(q.result);q.onerror=()=>res(null)})},
async set(v){const db=await this.open();return new Promise((res,rej)=>{const t=db.transaction('kv','readwrite');t.objectStore('kv').put(v,'state');t.oncomplete=res;t.onerror=()=>rej(t.error)})}};
async function save(){try{await DB.set(S)}catch(e){toast('保存できませんでした。設定からバックアップを書き出してください')}}
function toast(m){const t=$('#toast');t.textContent=m;t.style.display='block';clearTimeout(toast.h);toast.h=setTimeout(()=>t.style.display='none',2600)}
function fresh(){const p=[];let n=1;SEED_TEAM.forEach(([g,c])=>{for(let i=1;i<=c;i++)p.push({id:'p'+n++,name:GRADES[g]+i,grade:g,pos:'',th:'右',bt:'右',role:''})});
return{players:p,tasks:TASKS0.map(([id,name,q,dom,scope,imp,tg,lv,min])=>({id,name,q,dom,scope,imp,tg,lv,min})),rec:[],pitch:[],plans:[],set:{tourn:{name:'',date:''},lim:{dayU:70,dayL:60,wkU:210,wkL:180},lastBackup:null}}}
/* ---- 集計 ---- */
const rate=t=>{const r=S.rec.filter(x=>x.task===t.id).slice(-30),a=r.reduce((s,x)=>s+x.a,0);return a?{p:r.reduce((s,x)=>s+x.s,0)/a,n:a}:null};
const trate=t=>{const r=S.rec.filter(x=>x.task===t.id&&x.lv>=4),a=r.reduce((s,x)=>s+x.a,0);return a?r.reduce((s,x)=>s+x.s,0)/a:null};
const dleft=()=>{const d=S.set.tourn.date;return d?Math.ceil((new Date(d+'T00:00:00')-new Date(new Date().toDateString()))/864e5):null};
const band=d=>d==null||d<0||d>=30?0:d>=15?1:d>=8?2:d>=4?3:4;
const DT={A:[.4,.7,1,1,.7],B:[1,.9,.7,.5,.2],C:[.5,.6,.7,.8,1],D:[.8,.7,.6,.6,.7]};
function prio(t){const c=rate(t),tr=trate(t),d=dleft();
const f={'試合影響が大きい':t.imp/5,'目標との差が大きい':c?Math.max(.1,(t.tg/100-c.p)/(t.tg/100)):.5,'大会が近い':DT[t.q][band(d)],'実戦転移が不足':tr==null?.7:Math.max(.1,1-tr),'チームに重要':{team:1,position:.8,player:.6}[t.scope]||.8,'伸びしろがある':c&&c.p>=.85?.3:.7};
const v=Object.values(f),sc=Math.exp(v.reduce((s,x)=>s+Math.log(Math.max(.05,x)),0)/v.length)*100;
return{t,sc,c,conf:!!(c&&c.n>=10),why:Object.entries(f).filter(e=>e[1]>=.7).sort((a,b)=>b[1]-a[1]).slice(0,2).map(e=>e[0])}}
const ranked=()=>S.tasks.map(prio).sort((a,b)=>b.sc-a.sc);
/* ---- 投球管理 ---- */
const wk0=()=>{const d=new Date();d.setDate(d.getDate()-((d.getDay()+6)%7));return ymd(d)};
const pday=id=>S.pitch.filter(x=>x.p===id&&x.d===ymd(new Date())).reduce((s,x)=>s+x.n,0);
const pwk=id=>S.pitch.filter(x=>x.p===id&&x.d>=wk0()).reduce((s,x)=>s+x.n,0);
const lim=p=>p.grade>=5?{d:S.set.lim.dayU,w:S.set.lim.wkU}:{d:S.set.lim.dayL,w:S.set.lim.wkL};
const near=p=>pday(p.id)>=lim(p).d*.8||pwk(p.id)>=lim(p).w*.8;
/* ---- 練習生成 ---- */
function pick(dom,lv,noPitch){const c=DRILLS.filter(x=>x.d===dom&&!(noPitch&&x.pitch));return c.sort((a,b)=>Math.abs(a.lv-lv)-Math.abs(b.lv-lv))[0]}
function gen(o){const b=band(dleft()),P=ranked(),risky=o.fatigue||o.pain.length>0||S.players.some(near);
const W=[[.3,.3],[.25,.28],[.2,.25],[.15,.25],[.1,.2]][b],cd=b==4?10:5,rest=Math.max(10,o.min-10-5-cd);
const m0=Math.round(rest*W[0]/.75/5)*5,m1=Math.round(rest*W[1]/.75/5)*5,m2=Math.max(5,rest-m0-m1);
const cdT=P.find(x=>x.t.q==='C'||x.t.q==='D')||P[0];
const adj=(x,dr)=>!x.c?'まず10回で現状を測る':x.c.p<.7?'難しい→'+dr.easy:x.c.p>=.85?'1要素だけ難しく→'+dr.hard:'同じ難しさで継続';
const mk=(lab,min,x,lv)=>{const dr=pick(x.t.dom,lv,risky);return dr?{l:lab,min,t:x.t.name,dr,adj:adj(x,dr)}:null};
const orders=[[0,1,2],[1,0,2],[2,0,1]],names=['最優先課題を集中','2番目の課題を先に','判断・実戦を厚く'];
const cands=orders.map((od,i)=>{const [a,bb,c]=od.map(k=>P[k%P.length]);
const bl=[{l:'ウォームアップ',min:10,t:'動的ストレッチ・キャッチボール',txt:risky?'強度を下げ、肩・肘は特に丁寧に':''},mk('技術',m0,a,Math.min(a.t.lv,2)),mk('課題',m1,bb,bb.t.lv),mk('判断・実戦',m2,i===2?c:a,Math.min(5,Math.max(3,(i===2?c:a).t.lv+1))),mk('習慣・判断(C/D)',cd,cdT,cdT.t.lv),{l:'振り返り',min:5,t:'選手が「できた・難しかった・次にやること」を一言ずつ'}].filter(Boolean);
const gn=o.people>=8?Math.min(3,Math.max(2,o.coaches)):1;
const groups=gn<2?[]:(G=>gn===2?[G[0],G[2]]:G)(['基礎：距離を短く・時間制限なし','標準：通常の設定','発展：1要素だけ難しく（速度か時間）']);
return{title:'案'+(i+1)+'：'+names[i],bl,groups,focus:[a,bb,c].filter(Boolean).map(x=>x.t.name)}});
return{cands,risky,days:dleft()}}
/* ---- UI部品 ---- */
function form(title,fields,init,cb,del){const m=document.createElement('div');m.className='modal';
m.innerHTML='<form class="sheet"><h3>'+esc(title)+'</h3>'+fields.map(([k,l,t,o])=>'<label>'+esc(l)+(t==='select'?'<select name="'+k+'">'+o.map(([v,x])=>'<option value="'+esc(v)+'">'+esc(x)+'</option>').join('')+'</select>':'<input name="'+k+'" type="'+t+'">')+'</label>').join('')+'<button class="pri">保存</button><button type="button" class="sec" id="cx">キャンセル</button>'+(del?'<button type="button" class="dng" id="dl">削除</button>':'')+'</form>';
document.body.appendChild(m);const f=m.querySelector('form');fields.forEach(([k])=>{if(init[k]!=null)f.elements[k].value=init[k]});
m.querySelector('#cx').onclick=()=>m.remove();if(del)m.querySelector('#dl').onclick=()=>{if(confirm('削除しますか？')){del();m.remove()}};
f.onsubmit=e=>{e.preventDefault();const v={};fields.forEach(([k,,t])=>v[k]=t==='number'?Number(f.elements[k].value):f.elements[k].value);cb(v);m.remove()}}
const stp=(id,v,d,fn)=>'<div class="step"><button onclick="'+fn+'-'+d+')">−</button><b>'+v+'</b><button onclick="'+fn+d+')">＋</button></div>';
const opt=(arr,sel)=>arr.map(([v,l])=>'<option value="'+esc(v)+'"'+(v===sel?' selected':'')+'>'+esc(l)+'</option>').join('');
const bar=(p,hi)=>'<div class="bar"><i class="'+(hi?'hi':'')+'" style="width:'+Math.min(100,Math.round(p*100))+'%"></i></div>';
/* ---- 画面 ---- */
R.home=()=>{const d=dleft(),P=ranked(),t=P[0],td=S.plans.find(p=>p.d===ymd(new Date())),miss=[];
const un=S.tasks.filter(x=>!rate(x)).length;
if(!S.set.tourn.date)miss.push('大会日が未設定');if(un)miss.push('成功率が未入力の課題 '+un+'件');if(!S.set.lastBackup||Date.now()-S.set.lastBackup>2592e6)miss.push('バックアップが30日以上未実施');
const pl=S.players.filter(p=>pday(p.id)||pwk(p.id));
return '<div class="card"><small>次の大会：'+esc(S.set.tourn.name||'未設定')+'</small><div class="big">'+(d==null?'—':d<0?'終了':d)+'<span>日</span></div></div>'
+'<div class="card"><small>今日の最重要課題</small>'+(t?'<h3>'+esc(t.t.name)+'</h3><span class="tag">'+t.t.q+'</span> 現在 '+pc(t.c&&t.c.p)+' / 目標 '+t.t.tg+'%<p>理由：'+(t.why.join('・')||'—')+(t.conf?'':'（記録が少ない参考値）')+'</p>':'課題を追加してください')+'<button class="pri" onclick="go(\'today\')">今日の練習をつくる</button></div>'
+(td?'<div class="card"><small>今日の練習（採用済み）</small><h3>'+esc(td.title)+'</h3><p>'+esc(td.focus.join(' / '))+'</p></div>':'')
+'<div class="card"><small>投球管理（今日 / 今週）</small>'+(pl.length?pl.map(p=>'<div class="item" style="cursor:default"><span>'+esc(p.name)+'</span><span>'+pday(p.id)+'/'+lim(p).d+'　'+pwk(p.id)+'/'+lim(p).w+'</span></div>').join(''):'<p>記録なし</p>')+'<button class="sec" onclick="go(\'log\')">投球数を入力</button></div>'
+(miss.length?'<div class="warn"><b>未入力・要対応</b><br>'+miss.join('<br>')+'</div>':'')}
R.players=()=>'<h2>選手</h2><small>順位や優劣は表示しません。学年順の一覧です。</small>'+[...S.players].sort((a,b)=>b.grade-a.grade).map(p=>'<div class="item" onclick="pdet(\''+p.id+'\')"><span>'+esc(p.name)+' <small>'+GRADES[p.grade]+' '+esc(p.pos)+'</small></span><span>›</span></div>').join('')+'<button class="pri" onclick="pedit()">選手を追加</button>'
R.pdet=()=>{const p=S.players.find(x=>x.id===ctx.pid);if(!p)return R.players();
const rows=S.tasks.map(t=>{const r=S.rec.filter(x=>x.task===t.id&&x.p===p.id),a=r.reduce((s,x)=>s+x.a,0);return a?'<div class="item" style="cursor:default"><span>'+esc(t.name)+'<br><small>段階 '+Math.max(...r.map(x=>x.lv))+' ('+LV[Math.max(...r.map(x=>x.lv))]+')</small></span><b>'+r.reduce((s,x)=>s+x.s,0)+'/'+a+'</b></div>':''}).join('');
return '<h2>'+esc(p.name)+'</h2><div class="card">'+GRADES[p.grade]+'　'+esc(p.pos)+'　投'+p.th+' 打'+p.bt+'　'+esc(p.role)+'<p>投球 今日 '+pday(p.id)+'/'+lim(p).d+'　今週 '+pwk(p.id)+'/'+lim(p).w+'</p></div><h3>課題別の成功数</h3>'+(rows||'<p>まだ記録がありません</p>')+'<button class="sec" onclick="pedit(\''+p.id+'\')">編集・削除</button><button class="sec" onclick="go(\'players\')">一覧へ戻る</button>'}
R.tasks=()=>{const P=ranked();return '<h2>課題</h2>'+P.map(x=>'<div class="card" onclick="tedit(\''+x.t.id+'\')"><div class="row"><span class="tag" style="flex:0">'+x.t.q+'</span><b style="flex:4">'+esc(x.t.name)+'</b></div><small>'+({team:'チーム',position:'ポジション',player:'個人'}[x.t.scope])+'　段階'+x.t.lv+'　目標'+x.t.tg+'%'+(x.conf?'':'　参考値')+'</small>'+bar(x.c?x.c.p:0)+'<small>現在 '+pc(x.c&&x.c.p)+'（'+(x.c?x.c.n:0)+'回）</small></div>').join('')+'<button class="pri" onclick="tedit()">課題を追加</button>'}
R.matrix=()=>{const P=ranked();return '<h2>マトリクス</h2><small>分類は固定ではなく、大会日・成功率で優先順位が変わります。</small><div class="q" style="margin-top:8px">'+['A','B','C','D'].map(q=>'<div><b>'+QUAD[q]+'</b>'+P.filter(x=>x.t.q===q).map(x=>'<p>'+esc(x.t.name)+'<br><small>優先 '+Math.round(x.sc)+'</small></p>').join('')+'</div>').join('')+'</div>'}
const blkH=b=>{const d=b.dr;if(!d)return '<div class="blk"><b>'+esc(b.l)+' '+b.min+'分</b>　'+esc(b.t)+(b.txt?'<br>'+esc(b.txt):'')+'</div>';
return '<div class="blk"><b>'+esc(b.l)+' '+b.min+'分</b>　'+esc(d.n)+'<br>課題：'+esc(b.t)+'（'+LV[d.lv]+'・実戦転移 '+d.tr+'/5）<br>目的：'+esc(d.aim)+'<br>手順：'+esc(d.steps)+'<br>成功基準：<b>'+esc(d.ok)+'</b><br>調整：'+esc(b.adj)+'<br><small>道具：'+esc(d.tools)+'</small></div>'};
R.today=()=>{const o=ctx.td,c=ctx.cands;
let h='<h2>今日の練習</h2><div class="card"><label>練習時間（分）</label>'+stp('',o.min,10,'tdn(\'min\',')+'<label>参加人数</label>'+stp('',o.people,1,'tdn(\'people\',')+'<label>指導者数</label>'+stp('',o.coaches,1,'tdn(\'coaches\',')+'<label>今日の状態</label><div class="chips"><button class="'+(o.fatigue?'on':'')+'" onclick="ctx.td.fatigue=!ctx.td.fatigue;render()">疲労・集中低下あり</button></div><label>痛みを申告した選手（診断はしません）</label><div class="chips">'+S.players.map(p=>'<button class="'+(o.pain.includes(p.id)?'on':'')+'" onclick="tpain(\''+p.id+'\')">'+esc(p.name)+'</button>').join('')+'</div><button class="pri" onclick="ctx.cands=gen(ctx.td);render()">練習案を3つ出す</button></div>';
if(c){const np=S.players.filter(near).map(p=>p.name);
if(c.risky)h+='<div class="warn"><b>安全確認</b><br>練習量は増やしません。投球ドリルを外し、距離・速度・反復を控えめにします。'+(o.pain.length?'<br>痛みの申告がある選手は投球や強い送球を外し、保護者・医療専門家への相談を促してください。':'')+(np.length?'<br>投球数が設定値に近い選手：'+esc(np.join('、'))+'':'')+'</div>';
h+=c.cands.map((x,i)=>'<details'+(i?'':' open')+'><summary>'+esc(x.title)+'</summary><small>対象：'+esc(x.focus.join(' / '))+'</small>'+x.bl.map(blkH).join('')+(x.groups.length?'<div class="blk"><b>グループ分け</b><br>'+x.groups.map(esc).join('<br>')+'</div>':'')+'<button class="pri" onclick="adopt('+i+')">この案を採用</button></details>').join('')}
return h}
R.log=()=>{const k=ctx.sk,pt=ctx.pt;if(!pt.p&&S.players[0])pt.p=S.players[0].id;if(!k.task&&S.tasks[0])k.task=S.tasks[0].id;
const hist=S.pitch.slice(-4).reverse().map(x=>{const p=S.players.find(y=>y.id===x.p);return esc(p?p.name:'?')+' '+x.n+'球('+(x.type==='game'?'試合':'練習')+')'}).join('<br>');
return '<h2>記録</h2><div class="card"><h3>成功率を入力</h3><label>課題</label><select onchange="ctx.sk.task=this.value">'+opt(S.tasks.map(t=>[t.id,t.name]),k.task)+'</select><label>練習の段階</label><select onchange="ctx.sk.lv=+this.value">'+opt([1,2,3,4,5].map(v=>[v,v+' '+LV[v]]).map(([v,l])=>[String(v),l]),String(k.lv))+'</select><label>対象選手（任意）</label><select onchange="ctx.sk.p=this.value"><option value="">全体</option>'+opt(S.players.map(p=>[p.id,p.name]),k.p)+'</select><label>試行回数</label>'+stp('',k.a,1,'skn(\'a\',')+'<label>成功回数</label>'+stp('',k.s,1,'skn(\'s\',')+'<button class="pri" onclick="saveSk()">'+k.s+'/'+k.a+' を保存</button></div>'
+'<div class="card"><h3>投球数を入力</h3><label>選手</label><select onchange="ctx.pt.p=this.value">'+opt(S.players.map(p=>[p.id,p.name]),pt.p)+'</select><label>種別</label><select onchange="ctx.pt.type=this.value">'+opt([['game','試合'],['practice','練習']],pt.type)+'</select><label>球数</label>'+stp('',pt.n,5,'ptn(')+'<button class="pri" onclick="savePt()">投球数を保存</button><p><small>'+hist+'</small></p><button class="sec" onclick="undoPt()">直前の投球記録を取り消す</button></div>'}
R.more=()=>{const s=S.set;return '<h2>設定とバックアップ</h2><div class="card"><button class="sec" onclick="tourn()">大会名・日付</button><button class="sec" onclick="limits()">投球数の上限（大会規定に合わせて変更）</button><small>初期値は仕様書の数値です。所属連盟・大会の最新規定を必ず確認してください。</small></div><div class="card"><button class="pri" onclick="exp()">バックアップを書き出す（JSON）</button><button class="sec" onclick="$(\'#imp\').click()">バックアップから復元</button><input id="imp" type="file" accept=".json" hidden onchange="imp(this)"><small>最終：'+(s.lastBackup?ymd(s.lastBackup):'未実施')+'</small></div><div class="card"><button class="sec" onclick="window.print()">画面を印刷（A4）</button><button class="dng" onclick="wipe()">全データを初期状態に戻す</button></div>'}
/* ---- 操作 ---- */
const NAV=[['home','ホーム'],['players','選手'],['tasks','課題'],['matrix','マトリクス'],['today','今日'],['log','記録']];
function render(){try{$('#v').innerHTML=R[view]();$('#nav').innerHTML=NAV.map(([k,l])=>'<button class="'+((view===k||(k==='players'&&view==='pdet'))?'on':'')+'" onclick="go(\''+k+'\')">'+l+'</button>').join('')}catch(e){$('#v').innerHTML='<div class="warn">画面を表示できませんでした：'+esc(e.message)+'</div>'}}
function go(v){view=v;render();scrollTo(0,0)}
function tdn(k,d){ctx.td[k]=Math.max(k==='min'?30:k==='coaches'?1:1,ctx.td[k]+d);render()}
function skn(k,d){const s=ctx.sk;s[k]=Math.max(0,s[k]+d);if(s.s>s.a){if(k==='a')s.s=s.a;else s.a=s.s}render()}
function ptn(d){ctx.pt.n=Math.max(0,ctx.pt.n+d);render()}
function tpain(id){const a=ctx.td.pain,i=a.indexOf(id);i<0?a.push(id):a.splice(i,1);render()}
async function saveSk(){const k=ctx.sk;if(!k.a)return toast('試行回数を入力してください');S.rec.push({id:Date.now(),task:k.task,lv:k.lv,a:k.a,s:k.s,p:k.p,d:ymd(new Date())});await save();toast('保存しました');render()}
async function savePt(){const p=ctx.pt;if(!p.n)return toast('球数を入力してください');const pl=S.players.find(x=>x.id===p.p),l=lim(pl);
if(pday(pl.id)+p.n>l.d&&!confirm('今日の合計が設定上限（'+l.d+'球）を超えます。記録しますか？'))return;
S.pitch.push({id:Date.now(),p:p.p,n:p.n,type:p.type,d:ymd(new Date())});p.n=0;await save();toast('保存しました');render()}
async function undoPt(){if(S.pitch.pop()){await save();render()}}
async function adopt(i){const c=ctx.cands.cands[i];S.plans=S.plans.filter(p=>p.d!==ymd(new Date()));S.plans.push({d:ymd(new Date()),title:c.title,focus:c.focus,min:ctx.td.min});await save();toast('採用しました');go('home')}
function pdet(id){ctx.pid=id;go('pdet')}
function pedit(id){const p=S.players.find(x=>x.id===id)||{grade:3,th:'右',bt:'右'};
form(id?'選手を編集':'選手を追加',[['name','名前','text'],['grade','学年','select',GRADES.map((g,i)=>[i,g])],['pos','ポジション','text'],['th','投','select',[['右','右'],['左','左']]],['bt','打','select',[['右','右'],['左','左'],['両','両']]],['role','役割','text']],p,async v=>{v.grade=+v.grade;if(!v.name)return;if(id)Object.assign(p,v);else S.players.push({id:'p'+Date.now(),...v});await save();go(id?'pdet':'players')},id?async()=>{S.players=S.players.filter(x=>x.id!==id);await save();go('players')}:null)}
function tedit(id){const t=S.tasks.find(x=>x.id===id)||{q:'A',scope:'team',imp:3,tg:80,lv:2,min:15,dom:'catch'};
form(id?'課題を編集':'課題を追加',[['name','課題名','text'],['q','分類','select',Object.entries(QUAD)],['scope','範囲','select',[['team','チーム'],['position','ポジション'],['player','個人']]],['dom','ドリル領域','select',[...new Set(DRILLS.map(d=>d.d))].map(d=>[d,d])],['imp','試合影響度(1-5)','number'],['tg','目標成功率(%)','number'],['lv','現在の練習段階(1-5)','number'],['min','推奨時間(分)','number']],t,async v=>{if(!v.name)return;v.q=v.q[0];if(id)Object.assign(t,v);else S.tasks.push({id:'t'+Date.now(),...v});await save();render()},id?async()=>{S.tasks=S.tasks.filter(x=>x.id!==id);await save();render()}:null)}
function tourn(){form('大会',[['name','大会名','text'],['date','大会日','date']],S.set.tourn,async v=>{S.set.tourn=v;await save();render()})}
function limits(){form('投球数の上限',[['dayU','5・6年 1日','number'],['wkU','5・6年 1週間','number'],['dayL','4年以下 1日','number'],['wkL','4年以下 1週間','number']],S.set.lim,async v=>{S.set.lim=v;await save();render()})}
async function exp(){const b=new Blob([JSON.stringify(S)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='yakyu-matrix-backup-'+ymd(new Date())+'.json';a.click();S.set.lastBackup=Date.now();await save();render()}
function imp(el){const f=el.files[0];if(!f)return;const r=new FileReader();r.onload=async()=>{try{const o=JSON.parse(r.result);if(!Array.isArray(o.players)||!Array.isArray(o.tasks))throw 0;if(!confirm('現在のデータを上書きして復元します。よろしいですか？'))return;S=o;await save();toast('復元しました');go('home')}catch(e){toast('このファイルは復元できません')}};r.readAsText(f)}
async function wipe(){if(confirm('全データを消して初期状態に戻します。先にバックアップを推奨します。続けますか？')){S=fresh();await save();go('home')}}
window.onerror=m=>toast('エラー：'+m);
(async()=>{try{S=await DB.get()}catch(e){}if(!S){S=fresh();await save()}render();if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{})})();
