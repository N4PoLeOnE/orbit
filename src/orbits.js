import { G, SOFTENING, TYPES, dominant } from './physics.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const DRAG_SCALE=3.1;
export function circularSpeed(host,probe,d){
  return Math.sqrt(G*(host.mass+probe.mass)*d*d/Math.pow(d*d+SOFTENING**2,1.5));
}
export function satelliteZone(planet,bodies){
  if(!['planet','gas'].includes(TYPES[planet.type].family))return null;
  const star=dominant(planet,bodies.filter(b=>b.mass>planet.mass*3));
  const inner=(planet.r+TYPES.moon.radius)*1.3;
  // Use the parent's periapsis, not its current distance: an eccentric planet
  // must retain its satellite when it next approaches the star.
  const orbit=star?orbitalElements(planet,star):null;
  const distance=star?Math.hypot(planet.x-star.x,planet.y-star.y):0;
  const safeDistance=orbit?.bound?Math.min(distance,orbit.peri):distance;
  const hill=star?safeDistance*Math.cbrt(planet.mass/(3*star.mass)):220;
  const outer=Math.min(120,hill*.4);
  return outer>inner*1.15?{inner,outer,planet}:null;
}
export function satelliteHost(probe,bodies){
  if(probe.type!=='moon')return null;
  let best=null,nearest=Infinity;
  for(const p of bodies){const z=satelliteZone(p,bodies);if(!z)continue;const d=Math.hypot(p.x-probe.x,p.y-probe.y);if(d>=z.inner&&d<=z.outer&&d<nearest){best=p;nearest=d;}}
  return best;
}
export function refreshHost(host,bodies){
  if(!host?.members)return host;
  const members=host.members.map(id=>bodies.find(b=>b.id===id)).filter(Boolean),mass=members.reduce((s,b)=>s+b.mass,0);
  for(const key of ['x','y','vx','vy'])host[key]=members.reduce((s,b)=>s+b[key]*b.mass,0)/mass;
  return host;
}
export function orbitHost(probe,bodies){
  const retained=bodies.find(b=>b.id===probe.satelliteOf);
  if(retained&&Math.hypot(probe.x-retained.x,probe.y-retained.y)<Math.max(180,(satelliteZone(retained,bodies)?.outer||50)*2))return retained;
  const local=satelliteHost(probe,bodies);if(local)return local;
  const main=dominant(probe,bodies);if(!main||main.mass<40)return main;
  const d=Math.hypot(probe.x-main.x,probe.y-main.y);
  const companion=bodies.filter(b=>b.id!==main.id&&b.id!==probe.id&&b.mass>=main.mass*.3&&b.mass>=40).find(b=>{
    const sep=Math.hypot(b.x-main.x,b.y-main.y);
    return sep<d*.34&&((b.vx-main.vx)**2+(b.vy-main.vy)**2)/2<G*(b.mass+main.mass)/Math.max(1,sep);
  });
  if(!companion)return main;
  const members=[main,companion].sort((a,b)=>a.id-b.id),mass=main.mass+companion.mass;
  return refreshHost({id:`pair-${members.map(b=>b.id).join('-')}`,members:members.map(b=>b.id),mass,type:'binary',r:Math.hypot(main.x-companion.x,main.y-companion.y)*.5+Math.max(main.r,companion.r),label:members.map(b=>b.label||TYPES[b.type].name).join(' + ')},bodies);
}
export function gravityAt(point,bodies,exclude=null){
  let ax=0,ay=0;const influences=[];
  for(const b of bodies){if(b.id===exclude)continue;const dx=b.x-point.x,dy=b.y-point.y,r2=dx*dx+dy*dy+SOFTENING**2,f=G*b.mass/r2,d=Math.sqrt(r2);ax+=dx/d*f;ay+=dy/d*f;influences.push({body:b,strength:f});}
  influences.sort((a,b)=>b.strength-a.strength);
  const first=influences[0],second=influences[1];
  return {ax,ay,strength:Math.hypot(ax,ay),dominant:first?.body,contested:!!(second&&second.strength>first.strength*.55),influences};
}
// The input stays a vector. Outside the broad intent cone it is untouched.
// Local frames add the host's motion, never pin or guide an in-flight body.
export function assistLaunch(probe,bodies,rawX,rawY,lockedHost=null){
  const host=lockedHost||orbitHost(probe,bodies),planetary=['planet','gas'].includes(TYPES[probe.type].family)||probe.type==='moon';
  if(!host)return {vx:rawX,vy:rawY,localX:rawX,localY:rawY,host:null,assisted:false};
  const localFrame=planetary,dx=probe.x-host.x,dy=probe.y-host.y,d=Math.hypot(dx,dy)||1;
  let vx=rawX,vy=rawY;
  const ideal=circularSpeed(host,probe,d),tx=-dy/d,ty=dx/d;
  const speed=Math.hypot(vx,vy),sign=vx*tx+vy*ty<0?-1:1;
  const alignment=speed?Math.abs((vx*tx+vy*ty)/speed):0,ratio=speed/ideal;
  let assisted=false;
  if(planetary&&d>host.r+probe.r+4&&alignment>Math.cos(.62)&&ratio>.55&&ratio<1.48){
    const fade=Math.min(1,(alignment-Math.cos(.62))/.08,(ratio-.55)/.14,(1.48-ratio)/.14);
    const strength=clamp(fade,0,1)*(probe.type==='moon'?.94:.84);
    vx+=(tx*sign*ideal-vx)*strength;vy+=(ty*sign*ideal-vy)*strength;assisted=strength>.1;
  }
  return {vx:vx+(localFrame?host.vx:0),vy:vy+(localFrame?host.vy:0),localX:vx,localY:vy,host,ideal,assisted,localFrame};
}
export function orbitalElements(probe,host){
  if(!host)return null;
  const x=probe.x-host.x,y=probe.y-host.y,r=Math.hypot(x,y),vx=probe.vx-host.vx,vy=probe.vy-host.vy,mu=G*(host.mass+probe.mass);
  if(r<.001)return null;
  const energy=(vx*vx+vy*vy)/2-mu/r,h=x*vy-y*vx,e=Math.sqrt(Math.max(0,1+2*energy*h*h/(mu*mu)));
  const a=energy<0?-mu/(2*energy):Infinity,peri=h*h/(mu*(1+e)),apo=energy<0?a*(1+e):Infinity;
  const ex=vy*h/mu-x/r,ey=-vx*h/mu-y/r,orientation=e>.0001?Math.atan2(ey,ex):Math.atan2(y,x);
  return {energy,e,peri,apo,a,orientation,h,mu,r,speed:Math.hypot(vx,vy),escape:Math.sqrt(2*mu/r),period:energy<0?2*Math.PI*Math.sqrt(a**3/mu):Infinity,bound:energy<0};
}
export function orbitGuide(probe,host,elements=orbitalElements(probe,host)){
  if(!host||!elements?.bound||elements.e>=.985||elements.apo>12000)return null;
  const points=[],theta0=Math.atan2(probe.y-host.y,probe.x-host.x)-elements.orientation,sign=elements.h<0?-1:1;
  for(let i=0;i<=240;i++){const theta=theta0+sign*i*Math.PI*2/240,r=elements.a*(1-elements.e**2)/(1+elements.e*Math.cos(theta)),a=theta+elements.orientation;points.push({x:host.x+Math.cos(a)*r,y:host.y+Math.sin(a)*r});}
  return {points,peri:{x:host.x+Math.cos(elements.orientation)*elements.peri,y:host.y+Math.sin(elements.orientation)*elements.peri},apo:{x:host.x-Math.cos(elements.orientation)*elements.apo,y:host.y-Math.sin(elements.orientation)*elements.apo}};
}
