import { systemFocus } from './camera.js';
import { integrate, TYPES, LIMIT } from './physics.js';
import { orbitHost, orbitalElements, satelliteZone, refreshHost, orbitGuide } from './orbits.js';
export function predict(bodies,target,seconds){
  const copy=bodies.map(b=>({...b}));let probe=copy.find(b=>b.id===target.id);
  if(!probe){probe={...target};copy.push(probe);}
  const host=orbitHost(probe,copy),elements=orbitalElements(probe,host),satellite=host&&['planet','gas'].includes(TYPES[host.type]?.family)&&probe.type==='moon';
  let risk=1,reason='Traiettoria libera · cerca una tangente',tidal=0;
  if(host&&elements){
    const d=Math.hypot(probe.x-host.x,probe.y-host.y),clearance=(probe.r+host.r)*(satellite?1.04:1.8)+(satellite?1:2);
    for(const other of copy){if(other.id===probe.id||other.id===host.id||host.members?.includes(other.id))continue;const distance=Math.hypot(other.x-probe.x,other.y-probe.y);tidal+=2*other.mass/host.mass*(d/Math.max(1,distance))**3;}
    if(!elements.bound){risk=2;reason='Velocità di fuga · traiettoria aperta';}
    else if(!satellite&&elements.peri<host.r+probe.r+1){risk=2;reason='Troppo lento o radiale · caduta prevista';}
    else if(!satellite&&elements.peri<clearance){risk=1;reason='Pericentro ravvicinato · orbita rischiosa';}
    else if(elements.apo+Math.hypot(host.x-systemFocus(copy).x,host.y-systemFocus(copy).y)>LIMIT){risk=2;reason='Orbita oltre il settore';}
    else if(elements.e>.78){risk=1;reason='Ellisse estrema · ritorno rischioso';}
    else if(tidal>.13){risk=1;reason='Più masse in competizione · orbita perturbata';}
    else {risk=0;reason=satellite?'Orbita satellite plausibile':'Orbita chiusa plausibile';}
    if(satellite){const zone=satelliteZone(host,copy);if(!zone||d>zone.outer){risk=Math.max(risk,1);reason='Troppo lontano · cattura debole';}else if(d<zone.inner){risk=2;reason='Troppo vicino al pianeta';}}
  }
  const guide=orbitGuide(target,host,elements),hostStart=host?{...host}:null;
  const isolated=copy.length===2;
  const dt=seconds!==undefined?.1:satellite?1/120:isolated&&elements?.bound?Math.min(2,Math.max(.02,Math.sqrt(Math.max(1,elements.peri)**3/elements.mu)*.025)):Math.min(.12,Math.max(.012,(elements?.period||70)/600));
  const wanted=Number.isFinite(elements?.period)?elements.period*(satellite?3.25:2.25):50;
  const horizon=seconds??Math.min(isolated?14000:satellite?180:360,Math.max(satellite?45:32,wanted));
  const visibleHorizon=seconds??Math.min(horizon,Number.isFinite(elements?.period)?elements.period*1.15:50);
  const steps=Math.ceil(horizon/dt),sample=seconds!==undefined?2:Math.max(1,Math.floor(visibleHorizon/dt/240)),path=[];
  let collision=false,escaped=false,externalCollision=false,angleTravel=0,lastAngle=host?Math.atan2(probe.y-host.y,probe.x-host.x):0,returnPoint=null,satelliteEscaped=false;
  const initialZone=satellite?satelliteZone(host,copy):null;
  for(let i=0;i<steps;i++){
    for(const b of copy){b._px=b.x;b._py=b.y;}
    integrate(copy,dt);
    if(host){refreshHost(host,copy);const a=Math.atan2(probe.y-host.y,probe.x-host.x);let da=a-lastAngle;while(da>Math.PI)da-=Math.PI*2;while(da< -Math.PI)da+=Math.PI*2;angleTravel+=da;lastAngle=a;
      if(!returnPoint&&Math.abs(angleTravel)>=Math.PI*2)returnPoint={x:probe.x,y:probe.y};
      if(satellite&&initialZone&&Math.hypot(probe.x-host.x,probe.y-host.y)>initialZone.outer*1.4)satelliteEscaped=true;
    }
    for(let j=0;j<copy.length;j++){
      const b=copy[j];if(b.id===probe.id)continue;
      // Swept relative positions catch fast crossings between prediction samples.
      const x0=probe._px-b._px,y0=probe._py-b._py,dx=probe.x-b.x-x0,dy=probe.y-b.y-y0;
      const u=Math.max(0,Math.min(1,-(x0*dx+y0*dy)/(dx*dx+dy*dy||1))),d=Math.hypot(x0+dx*u,y0+dy*u);
      if(d<=b.r+probe.r){risk=2;reason='Collisione prevista';collision=true;break;}
      if(d<(b.r+probe.r)*(satellite&&b.id===host.id?1.12:1.5)){risk=Math.max(1,risk);if(risk<2)reason='Passaggio ravvicinato · margine ridotto';}
      if(i%6===0)for(let k=j+1;k<copy.length;k++){const o=copy[k];if(o.id===probe.id)continue;if(Math.hypot(o.x-b.x,o.y-b.y)<o.r+b.r)externalCollision=true;}
    }
    const sector=systemFocus(copy);if(Math.hypot(probe.x-sector.x,probe.y-sector.y)>LIMIT){risk=2;reason='Verso lo spazio profondo';escaped=true;}
    if((i%sample===0&&i*dt<=visibleHorizon)||collision||escaped)path.push({x:probe.x,y:probe.y,risk});
    if(collision||escaped)break;
  }
  if(externalCollision&&risk===0){risk=1;reason='Impatto fra vicini · equilibrio incerto';}
  if(risk===0&&bodies.some(b=>TYPES[b.type].lifetime&&b.age+horizon>=TYPES[b.type].lifetime&&Math.hypot(b.x-target.x,b.y-target.y)<1300)){risk=1;reason='Stella instabile · il campo cambierà';}
  if(risk===0&&host){const final=orbitalElements(probe,host);if(!final?.bound||!satellite&&final.peri<host.r+probe.r+2){risk=1;reason='Orbita in evoluzione · perturbazioni';}}
  if(satellite&&(satelliteEscaped||Math.abs(angleTravel)<Math.PI*4)){risk=Math.max(risk,1);if(risk<2)reason=satelliteEscaped?'La Luna perde il pianeta durante la previsione':'Cattura possibile · due giri non confermati';}
  // Never leave a misleading green segment before a known future crash.
  for(const p of path)p.risk=risk;
  let status='TRAIETTORIA APERTA',binding='Nessun legame stabile',returnText='Non previsto';
  if(elements?.bound){binding=satellite?'Legata al pianeta':elements.e>.8?'Legame debole':'Ancora agganciato';status=satellite?'CATTURA POSSIBILE':elements.e>.18?'ORBITA ELLITTICA':'ORBITA CHIUSA';returnText=returnPoint?'Sì · osservato nella previsione':'Probabile · orbita stimata';if(elements.apo>650&&!satellite)status='ORBITA ELLITTICA AMPIA';}
  if(elements&&!elements.bound){status='VELOCITÀ DI FUGA';binding='Non legato al dominante';}
  if(risk===1){if(!satellite)status='TRAIETTORIA INSTABILE';binding='Legame da verificare';returnText=returnPoint?'Passaggio di ritorno · instabile':'Non confermato';}
  if(risk===2){status=collision||elements?.bound&&elements.peri<(host?.r||0)+target.r+2?'CADUTA PROBABILE':'VELOCITÀ DI FUGA';binding=collision?'Collisione prevista':'Orbita non sicura';returnText='Non sicuro';}
  if(satellite&&risk===0){status='ORBITA SATELLITE';binding='Cattura verificata · almeno 2 giri';}
  return {path,risk,reason,status,binding,returnText,returnPoint,guide,hostId:host?.id,hostMembers:host?.members,hostLabel:hostStart?.label||TYPES[host?.type]?.name||'Nessuno stabile',hostPosition:hostStart,elements,seconds:horizon,collision,validatedTurns:Math.abs(angleTravel)/(Math.PI*2)};
}
