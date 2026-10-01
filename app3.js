'use strict';
/* 追加仕様：活動日カレンダー・チーム練習日換算・自主練 */
const WD='日月火水木金土',LBL={TEAM_PRACTICE:'全体練習',GAME:'実戦',INDIVIDUAL:'自主練候補',REST:'休養',OTHER:'その他'};
const ROLE={課題発見:'成功率を測り、重点課題を確認する（段階1〜2）',基礎修正:'重点課題の基礎動作を修正する',制約付き:'条件を決めて反復する',判断:'判断付きのドリルで状況判断を鍛える',実戦転移:'段階4〜5で実戦に近づけて確認する',試合修正:'直前の試合で出た課題を修正する',最終調整:'新しい課題は入れず、確認・精度・判断・ルーティン',実戦確認:'実戦で課題の転移を確認し、データを取る'};
const addDays=(ds,n)=>{const d=new Date(ds+'T00:00:00');d.setDate(d.getDate()+n);return ymd(d)};
const diff=(a,b)=>Math.round((new Date(b+'T00:00:00')-new Date(a+'T00:00:00'))/864e5);
const today=()=>ymd(new Date()),wdOf=ds=>WD[new Date(ds+'T00:00:00').getDay()];
MENU.unshift(['cal','活動日'],['indiv','自主練']);
const _mig=migrate;migrate=function(){_mig();if(!S.cal)S.cal={week:{0:'team',1:'off',2:'team',3:'team',4:'off',5:'team',6:'team'},third:true,time:'',ev:{},roleOv:{}}};
/* 日の種類（大会＞休養＞練習試合＞全体練習＞自主練＞その他。すべて上書き可能） */
function typeOf(ds){const T=S.set.tourn;if(T.date===ds)return{t:'GAME',sub:'大会',name:T.name||'大会',time:(S.cal.ev[ds]||{}).time||''};
const e=S.cal.ev[ds];if(e)return{t:e.type,sub:e.sub||'',name:e.name||'',time:e.time||''};
const d=new Date(ds+'T00:00:00'),w=d.getDay();
if(w===0&&S.cal.third&&Math.ceil(d.getDate()/7)===3)return{t:'REST',sub:'',name:'第三日曜（原則休養）',time:''};
const k=S.cal.week[w];return{t:k==='team'?'TEAM_PRACTICE':k==='rest'?'REST':'INDIVIDUAL',sub:'',name:'',time:k==='team'?S.cal.time:''}}
/* 自主練／軽い自主練／休養の推奨（暦日だけでなく直近の活動量・翌日の予定で判断） */
function recFor(ds){const L=n=>typeOf(addDays(ds,n)),why=[];let load=0;
[[-1,1.5],[-2,1],[-3,1]].forEach(([n,w])=>{const x=L(n);load+=(x.t==='GAME'?2:x.t==='TEAM_PRACTICE'?1:0)*w});
if(L(-1).t==='GAME')why.push('前日が実戦');
if(ds===today()&&ctx.td.fatigue){load+=2;why.push('疲労の申告あり')}
if(Math.abs(diff(today(),ds))<=1&&S.players.some(near)){load+=1.5;why.push('投球数が上限に近い選手がいる')}
const n1=L(1);let k,min;
if(load>=4.5){k='休養推奨';min=0;why.push('直近の活動量が多い')}
else if(load>=3||n1.t==='GAME'){k='軽い自主練';min=15;why.push(n1.t==='GAME'?'翌日が実戦':'直近の活動量がやや多い')}
else{k='自主練推奨';min=20;why.push(n1.t==='TEAM_PRACTICE'?'次の全体練習に向けて重点課題を整える':'重点課題を短時間で改善')}
return{k,min,why}}
/* 大会までの活動日を暦日と別に数える（今日を含み、大会当日は含めない） */
function remain(){const T=S.set.tourn.date,t0=today();if(!T||T<=t0)return null;const o={tp:0,g:0,ind:0,rest:0,list:[]};
for(let ds=t0;ds<T;ds=addDays(ds,1)){const x=typeOf(ds),it={d:ds,...x};
if(x.t==='TEAM_PRACTICE')o.tp++;else if(x.t==='GAME')o.g++;else if(x.t==='REST')o.rest++;else if(x.t==='INDIVIDUAL'){it.rec=recFor(ds);it.rec.k==='休養推奨'?o.rest++:o.ind++}
o.list.push(it)}return o}
/* 全体練習・実戦の役割を自動割り当て（指導者が変更可能） */
function roles(o){const T=S.set.tourn.date,A=o.list.filter(x=>x.t==='TEAM_PRACTICE'||x.t==='GAME'),days=diff(today(),T);
const st=days>=30?['基礎修正','基礎修正','制約付き','判断']:days>=15?['基礎修正','制約付き','判断','実戦転移']:['基礎修正','判断','実戦転移'];
const tpN=A.filter(x=>x.t==='TEAM_PRACTICE').length,lg=A.map(x=>x.t).lastIndexOf('GAME');let ti=0;
A.forEach((x,i)=>{if(x.t==='GAME'){x.role='実戦確認';x.lastG=i===lg;x.title=i===lg?'大会前 最終実戦':(x.sub||'実戦')}
else{const pg=i>0&&A[i-1].t==='GAME',last=ti===tpN-1;x.lastTP=last;x.title=last?'大会前 最終全体練習':'全体練習';
x.role=last?'最終調整':pg?'試合修正':ti===0?'課題発見':st[Math.min(st.length-1,Math.floor(ti/Math.max(1,tpN-1)*st.length))];if(last&&pg)x.sub2='直前の試合の修正も含む';ti++}
const ov=S.cal.roleOv[x.d];if(ov&&ROLE[ov])x.role=ov;
const dd=diff(x.d,T);x.focus=S.tasks.map(t=>prio(t,dd)).sort((a,b)=>b.sc-a.sc).filter(p=>!(x.role==='最終調整'&&p.t.q==='B')).slice(0,2).map(p=>p.t.name);const g=S.games[S.games.length-1],wk=g?g.st.filter(y=>y.a&&y.s/y.a<.7).map(y=>tname(y.task)).slice(0,2):[];if(x.role==='試合修正'&&wk.length)x.focus=wk});return A}
const countsH=o=>'<div class="q" style="margin-top:8px">'+[['チーム練習',o.tp],['実戦',o.g],['自主練',o.ind],['休養',o.rest]].map(([l,n])=>'<div><small>'+l+'</small><div class="big" style="font-size:34px">あと'+n+'<span style="font-size:16px">回</span></div></div>').join('')+'</div>';
function schedH(){if(!S.set.tourn.date)return '<div class="warn">大会日を設定すると、残りの全体練習・実戦・自主練・休養の回数が出ます。<button class="sec" onclick="tourn()">大会日を設定</button></div>';
const o=remain();if(!o)return '';const A=roles(o);
return '<div class="card"><small>大会まで 暦日'+dleft()+'日の内訳</small>'+countsH(o)+(A.length?'<p><b>この'+o.tp+'回の全体練習の使い道</b><br>'+A.slice(0,8).map(x=>x.d.slice(5)+'（'+wdOf(x.d)+'）'+esc(x.title)+' → '+x.role).join('<br>')+'</p>':'')+'<button class="sec" onclick="go(\'plan\')">詳しく見る・役割を変更</button></div>'}
function nextH(){let ds=today(),it=null;for(let i=0;i<60;i++,ds=addDays(ds,1)){const x=typeOf(ds);if(x.t==='TEAM_PRACTICE'||x.t==='GAME'){it={d:ds,...x};break}}
if(!it)return '<div class="card"><small>次のチーム活動</small><p>予定がありません。活動日カレンダーで登録してください。</p></div>';
const o=remain(),r=o?roles(o).find(x=>x.d===it.d):null,top=r?r.focus:ranked().slice(0,1).map(p=>p.t.name),pv=addDays(it.d,-1),pr=typeOf(pv).t==='INDIVIDUAL'&&pv>=today()?recFor(pv):null;
return '<div class="card"><small>次のチーム活動</small><h3>'+wdOf(it.d)+'曜日 '+it.d.slice(5)+(it.time?' '+esc(it.time):'')+'</h3><div>'+LBL[it.t]+(it.sub?'（'+esc(it.sub)+'）':'')+(r?'：'+esc(r.title)+'／'+r.role:'')+'</div><p>重点：'+esc(top.join('・'))+'</p>'+(pr?'<p>その前の'+wdOf(pv)+'曜日：'+(pr.k==='休養推奨'?'休養を推奨':'個人自主練 '+pr.min+'分（'+pr.k+'）')+'</p>':'')+'</div>'}
function tlH(){let h='<div class="card"><small>直近7日</small>';for(let i=6;i>=0;i--){const ds=addDays(today(),-i),x=typeOf(ds);h+='<div class="item" style="cursor:default;min-height:36px;padding:6px 4px"><span>'+wdOf(ds)+(i===0?' <span class="tag">今日</span>':'')+'</span><span>'+(x.t==='INDIVIDUAL'?recFor(ds).k.replace('推奨',''):LBL[x.t]+(x.sub?'（'+esc(x.sub)+'）':''))+'</span></div>'}return h+'</div>'}
const _home=R.home;R.home=()=>{const h=_home(),k='<span>日</span></div></div>',i=h.indexOf(k)+k.length;return h.slice(0,i)+schedH()+nextH()+tlH()+h.slice(i)};
/* 今日の画面：今日の活動日タイプ */
const _today=R.today;R.today=()=>{const ds=today(),x=typeOf(ds),rc=recFor(ds);let c='<div class="card"><small>今日（'+wdOf(ds)+'曜日）</small><h3>'+LBL[x.t]+(x.sub?'（'+esc(x.sub)+'）':'')+'</h3>';
if(x.t==='INDIVIDUAL'||x.t==='REST')c+='<p>'+(x.t==='REST'?'予定は休養です。':'全体練習はありません。')+'推奨：<b>'+rc.k+'</b>'+(rc.min?'（'+rc.min+'分）':'')+'<br><small>'+rc.why.join('、')+'</small></p><button class="sec" onclick="go(\'indiv\')">自主練メニューを見る</button>';return _today().replace('</h2>','</h2>'+c+'</div>')};
/* 自主練 */
const CAT={swing:'打撃',twoStrike:'打撃',bunt:'打撃',infield:'守備',runner1:'守備',catch:'守備',cover:'守備',dp:'守備',base:'走塁',tagup:'走塁',run:'走塁',strike:'投球',pitchForm:'投球'};
const ITEMS={打撃:['シャドースイング','ティー打撃・方向打ち','カウント別・判断のイメージ練習','自己評価'],守備:['グラブさばき・捕球姿勢','足運び','壁当て（軽い送球）','自己評価'],走塁:['スタート・1歩目','リード・帰塁','状況判断のイメージ','自己評価'],投球:['シャドーピッチング（ボールなし）','フォーム確認','状況判断のイメージ','自己評価'],習慣:['今日の目的を言葉にする','道具・準備のチェック','次の行動を自分で決める','自己評価']};
const SPLIT={15:[5,5,0,5],20:[5,5,5,5],25:[5,10,5,5],30:[10,5,10,5]};
function focusFor(pid){const g=S.games[S.games.length-1],wk=new Set(g?g.st.filter(x=>x.a&&x.s/x.a<.7).map(x=>x.task):[]);
return ranked().map(x=>{const r=S.rec.filter(y=>y.task===x.t.id&&y.p===pid),a=r.reduce((s,y)=>s+y.a,0),pr=a?r.reduce((s,y)=>s+y.s,0)/a:null;return{x,pr,s:x.sc*(wk.has(x.t.id)?1.3:1)*(pr==null?1:1.3-pr)}}).sort((a,b)=>b.s-a.s)[0]}
function indivH(pid){const ds=today(),rc=recFor(ds),p=S.players.find(q=>q.id===pid),f=focusFor(pid);if(!p||!f)return '';
if(rc.k==='休養推奨')return '<div class="card"><h3>今日は自主練より休養</h3><p>'+rc.why.join('、')+'</p><p>休養も練習の一部です。睡眠・食事・軽いストレッチを大切にしましょう。痛みがあれば、保護者や医療専門家に相談してください（診断はしません）。</p></div>';
const t=f.x.t,cat=CAT[t.dom]||'習慣',sp=SPLIT[rc.min]||SPLIT[20],lv=f.pr==null?t.lv:f.pr<.7?t.lv-1:t.lv,dr=pick(t.dom,Math.max(1,Math.min(3,lv)),true),tpn=(roles(remain()||{list:[]}).find(x=>x.t==='TEAM_PRACTICE'&&x.d>ds)||{}),dl=dleft(),o=remain();
let n=0;const it=ITEMS[cat].map((s,i)=>sp[i]?'<p>'+'①②③④'[n++]+' '+s+' '+sp[i]+'分</p>':'').join('');
return '<div class="card"><small>今日の自主練（'+esc(p.name)+'）</small><div class="big" style="font-size:40px">'+rc.min+'<span>分</span></div><p><b>'+rc.k+'</b></p><p>目的：'+esc(t.name)+'</p>'+it+'<p>成功基準：<b>'+esc(dr?dr.ok:'10回中8回以上')+'</b></p>'+(cat==='投球'?'<div class="warn">ボールを使う投球は別管理です。今週 '+pwk(p.id)+'/'+lim(p).w+'球。投球量を増やすことが目的ではないので、指導者・保護者と相談してください。</div>':'')+'<small>理由：'+(f.pr==null?'成功率データなし':'前回成功率 '+Math.round(f.pr*100)+'%')+'／'+(tpn.d?'次の全体練習 '+tpn.d.slice(5)+'（'+tpn.role+'）':'')+'／'+(dl==null?'':'大会まで'+dl+'日')+(o?'・全体練習あと'+o.tp+'回':'')+'／'+rc.why.join('、')+'</small></div>'}
ctx.ip='';R.indiv=()=>{const pid=ctx.ip||(S.players[0]||{}).id;ctx.ip=pid;return '<h2>自主練</h2><small>15〜30分。大量反復ではなく、重点課題を短時間で改善します。</small><label>選手</label><select onchange="ctx.ip=this.value;render()">'+opt(S.players.map(p=>[p.id,p.name]),pid)+'</select>'+indivH(pid)};
/* カレンダー */
R.cal=()=>{const off=ctx.cm||0,b=new Date();b.setDate(1);b.setMonth(b.getMonth()+off);const y=b.getFullYear(),m=b.getMonth(),f=new Date(y,m,1).getDay(),n=new Date(y,m+1,0).getDate(),cs=[];
for(let i=0;i<f;i++)cs.push('<span></span>');
for(let d=1;d<=n;d++){const ds=ymd(new Date(y,m,d)),x=typeOf(ds),k={TEAM_PRACTICE:'tp',GAME:'gm',INDIVIDUAL:'in',REST:'rs',OTHER:'ot'}[x.t],c={TEAM_PRACTICE:'全',GAME:(x.sub==='大会'||x.sub==='公式戦')?'大':'試',INDIVIDUAL:'自',REST:'休',OTHER:'他'}[x.t];cs.push('<button class="'+k+(ds===today()?' td':'')+'" onclick="dayForm(\''+ds+'\')">'+d+'<br><small>'+c+'</small></button>')}
return '<h2>活動日カレンダー</h2><div class="row"><button class="sec" onclick="ctx.cm=(ctx.cm||0)-1;render()">前月</button><b style="text-align:center">'+y+'年'+(m+1)+'月</b><button class="sec" onclick="ctx.cm=(ctx.cm||0)+1;render()">翌月</button></div><div class="cal">'+[...WD].map(w=>'<b>'+w+'</b>').join('')+cs.join('')+'</div><p><small>全=全体練習／試=練習試合など／大=大会・公式戦／自=自主練候補／休=休養／他=その他。日付をタップして変更できます。</small></p><button class="sec" onclick="calSet()">週の標準設定</button>'}
function dayForm(ds){const e=S.cal.ev[ds]||{};form(ds+'（'+wdOf(ds)+'）の予定',[['type','種類','select',[['','標準のまま'],['TEAM_PRACTICE','全体練習'],['GAME','実戦'],['INDIVIDUAL','自主練'],['REST','休養'],['OTHER','その他']]],['sub','実戦の種類','select',['練習試合','大会','公式戦','紅白戦','その他実戦'].map(x=>[x,x])],['name','名称','text'],['time','時間','time']],{type:e.type||'',sub:e.sub||'練習試合',name:e.name||'',time:e.time||''},async v=>{if(!v.type)delete S.cal.ev[ds];else S.cal.ev[ds]={type:v.type,sub:v.type==='GAME'?v.sub:'',name:v.name,time:v.time};await save();render()},e.type?async()=>{delete S.cal.ev[ds];await save();render()}:null)}
function calSet(){const o=[['team','全体練習'],['off','全体練習なし（自主練候補）'],['rest','休養']],c=S.cal,init={third:c.third?'1':'0',time:c.time};[1,2,3,4,5,6,0].forEach(w=>init['w'+w]=c.week[w]);
form('週の標準設定',[...[1,2,3,4,5,6,0].map(w=>['w'+w,WD[w]+'曜日','select',o]),['third','第三日曜日','select',[['1','原則休養'],['0','休養にしない']]],['time','標準の開始時間','time']],init,async v=>{[1,2,3,4,5,6,0].forEach(w=>c.week[w]=v['w'+w]);c.third=v.third==='1';c.time=v.time;await save();render()})}
/* 大会逆算：活動日の使い方 */
const _plan=R.plan;R.plan=()=>{const T=S.set.tourn.date,o=T?remain():null;let h='';
if(o){const A=roles(o);h='<h2>活動日の使い方</h2>'+countsH(o)+'<small>固定ではありません。タップで役割を変更できます。</small>'+A.map(x=>'<div class="card" onclick="roleForm(\''+x.d+'\')"><b>'+x.d.slice(5)+'（'+wdOf(x.d)+'）'+esc(x.title)+'</b> <span class="tag">'+x.role+'</span><p>'+ROLE[x.role]+(x.sub2?'（'+x.sub2+'）':'')+'</p><small>重点：'+esc(x.focus.join('・'))+'</small></div>').join('')}
return h+_plan()};
function roleForm(ds){form(ds+' の役割',[['r','役割','select',[['','自動'],...Object.keys(ROLE).map(k=>[k,k])]]],{r:S.cal.roleOv[ds]||''},async v=>{if(v.r)S.cal.roleOv[ds]=v.r;else delete S.cal.roleOv[ds];await save();render()})}
/* 試合分析の追記（最終実戦・次回修正） */
function gameExtra(g){const ok=g.st.filter(x=>x.a&&x.s/x.a>=.7).map(x=>tname(x.task)),ng=g.st.filter(x=>x.a&&x.s/x.a<.7).map(x=>tname(x.task)),pt=S.pitch.filter(x=>x.d===g.d).reduce((a,x)=>a+x.n,0),o=remain(),lastG=o&&roles(o).some(x=>x.d===g.d&&x.lastG);
let nd=null;for(let i=1;i<=14&&!nd;i++){const d=addDays(g.d,i);if(typeOf(d).t==='TEAM_PRACTICE')nd=d}
return '<div class="blk">'+(lastG?'<b>大会前 最終実戦</b><br>':'')+'成功した課題：'+esc(ok.join('、')||'—')+'<br>未解決の課題：'+esc(ng.join('、')||'—')+'<br>新たに発生した課題：'+esc(g.nw||'—')+'<br>投球数：'+pt+'球／試合負荷：'+esc(g.load||'—')+'<br>次回の修正：'+esc(g.nx||'—')+(nd?'<br>次の全体練習（'+nd.slice(5)+' '+wdOf(nd)+'）で「'+esc(ng[0]||g.nx||'確認')+'」を修正する案':'')+'</div>'}
