/* OSRS Character Planner – hybrid dashboard. Data stays local until shared profiles are implemented. */
'use strict';
const $ = id => document.getElementById(id);
const names = ['Attack','Defence','Strength','Hitpoints','Ranged','Prayer','Magic','Cooking','Woodcutting','Fletching','Fishing','Firemaking','Crafting','Smithing','Mining','Herblore','Agility','Thieving','Slayer','Farming','Runecraft','Hunter','Construction','Sailing'];
const icons = {Attack:'Attack',Defence:'Defence',Strength:'Strength',Hitpoints:'Hitpoints',Ranged:'Ranged',Prayer:'Prayer',Magic:'Magic',Cooking:'Cooking',Woodcutting:'Woodcutting',Fletching:'Fletching',Fishing:'Fishing',Firemaking:'Firemaking',Crafting:'Crafting',Smithing:'Smithing',Mining:'Mining',Herblore:'Herblore',Agility:'Agility',Thieving:'Thieving',Slayer:'Slayer',Farming:'Farming',Runecraft:'Runecraft',Hunter:'Hunter',Construction:'Construction',Sailing:'Sailing'};
const iconFallback = {Attack:'⚔',Defence:'⛨',Strength:'✊',Hitpoints:'♥',Ranged:'🏹',Prayer:'✧',Magic:'✦',Cooking:'♨',Woodcutting:'🌲',Fletching:'➶',Fishing:'🐟',Firemaking:'🔥',Crafting:'◇',Smithing:'⚒',Mining:'⛏',Herblore:'❀',Agility:'↝',Thieving:'◈',Slayer:'☠',Farming:'🌿',Runecraft:'✥',Hunter:'♞',Construction:'⌂',Sailing:'⚓'};
const escapeHtml = x => String(x ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = n => Math.max(0,Math.round(Number(n)||0)).toLocaleString('en-GB');
const compact = n => {n=Number(n)||0; if(n>=1e9)return (n/1e9).toFixed(n>=1e10?1:2).replace(/0+$/,'').replace(/\.$/,'')+'B';if(n>=1e6)return (n/1e6).toFixed(n>=1e8?0:1).replace(/\.0$/,'')+'M';if(n>=1e4)return (n/1e3).toFixed(1).replace(/\.0$/,'')+'K';return fmt(n)};
const geNum = n => Math.max(0,Math.floor(Number(n)||0));
const geFmt = n => fmt(n)+' GP';
function readStorage(key,fallback){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback}catch{return fallback}}
function writeStorage(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch{}}
function iconHtml(skill){const file=icons[skill]||skill;const text=escapeHtml(iconFallback[skill]||'✦');return `<span class="skill-icon-wrap"><span class="fallback-icon">${text}</span><img loading="lazy" src="https://oldschool.runescape.wiki/images/${encodeURIComponent(file+'_icon.png')}" alt="" onerror="this.hidden=true"></span>`}
function itemIcon(icon,name){if(!icon)return `<span aria-hidden="true">◈</span>`;const filename=encodeURIComponent(icon.replaceAll(' ','_'));return `<img loading="lazy" alt="" src="https://oldschool.runescape.wiki/images/${filename}" onerror="this.hidden=true;this.parentElement.textContent='◈'">`}
const xp=[0];let xpSum=0;for(let level=1;level<99;level++){xpSum+=Math.floor(level+300*Math.pow(2,level/7));xp[level]=Math.floor(xpSum/4)}
let character=(localStorage.getItem('osrs-planner-last-player')||'dcstorms').trim()||'dcstorms';
let skills={},goals={},quests=[],geState={target:0,cash:0,items:[]},activities=[];
let chosen='Crafting',geCatalog=[],gePrices={},geLoaded=false,geLoading=false,currentPage='dashboard';
const openQuestNames=new Set();
function key(kind){return `osrs-profile-${kind}-v1:${character.toLowerCase()}`}
function normalizeGoal(n,skill){const current=Math.max(1,skills[skill]?.level||1);return Math.max(current,Math.min(99,Math.floor(Number(n)||current)))}
function loadPlayerData(){
  // One-time migration of existing single-browser planner data to the first selected character.
  if(!localStorage.getItem('osrs-planner-migrated-v1')){
    const migrate={goals:'osrs-goals-v1',quests:'osrs-quest-plans-v2',ge:'osrs-ge-wishlist-v1'};
    for(const [kind,oldKey] of Object.entries(migrate)){
      const value=readStorage(oldKey,null);if(value!==null && localStorage.getItem(key(kind))===null)writeStorage(key(kind),value);
    }
    localStorage.setItem('osrs-planner-migrated-v1','true');
  }
  goals=readStorage(key('goals'),{});if(!goals||typeof goals!=='object'||Array.isArray(goals))goals={};
  quests=readStorage(key('quests'),[]);if(!Array.isArray(quests))quests=[];
  const savedGe=readStorage(key('ge'),{});geState={target:geNum(savedGe?.target),cash:geNum(savedGe?.cash),items:Array.isArray(savedGe?.items)?savedGe.items.filter(i=>Number.isSafeInteger(Number(i.id))&&Number(i.id)>0).map(i=>({id:Number(i.id),name:String(i.name||''),qty:Math.max(1,Math.min(1000000,geNum(i.qty)||1))})):[]};
  activities=readStorage(key('activity'),[]);if(!Array.isArray(activities))activities=[];
  const cached=readStorage(key('snapshot'),null);skills=cached?.skills&&typeof cached.skills==='object'?cached.skills:{};
  $('username').value=character;
  $('heroName').textContent=character;
  $('dashProfileName').textContent=character;
  $('profilePageName').textContent=character;
  $('geTarget').value=geState.target||'';$('geCash').value=geState.cash||'';
}
function logActivity(kind,text){activities.unshift({kind,text:String(text).slice(0,120),at:Date.now()});activities=activities.slice(0,30);writeStorage(key('activity'),activities);renderActivity()}
function humanTime(ms){let diff=Math.max(0,Date.now()-ms);if(diff<60000)return 'Just now';if(diff<3600000)return Math.floor(diff/60000)+' min ago';if(diff<86400000)return Math.floor(diff/3600000)+' hr ago';return new Date(ms).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}
function renderActivity(){const glyph={goal:'✦',quest:'▤',ge:'◉',xp:'↗',import:'⚔'};$('activityList').innerHTML=activities.slice(0,5).map(a=>`<div class="activity-row"><div class="activity-symbol">${glyph[a.kind]||'✧'}</div><div class="activity-copy"><strong>${escapeHtml(a.text)}</strong><small>${humanTime(a.at)}</small></div></div>`).join('')||'<p class="empty-note">No activity recorded yet. Set a goal, add an item or complete a quest to start your journal.</p>'}
function activeGoals(){return names.filter(n=>skills[n]&&skills[n].level>=1&&(goals[n]||skills[n].level)>skills[n].level)}
function xpRemaining(n){const s=skills[n];if(!s||s.level<1)return 0;const goal=normalizeGoal(goals[n]||s.level,n);return Math.max(0,(xp[goal-1]||0)-Math.max(0,s.xp))}
function drawSkills(){
  const found=names.filter(n=>skills[n]&&skills[n].level>=1);
  const total=skills.Overall?.level>=0?fmt(skills.Overall.level):'—';const overallXp=skills.Overall?.xp>=0?fmt(skills.Overall.xp):'—';
  const remaining=found.length?fmt(found.reduce((a,n)=>a+xpRemaining(n),0)):'—';
  $('dashTotalLevel').textContent=total;$('dashTotalXp').textContent=overallXp;$('dashRemaining').textContent=remaining;
  $('heroLevel').textContent=found.length?'Total level '+total:'Import your character to begin';
  $('heroXp').textContent=found.length?compact(skills.Overall.xp)+' total XP':'Track every milestone';
  $('dashGoalCount').textContent=activeGoals().length+' active training goals';$('skillGoalBadge').textContent=activeGoals().length+' active goals';
  $('profilePageStat').textContent=found.length?'Total level '+total+' · '+overallXp+' total XP':'Import your Hiscores to view stats';
  $('skillOverview').innerHTML=found.length?found.map(n=>`<div class="skill-tile" title="${escapeHtml(n)}: level ${skills[n].level}">${iconHtml(n)}<b>${skills[n].level}</b></div>`).join(''):'<p class="empty-note">Import your character to see your skill levels.</p>';
  $('skills').innerHTML=found.length?found.map(n=>`<div class="skill-row"><span class="skill-cell">${iconHtml(n)}<span>${escapeHtml(n)}</span></span><span class="current-level">${skills[n].level}</span><input aria-label="${escapeHtml(n)} target level" type="number" min="${skills[n].level}" max="99" data-skill="${escapeHtml(n)}" value="${normalizeGoal(goals[n]||skills[n].level,n)}"><span class="xp-left">${fmt(xpRemaining(n))}</span></div>`).join(''):'<p class="empty-note">Import your character to set your skill goals.</p>';
  drawCalculator();
  renderQuests();
}
function drawCalculator(){const s=skills[chosen];if(!s||s.level<1){$('summary').textContent='Import stats to begin';$('trainingXpLarge').textContent='—';$('bar').style.width='0%';$('pct').textContent='—';$('time').textContent='—';return}
  const goal=normalizeGoal(goals[chosen]||s.level,chosen),need=xpRemaining(chosen);
  $('summary').textContent=`Level ${s.level} → ${goal}`;$('trainingXpLarge').textContent=fmt(need)+' XP';
  // Match original planner's total-XP-based progress calculation.
  const progress=Math.min(100,100*Math.max(0,s.xp)/Math.max(1,xp[goal-1]||0));
  $('bar').style.width=progress+'%';$('pct').textContent=progress.toFixed(1)+'% of target XP';
  const rate=Number($('rate').value);$('time').textContent=rate>0?(need/rate).toFixed(1)+' hours':'Enter an XP rate';
}
function setGoal(skill,level){if(!skills[skill]||skills[skill].level<1)return;const previous=normalizeGoal(goals[skill]||skills[skill].level,skill);const next=normalizeGoal(level,skill);goals[skill]=next;writeStorage(key('goals'),goals);chosen=skill;$('chosen').value=skill;drawSkills();if(next!==previous)logActivity('goal',`Set ${skill} goal to level ${next}`)}
$('chosen').innerHTML=names.map(n=>`<option>${n}</option>`).join('');$('chosen').value=chosen;
$('skills').addEventListener('change',e=>{const skill=e.target.dataset.skill;if(skill)setGoal(skill,e.target.value)});
$('chosen').onchange=e=>{chosen=e.target.value;drawCalculator()};$('rate').oninput=drawCalculator;
$('next').onclick=()=>setGoal(chosen,(skills[chosen]?.level||1)+1);$('to70').onclick=()=>setGoal(chosen,70);$('to99').onclick=()=>setGoal(chosen,99);
async function importHiscores(){
  const input=$('username').value.trim();if(!input||input.length>12){setStatus('Enter a valid character name.',true);return}
  if(input!==character){character=input;localStorage.setItem('osrs-planner-last-player',character);loadPlayerData();geLoaded=false;geCatalog=[];gePrices={};renderAll();if(geState.items.length)loadGe()}
  setStatus('Fetching official Hiscores…');$('refresh').disabled=true;
  try{const response=await fetch('/api/hiscores?player='+encodeURIComponent(character));const data=await response.json();if(!response.ok)throw Error(data.error||'Hiscores request failed');
    const old=readStorage(key('snapshot'),null);const previous=old?.skills?.Overall?.xp;
    skills=data.skills;writeStorage(key('snapshot'),{skills,at:Date.now()});
    const newXp=skills.Overall?.xp;if(typeof previous==='number'&&typeof newXp==='number'&&previous>=0&&newXp>previous)logActivity('xp',`Gained ${fmt(newXp-previous)} total XP since your last import`);
    else if(!activities.some(a=>a.kind==='import'))logActivity('import','Imported '+character+' from OSRS Hiscores');
    setStatus('Imported '+character+' successfully');renderAll();
  }catch(err){setStatus((err.message||'Hiscores unavailable')+(Object.keys(skills).length?' · showing saved stats':''),true);renderAll()}
  finally{$('refresh').disabled=false}
}
function setStatus(message,error=false){$('status').textContent=message;$('status').className='status-text'+(error?' error':' success')}
$('refresh').onclick=importHiscores;$('username').addEventListener('keydown',e=>{if(e.key==='Enter')importHiscores()});

// Quest Planner – preserves the OSRS Wiki lookup and collapsible quest panels.
function questPct(){return quests.length?Math.round(100*quests.filter(q=>q.completed).length/quests.length):0}
function safeWikiUrl(q){try{const u=new URL(q.wiki);if(u.protocol==='https:'&&u.hostname==='oldschool.runescape.wiki')return u.href}catch{}return 'https://oldschool.runescape.wiki/w/'+encodeURIComponent(String(q.title||'').replaceAll(' ','_'))}
function renderQuests(){
  const completed=quests.filter(q=>q.completed).length,pct=questPct();
  $('questCountBadge').textContent=quests.length+' planned quests';$('questSideCount').textContent=completed+' / '+quests.length+' complete';$('questSideBar').style.width=pct+'%';
  $('dashQuestsCompleted').textContent=completed;$('dashQuestsTotal').textContent=quests.length;$('dashQuestPct').textContent=pct+'%';$('dashQuestBar').style.width=pct+'%';
  $('dashQuestList').innerHTML=quests.length?quests.slice(0,4).map(q=>`<div class="dashboard-quest"><span>▤</span><strong>${escapeHtml(q.title)}</strong><span class="quest-tag ${q.completed?'complete':''}">${q.completed?'✓ Complete':'○ Planned'}</span></div>`).join(''):'<p class="empty-note">No quests in your log yet. Add your next adventure in Quest Planner.</p>';
  $('questList').innerHTML=quests.length?quests.map((q,i)=>{
    const rows=Object.entries(q.skills||{}).map(([skill,required])=>{const current=skills[skill]?.level;const deficit=current===undefined?null:Math.max(0,required-current);const missingXp=current===undefined?null:Math.max(0,(xp[required-1]||0)-(skills[skill]?.xp||0));return `<div class="questline"><span>${escapeHtml(skill)} · Level ${Number(required)} required</span><span class="${deficit===0?'good':'bad'}">${current===undefined?'Import stats first':deficit===0?'✓ Met':`${deficit} levels / ${fmt(missingXp)} XP short`}</span></div>`}).join('');
    const missing=Object.entries(q.skills||{}).filter(([skill,level])=>!skills[skill]||skills[skill].level<level).length;
    return `<details class="quest" data-quest="${escapeHtml(q.title)}" ${openQuestNames.has(q.title)?'open':''}><summary><strong>${escapeHtml(q.title)}</strong><span class="quest-summary-info">${q.completed?'✓ Complete':missing?missing+' requirements to work on':'View requirements'}</span></summary><div class="quest-content"><div class="quest-content-top"><a href="${escapeHtml(safeWikiUrl(q))}" target="_blank" rel="noopener noreferrer">View OSRS Wiki ↗</a><button type="button" class="btn btn-soft" data-remove="${i}">Remove</button></div><div class="${missing?'bad':'good'}">${q.completed?'✓ Marked complete':Object.keys(q.skills||{}).length?missing?missing+' detected skill requirements not met':'✓ All detected skill requirements met':'No skill requirements detected — verify on the Wiki'}</div>${rows}<label class="quest-check"><input type="checkbox" data-complete="${i}" ${q.completed?'checked':''}> Quest completed</label></div></details>`;
  }).join(''):'<p class="empty-note">Your quest log is empty. Search a quest above to begin.</p>';
}
$('questList').addEventListener('toggle',e=>{const el=e.target;if(el.tagName!=='DETAILS'||!el.dataset.quest)return;if(el.open)openQuestNames.add(el.dataset.quest);else openQuestNames.delete(el.dataset.quest)},true);
$('questList').addEventListener('change',e=>{if(e.target.dataset.complete===undefined)return;const q=quests[Number(e.target.dataset.complete)];if(!q)return;q.completed=e.target.checked;writeStorage(key('quests'),quests);renderQuests();logActivity('quest',(q.completed?'Completed ':'Reopened ')+q.title)});
$('questList').addEventListener('click',e=>{const b=e.target.closest('[data-remove]');if(!b)return;const i=Number(b.dataset.remove),q=quests[i];if(!q)return;quests.splice(i,1);openQuestNames.delete(q.title);writeStorage(key('quests'),quests);renderQuests();logActivity('quest','Removed '+q.title+' from quest log')});
$('addQuest').onclick=async()=>{const name=$('questSearch').value.trim();if(!name)return;$('addQuest').disabled=true;$('questStatus').textContent='Checking OSRS Wiki…';
  try{const response=await fetch('/api/quest?name='+encodeURIComponent(name));const q=await response.json();if(!response.ok)throw Error(q.error+(q.detail?' ('+q.detail+')':''));if(quests.some(x=>x.title.toLowerCase()===q.title.toLowerCase()))throw Error('That quest is already in your log.');quests.push({...q,completed:false});writeStorage(key('quests'),quests);renderQuests();logActivity('quest','Added '+q.title+' to quest log');$('questStatus').textContent='Added '+q.title;$('questSearch').value=''}catch(err){$('questStatus').textContent=err.message||'Quest lookup failed'}finally{$('addQuest').disabled=false}
};$('questSearch').addEventListener('keydown',e=>{if(e.key==='Enter')$('addQuest').click()});

// GE Wishlist – independent total GP savings target and live item prices.
const geItemById=()=>new Map(geCatalog.map(x=>[Number(x.id),x]));
function gePrice(entry){const p=gePrices[String(entry.id)];return Number(p?.high)>0?Number(p.high):Number(p?.low)>0?Number(p.low):null}
function geTotals(){let sum=0,missing=0;for(const x of geState.items){const p=gePrice(x);if(p!==null)sum+=p*Math.max(1,geNum(x.qty));else missing++}return {sum,missing}}
function geDisplayPrice(value){return value===null?'Price unavailable':geFmt(value)}
function renderGe(refreshFields=false){
  const cash=geNum(geState.cash),target=geNum(geState.target),pct=target?Math.min(100,100*cash/target):0;
  if(refreshFields){$('geTarget').value=target||'';$('geCash').value=cash||''}
  $('geProgressLabel').textContent=target?pct.toFixed(1)+'% saved':'Set a GP target';$('geProgressBar').style.width=pct+'%';
  $('geRemaining').textContent=target?geFmt(Math.max(0,target-cash))+' remaining':'Enter your savings goal above';
  $('dashCash').innerHTML=escapeHtml(compact(cash))+' <small>GP</small>';$('dashCashBar').style.width=pct+'%';$('dashCashLabel').textContent=target?fmt(cash)+' / '+fmt(target)+' GP saved':'Set a savings goal in your wishlist';
  const {sum,missing}=geTotals(),catalog=geItemById();
  $('geTotal').textContent=geFmt(sum)+(missing?'*':'');$('geShortfall').textContent=geFmt(Math.max(0,sum-cash))+(missing?'*':'');
  $('geItemCountLabel').textContent=geState.items.length?geState.items.length+' wishlist items'+(missing?' · '+missing+' prices unavailable':''):'Add your first item below.';
  $('dashWishlistTotal').textContent=geFmt(sum)+(missing?'*':'');$('dashWishlistCount').textContent=geState.items.length+' wishlist '+(geState.items.length===1?'item':'items')+(missing?' · '+missing+' unpriced':'');
  const rows=geState.items.map((entry,i)=>{const item=catalog.get(entry.id),price=gePrice(entry),qty=Math.max(1,geNum(entry.qty)),name=item?.name||entry.name||'Item '+entry.id,icon=item?.icon||'';return {entry,i,item,price,qty,name,icon}});
  $('geItems').innerHTML=rows.length?rows.map(r=>`<div class="ge-item"><div class="ge-item-icon">${itemIcon(r.icon,r.name)}</div><div class="ge-item-info"><strong>${escapeHtml(r.name)}</strong><div class="muted">${geDisplayPrice(r.price)} each</div></div><input type="number" min="1" max="1000000" value="${r.qty}" data-ge-qty="${r.i}" aria-label="Quantity of ${escapeHtml(r.name)}"><span class="ge-item-total">${r.price===null?'—':geFmt(r.price*r.qty)}</span><button type="button" data-ge-remove="${r.i}" aria-label="Remove ${escapeHtml(r.name)}">×</button></div>`).join(''):'<p class="empty-note">Your wishlist is empty. Search above to add your first item.</p>';
  const dashRows=rows.slice(0,4);$('dashWishlistItems').innerHTML=dashRows.length?dashRows.map(r=>`<div class="mini-item"><div class="ge-item-icon">${itemIcon(r.icon,r.name)}</div><div class="mini-item-copy"><strong>${escapeHtml(r.name)}</strong><small>${geDisplayPrice(r.price)}</small></div><span class="mini-qty">×${r.qty}</span></div>`).join(''):'<p class="empty-note">Build your next gear upgrade wishlist.</p>';
  $('geMiniItems').innerHTML=dashRows.length?dashRows.map(r=>`<div class="ge-mini-item"><div class="ge-item-icon">${itemIcon(r.icon,r.name)}</div><strong>${escapeHtml(r.name)}</strong><span>${r.price===null?'—':compact(r.price)+' GP'}</span></div>`).join(''):'<p class="empty-note">Add tradeable items to see prices here.</p>';
  $('geMiniStatus').textContent=geLoaded?'Live Wiki prices loaded on this visit'+(missing?' · Some items unavailable':''):'Visit your wishlist to load the latest prices.';
}
function renderGeResults(){const q=$('geSearch').value.trim().toLowerCase();if(q.length<2){$('geSearchResults').innerHTML='';return}const found=geCatalog.filter(x=>x.name.toLowerCase().includes(q)).slice(0,12);$('geSearchResults').innerHTML=found.map(x=>`<button type="button" data-ge-add="${Number(x.id)}"><span>${escapeHtml(x.name)}</span><span>${geDisplayPrice(gePrice(x))}　＋</span></button>`).join('')||'<p class="empty-note">No matching tradeable items, or prices have not loaded yet.</p>'}
async function loadGe(){if(geLoading)return;geLoading=true;$('geRefresh').disabled=true;$('geStatus').textContent='Loading recent OSRS Wiki trade prices…';
  try{const response=await fetch('/api/ge');const data=await response.json();if(!response.ok)throw Error(data.error||'GE service unavailable');geCatalog=Array.isArray(data.items)?data.items:[];gePrices=data.prices||{};geLoaded=true;$('geStatus').textContent='Prices loaded for '+fmt(geCatalog.length)+' items · refresh for new prices';renderGe();renderGeResults()}
  catch(err){$('geStatus').textContent='Prices unavailable: '+(err.message||'Unknown error')+' · try Refresh prices';renderGe()}
  finally{geLoading=false;$('geRefresh').disabled=false}
}
$('geTarget').addEventListener('input',e=>{geState.target=geNum(e.target.value);writeStorage(key('ge'),geState);renderGe()});
$('geCash').addEventListener('input',e=>{geState.cash=geNum(e.target.value);writeStorage(key('ge'),geState);renderGe()});
for(const id of ['geTarget','geCash'])$(id).addEventListener('change',()=>logActivity('ge','Updated GP savings progress'));
$('geSearch').addEventListener('input',renderGeResults);$('geRefresh').onclick=loadGe;
$('geSearchResults').addEventListener('click',e=>{const b=e.target.closest('[data-ge-add]');if(!b)return;const id=Number(b.dataset.geAdd),item=geCatalog.find(x=>Number(x.id)===id);if(!item)return;const existing=geState.items.find(x=>x.id===id);if(existing)existing.qty=Math.min(1000000,geNum(existing.qty)+1);else geState.items.push({id,name:item.name,qty:1});writeStorage(key('ge'),geState);renderGe();logActivity('ge','Added '+item.name+' to wishlist');$('geSearch').value='';renderGeResults()});
$('geItems').addEventListener('click',e=>{const b=e.target.closest('[data-ge-remove]');if(!b)return;const i=Number(b.dataset.geRemove),entry=geState.items[i];if(!entry)return;geState.items.splice(i,1);writeStorage(key('ge'),geState);renderGe();logActivity('ge','Removed '+(entry.name||'item')+' from wishlist')});
$('geItems').addEventListener('change',e=>{const i=e.target.dataset.geQty;if(i===undefined)return;const entry=geState.items[Number(i)];if(!entry)return;entry.qty=Math.max(1,Math.min(1000000,geNum(e.target.value)));writeStorage(key('ge'),geState);renderGe();logActivity('ge','Updated quantity for '+(entry.name||'wishlist item'))});

const pageLabels={dashboard:'Dashboard',skills:'Skills Planner',quests:'Quest Planner',ge:'GE Wishlist',profiles:'Player Profiles'};
function navigate(page){if(!pageLabels[page])return;currentPage=page;document.querySelectorAll('.page').forEach(el=>el.classList.toggle('active',el.id===page+'Page'));document.querySelectorAll('.nav-link').forEach(el=>{const active=el.dataset.page===page;el.classList.toggle('active',active);if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current')});$('breadcrumbCurrent').textContent=pageLabels[page];if(page==='ge'&&!geLoaded)loadGe();window.scrollTo({top:0,behavior:'auto'})}
document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.page)));
document.querySelector('[data-tool="calculator"]').addEventListener('click',()=>{navigate('skills');$('calculatorPanel').scrollIntoView({behavior:'smooth',block:'start'})});
document.querySelector('[data-tool="lookup"]').addEventListener('click',()=>{navigate('ge');$('geLookupPanel').scrollIntoView({behavior:'smooth',block:'start'});$('geSearch').focus()});
function renderAll(){drawSkills();renderGe(true);renderActivity()}
loadPlayerData();renderAll();importHiscores();if(geState.items.length)loadGe();
