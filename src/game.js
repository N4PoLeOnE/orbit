import { TYPES, G, LIMIT, MAX_BODIES, body, integrate, collide, supernova, predict, orbitSpeed, binaryBodies, habitable } from './physics.js';
import { Renderer } from './render.js';
import { Audio } from './audio.js';
import { assistLaunch, satelliteHost, orbitHost, orbitalElements, DRAG_SCALE } from './orbits.js';
import { ARRIVAL_INTERVAL, AIM_TIME_SCALE, pacingState, nextPiece, arrivalSpeed, isSpecial } from './pacing.js';
import { recenter, systemFocus, followSelected, tickCamera } from './camera.js';
import { deliverLife } from './biology.js';
import { contractState, startContracts, advance, rankOf, RANKS, CONTRACTS } from './contracts.js';
const $=id=>document.getElementById(id),TAU=Math.PI*2,clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const stages=['Sterile','Oceani','Vegetazione','Vita','Civiltà','Civiltà avanzata'];
const eras=['Genesi','Prime armonie','Attrazioni pericolose','Orizzonti oscuri','Il grande squilibrio','Ultima luce'];
const renderer=new Renderer($('space')),audio=new Audio();
const game={bodies:[],camera:{x:0,y:0,zoom:1,targetZoom:1},queue:[],mode:'menu',paused:false,elapsed:0,arrival:0,score:0,combo:1,comboTimer:0,instability:0,collapseTime:0,ending:0,selected:null,aim:null,forecast:null,particles:[],waves:[],labels:[],shake:0,era:1,stats:{placed:0,orbits:0,civilizations:0,collisions:0},record:0,contracts:contractState(),rank:0,flash:0,flashes:[],warp:0,motes:[],shownScore:0};
try{game.record=Number(localStorage.getItem('orbit-best'))||0;}catch{}
const cameraKeys=new Set();
// Private generator: cosmetic and contract randomness never shifts the gameplay sequence of Math.random.
let rngSeed=1;const rng=()=>{rngSeed=(Math.imul(rngSeed,1664525)+1013904223)>>>0;return rngSeed/4294967296;};
let menuAccumulator=0,contractsVersion='';
let scenario='genesis',helpWasPaused=false,catalogWasPaused=false,nextForecast=0,lastUI=0,accumulator=0,lastTime=0,pan=null,pointer=null,queueVersion='';
function reset(which='genesis'){
  cameraKeys.clear();scenario=which;Object.assign(game,{bodies:[],queue:['rocky','ocean','earth'],elapsed:0,arrival:0,score:0,combo:1,comboTimer:0,instability:0,collapseTime:0,ending:0,selected:null,aim:null,forecast:null,particles:[],waves:[],labels:[],shake:0,era:1,planetSerial:0,pacing:pacingState(),nextHazard:210,hazardScan:0,hover:null,zoomAnchor:null,stats:{placed:0,orbits:0,civilizations:0,collisions:0}});
  game.asteroidMode=false;game.asteroidReady=0;game.starSerial=0;accumulator=0;nextForecast=0;queueVersion='';contractsVersion='';$('events').replaceChildren();$('announce').replaceChildren();
  rngSeed=(Math.random()*4294967296)>>>0||1;Object.assign(game,{contracts:contractState(),rank:0,flash:0,flashes:[],warp:0,motes:[],nextMote:8,dustChain:0,dustTime:-99,shownScore:0});startContracts(game.contracts);renderer.resetTrails();
  if(which==='binary'){
    game.bodies=binaryBodies(0,0,0,0);game.bodies.forEach((b,i)=>b.label=`Stella ${String.fromCharCode(65+i)}`);game.starSerial=2;game.queue=['earth','ocean','moon'];
  }else{
    game.bodies=[body('sun',0,0,0,0,{label:'Sol'})];
    if(which==='abyss'){game.bodies.push(body('black',950,110,0,-5,{age:12}));game.queue=['earth','ocean','comet'];game.pacing.quietUntil=180;}
  }
  centerCamera();updateUI();
}
function centerCamera(){
  game.zoomAnchor=null;recenter(game.camera,game.bodies,renderer.w,renderer.h);
}
function cameraFocus(){
  return systemFocus(game.bodies);
}
function event(text,sub='',danger=false){const el=document.createElement('div');el.className='event'+(danger?' danger':'');el.textContent=text;if(sub){const small=document.createElement('small');small.textContent=sub;el.append(small);}$('events').prepend(el);while($('events').children.length>4)$('events').lastChild.remove();setTimeout(()=>el.remove(),6500);}
function announce(title,sub='',tone=''){
  const box=$('announce'),el=document.createElement('div');el.className='announce'+(tone?' tone-'+tone:'');const h=document.createElement('b');h.textContent=title;el.append(h);
  if(sub){const small=document.createElement('small');small.textContent=sub;el.append(small);}
  box.prepend(el);while(box.children.length>2)box.lastChild.remove();setTimeout(()=>el.remove(),3400);
}
function bump(){const el=$('score');el.classList.remove('bump');void el.offsetWidth;el.classList.add('bump');}
function multiplier(){return 1+.1*game.rank;}
function contract(kind,value=1){
  if(game.mode!=='playing')return;
  for(const c of advance(game.contracts,kind,value,rng)){
    const oldRank=game.rank;game.rank=rankOf(game.contracts.done);
    const points=Math.round(c.def.points*(1+.1*oldRank));game.score+=points;game.instability=Math.max(0,game.instability-10);
    announce('CONTRATTO COMPLETATO',`${c.def.title} · +${points.toLocaleString('it-IT')} · instabilità −10%`,'contract');
    audio.play('contract');game.flash=Math.max(game.flash,.16);bump();contractsVersion='';
    if(game.rank>oldRank)setTimeout(()=>{if(game.mode!=='playing')return;announce(`NUOVO RANGO · ${RANKS[game.rank].toUpperCase()}`,`Tutti i punti ×${multiplier().toFixed(1)}`,'rank');audio.play('rank');},1500);
  }
}
const COMBO_COLORS=['#a7dfc4','#a7dfc4','#b7e7c4','#d6eab0','#f3e29a','#ffd08a','#ffb07e','#ff9a8a','#ff8fc0'];
function reward(text,points,b,sub=''){
  if(game.mode!=='playing')return;
  game.combo=game.comboTimer>0?Math.min(8,game.combo+1):1;game.comboTimer=9;
  const value=Math.round(points*game.combo*multiplier());game.score+=value;
  event(`${text}  +${value.toLocaleString('it-IT')}`,sub);
  if(b)game.labels.push({x:b.x,y:b.y-b.r-10,text:`+${value}  ×${game.combo}`,color:COMBO_COLORS[game.combo],life:2.5,max:2.5});
  audio.play('score',game.combo);bump();contract('combo',game.combo);
}
function burst(x,y,mass,color='#ffd19a',large=false){
  const n=Math.min(large?160:90,Math.round(18+mass));
  for(let i=0;i<n;i++){const a=Math.random()*TAU,v=(8+Math.random()*(large?155:75));game.particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,r:.6+Math.random()*2.1,life:1+Math.random()*2,max:3,color});}
  if(game.particles.length>900)game.particles.splice(0,game.particles.length-900);
  game.waves.push({x,y,radius:4,life:large?3:1.5,max:large?3:1.5,color,speed:large?190:70});game.flashes.push({x,y,r:Math.min(large?320:110,22+mass*(large?2.2:1.3)),life:large?1:.5,max:large?1:.5,color});game.shake=Math.min(large?9:4,Math.sqrt(mass)*.5);
}
function collisionEvent(e){
  if(game.mode==='menu')return;
  game.stats.collisions++;
  burst(e.x,e.y,e.mass,e.kind==='accretion'?'#d6acd5':'#ffc38f',e.kind==='stellar'||e.kind==='supernova');
  audio.play(e.kind==='supernova'?'supernova':'collision');
  const names={fragment:'IMPATTO PLANETARIO',merge:'FUSIONE CREATIVA',accretion:'L’ABISSO RINGRAZIA',stellar:'DUE SOLI. UNA PESSIMA IDEA.',impact:'IMPATTO COSMICO',supernova:'SUPERNOVA'};
  reward(names[e.kind],e.kind==='supernova'?750:e.kind==='stellar'?450:e.kind==='fragment'?160:80,{x:e.x,y:e.y,r:10});
  if(e.kind!=='supernova')contract('impact');
  if(e.kind==='supernova'||e.kind==='stellar'){game.warp=1.1;game.flash=Math.max(game.flash,e.kind==='supernova'?.6:.35);announce(names[e.kind],e.kind==='supernova'?'Una stella è morta. Il vicinato trema.':'Due soli. Una pessima idea.','danger');}
  game.instability=clamp(game.instability+(e.kind==='supernova'?19:e.kind==='merge'?3:Math.min(13,3+e.mass*.08)),0,100);
  if(e.lostLife){event(`ESTINZIONE${e.lostName?' · '+e.lostName:''}`,'«AAAAAAAAAAAA—»',true);audio.say('Aaaaaa!');game.instability=clamp(game.instability+7,0,100);}
  if(game.selected&&!game.bodies.some(b=>b.id===game.selected)){game.selected=e.body?.id||null;game.forecast=null;}
  nextForecast=0;
}
function makePiece(type,x,y,vx,vy){const pieces=type==='binary'?binaryBodies(x,y,vx,vy):[body(type,x,y,vx,vy)];for(const p of pieces){if(TYPES[p.type].family==='planet')p.label=`${['Eden','Nerea','Aurora','Gaia','Iris','Vesta'][game.planetSerial++%6]}-${String(game.planetSerial).padStart(2,'0')}`;else if(p.mass>=40)p.label=`${TYPES[p.type].family==='black'?'Abisso':'Stella'} ${String.fromCharCode(65+game.starSerial++%26)}`;}return pieces;}
function deploy(x,y,vx,vy,automatic=false){
  const micro=!automatic&&game.aim?.micro;
  if((!game.queue.length&&!micro)||game.bodies.length>MAX_BODIES-2)return false;
  if(micro&&game.elapsed<game.asteroidReady)return false;
  const type=micro?'asteroid':game.queue.shift(),pieces=micro?[body('asteroid',x,y,vx,vy,{mass:.2,r:2.2,micro:true,label:'Micro-asteroide'})]:makePiece(type,x,y,vx,vy);game.bodies.push(...pieces);if(!micro)game.stats.placed++;else game.asteroidReady=game.elapsed+2;
  if(!automatic&&game.aim&&!micro){const p=pieces[0],host=game.aim.solution?.host;p.satelliteOf=game.aim.satelliteId||null;p.orbitalTrial=game.forecast?.risk===0&&host?{hostId:host.id,moon:!!p.satelliteOf,period:game.forecast.elements?.period||10}:null;}
  game.selected=pieces[0].id;game.forecast=null;nextForecast=0;
  for(const p of pieces)game.waves.push({x:p.x,y:p.y,radius:p.r+6,life:1.2,max:1.2,color:TYPES[p.type].color,speed:28});
  audio.play(automatic?'auto':'launch');
  if(type==='binary')reward('SISTEMA BINARIO',180,pieces[0],'Due centri. Un solo equilibrio.');
  if(type==='supermassive'){event('È ARRIVATA L’ULTIMA LUCE','Il piccolo punto ha grandi progetti.',true);game.instability=clamp(game.instability+15,0,100);}
  if(automatic){event('L’UNIVERSO HA DECISO PER TE','Coda piena · lancio automatico',true);game.instability=clamp(game.instability+3,0,100);$('queue-panel').classList.remove('auto-flash');void $('queue-panel').offsetWidth;$('queue-panel').classList.add('auto-flash');}
  updateUI();return true;
}
function autoDeploy(){
  if(game.bodies.length>MAX_BODIES-2){game.instability=100;event('SETTORE SATURO','Troppa materia. Il collasso è vicino.',true);return false;}
  const hosts=game.bodies.filter(b=>b.mass>=40),host=hosts.sort((a,b)=>b.mass-a.mass)[0]||{x:0,y:0,mass:90,vx:0,vy:0,r:26};
  let x,y,angle,d;
  for(let n=0;n<30;n++){angle=Math.random()*TAU;d=240+Math.random()*430;x=host.x+Math.cos(angle)*d;y=host.y+Math.sin(angle)*d;if(Math.hypot(x-cameraFocus().x,y-cameraFocus().y)<LIMIT-150&&game.bodies.every(b=>Math.hypot(x-b.x,y-b.y)>b.r+60))break;}
  const v=orbitSpeed(host.mass,d)*(.72+Math.random()*.48),sign=Math.random()<.88?1:-1;
  return deploy(x,y,host.vx-Math.sin(angle)*v*sign,host.vy+Math.cos(angle)*v*sign,true);
}
function incoming(){
  if(game.queue.length>=5){cancelAim();if(!autoDeploy())return;}
  const type=nextPiece(game.pacing,game.elapsed);
  game.queue.push(type);
  if(isSpecial(type)){audio.play('auto');event(`${TYPES[type].name.toUpperCase()} — MASSA ${TYPES[type].mass}`,TYPES[type].family==='black'?'Un piccolo punto. Un’enorme complicazione.':'Un nuovo protagonista nella coda.',true);}
  updateUI();
}
function lifeAndOrbits(b,dt){
  b.age+=dt;b.cooldown=Math.max(0,(b.cooldown||0)-dt);
  if(TYPES[b.type].lifetime && b.age>=TYPES[b.type].lifetime && game.bodies.length<MAX_BODIES-4){supernova(b,game.bodies,collisionEvent);return;}
  const host=orbitHost(b,game.bodies);
  if(b.type==='comet')deliverLife(b,game.bodies,e=>{reward(e.title,250,e.world,e.world.label||TYPES[e.world.type].name);contract('seed');e.world.signal='semina';e.world.signalUntil=game.elapsed+8;audio.play('life');});
  if(b.micro)return;
  if(b.orbitalTrial&&b.age>(b.orbitalTrial.moon?b.orbitalTrial.period*1.1:2.4)){
    const trial=b.orbitalTrial,h=game.bodies.find(p=>p.id===trial.hostId)||(host?.id===trial.hostId?host:null),el=orbitalElements(b,h);
    if(el?.bound&&(trial.moon?Math.hypot(b.x-h.x,b.y-h.y)>h.r+b.r+1:el.peri>h.r+b.r+1)){reward(trial.moon?'LUNA CATTURATA':'ORBITA STABILE',trial.moon?220:120,b,trial.moon?`Satellite di ${h.label||TYPES[h.type].name}`:'Buon lancio. Ora il sistema può crescere.');b.signalUntil=game.elapsed+4;b.signal='orbita';contract(trial.moon?'moon':'launch');}
    b.orbitalTrial=null;
  }
  if(host){
    const dx=b.x-host.x,dy=b.y-host.y,d=Math.hypot(dx,dy),angle=Math.atan2(dy,dx),rv=Math.hypot(b.vx-host.vx,b.vy-host.vy),energy=rv*rv/2-G*(host.mass+b.mass)/Math.max(1,d);
    if(b.orbitHost===host.id){
      if(b.angle!==null){let da=angle-b.angle;while(da>Math.PI)da-=TAU;while(da< -Math.PI)da+=TAU;b.angleTravel+=da;}
      b.captureTimer+=dt;
      if(Math.abs(b.angleTravel)>=TAU && energy<0){b.turns++;game.stats.orbits++;b.angleTravel%=TAU;const tight=clamp(320/d,.25,4),eccentric=(b.maxOrbitD||d)/Math.max(1,b.minOrbitD||d)>1.55;reward(b.type==='comet'?'RITORNO DELLA COMETA':TYPES[b.type].family==='star'?'DANZA BINARIA':eccentric?'ELLISSE IMPROBABILE':'ORBITA STABILE',Math.round((b.type==='comet'?500:eccentric?150:100)*tight),b);game.instability=Math.max(0,game.instability-4);b.maxOrbitD=d;b.minOrbitD=d;contract('orbit');if(eccentric)contract('ellipse');}
      b.minOrbitD=Math.min(b.minOrbitD||d,d);b.maxOrbitD=Math.max(b.maxOrbitD||d,d);
      if(b.previousHost && b.captureTimer>9 && energy<0){reward(b.type==='comet'?'TRA DUE SOLI':b.type==='moon'?'LUNA RUBATA':'CATTURA ORBITALE',b.type==='comet'?500:240,b,'Un nuovo indirizzo, la stessa gravità.');b.previousHost=null;game.instability=Math.max(0,game.instability-2);contract('capture');}
    }else{b.previousHost=b.orbitHost;b.orbitHost=host.id;b.captureTimer=0;b.angleTravel=0;b.minOrbitD=d;b.maxOrbitD=d;}
    b.angle=angle;
    // Score a close pass only after entering AND leaving a narrow encounter region.
    const near=(host.r+b.r)*3+25;
    if(d<near&&!b.encounter&&b.age>4)b.encounter={id:host.id,speed:Math.hypot(b.vx,b.vy),min:d};
    if(b.encounter){b.encounter.min=Math.min(b.encounter.min,d);if(d>near*1.6){const gain=Math.hypot(b.vx,b.vy)-b.encounter.speed;if(b.encounter.id===host.id){const comet=b.type==='comet',razor=b.encounter.min<(host.r+b.r)*1.65,solar=TYPES[host.type]?.family==='star';reward(gain>5?'FIONDA GRAVITAZIONALE':comet&&razor?'RASOIO COSMICO':comet&&solar?'PASSAGGIO SOLARE':'NEAR MISS',comet?(razor?600:420):gain>5?230:110,b);contract('flyby');if(gain>5)contract('slingshot');if(comet&&(razor||solar))contract('cometPass');}b.encounter=null;} }
  }
  if(TYPES[b.type].family!=='planet')return;
  let flux=0,radiation=false,danger=false;
  for(const star of game.bodies){if(star.id===b.id)continue;const dx=b.x-star.x,dy=b.y-star.y,d=Math.hypot(dx,dy),[inner,outer]=habitable(star);if(outer)flux+=((inner+outer)/2/Math.max(1,d))**2;
    if(star.type==='pulsar'&&d<450){const a=Math.atan2(dy,dx)-star.age*.65;if(Math.abs(Math.sin(a))<.095)radiation=true;}
    if(TYPES[star.type].family==='black'&&d<100)danger=true;
  }
  const safe=flux>.57&&flux<2.05&&!radiation;
  const oldStage=b.stage;
  if(safe){b.life=Math.min(150,b.life+dt);b.exposure=Math.max(0,b.exposure-dt*2);}
  else {b.exposure+=dt;b.life=Math.max(0,b.life-dt*(radiation?4:flux>4?2.5:1.1));}
  b.stage=b.life>=120?5:b.life>=80?4:b.life>=48?3:b.life>=28?2:b.life>=12?1:0;
  if(b.stage>oldStage&&b.stage>(b.peakStage||0)){
    const previousPeak=b.peakStage||0;b.peakStage=b.stage;for(let s=previousPeak+1;s<=b.stage;s++)contract('stage'+s);
    if(b.stage===4){game.stats.civilizations++;reward('UNA CIVILTÀ È NATA',500,b,`${b.label||TYPES[b.type].name} · guarda il pianeta illuminarsi`);b.signal='civiltà';b.signalUntil=game.elapsed+14;game.waves.push({x:b.x,y:b.y,radius:b.r+4,life:3,max:3,color:'#adf2c5',speed:22});audio.say(`Una civiltà è nata. ${b.label||'Un nuovo mondo'}.`,true);announce('UNA CIVILTÀ È NATA',`${b.label||TYPES[b.type].name} ha acceso le prime luci`,'life');game.warp=.9;game.flash=Math.max(game.flash,.22);}
    else reward(stages[b.stage].toUpperCase(),b.stage>=4?400:120,b,`${b.label||TYPES[b.type].name} · ${b.stage===5?'«Abbiamo inventato le tasse!»':'un piccolo miracolo.'}`);
    audio.play('life');
  }
  if(oldStage>=3&&b.stage<3){event(`ESTINZIONE · ${b.label||TYPES[b.type].name}`,'La recensione del pianeta: una stella.',true);game.instability=clamp(game.instability+4,0,100);}
  if(b.stage>=3){game.score+=dt*b.stage*.7;game.instability=Math.max(0,game.instability-dt*.007*b.stage);}
  if(b.stage>=3&&(b.exposure>3||danger)&&(!b.lastCry||b.age-b.lastCry>25)){const line=danger?'Perché il cielo si sta deformando?':flux<.57?'Sta diventando sempre più freddo…':'Qualcuno può abbassare il Sole?';event(`RADIO ${b.label||TYPES[b.type].name}`,`«${line}»`,true);audio.say(`${b.label||'Pianeta'}: ${line}`);b.signal='sos';b.signalUntil=game.elapsed+9;b.lastCry=b.age;b.wasDying=true;}
  if(b.wasDying&&safe&&b.exposure===0){reward('SALVATAGGIO IMPROBABILE',300,b);b.wasDying=false;contract('rescue');}
}
function physicsTick(dt){
  integrate(game.bodies,dt/2);integrate(game.bodies,dt/2);
  for(const b of [...game.bodies])lifeAndOrbits(b,dt);
  let count=0;while(count++<5&&collide(game.bodies,collisionEvent)){}
  collectMotes();
  for(let i=game.bodies.length-1;i>=0;i--){const b=game.bodies[i];if(Math.hypot(b.x-cameraFocus().x,b.y-cameraFocus().y)>LIMIT){game.bodies.splice(i,1);if(game.mode==='playing'){event('ESPULSIONE','Un viaggio di sola andata.',true);game.instability=clamp(game.instability+Math.min(12,3+b.mass*.08),0,100);if(b.stage>=3)audio.say('Sta diventando sempre più freddo');}if(game.selected===b.id){game.selected=null;game.forecast=null;}}}
}
function update(realDt){
  if(game.mode==='playing'&&!game.paused){
    game.elapsed+=realDt;game.arrival+=realDt*arrivalSpeed(game.queue.length);game.comboTimer=Math.max(0,game.comboTimer-realDt);if(!game.comboTimer)game.combo=1;
    const era=Math.min(6,1+Math.floor(game.elapsed/90));if(era!==game.era){game.era=era;event(`ERA ${String(era).padStart(2,'0')} · ${eras[era-1].toUpperCase()}`,'La gravità ha altre idee.');announce(`ERA ${String(era).padStart(2,'0')} · ${eras[era-1].toUpperCase()}`,'La gravità ha altre idee.','era');}
    while(game.arrival>=ARRIVAL_INTERVAL){game.arrival-=ARRIVAL_INTERVAL;incoming();}
    accumulator+=realDt*3*(game.aim?AIM_TIME_SCALE:1)*(game.warp>0?.22:1);game.warp=Math.max(0,game.warp-realDt);
    let steps=0;while(accumulator>=1/60&&steps++<24){physicsTick(1/60);accumulator-=1/60;}
    if(game.aim)refreshAim();
    if(game.elapsed>=game.nextHazard){spawnHazard();game.nextHazard=game.elapsed+150+Math.random()*90;}
    if(game.elapsed>=game.hazardScan){scanHazards();game.hazardScan=game.elapsed+1;}
    if(game.elapsed>=game.nextMote){game.nextMote=game.elapsed+8+rng()*6;if(game.stats.placed>0&&game.motes.length<3)spawnMote();}
    for(const m of game.motes){m.life-=realDt;const host=game.bodies.find(b=>b.id===m.hostId);if(host){m.x=host.x+m.ox;m.y=host.y+m.oy;}}game.motes=game.motes.filter(m=>m.life>0);
    let orbiting=0,living=0;for(const b of game.bodies){if(['planet','gas'].includes(TYPES[b.type].family)&&b.turns>=1)orbiting++;if(b.stage>=3)living++;}
    contract('system',orbiting);contract('living',living);
    game.contracts.calm=game.instability<25?game.contracts.calm+realDt:0;contract('calm',game.contracts.calm);
    if(cameraKeys.size&&!pan){
      const dx=Number(cameraKeys.has('ArrowRight'))-Number(cameraKeys.has('ArrowLeft')),dy=Number(cameraKeys.has('ArrowDown'))-Number(cameraKeys.has('ArrowUp')),length=Math.hypot(dx,dy)||1;
      game.camera.x+=dx/length*420*realDt/game.camera.zoom;game.camera.y+=dy/length*420*realDt/game.camera.zoom;
    }
    if(!game.aim&&!pan)tickCamera(game.camera,game.bodies,realDt);
    if(game.instability<100)game.instability=Math.max(0,game.instability-realDt*.055);
    if(game.bodies.length===0)game.instability=100;
    if(game.instability>=99.9){game.collapseTime+=realDt;$('status-text').textContent=`COLLASSO IN ${Math.max(0,Math.ceil(10-game.collapseTime))} s`;if(game.collapseTime>=10)beginEnd();}
    else{game.collapseTime=0;$('status-text').textContent=`SETTORE ${String(game.era).padStart(3,'0')}`;}
  }
  if(game.mode==='menu'&&!game.paused){menuAccumulator+=realDt*2.2;let n=0;while(menuAccumulator>=1/60&&n++<10){integrate(game.bodies,1/60);menuAccumulator-=1/60;}for(const b of game.bodies)b.age+=realDt;}
  if(game.mode==='ending'){
    game.ending+=realDt;
    if(game.ending<2){for(const b of game.bodies){b.x*=Math.exp(-realDt*1.8);b.y*=Math.exp(-realDt*1.8);}game.camera.x*=Math.exp(-realDt*2);game.camera.y*=Math.exp(-realDt*2);}
    if(game.ending>=2&&!game.banged){game.banged=true;game.bodies=[];burst(0,0,220,'#ffe3b9',true);audio.play('supernova');}
    if(game.ending>4.2)finishEnd();
  }
  if(!game.paused){for(const p of game.particles){p.x+=p.vx*realDt;p.y+=p.vy*realDt;p.vx*=Math.exp(-realDt*.6);p.vy*=Math.exp(-realDt*.6);p.life-=realDt;}game.particles=game.particles.filter(p=>p.life>0);for(const w of game.waves){w.radius+=w.speed*realDt;w.life-=realDt;}game.waves=game.waves.filter(w=>w.life>0);for(const l of game.labels)l.life-=realDt;game.labels=game.labels.filter(l=>l.life>0);game.shake*=Math.exp(-realDt*5);game.flash*=Math.exp(-realDt*3.5);if(game.flash<.01)game.flash=0;for(const f of game.flashes)f.life-=realDt;game.flashes=game.flashes.filter(f=>f.life>0);}
  const oldZoom=game.camera.zoom;game.camera.zoom+=(game.camera.targetZoom-game.camera.zoom)*(1-Math.exp(-realDt*15));
  if(Math.abs(oldZoom-game.camera.zoom)>.00001&&game.zoomAnchor){const a=game.zoomAnchor;game.camera.x=a.wx-(a.sx-renderer.w/2)/game.camera.zoom;game.camera.y=a.wy-(a.sy-renderer.h/2)/game.camera.zoom;}
  if(game.zoomAnchor&&game.camera.follow){const focus=game.camera.mode==='selected'?game.bodies.find(b=>b.id===game.camera.followId)||cameraFocus():cameraFocus();game.camera.offsetX=game.camera.x-focus.x;game.camera.offsetY=game.camera.y-focus.y;}
  if(Math.abs(game.camera.zoom-game.camera.targetZoom)<.0001)game.zoomAnchor=null;
}
function spawnHazard(){
  // Hazards use the same gravity/collisions as every player-created body.
  if(game.bodies.length>=MAX_BODIES-2||game.elapsed<game.pacing.quietUntil)return;
  const candidates=game.bodies.filter(b=>TYPES[b.type].family==='planet');if(!candidates.length)return;
  const target=candidates[Math.floor(Math.random()*candidates.length)],angle=Math.random()*TAU,r=LIMIT-80,x=cameraFocus().x+Math.cos(angle)*r,y=cameraFocus().y+Math.sin(angle)*r;
  const speed=105,travel=Math.hypot(target.x-x,target.y-y)/speed,future=predict(game.bodies,target,Math.min(45,travel)).path.at(-1)||target;
  const dx=future.x-x+(Math.random()-.5)*65,dy=future.y-y+(Math.random()-.5)*65,d=Math.hypot(dx,dy);
  const rock=body('asteroid',x,y,dx/d*speed,dy/d*speed,{hazard:true,signal:'hazard',signalUntil:game.elapsed+9});game.bodies.push(rock);
  event('VISITATORE DALLO SPAZIO PROFONDO','Un asteroide sta attraversando il settore.',true);
}
function scanHazards(){
  for(const a of game.bodies){if(a.type!=='asteroid')continue;for(const b of game.bodies){if(b.stage<4||a.warned===b.id)continue;const x=a.x-b.x,y=a.y-b.y,vx=a.vx-b.vx,vy=a.vy-b.vy,t=clamp(-(x*vx+y*vy)/(vx*vx+vy*vy||1),0,18);if(t>0&&Math.hypot(x+vx*t,y+vy*t)<b.r+a.r+20){event(`ASTEROIDE IN ROTTA VERSO ${b.label||TYPES[b.type].name}`,'La gravità può ancora cambiare le cose.',true);b.signal='sos';b.signalUntil=game.elapsed+9;a.signal='hazard';a.signalUntil=game.elapsed+9;a.warned=b.id;audio.play('auto');}}}
}
function spawnMote(){
  const host=game.bodies.filter(b=>b.mass>=40).sort((a,b)=>b.mass-a.mass)[0]||game.bodies[0];if(!host)return;
  const orbiters=game.bodies.filter(b=>['planet','gas'].includes(TYPES[b.type].family));let x,y;
  if(orbiters.length&&rng()<.7){
    // Usually on an existing orbit, a little ahead or behind a planet: a reason to watch your system.
    const o=orbiters[Math.floor(rng()*orbiters.length)],h=orbitHost(o,game.bodies)||host,d=Math.hypot(o.x-h.x,o.y-h.y),a=Math.atan2(o.y-h.y,o.x-h.x)+(rng()<.5?1:-1)*(.8+rng()*2);
    x=h.x+Math.cos(a)*d*(.97+rng()*.06);y=h.y+Math.sin(a)*d*(.97+rng()*.06);
  }else{const a=rng()*TAU,d=170+rng()*520;x=host.x+Math.cos(a)*d;y=host.y+Math.sin(a)*d;}
  if(game.bodies.some(b=>Math.hypot(b.x-x,b.y-y)<b.r+45))return;
  game.motes.push({x,y,ox:x-host.x,oy:y-host.y,hostId:host.id,r:15,life:42,max:42,seed:rng()*TAU});
}
function collectMotes(){
  if(game.mode!=='playing'||!game.motes.length)return;
  for(const m of game.motes){if(m.life<=0)continue;
    const b=game.bodies.find(b=>!['star','compact','black','binary'].includes(TYPES[b.type].family)&&Math.hypot(b.x-m.x,b.y-m.y)<m.r+b.r);if(!b)continue;
    m.life=0;game.dustChain=game.elapsed-game.dustTime<7?game.dustChain+1:1;game.dustTime=game.elapsed;
    reward('POLVERE DI STELLE',80+40*Math.min(game.dustChain-1,5),m,game.dustChain>1?`Catena di luce ×${game.dustChain}`:`Raccolta da ${b.label||TYPES[b.type].name}`);
    for(let i=0;i<26;i++){const a=rng()*TAU,v=20+rng()*70;game.particles.push({x:m.x,y:m.y,vx:Math.cos(a)*v+b.vx*.3,vy:Math.sin(a)*v+b.vy*.3,r:.8+rng()*1.4,life:.8+rng(),max:1.8,color:'#ffd98a'});}
    game.waves.push({x:m.x,y:m.y,radius:m.r,life:.9,max:.9,color:'#ffe2a0',speed:60});audio.play('dust',game.dustChain);contract('stardust');
  }
}
function demo(){
  // The title screen runs a small, living system: real physics, no scoring.
  const orbit=(type,d,a,extra={})=>{const v=orbitSpeed(90+TYPES[type].mass,d);return body(type,Math.cos(a)*d,Math.sin(a)*d,-Math.sin(a)*v,Math.cos(a)*v,{demo:true,...extra});};
  const earth=orbit('earth',255,.5,{stage:5,peakStage:5,life:150,label:'Gaia'}),mv=Math.sqrt(G*5/22);
  const comet=body('comet',-760,140,0,0,{demo:true});const cv=orbitSpeed(91,770)*.52;comet.vx=-140/770*cv;comet.vy=-(-760)/770*cv;
  game.bodies=[body('sun',0,0,0,0,{label:'Sol',demo:true,age:30}),orbit('rocky',160,2.6,{stage:1}),earth,body('moon',earth.x+22,earth.y,earth.vx,earth.vy+mv,{demo:true}),orbit('gas',430,4.2),orbit('jupiter',610,1.4),orbit('neptune',800,3.2),comet];
  renderer.resetTrails();menuAccumulator=0;
  const zoom=Math.max(.55,Math.min(1.05,renderer.h/900));Object.assign(game.camera,{zoom,targetZoom:zoom,x:-renderer.w*.16/zoom,y:40,follow:false,mode:'manual'});
}
function beginEnd(){game.mode='ending';game.ending=.001;game.banged=false;game.paused=false;cancelAim();game.selected=null;game.forecast=null;event('COLLASSO GRAVITAZIONALE','Il cosmo sta trattenendo il respiro.',true);audio.play('auto');}
function finishEnd(){
  game.mode='over';game.ending=0;game.collapseTime=0;game.record=Math.max(game.record,Math.floor(game.score));try{localStorage.setItem('orbit-best',String(game.record));}catch{}
  $('end-description').textContent=`Il tuo universo è durato ${Math.floor(game.elapsed/60)} min ${Math.floor(game.elapsed%60)} s. Hai dato una possibilità a ${game.stats.civilizations} civiltà. Il prossimo potrebbe andare diversamente.`;
  $('end-stats').innerHTML=`<div><strong>${Math.floor(game.score).toLocaleString('it-IT')}</strong><small>PUNTI</small></div><div><strong>${game.stats.orbits}</strong><small>ORBITE</small></div><div><strong>${game.contracts.done}</strong><small>CONTRATTI</small></div><div><strong>${game.record.toLocaleString('it-IT')}</strong><small>RECORD</small></div>`;
  showModal('end-modal');
}
function icon(type){const t=TYPES[type];return `<span class="orb-icon ${t.family} type-${type}" style="--body-color:${t.color}"></span>`;}
function contractRow(c){
  const d=CONTRACTS[c.id],timer=d.mode==='timer',pct=Math.min(100,c.progress/c.goal*100),value=timer?`${Math.floor(c.progress)} / ${c.goal} s`:`${Math.min(c.goal,Math.floor(c.progress))} / ${c.goal}`;
  return `<div class="contract tier-${d.tier}${c.fresh?' fresh':''}"><div class="contract-head"><b>${d.title}</b><span>+${Math.round(d.points*multiplier()).toLocaleString('it-IT')}</span></div><small>${d.desc}</small><div class="contract-bar"><i style="width:${pct}%"></i></div><em>${value}</em></div>`;
}
function updateUI(){
  game.shownScore+=(game.score-game.shownScore)*.35;if(Math.abs(game.score-game.shownScore)<1)game.shownScore=game.score;
  $('score').textContent=String(Math.floor(game.shownScore)).padStart(6,'0');
  $('combo-fill').style.width=(game.combo>1?game.comboTimer/9*100:0)+'%';$('combo-fill').style.background=COMBO_COLORS[game.combo];
  $('rank').textContent=`${RANKS[game.rank]} · punti ×${multiplier().toFixed(1)}`;
  const cv=game.contracts.active.map(c=>c.id+':'+Math.floor(c.progress)).join('|')+game.rank;
  if(cv!==contractsVersion){contractsVersion=cv;$('contract-list').innerHTML=game.contracts.active.map(contractRow).join('');for(const c of game.contracts.active)c.fresh=0;}
  $('contracts-done').textContent=`${game.contracts.done} completati`;
  $('contracts').classList.toggle('hidden',game.mode==='menu'||game.mode==='over');$('rank').classList.toggle('hidden',game.mode==='menu');$('combo').innerHTML=`×${game.combo} <i>${game.combo>1?'il cosmo approva':'prendi un rischio'}</i>`;
  $('era').textContent=`ERA ${String(game.era).padStart(2,'0')} · ${eras[game.era-1].toUpperCase()}`;
  $('instability-fill').style.width=game.instability+'%';$('instability-fill').style.background=game.instability>75?'#ff7e85':game.instability>45?'#ffc58a':'#9ad9c8';
  $('instability-label').textContent=`Instabilità ${Math.floor(game.instability)}% · ${game.instability>95?'collasso imminente':game.instability>65?'il cielo trema':game.instability>35?'equilibrio precario':'il cosmo respira'}`;
  $('countdown').textContent=`${Math.ceil((ARRIVAL_INTERVAL-game.arrival)/arrivalSpeed(game.queue.length))} s`;$('timer-fill').style.width=(game.arrival/ARRIVAL_INTERVAL*100)+'%';$('queue-count').textContent=`${game.queue.length} / 5`;$('queue-panel').classList.toggle('full',game.queue.length>=5);
  const version=game.queue.join(',');if(queueVersion!==version){queueVersion=version;$('queue').innerHTML=game.queue.map((type,i)=>`<div class="queue-item ${i===0?'first':''}" title="${TYPES[type].desc}">${icon(type)}<div><b>${TYPES[type].name}</b><small>MASSA ${TYPES[type].mass}</small></div></div>`).join('')+Array.from({length:5-game.queue.length},()=>'<div class="queue-item empty">· · ·</div>').join('');}
  const b=game.bodies.find(b=>b.id===game.selected);$('selection').classList.toggle('hidden',!b||!!game.aim||game.mode==='menu');
  if(b){const t=TYPES[b.type],hab=t.family==='planet',f=game.forecast;$('selection').innerHTML=`<span class="eyebrow">${b.label||'CORPO SELEZIONATO'}</span><h3>${t.name}</h3><span class="eyebrow accent">MASSA ${Math.round(b.mass*10)/10} <span style="color:#657582">/ ${b.turns} GIRI</span></span>${f?`<div class="orbit-state risk-${f.risk}"><b>${f.status}</b><span>${f.binding}</span></div><p><strong>Dominante: ${f.hostLabel}</strong><br>Ritorno: ${f.returnText}</p><small class="orbit-legend">Linea: previsione · tratteggio: ellisse stimata</small>`:'<p>Verifica dell’orbita…</p>'}<p>${hab?stages[b.stage]+' · '+(b.exposure>1?'condizioni ostili':'in cerca di equilibrio'):t.desc}</p>${hab?`<div class="life-bar"><span style="width:${b.life/150*100}%"></span></div>`:''}`;}
  $('body-count').textContent=`${game.bodies.length} ${game.bodies.length===1?'corpo':'corpi'}`;$('zoom-label').textContent=Math.round(game.camera.zoom*100)+'%';
  if(game.aim){const f=game.forecast;$('aim-info').classList.remove('hidden');$('aim-info').innerHTML=`<b class="${f?.dirty?'yellow':['green','yellow','red'][f?.risk??1]}">${f?.dirty?'Verifica della nuova traiettoria…':f?.status||'Cerca una tangente'}</b><br>Dominante: ${f?.hostLabel||game.aim.solution?.host?.label||'in verifica'}<br>${f&&!f.dirty?f.returnText+' · ':''}tempo 12% · coda attiva`;}else $('aim-info').classList.add('hidden');
  $('follow-selected').disabled=!b;$('follow-selected').textContent=game.camera.follow&&game.camera.mode==='selected'?'◎ Corpo seguito':'◎ Segui corpo';
  $('follow-selected').classList.toggle('active',game.camera.follow&&game.camera.mode==='selected');
  const wait=Math.max(0,game.asteroidReady-game.elapsed);$('asteroid-tool').textContent=game.asteroidMode?`✓ Micro-asteroide ${wait>0?'· '+wait.toFixed(1)+' s':'· pronto'} · torna alla coda`:'↗ Micro-asteroide · massa 0,2';$('asteroid-tool').classList.toggle('active',game.asteroidMode);
}
function showModal(id){$('overlay').classList.remove('hidden');for(const m of ['welcome','help-modal','end-modal'])$(m).classList.toggle('hidden',m!==id);}
function start(){audio.init();audio.ambient(true);reset($('scenario').value);game.mode='playing';game.paused=false;$('pause').textContent='Ⅱ';$('overlay').classList.add('hidden');$('paused').classList.add('hidden');event('BENVENUTO, PICCOLA DIVINITÀ.','Trascina di lato rispetto al Sole per cercare un’orbita.');updateUI();}
function pause(value=!game.paused){if(game.mode!=='playing')return;game.paused=value;cameraKeys.clear();cancelAim();$('paused').classList.toggle('hidden',!value);$('pause').textContent=value?'▶':'Ⅱ';if(value&&'speechSynthesis'in window)speechSynthesis.cancel();}
function cancelAim(){game.hover=null;game.aim=null;pointer=null;game.forecast=null;nextForecast=0;$('aim-info').classList.add('hidden');}
function setZoom(factor,x=renderer.w/2,y=renderer.h/2){const w=renderer.world(x,y,game.camera);game.zoomAnchor={sx:x,sy:y,wx:w.x,wy:w.y};game.camera.targetZoom=clamp(game.camera.targetZoom*factor,.12,2.8);}
function refreshAim(){
  const aim=game.aim;if(!aim)return;
  let host=aim.satelliteId?game.bodies.find(b=>b.id===aim.satelliteId):null;
  if(host){aim.probe.x=host.x+aim.offsetX;aim.probe.y=host.y+aim.offsetY;}
  else if(aim.satelliteId){aim.satelliteId=null;aim.probe.satelliteOf=null;}
  aim.solution=assistLaunch(aim.probe,game.bodies,aim.rawX||0,aim.rawY||0,host);
  aim.dragScale??=Math.max(DRAG_SCALE,44/Math.max(.1,(aim.solution.ideal||20)*game.camera.zoom));
  aim.probe.vx=aim.solution.vx;aim.probe.vy=aim.solution.vy;
}
function hit(x,y){let found=null,dist=Infinity;for(const b of game.bodies){const d=Math.hypot(x-b.x,y-b.y);if(d<Math.max(b.r+5/game.camera.zoom,12/game.camera.zoom)&&d<dist){found=b;dist=d;}}return found;}
const canvas=$('space');
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{
  if(game.mode!=='playing')return;
  const w=renderer.world(e.clientX,e.clientY,game.camera);canvas.setPointerCapture(e.pointerId);
  if(e.button===2||e.button===1||e.shiftKey){cancelAim();pan={x:e.clientX,y:e.clientY,cx:game.camera.x,cy:game.camera.y};game.camera.follow=false;game.camera.mode='manual';game.zoomAnchor=null;canvas.style.cursor='grabbing';return;}
  if(e.button!==0)return;
  const satellite=!game.asteroidMode&&game.queue[0]==='moon'?satelliteHost({type:'moon',x:w.x,y:w.y},game.bodies):null;
  const b=hit(w.x,w.y);if(b&&!satellite){game.selected=b.id;game.forecast=null;nextForecast=0;updateUI();return;}
  if(game.paused||(!game.queue.length&&!game.asteroidMode)||(game.asteroidMode&&game.elapsed<game.asteroidReady))return;
  if(game.bodies.length>MAX_BODIES-2){event('SETTORE SATURO','Aspetta una fusione: non c’è più spazio nella simulazione.',true);return;}
  if(Math.hypot(w.x-cameraFocus().x,w.y-cameraFocus().y)>LIMIT-50){event('OLTRE IL SETTORE','Piazza dentro il confine tratteggiato.',true);return;}
  audio.init();pointer={x:e.clientX,y:e.clientY,id:e.pointerId};const type=game.asteroidMode?'asteroid':game.queue[0];game.aim={type,micro:game.asteroidMode,probe:body(type,w.x,w.y,0,0,{id:-1,satelliteOf:satellite?.id,...(game.asteroidMode?{mass:.2,r:2.2,micro:true}:{})}),satelliteId:satellite?.id,offsetX:satellite?w.x-satellite.x:0,offsetY:satellite?w.y-satellite.y:0,rawX:0,rawY:0};refreshAim();game.forecast=null;nextForecast=0;updateUI();
});
canvas.addEventListener('pointermove',e=>{
  if(pan){game.camera.x=pan.cx-(e.clientX-pan.x)/game.camera.zoom;game.camera.y=pan.cy-(e.clientY-pan.y)/game.camera.zoom;return;}
  if(game.aim&&pointer){const dx=(e.clientX-pointer.x)/game.camera.zoom,dy=(e.clientY-pointer.y)/game.camera.zoom,length=Math.hypot(dx,dy),scale=Math.min(1,1000/Math.max(1,length));game.aim.rawX=dx/game.aim.dragScale*scale;game.aim.rawY=dy/game.aim.dragScale*scale;refreshAim();if(game.forecast)game.forecast.dirty=true;}
  else{const w=renderer.world(e.clientX,e.clientY,game.camera);game.hover=w;canvas.style.cursor=hit(w.x,w.y)?'pointer':'crosshair';}
});
canvas.addEventListener('pointerup',e=>{
  if(pan){pan=null;canvas.style.cursor='crosshair';return;}
  if(game.aim&&pointer&&pointer.id===e.pointerId&&!game.paused){refreshAim();const b=game.aim.probe;game.forecast=predict(game.bodies,b);deploy(b.x,b.y,b.vx,b.vy);cancelAim();}
  if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
});
canvas.addEventListener('pointerleave',()=>{game.hover=null;});
canvas.addEventListener('pointercancel',()=>{cancelAim();pan=null;});
canvas.addEventListener('wheel',e=>{e.preventDefault();if(game.mode==='playing')setZoom(Math.exp(-e.deltaY*.0012),e.clientX,e.clientY);},{passive:false});
$('start').onclick=start;$('restart').onclick=()=>{$('scenario').value=scenario;start();};
$('back-menu').onclick=()=>{reset();game.mode='menu';demo();showModal('welcome');};
$('pause').onclick=()=>pause();$('resume').onclick=()=>pause(false);
$('pause-restart').onclick=()=>{$('scenario').value=scenario;start();};
$('pause-menu').onclick=()=>{reset();game.mode='menu';game.paused=false;$('paused').classList.add('hidden');demo();showModal('welcome');};
$('sound').onclick=()=>{audio.init();const on=audio.mute();$('sound').textContent=on?'♫':'♪̸';$('sound').setAttribute('aria-label',on?'Disattiva audio':'Attiva audio');};
$('zoom-in').onclick=()=>setZoom(1.3);$('zoom-out').onclick=()=>setZoom(1/1.3);
$('follow-selected').onclick=()=>{game.zoomAnchor=null;followSelected(game.camera,game.bodies.find(b=>b.id===game.selected),renderer.w);updateUI();};
$('asteroid-tool').onclick=()=>{cancelAim();game.asteroidMode=!game.asteroidMode;updateUI();};
$('help').onclick=()=>{if(game.mode==='ending')return;helpWasPaused=game.paused;game.paused=true;cameraKeys.clear();cancelAim();showModal('help-modal');};
$('close-help').onclick=()=>{if(game.mode==='menu')showModal('welcome');else if(game.mode==='over')showModal('end-modal');else $('overlay').classList.add('hidden');game.paused=helpWasPaused;};
$('catalog-grid').innerHTML=Object.entries(TYPES).map(([type,t])=>`<div class="catalog-card">${icon(type)}<b>${t.name}</b><small>MASSA ${t.mass}</small><p>${t.desc}</p></div>`).join('');
$('catalog-button').onclick=()=>{catalogWasPaused=game.paused;game.paused=true;cancelAim();$('catalog').showModal();};$('close-catalog').onclick=()=>$('catalog').close();$('catalog').addEventListener('close',()=>{game.paused=catalogWasPaused;});
document.addEventListener('keyup',e=>cameraKeys.delete(e.code));
document.addEventListener('keydown',e=>{
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code)&&game.mode==='playing'&&!game.paused&&$('overlay').classList.contains('hidden')&&!$('catalog').open&&!['INPUT','TEXTAREA','SELECT'].includes(e.target?.tagName)&&!e.target?.isContentEditable){
    e.preventDefault();if(!cameraKeys.size){cancelAim();pan=null;}cameraKeys.add(e.code);game.camera.follow=false;game.camera.mode='manual';game.zoomAnchor=null;return;
  }
if(e.code==='Space'&&e.target===document.body&&$('overlay').classList.contains('hidden')&&!$('catalog').open){e.preventDefault();pause();}if(e.code==='Escape')cancelAim();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&game.mode==='playing')pause(true);});
window.addEventListener('blur',()=>{cameraKeys.clear();cancelAim();pan=null;});
window.addEventListener('resize',()=>renderer.resize());
function frame(time){const dt=Math.min(.075,(time-(lastTime||time))/1000);lastTime=time;update(dt);
  if(game.mode==='playing'&&(game.aim||game.selected)&&time>=nextForecast){const b=game.aim?.probe||game.bodies.find(b=>b.id===game.selected);if(b)game.forecast=predict(game.bodies,b);nextForecast=time+(game.aim?150:700);}
  if(time-lastUI>100){updateUI();lastUI=time;}renderer.draw(game,time/1000);requestAnimationFrame(frame);
}
reset();demo();requestAnimationFrame(frame);
// Named exports let the integration tests exercise the actual game loop without a browser.
export { game, reset, update, incoming, deploy, pause, lifeAndOrbits, refreshAim, cameraFocus, spawnHazard, scanHazards, spawnMote, collectMotes, contract, demo };
