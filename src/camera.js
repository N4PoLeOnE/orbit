export function mainCluster(bodies){
  if(!bodies.length)return [];
  const anchor=bodies.reduce((a,b)=>b.mass>a.mass?b:a);
  return bodies.filter(b=>Math.hypot(b.x-anchor.x,b.y-anchor.y)<Math.max(1300,anchor.r*15));
}
export function systemFocus(bodies){
  const cluster=mainCluster(bodies);if(!cluster.length)return {x:0,y:0};
  const top=cluster.reduce((a,b)=>b.mass>a.mass?b:a),major=cluster.filter(b=>b.mass>=top.mass*.3),sum=major.reduce((s,b)=>s+b.mass,0);
  return {x:major.reduce((s,b)=>s+b.x*b.mass,0)/sum,y:major.reduce((s,b)=>s+b.y*b.mass,0)/sum};
}
export function recenter(camera,bodies,width,height){
  const cluster=mainCluster(bodies),focus=systemFocus(bodies);
  const extent=cluster.reduce((m,b)=>Math.max(m,Math.hypot(b.x-focus.x,b.y-focus.y)+b.r),270);
  camera.zoom=camera.targetZoom=Math.max(.12,Math.min(1.2,(width-270)/(extent*2.3),(height-200)/(extent*2.3)));
  camera.offsetX=(width<720?77:110)/camera.zoom;camera.offsetY=0;
  camera.x=focus.x+camera.offsetX;camera.y=focus.y;camera.follow=true;camera.mode='system';camera.followId=null;
}
export function followSelected(camera,selected,width){
  if(!selected)return false;
  camera.follow=true;camera.mode='selected';camera.followId=selected.id;camera.offsetX=(width<720?77:110)/camera.zoom;camera.offsetY=0;
  camera.x=selected.x+camera.offsetX;camera.y=selected.y;return true;
}
export function tickCamera(camera,bodies,dt){
  if(!camera.follow)return;
  let focus=camera.mode==='selected'?bodies.find(b=>b.id===camera.followId):null;
  if(!focus){if(camera.mode==='selected'){camera.mode='system';camera.followId=null;}focus=systemFocus(bodies);}
  const t=1-Math.exp(-dt*(camera.mode==='selected'?7:1.7));camera.x+=(focus.x+camera.offsetX-camera.x)*t;camera.y+=(focus.y+camera.offsetY-camera.y)*t;
}
