export const ARRIVAL_INTERVAL=14;
export const AIM_TIME_SCALE=.12;
export const COMMON=['small','rocky','rocky','ocean','earth','earth','superEarth','moon'];
export const GIANTS=['uranus','neptune','gas','jupiter'];
export const SMALL=['comet','comet','asteroid'];
export const isSpecial=type=>['red','sun','white','giant','neutron','pulsar','binary','black','massive','supermassive'].includes(type);
export function pacingState(){return {count:0,lastSpecial:-Infinity,lastStar:-Infinity,lastCompact:-Infinity,lastBlack:-Infinity,quietUntil:0};}
export function nextPiece(state,elapsed,random=Math.random){
  const lesson=['moon','small','comet','uranus'];
  if(state.count++<lesson.length)return lesson[state.count-1];
  const roll=random(),pick=pool=>pool[Math.floor(random()*pool.length)];let type;
  const quiet=elapsed>=state.quietUntil;
  // Eligible weights compensate for cooldown rejection; blocked events become
  // common planets instead of an immediate different cosmic event.
  if(roll<.025){
    if(quiet&&elapsed>=420&&elapsed-state.lastBlack>=240){type=elapsed>=1500&&random()<.08?'supermassive':elapsed>=900&&random()<.2?'massive':'black';state.lastBlack=elapsed;state.quietUntil=elapsed+70;}
  }else if(roll<.09){
    if(quiet&&elapsed>=240&&elapsed-state.lastCompact>=100){type=pick(['pulsar','neutron','binary']);state.lastCompact=elapsed;state.quietUntil=elapsed+35;}
  }else if(roll<.23){
    if(quiet&&elapsed>=120&&elapsed-state.lastStar>=45){type=pick(elapsed>=420?['red','sun','white','giant']:['red','sun','white']);state.lastStar=elapsed;state.quietUntil=elapsed+20;}
  }else if(roll<.38)type=pick(GIANTS);
  else if(roll<.51)type=pick(SMALL);
  if(type&&isSpecial(type))state.lastSpecial=elapsed;
  return type||pick(COMMON);
}
export function arrivalSpeed(length){return length===0?7:length===1?3.5:1;}
