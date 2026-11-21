// Arcade units. Every kind uses the same reciprocal, softened gravity law.
export const G = 720;
export const SOFTENING = 5;
export const LIMIT = 3800;
export const MAX_BODIES = 80;
export const TYPES = {
  asteroid: { name:'Asteroide', mass:1, radius:4, color:'#b4a79c', family:'rock', desc:'Piccolo, irregolare. Enorme talento per il tempismo sbagliato.' },
  comet: { name:'Cometa', mass:1, radius:4, color:'#afe5e4', family:'ice', desc:'Una viaggiatrice con una scia. Perfetta per una fionda.' },
  moon: { name:'Luna', mass:1, radius:3, color:'#c1c8d3', family:'rock', desc:'Nella zona satellite, eredita il moto del pianeta: trascina solo l’orbita locale.' },
  small: { name:'Piccolo pianeta', mass:2, radius:6, color:'#ad9990', family:'planet', desc:'Compatto e craterizzato. Un Mercurio in cerca di casa.' },
  rocky: { name:'Pianeta roccioso', mass:3, radius:8, color:'#d89a74', family:'planet', desc:'Può ospitare oceani, vita e pessime previsioni meteo.' },
  ocean: { name:'Pianeta oceanico', mass:4, radius:9, color:'#64b8db', family:'planet', desc:'Già bagnato. Aspetta solo la stella giusta.' },
  earth: { name:'Terra', mass:5, radius:10, color:'#72bdb1', family:'planet', desc:'Oceani blu, continenti verdi. Una promessa da mantenere.' },
  superEarth: { name:'Super-Terra', mass:7, radius:12, color:'#b2bf7d', family:'planet', desc:'Più spazio per la vita. Più massa per disturbare i vicini.' },
  uranus: { name:'Mini-Nettuno', mass:8, radius:13, color:'#a4dfda', family:'gas', desc:'Ghiaccio turchese e anelli inclinati. Il peso medio del settore.' },
  neptune: { name:'Nettuno', mass:10, radius:15, color:'#527edf', family:'gas', desc:'Blu intenso, venti chiari. Un vicino piuttosto influente.' },
  gas: { name:'Saturno', mass:12, radius:17, color:'#d8b68e', family:'gas', desc:'Bande tenui, grandi anelli e una certa voglia di inglobare pianeti.' },
  jupiter: { name:'Giove', mass:16, radius:20, color:'#d3a286', family:'gas', desc:'Bande e una grande macchia. Il peso massimo planetario.' },
  red: { name:'Nana rossa', mass:50, radius:20, color:'#ff8e76', family:'star', heat:.57, desc:'Un piccolo focolare. Zona abitabile più vicina.' },
  sun: { name:'Stella solare', mass:90, radius:26, color:'#ffd19a', family:'star', heat:1, desc:'Calda, luminosa. Il posto intorno a cui chiamare casa.' },
  giant: { name:'Stella gigante', mass:150, radius:36, color:'#ffba85', family:'star', heat:2, lifetime:360, desc:'Brilla intensamente. Poi diventa il problema di tutti.' },
  white: { name:'Nana bianca', mass:100, radius:9, color:'#e7f2ff', family:'compact', heat:.28, desc:'Molta gravità, poco ingombro. Luce fredda e discreta.' },
  neutron: { name:'Stella di neutroni', mass:140, radius:5, color:'#b8d6ff', family:'compact', desc:'Un punto densissimo. Orbite vicine, conseguenze grandi.' },
  pulsar: { name:'Pulsar', mass:150, radius:5, color:'#aabfff', family:'compact', desc:'Un faro rotante. I suoi fasci non fanno bene alla vita.' },
  black: { name:'Buco nero stellare', mass:220, radius:3, color:'#c0a0ed', family:'black', desc:'Piccolo orizzonte, grande personalità. La gravità resta gravità.' },
  massive: { name:'Buco nero massiccio', mass:700, radius:4, color:'#efb29b', family:'black', desc:'Può reggere un intero sistema. O mangiarselo lentamente.' },
  supermassive: { name:'Buco nero supermassiccio', mass:2200, radius:6, color:'#e88e76', family:'black', desc:'Un evento eccezionale. Il settore non sarà più lo stesso.' },
  binary: { name:'Sistema binario', mass:100, radius:20, color:'#ffc797', family:'binary', desc:'Due nane rosse già in orbita attorno al loro baricentro.' },
  debris: { name:'Frammento', mass:.5, radius:3, color:'#a7a3ad', family:'rock', desc:'Ciò che rimane di un’idea ambiziosa. Gravita davvero.' },
};
let nextId = 1;
export function body(type, x=0, y=0, vx=0, vy=0, overrides={}) {
  const t=TYPES[type];
  return { id:nextId++, type, x,y,vx,vy, mass:t.mass, r:t.radius, age:0, life:0, stage:0, exposure:0, turns:0, angleTravel:0, orbitHost:null, angle:null, captureTimer:0, cooldown:0, seed:Math.random()*1000, ...overrides };
}
export function radiusFor(type,mass) {
  const t=TYPES[type];
  return t.family==='black' ? t.radius*Math.pow(mass/t.mass,.25) : t.radius*Math.cbrt(mass/t.mass);
}
export function accelerations(bodies) {
  const ax=new Float64Array(bodies.length), ay=new Float64Array(bodies.length);
  for(let i=0;i<bodies.length;i++) for(let j=i+1;j<bodies.length;j++) {
    const a=bodies[i],b=bodies[j],dx=b.x-a.x,dy=b.y-a.y;
    const r2=dx*dx+dy*dy+SOFTENING*SOFTENING, f=G/(r2*Math.sqrt(r2));
    ax[i]+=dx*f*b.mass; ay[i]+=dy*f*b.mass;
    ax[j]-=dx*f*a.mass; ay[j]-=dy*f*a.mass;
  }
  // Civilian deflectors only affect rubble, never moons or life-bearing comets.
  // Keeping this force here makes live physics and prediction identical.
  for(let i=0;i<bodies.length;i++)if(bodies[i].stage>=5){
    const world=bodies[i];
    for(let j=0;j<bodies.length;j++){const p=bodies[j];if(!['asteroid','debris'].includes(p.type)||p.mass>1.1)continue;
      const dx=p.x-world.x,dy=p.y-world.y,d=Math.hypot(dx,dy);
      if(d<45&&d>world.r+p.r){const force=10*p.mass;ax[j]+=dx/d*10;ay[j]+=dy/d*10;ax[i]-=dx/d*force/world.mass;ay[i]-=dy/d*force/world.mass;}
    }
  }
  return {ax,ay};
}
// Kick-drift-kick leapfrog. Fixed steps preserve long-term orbital stability.
export function integrate(bodies,dt) {
  let {ax,ay}=accelerations(bodies);
  for(let i=0;i<bodies.length;i++) { const b=bodies[i]; b.vx+=ax[i]*dt*.5; b.vy+=ay[i]*dt*.5; b.x+=b.vx*dt; b.y+=b.vy*dt; }
  ({ax,ay}=accelerations(bodies));
  for(let i=0;i<bodies.length;i++) { bodies[i].vx+=ax[i]*dt*.5; bodies[i].vy+=ay[i]*dt*.5; }
}
export function dominant(b,bodies) {
  let host=null,force=0;
  for(const p of bodies) { if(p.id===b.id || p.mass < b.mass*.65) continue; const f=p.mass/((p.x-b.x)**2+(p.y-b.y)**2+25); if(f>force){force=f;host=p;} }
  return host;
}
export function orbitSpeed(mass,distance) { return Math.sqrt(G*mass/Math.max(distance,5)); }
export function binaryBodies(x,y,vx,vy) {
  const separation=110, v=Math.sqrt(G*TYPES.red.mass/(2*separation));
  return [body('red',x-separation/2,y,vx,vy-v),body('red',x+separation/2,y,vx,vy+v)];
}
export function habitable(star) {
  const heat=TYPES[star.type].heat||0;
  const scale=Math.sqrt(heat*star.mass/TYPES[star.type].mass);
  return [155*scale,290*scale];
}
export function merge(a,b) {
  const mass=a.mass+b.mass;
  let primary=a.mass>=b.mass?a:b;
  const black=[a,b].find(p=>TYPES[p.type].family==='black');
  const star=[a,b].filter(p=>TYPES[p.type].family==='star').sort((p,q)=>q.mass-p.mass)[0];
  const gas=[a,b].find(p=>TYPES[p.type].family==='gas');
  if(black)primary=black; else if(star)primary=star; else if(gas)primary=gas;
  let type=primary.type;
  if(TYPES[type].family==='star'&&mass>=145)type='giant';
  if(type==='rocky'&&mass>=7)type='superEarth';
  const small=primary===a?b:a, gentle=['asteroid','debris'].includes(small.type)&&small.mass/primary.mass<.1&&Math.hypot(a.vx-b.vx,a.vy-b.vy)<45;
  return body(type,(a.x*a.mass+b.x*b.mass)/mass,(a.y*a.mass+b.y*b.mass)/mass,(a.vx*a.mass+b.vx*b.mass)/mass,(a.vy*a.mass+b.vy*b.mass)/mass,{id:primary.id,label:primary.label,mass,r:radiusFor(type,mass),seed:primary.seed,life:gentle?primary.life:0,stage:gentle?primary.stage:0,peakStage:gentle?primary.peakStage:0,age:primary.type===type?primary.age:0,cooldown:1});
}
export function collide(bodies, emit=()=>{}, random=Math.random) {
  for(let i=0;i<bodies.length;i++) for(let j=i+1;j<bodies.length;j++) {
    const a=bodies[i], b=bodies[j];
    if(a.cooldown>0||b.cooldown>0||Math.hypot(a.x-b.x,a.y-b.y)>a.r+b.r)continue;
    const merged=merge(a,b), speed=Math.hypot(a.vx-b.vx,a.vy-b.vy);
    const famA=TYPES[a.type].family,famB=TYPES[b.type].family;
    const absorbing=[famA,famB].some(f=>['black','star','gas','compact'].includes(f));
    const impact=speed>32 && !absorbing && Math.min(a.mass,b.mass)>1.5 && bodies.length<MAX_BODIES-4;
    const lostLife=Math.max(a.stage,b.stage)>=3&&merged.stage<3;
    bodies.splice(j,1); bodies.splice(i,1);
    if(impact) {
      // Three physical fragments conserve mass and linear momentum; sparks are decorative.
      const count=3, theta=random()*Math.PI*2, spread=Math.min(50,speed*.32), fragmentMass=merged.mass/count;
      for(let k=0;k<count;k++) {
        const angle=theta+k*Math.PI*2/count, radius=radiusFor('debris',fragmentMass);
        bodies.push(body('debris',merged.x+Math.cos(angle)*(radius*3+4),merged.y+Math.sin(angle)*(radius*3+4),merged.vx+Math.cos(angle)*spread,merged.vy+Math.sin(angle)*spread,{mass:fragmentMass,r:radius,cooldown:1.5}));
      }
    } else bodies.push(merged);
    emit({kind:impact?'fragment':famA==='black'||famB==='black'?'accretion':famA==='star'&&famB==='star'?'stellar':absorbing?'impact':'merge',x:merged.x,y:merged.y,mass:merged.mass,lostLife,lostName:a.stage>=3?a.label:b.label,body:merged,speed});
    return true; // Rebuild the pair list after mutation.
  }
  return false;
}
export function supernova(star,bodies,emit=()=>{}) {
  const original=star.mass, remnant=original>=240?'black':'neutron';
  star.type=remnant; star.mass=original*.62; star.r=radiusFor(remnant,star.mass); star.age=0;
  const ejectMass=original-star.mass;
  for(const p of bodies) { if(p.id===star.id)continue; const dx=p.x-star.x,dy=p.y-star.y,d=Math.hypot(dx,dy); if(d>0&&d<700){const kick=25*(1-d/700);p.vx+=dx/d*kick;p.vy+=dy/d*kick;if(d<320){p.life=0;p.stage=0;}} }
  // Opposite ejecta pairs preserve the progenitor's mass and momentum.
  for(let k=0;k<4;k++){const a=k*Math.PI/2; bodies.push(body('debris',star.x+Math.cos(a)*45,star.y+Math.sin(a)*45,star.vx+Math.cos(a)*48,star.vy+Math.sin(a)*48,{mass:ejectMass/4,r:radiusFor('debris',ejectMass/4),cooldown:2}));}
  emit({kind:'supernova',x:star.x,y:star.y,mass:original,body:star});
}
export { predict } from './prediction.js';

