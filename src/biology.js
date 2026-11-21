import { TYPES,habitable } from './physics.js';
export function lifeFlux(world,bodies){
  let flux=0;
  for(const b of bodies){const [inner,outer]=habitable(b);if(!outer)continue;const d=Math.hypot(world.x-b.x,world.y-b.y);flux+=((inner+outer)/2/Math.max(1,d))**2;}
  return flux;
}
export function deliverLife(comet,bodies,emit=()=>{}){
  if(comet.type!=='comet')return;
  comet.seededWorlds??=[];
  for(const p of bodies){
    if(TYPES[p.type].family!=='planet'||p.stage>=4||comet.seededWorlds.includes(p.id))continue;
    const d=Math.hypot(comet.x-p.x,comet.y-p.y),flux=lifeFlux(p,bodies);
    if(d<=p.r+comet.r||d>p.r+38||flux<.57||flux>2.05)continue;
    comet.seededWorlds.push(p.id);const barren=p.life<12;p.life=Math.min(100,p.life+(barren?28:20));p.seeded=true;
    emit({world:p,comet,title:barren?'ACQUA CONSEGNATA · SEMI DELLA VITA':'PANSPERMIA',amount:barren?28:20});
  }
}
