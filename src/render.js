import { systemFocus } from './camera.js';
import { TYPES, LIMIT, habitable, dominant } from './physics.js';
import { satelliteZone, gravityAt, DRAG_SCALE } from './orbits.js';
import { planetTexture, starTexture, nebula, vignette, SURFACES, rgb, rgba, mix, clamp } from './textures.js';
const TAU=Math.PI*2;
const TRAIL={planet:200,gas:240,rock:110,ice:260,star:90,compact:90,black:60,binary:90};
const LIGHT_FAMILIES=['star','compact'];
export class Renderer {
  constructor(canvas) {
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.w=innerWidth;this.h=innerHeight;this.dpr=Math.min(devicePixelRatio,2);
    // Three parallax layers: dust, ordinary stars, a few bright glinting ones.
    const tint=()=>{const r=Math.random();return r<.18?'#b9d4ff':r<.3?'#ffe2bd':r<.34?'#ffc2b0':'#e4e9f4';};
    this.layers=[
      {f:.008,stars:Array.from({length:420},()=>({x:Math.random(),y:Math.random(),r:.25+Math.random()*.45,a:.12+Math.random()*.35,c:tint()}))},
      {f:.022,stars:Array.from({length:220},()=>({x:Math.random(),y:Math.random(),r:.45+Math.random()*.7,a:.25+Math.random()*.5,c:tint()}))},
      {f:.05,stars:Array.from({length:26},()=>({x:Math.random(),y:Math.random(),r:.9+Math.random()*.9,a:.6+Math.random()*.4,c:tint(),glint:true,p:Math.random()*TAU}))},
    ];
    this.trails=new Map();this.textures=new Map();this.bg=null;this.vig=null;
    this.resize();
  }
  resize(){this.w=innerWidth;this.h=innerHeight;this.dpr=Math.min(devicePixelRatio,2);this.canvas.width=this.w*this.dpr;this.canvas.height=this.h*this.dpr;this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0);this.bg=null;this.vig=null;}
  resetTrails(){this.trails.clear();}
  screen(x,y,cam){return {x:(x-cam.x)*cam.zoom+this.w/2,y:(y-cam.y)*cam.zoom+this.h/2};}
  world(x,y,cam){return {x:(x-this.w/2)/cam.zoom+cam.x,y:(y-this.h/2)/cam.zoom+cam.y};}
  texture(key,make){let t=this.textures.get(key);if(!t){if(this.textures.size>160)this.textures.clear();t=make();this.textures.set(key,t);}return t;}

  // ---------------------------------------------------------------- frame
  draw(game,time) {
    const c=this.ctx,cam=game.camera;
    if(!this.bg){this.bg=nebula(this.w*1.3,this.h*1.3);this.vig=vignette(this.w,this.h);}
    c.setTransform(this.dpr,0,0,this.dpr,0,0);c.globalCompositeOperation='source-over';c.globalAlpha=1;
    this.background(cam,time);
    this.lights=game.bodies.filter(b=>LIGHT_FAMILIES.includes(TYPES[b.type].family));
    const selected=game.bodies.find(b=>b.id===game.selected),preview=game.aim;
    this.spacetime(game,cam,preview?.14:selected?.09:.06);
    this.updateTrails(game,cam.zoom);
    c.save();
    if(game.shake>0)c.translate(Math.sin(time*91)*game.shake,Math.cos(time*73)*game.shake*.7);
    c.translate(this.w/2,this.h/2);c.scale(cam.zoom,cam.zoom);c.translate(-cam.x,-cam.y);
    const focus=systemFocus(game.bodies);
    c.strokeStyle='#7d94ad30';c.lineWidth=1.2/cam.zoom;c.setLineDash([4/cam.zoom,14/cam.zoom]);c.lineDashOffset=-time*6/cam.zoom;c.beginPath();c.arc(focus.x,focus.y,LIMIT,0,TAU);c.stroke();c.setLineDash([]);
    if(preview||selected)this.zones(game,preview,selected,cam.zoom,time);
    this.drawTrails(cam.zoom);
    if(game.forecast&&(preview||selected))this.trajectory(game.forecast,preview?.probe||selected,cam.zoom,time);
    this.effects(game,cam.zoom);
    this.motes(game,cam.zoom,time);
    const ordered=[...game.bodies].sort((a,b)=>b.mass-a.mass);
    for(const b of ordered){const s=this.screen(b.x,b.y,cam),margin=TYPES[b.type].family==='black'?260:TYPES[b.type].family==='compact'||b.type==='comet'?300:150;if(s.x<-margin||s.x>this.w+margin||s.y<-margin||s.y>this.h+margin)continue;this.drawBody(b,time,cam.zoom);}
    if(selected)this.selection(selected,cam.zoom,time);
    if(preview)this.aim(game,preview,cam.zoom,time);
    c.restore();
    c.globalCompositeOperation='source-over';
    if(preview)this.fieldReadout(game,preview.probe);
    this.orbitIndicators(game);
    this.signals(game,time);
    for(const label of game.labels){const p=this.screen(label.x,label.y,cam),age=label.max-label.life,pop=1+Math.max(0,.35-age)*1.6;c.save();c.globalAlpha=Math.min(1,label.life);c.translate(p.x,p.y-age*22);c.scale(pop,pop);c.font='700 13px "Segoe UI", sans-serif';c.textAlign='center';c.shadowColor=label.color;c.shadowBlur=12;c.fillStyle=label.color;c.fillText(label.text,0,0);c.restore();}
    c.globalAlpha=1;
    if(game.mode==='menu'&&!game.bodies.some(b=>b.demo)){const p=this.screen(0,0,cam);c.fillStyle='#8b99a7';c.font='9px "Segoe UI", sans-serif';c.fillText('SOL / MASSA 90',p.x+40,p.y-30);}
    if(game.mode==='playing'&&!game.aim&&game.stats.placed===0){const sun=game.bodies.find(b=>b.type==='sun');if(sun){const p=this.screen(sun.x,sun.y-220,cam),pulse=.5+.5*Math.sin(time*3);c.strokeStyle=`rgba(153,218,203,${.35+pulse*.4})`;c.lineWidth=1.2;c.setLineDash([3,5]);c.beginPath();c.arc(p.x,p.y,12+pulse*4,0,TAU);c.stroke();c.setLineDash([]);c.beginPath();c.moveTo(p.x+18,p.y);c.lineTo(p.x+55+pulse*8,p.y);c.lineTo(p.x+49+pulse*8,p.y-4);c.stroke();c.font='12px "Segoe UI"';c.fillStyle='#bfe3dc';c.fillText('Prova qui. Trascina di lato →',p.x-70,p.y-26);}}
    c.drawImage(this.vig,0,0,this.w,this.h);
    if(game.collapseTime>0){const alpha=Math.min(.28,game.collapseTime*.03);const g=c.createRadialGradient(this.w/2,this.h/2,this.h*.25,this.w/2,this.h/2,this.w*.7);g.addColorStop(0,'rgba(255,70,60,0)');g.addColorStop(1,`rgba(255,70,60,${alpha*(.6+.4*Math.sin(time*6))})`);c.fillStyle=g;c.fillRect(0,0,this.w,this.h);}
    if(game.flash>0){c.globalCompositeOperation='lighter';c.fillStyle=`rgba(255,236,210,${Math.min(.55,game.flash)})`;c.fillRect(0,0,this.w,this.h);c.globalCompositeOperation='source-over';}
    if(game.ending>0){const a=game.ending;if(a<2){c.fillStyle=`rgba(0,0,0,${a*.35})`;c.fillRect(0,0,this.w,this.h);}else{c.fillStyle=`rgba(255,238,211,${Math.max(0,1-(a-2)/1.6)})`;c.fillRect(0,0,this.w,this.h);}}
  }

  // ---------------------------------------------------------------- backdrop
  background(cam,time){
    const c=this.ctx;c.fillStyle='#04070e';c.fillRect(0,0,this.w,this.h);
    const ox=-this.w*.15+Math.tanh(cam.x*.0004)*-this.w*.13,oy=-this.h*.15+Math.tanh(cam.y*.0004)*-this.h*.13;
    c.imageSmoothingEnabled=true;c.drawImage(this.bg,ox,oy,this.w*1.3,this.h*1.3);
    for(const layer of this.layers){
      for(const s of layer.stars){
        const x=((s.x*this.w-cam.x*layer.f*cam.zoom*3)%this.w+this.w)%this.w,y=((s.y*this.h-cam.y*layer.f*cam.zoom*3)%this.h+this.h)%this.h;
        const tw=s.glint?.65+.35*Math.sin(time*1.7+s.p):.85+.15*Math.sin(time*.4+s.x*40);
        c.globalAlpha=s.a*tw;c.fillStyle=s.c;c.beginPath();c.arc(x,y,s.r,0,TAU);c.fill();
        if(s.glint){c.globalAlpha=s.a*tw*.35;c.fillRect(x-s.r*5,y-.35,s.r*10,.7);c.fillRect(x-.35,y-s.r*5,.7,s.r*10);const g=c.createRadialGradient(x,y,0,x,y,s.r*5);g.addColorStop(0,s.c);g.addColorStop(1,'rgba(0,0,0,0)');c.globalAlpha=s.a*tw*.25;c.fillStyle=g;c.beginPath();c.arc(x,y,s.r*5,0,TAU);c.fill();}
      }
    }
    c.globalAlpha=1;
  }
  // A world-anchored grid bent towards every significant mass: gravity wells at a glance.
  spacetime(game,cam,alpha){
    const masses=game.bodies.filter(b=>b.mass>=2).sort((a,b)=>b.mass-a.mass).slice(0,16);if(!masses.length)return;
    const c=this.ctx,sp=48,step=sp/cam.zoom,left=cam.x-this.w/2/cam.zoom,top=cam.y-this.h/2/cam.zoom;
    const x0=Math.floor(left/step)*step,y0=Math.floor(top/step)*step,cols=Math.ceil(this.w/sp)+2,rows=Math.ceil(this.h/sp)+2;
    const pts=new Array(cols*rows),depth=new Float32Array(cols*rows);
    for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
      const wx=x0+i*step,wy=y0+j*step;let dx=0,dy=0,deep=0;
      for(const m of masses){const ex=m.x-wx,ey=m.y-wy,d=Math.hypot(ex,ey)+.001,well=Math.min(d*.82,46*m.mass/(d+40+m.r*2));dx+=ex/d*well;dy+=ey/d*well;deep+=well;}
      pts[j*cols+i]=this.screen(wx+dx,wy+dy,cam);depth[j*cols+i]=deep*cam.zoom;
    }
    c.lineWidth=1;c.strokeStyle=`rgba(120,175,214,${alpha})`;c.beginPath();
    for(let j=0;j<rows;j++){for(let i=0;i<cols;i++){const p=pts[j*cols+i];i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y);}}
    for(let i=0;i<cols;i++){for(let j=0;j<rows;j++){const p=pts[j*cols+i];j?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y);}}
    c.stroke();
    c.globalCompositeOperation='lighter';c.fillStyle='#8cc6ea';
    for(let k=0;k<pts.length;k++){const a=Math.min(.5,depth[k]/90)*alpha*5;if(a<.02)continue;c.globalAlpha=a;c.fillRect(pts[k].x-.8,pts[k].y-.8,1.6,1.6);}
    c.globalAlpha=1;c.globalCompositeOperation='source-over';
  }

  // ---------------------------------------------------------------- trails
  updateTrails(game,zoom){
    const alive=new Set();
    for(const b of game.bodies){
      alive.add(b.id);const fam=TYPES[b.type].family;let t=this.trails.get(b.id);
      if(!t||t.type!==b.type){t={type:b.type,pts:[]};this.trails.set(b.id,t);}
      const last=t.pts.at(-1),d=last?Math.hypot(b.x-last.x,b.y-last.y):Infinity;
      if(d>500)t.pts.length=0;
      if(!last||d>Math.max(1.5,2.6/zoom))t.pts.push({x:b.x,y:b.y});
      const max=b.micro?40:TRAIL[fam]||120;if(t.pts.length>max)t.pts.splice(0,t.pts.length-max);
      t.color=b.stage>=3?'#9fe8c6':b.type==='comet'?'#b9f0ff':b.hazard?'#ff9b7a':TYPES[b.type].color;t.r=b.r;t.head=b;
    }
    for(const id of this.trails.keys())if(!alive.has(id))this.trails.delete(id);
  }
  drawTrails(zoom){
    const c=this.ctx,glow=this.trails.size<=30;c.globalCompositeOperation='lighter';c.lineCap='round';c.lineJoin='round';
    for(const t of this.trails.values()){
      const pts=t.pts;if(pts.length<3)continue;
      const chunks=10,size=Math.ceil(pts.length/chunks),width=clamp(t.r*.32,1.1/zoom,3.2/zoom);
      for(let k=0;k<chunks;k++){
        const from=k*size,to=Math.min(pts.length-1,(k+1)*size);if(to<=from)continue;const a=(k+1)/chunks;
        c.strokeStyle=t.color;c.beginPath();c.moveTo(pts[from].x,pts[from].y);for(let i=from+1;i<=to;i++)c.lineTo(pts[i].x,pts[i].y);if(k===chunks-1)c.lineTo(t.head.x,t.head.y);
        if(glow){c.globalAlpha=a*a*.12;c.lineWidth=width*4;c.stroke();}
        c.globalAlpha=a*a*.6;c.lineWidth=width;c.stroke();
      }
    }
    c.globalAlpha=1;c.globalCompositeOperation='source-over';
  }

  // ---------------------------------------------------------------- overlays in world space
  zones(game,preview,selected,zoom,time){
    const c=this.ctx;
    if(game.queue[0]==='moon'||preview?.type==='moon')for(const planet of game.bodies){
      const zone=satelliteZone(planet,game.bodies);if(!zone)continue;
      const near=preview?.satelliteId===planet.id||game.hover&&Math.hypot(game.hover.x-planet.x,game.hover.y-planet.y)<zone.outer+65;
      if(!near&&planet.id!==selected?.id)continue;
      c.strokeStyle=preview?.satelliteId===planet.id?'#a1e5d347':'#a1e5d324';c.lineWidth=zone.outer-zone.inner;c.beginPath();c.arc(planet.x,planet.y,(zone.inner+zone.outer)/2,0,TAU);c.stroke();
      c.fillStyle='#a8d9ca';c.font=`${9/zoom}px "Segoe UI"`;c.fillText('ZONA SATELLITE',planet.x+zone.outer+6/zoom,planet.y-9/zoom);
    }
    const subject=preview?.probe||selected;
    for(const star of game.bodies){const [inner,outer]=habitable(star);if(!outer)continue;
      if(Math.hypot(subject.x-star.x,subject.y-star.y)>outer*2&&star.id!==selected?.id)continue;
      const g=c.createRadialGradient(star.x,star.y,inner,star.x,star.y,outer);g.addColorStop(0,'rgba(138,218,172,0)');g.addColorStop(.5,'rgba(138,218,172,.07)');g.addColorStop(1,'rgba(138,218,172,0)');
      c.fillStyle=g;c.beginPath();c.arc(star.x,star.y,outer,0,TAU);c.arc(star.x,star.y,inner,0,TAU,true);c.fill();
      c.lineWidth=1/zoom;c.strokeStyle='#8adaac2c';c.setLineDash([2/zoom,6/zoom]);for(const r of [inner,outer]){c.beginPath();c.arc(star.x,star.y,r,0,TAU);c.stroke();}c.setLineDash([]);
      c.fillStyle='#8adaac88';c.font=`${9/zoom}px "Segoe UI"`;c.fillText('ZONA ABITABILE',star.x+(inner+outer)/2*Math.cos(-.9)-30/zoom,star.y+(inner+outer)/2*Math.sin(-.9));
    }
    const ids=game.forecast?.hostMembers||[game.forecast?.hostId||dominant(subject,game.bodies)?.id];
    for(const influence of game.bodies.filter(b=>ids.includes(b.id))){c.strokeStyle='#ffc887bb';c.lineWidth=1.5/zoom;c.setLineDash([5/zoom,4/zoom]);c.lineDashOffset=time*8/zoom;c.beginPath();c.arc(influence.x,influence.y,influence.r+11/zoom,0,TAU);c.stroke();c.setLineDash([]);c.fillStyle='#ffd09d';c.font=`${10/zoom}px "Segoe UI"`;c.fillText(`DOMINANTE · ${influence.label||TYPES[influence.type].name}`,influence.x+influence.r+16/zoom,influence.y-10/zoom);}
  }
  effects(game,zoom){
    const c=this.ctx;c.globalCompositeOperation='lighter';
    for(const f of game.flashes||[]){const a=Math.max(0,f.life/f.max),r=f.r*(1.6-a*.6);const g=c.createRadialGradient(f.x,f.y,0,f.x,f.y,r);g.addColorStop(0,`rgba(255,255,255,${a})`);g.addColorStop(.25,rgba(rgb(f.color),a*.7));g.addColorStop(1,rgba(rgb(f.color),0));c.fillStyle=g;c.beginPath();c.arc(f.x,f.y,r,0,TAU);c.fill();}
    for(const wave of game.waves){const a=Math.max(0,wave.life/wave.max);c.strokeStyle=wave.color;c.globalAlpha=a*.25;c.lineWidth=(6+wave.life*6)/zoom;c.beginPath();c.arc(wave.x,wave.y,wave.radius,0,TAU);c.stroke();c.globalAlpha=a*.8;c.lineWidth=(1+wave.life*1.4)/zoom;c.stroke();}
    c.lineCap='round';
    for(const p of game.particles){const a=Math.max(0,p.life/p.max);c.globalAlpha=a;c.strokeStyle=a>.75?'#fff4e6':p.color;c.lineWidth=p.r;c.beginPath();c.moveTo(p.x-p.vx*.05,p.y-p.vy*.05);c.lineTo(p.x,p.y);c.stroke();}
    c.globalAlpha=1;c.globalCompositeOperation='source-over';
  }
  motes(game,zoom,time){
    const c=this.ctx;if(!game.motes?.length)return;
    for(const m of game.motes){
      const appear=Math.min(1,(m.max-m.life)/.8),blink=m.life<6?.55+.45*Math.sin(time*14):1,a=appear*blink,r=m.r,spin=time*.8+m.seed;
      c.save();c.translate(m.x,m.y);c.globalCompositeOperation='lighter';
      const g=c.createRadialGradient(0,0,0,0,0,r*2.4);g.addColorStop(0,`rgba(255,236,170,${.55*a})`);g.addColorStop(.35,`rgba(255,196,110,${.18*a})`);g.addColorStop(1,'rgba(255,180,90,0)');c.fillStyle=g;c.beginPath();c.arc(0,0,r*2.4,0,TAU);c.fill();
      c.rotate(spin);c.fillStyle=`rgba(255,246,214,${.9*a})`;const k=1+.15*Math.sin(time*5+m.seed);
      c.beginPath();for(let i=0;i<8;i++){const rr=i%2?r*.18:r*.75*k,ang=i*Math.PI/4;i?c.lineTo(Math.cos(ang)*rr,Math.sin(ang)*rr):c.moveTo(Math.cos(ang)*rr,Math.sin(ang)*rr);}c.closePath();c.fill();
      c.rotate(-spin*2.3);c.fillStyle=`rgba(255,226,160,${.8*a})`;for(let i=0;i<3;i++){const ang=i*TAU/3;c.beginPath();c.arc(Math.cos(ang)*r*1.15,Math.sin(ang)*r*1.15,Math.max(.8/zoom,r*.08),0,TAU);c.fill();}
      c.globalCompositeOperation='source-over';c.rotate(spin*1.3);
      c.strokeStyle=`rgba(255,214,140,${.35*a})`;c.lineWidth=1.2/zoom;c.beginPath();c.arc(0,0,r*1.45,-Math.PI/2,-Math.PI/2+TAU*m.life/m.max);c.stroke();
      c.restore();
    }
  }
  selection(b,zoom,time){
    const c=this.ctx,r=b.r+(9+Math.sin(time*3)*1.5)/zoom;c.strokeStyle='#b9e7d9';c.lineWidth=1.3/zoom;
    for(let i=0;i<4;i++){const a=i*TAU/4+time*.6;c.beginPath();c.arc(b.x,b.y,r,a,a+.45);c.stroke();}
    c.font=`600 ${9/zoom}px "Segoe UI", sans-serif`;c.fillStyle='#cfe3e6';c.fillText((b.label||TYPES[b.type].name).toUpperCase(),b.x+r+6/zoom,b.y+3/zoom);
  }
  aim(game,preview,zoom,time){
    const c=this.ctx,b=preview.probe,local=preview.solution,vx=local?.localX??b.vx,vy=local?.localY??b.vy,scale=preview.dragScale||DRAG_SCALE;
    const ex=b.x+vx*scale,ey=b.y+vy*scale,angle=Math.atan2(vy,vx),color=game.forecast?.dirty?'#abb4c0':['#9edbc3','#ffce8e','#ff7e85'][game.forecast?.risk??1];
    const host=local?.host;
    if(host&&['planet','gas','rock'].includes(TYPES[b.type].family)){const a=Math.atan2(b.y-host.y,b.x-host.x)+Math.PI/2,v=local.ideal;for(const sign of [1,-1]){const tangent=a+(sign<0?Math.PI:0),reach=v*scale;c.strokeStyle='#98dbef1c';c.lineWidth=reach*.45;c.beginPath();c.arc(b.x,b.y,reach,tangent-.4,tangent+.4);c.stroke();const sx=b.x+Math.cos(tangent)*reach,sy=b.y+Math.sin(tangent)*reach,pulse=1+.25*Math.sin(time*5);c.strokeStyle='#98dbefcc';c.lineWidth=1.5/zoom;c.beginPath();c.arc(sx,sy,4*pulse/zoom,0,TAU);c.stroke();}}
    c.globalAlpha=.75;this.drawBody(b,time,zoom);c.globalAlpha=1;
    c.globalCompositeOperation='lighter';
    const g=c.createLinearGradient(b.x,b.y,ex,ey);g.addColorStop(0,color+'22');g.addColorStop(1,color);
    c.strokeStyle=g;c.lineWidth=6/zoom;c.globalAlpha=.25;c.beginPath();c.moveTo(b.x,b.y);c.lineTo(ex,ey);c.stroke();
    c.globalAlpha=1;c.lineWidth=2/zoom;c.stroke();
    c.fillStyle=color;c.beginPath();c.moveTo(ex+Math.cos(angle)*3/zoom,ey+Math.sin(angle)*3/zoom);c.lineTo(ex-Math.cos(angle-.45)*12/zoom,ey-Math.sin(angle-.45)*12/zoom);c.lineTo(ex-Math.cos(angle+.45)*12/zoom,ey-Math.sin(angle+.45)*12/zoom);c.closePath();c.fill();
    c.globalCompositeOperation='source-over';
    const pulse=(time*1.4)%1;c.strokeStyle=`rgba(255,255,255,${.5*(1-pulse)})`;c.lineWidth=1/zoom;c.beginPath();c.arc(b.x,b.y,b.r+(5+pulse*16)/zoom,0,TAU);c.stroke();
  }

  // ---------------------------------------------------------------- bodies
  lightFor(b){
    let best=null,score=0;
    for(const s of this.lights){if(s.id===b.id)continue;const d2=(s.x-b.x)**2+(s.y-b.y)**2+1,k=(TYPES[s.type].heat||.35)*s.mass/d2;if(k>score){score=k;best=s;}}
    if(!best)return {x:-.55,y:-.83,k:0,star:null};
    const d=Math.hypot(best.x-b.x,best.y-b.y)||1;return {x:(best.x-b.x)/d,y:(best.y-b.y)/d,k:Math.min(1,score*400),star:best};
  }
  drawBody(b,time,zoom){
    const c=this.ctx,t=TYPES[b.type],fam=t.family;
    c.save();c.translate(b.x,b.y);
    if(fam==='black')this.blackHole(b,t,time,zoom);
    else if(fam==='star'||fam==='compact')this.star(b,t,time,zoom);
    else if(b.type==='comet')this.comet(b,time,zoom);
    else if(b.type==='asteroid'||b.type==='debris')this.rock(b,t,time,zoom);
    else this.planet(b,t,time,zoom);
    c.restore();
  }
  star(b,t,time,zoom){
    const c=this.ctx,compact=t.family==='compact',unstable=t.lifetime&&b.age>t.lifetime-35;
    const pulse=1+Math.sin(time*(unstable?9:1.3)+b.seed)*(unstable?.09:.02),r=Math.max(b.r*pulse,1.6/zoom),col=rgb(t.color);
    const ga=c.globalAlpha;c.globalCompositeOperation='lighter';
    const halo=compact?r*14:r*7,g=c.createRadialGradient(0,0,r*.5,0,0,halo);g.addColorStop(0,rgba(col,.55*ga));g.addColorStop(.12,rgba(col,.22*ga));g.addColorStop(.4,rgba(col,.06*ga));g.addColorStop(1,rgba(col,0));c.fillStyle=g;c.beginPath();c.arc(0,0,halo,0,TAU);c.fill();
    // Shimmering corona.
    const cor=r*(1.9+.12*Math.sin(time*2.1+b.seed)),g2=c.createRadialGradient(0,0,r*.9,0,0,cor);g2.addColorStop(0,rgba(mix(col,[255,255,255],.5),.7*ga));g2.addColorStop(1,rgba(col,0));c.fillStyle=g2;c.beginPath();c.arc(0,0,cor,0,TAU);c.fill();
    // Diffraction spikes.
    const spike=(compact?r*15:r*3.6)*(1+.06*Math.sin(time*3+b.seed));c.save();c.rotate(.35);
    for(let k=0;k<4;k++){c.rotate(Math.PI/2);const sg=c.createLinearGradient(0,0,spike,0);sg.addColorStop(0,rgba([255,250,240],.38*ga));sg.addColorStop(1,rgba(col,0));c.fillStyle=sg;c.beginPath();c.moveTo(0,-Math.max(.6/zoom,r*.06));c.lineTo(spike,0);c.lineTo(0,Math.max(.6/zoom,r*.06));c.fill();}
    c.restore();
    if(b.type==='pulsar'){c.save();c.rotate(b.age*.65);for(let k=0;k<2;k++){c.rotate(Math.PI);const beam=c.createLinearGradient(0,0,450,0);beam.addColorStop(0,'rgba(200,215,255,.6)');beam.addColorStop(.4,'rgba(160,180,255,.18)');beam.addColorStop(1,'rgba(150,170,255,0)');c.fillStyle=beam;c.beginPath();c.moveTo(0,-2);c.lineTo(450,-43);c.lineTo(450,43);c.lineTo(0,2);c.fill();c.fillStyle='rgba(230,240,255,.5)';c.beginPath();c.moveTo(0,-.8);c.lineTo(450,-4);c.lineTo(450,4);c.lineTo(0,.8);c.fill();}c.restore();}
    c.globalCompositeOperation='source-over';
    if(r*zoom>2.5){const tex=this.texture(`star-${b.type}-${(b.seed*10|0)%6}`,()=>starTexture(t.color,b.seed,compact));c.save();c.rotate(time*.025+b.seed);c.drawImage(tex,-r,-r,r*2,r*2);c.restore();}
    else{c.fillStyle='#fff6e8';c.beginPath();c.arc(0,0,r,0,TAU);c.fill();}
    c.globalCompositeOperation='lighter';const core=c.createRadialGradient(0,0,0,0,0,r);core.addColorStop(0,`rgba(255,255,255,${.45*ga})`);core.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=core;c.beginPath();c.arc(0,0,r,0,TAU);c.fill();c.globalCompositeOperation='source-over';
    if(unstable){const p=.5+.5*Math.sin(time*9);c.strokeStyle=`rgba(255,120,90,${.4+p*.5})`;c.lineWidth=2/zoom;c.beginPath();c.arc(0,0,r*(1.5+p*.3),0,TAU);c.stroke();c.fillStyle='#ffb890';c.font=`700 ${9/zoom}px "Segoe UI"`;c.fillText('INSTABILE',r*1.6+6/zoom,-r);}
  }
  blackHole(b,t,time,zoom){
    const c=this.ctx,growth=Math.min(1,b.age/9),disk=Math.max(b.r*3,(19+Math.sqrt(b.mass)*3.3)*growth),shadow=Math.max(b.r*1.15,disk*.24),tilt=-.3+(b.seed%1)*.2;
    const hot=[255,244,222],mid=rgb(t.color),cold=[124,74,214];
    c.globalCompositeOperation='lighter';
    const glow=c.createRadialGradient(0,0,shadow,0,0,disk*1.9);glow.addColorStop(0,rgba(mid,.28));glow.addColorStop(.4,rgba(cold,.1));glow.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=glow;c.beginPath();c.arc(0,0,disk*1.9,0,TAU);c.fill();
    const rings=16,ringDisk=(from,to)=>{for(let k=0;k<rings;k++){const f=k/(rings-1),rad=shadow*1.35+(disk-shadow*1.35)*f,col=f<.3?mix(hot,mid,f/.3):mix(mid,cold,(f-.3)/.7);c.strokeStyle=rgba(col,(1-f)*.55+.08);c.lineWidth=(disk-shadow)/rings*1.25;c.setLineDash([rad*1.3,rad*.3]);c.lineDashOffset=-time*80/Math.sqrt(rad);c.beginPath();c.ellipse(0,0,rad,rad*.26,tilt,from,to);c.stroke();}c.setLineDash([]);};
    ringDisk(Math.PI,TAU);
    // Lensed image of the far side of the disk, wrapped around the shadow.
    const lens=c.createRadialGradient(0,0,shadow,0,0,shadow*1.7);lens.addColorStop(0,rgba(hot,.85));lens.addColorStop(.25,rgba(mid,.45));lens.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=lens;c.beginPath();c.arc(0,0,shadow*1.7,0,TAU);c.fill();
    c.globalCompositeOperation='source-over';c.fillStyle='#000';c.beginPath();c.arc(0,0,shadow,0,TAU);c.fill();
    c.strokeStyle=rgba(hot,.9);c.lineWidth=Math.max(.8/zoom,shadow*.07);c.beginPath();c.arc(0,0,shadow*1.04,0,TAU);c.stroke();
    c.globalCompositeOperation='lighter';ringDisk(0,Math.PI);c.globalCompositeOperation='source-over';
  }
  rock(b,t,time,zoom){
    const c=this.ctx,r=Math.max(b.r,1.3/zoom),L=this.lightFor(b),n=9;let s=(b.seed*9301|0)>>>0;const rnd=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};
    if(b.hazard){const p=.5+.5*Math.sin(time*6);c.globalCompositeOperation='lighter';const g=c.createRadialGradient(0,0,r,0,0,r*5);g.addColorStop(0,`rgba(255,120,80,${.35+p*.2})`);g.addColorStop(1,'rgba(255,120,80,0)');c.fillStyle=g;c.beginPath();c.arc(0,0,r*5,0,TAU);c.fill();c.globalCompositeOperation='source-over';}
    const hot=b.type==='debris'&&b.age<3;
    if(hot){c.globalCompositeOperation='lighter';const g=c.createRadialGradient(0,0,0,0,0,r*4);g.addColorStop(0,`rgba(255,170,90,${.6*(1-b.age/3)})`);g.addColorStop(1,'rgba(255,120,60,0)');c.fillStyle=g;c.beginPath();c.arc(0,0,r*4,0,TAU);c.fill();c.globalCompositeOperation='source-over';}
    const spin=time*(.3+rnd()*.6)*(rnd()<.5?-1:1);c.save();c.rotate(spin);c.beginPath();for(let k=0;k<n;k++){const a=k/n*TAU,rr=r*(.72+rnd()*.42);k?c.lineTo(Math.cos(a)*rr,Math.sin(a)*rr):c.moveTo(Math.cos(a)*rr,Math.sin(a)*rr);}c.closePath();
    c.fillStyle=t.color;c.fill();c.clip();c.rotate(-spin);
    const g=c.createLinearGradient(L.x*r,L.y*r,-L.x*r,-L.y*r);g.addColorStop(0,'rgba(255,245,230,.35)');g.addColorStop(.5,'rgba(0,0,0,.1)');g.addColorStop(1,'rgba(0,0,0,.7)');c.fillStyle=g;c.fillRect(-r*1.5,-r*1.5,r*3,r*3);c.restore();
  }
  comet(b,time,zoom){
    const c=this.ctx,r=Math.max(b.r,1.4/zoom),L=this.lightFor(b),speed=Math.hypot(b.vx,b.vy),dist=L.star?Math.hypot(L.star.x-b.x,L.star.y-b.y):900;
    const k=clamp(520/dist,.45,2.1),len=(30+speed*.26)*k,ax=-L.x,ay=-L.y,vx=speed?-b.vx/speed:ax,vy=speed?-b.vy/speed:ay;
    const dx=ax*.55+vx*.45,dy=ay*.55+vy*.45,dl=Math.hypot(dx,dy)||1;
    c.globalCompositeOperation='lighter';
    // Dust tail: broad, curved, warm.
    const dg=c.createLinearGradient(0,0,dx/dl*len,dy/dl*len);dg.addColorStop(0,'rgba(255,240,215,.45)');dg.addColorStop(1,'rgba(255,220,180,0)');c.fillStyle=dg;
    const nx=-dy/dl,ny=dx/dl,w=r*2.2*Math.sqrt(k);c.beginPath();c.moveTo(nx*r,ny*r);c.quadraticCurveTo(dx/dl*len*.5+nx*w*2,dy/dl*len*.5+ny*w*2,dx/dl*len+nx*w*2.5,dy/dl*len+ny*w*2.5);c.lineTo(dx/dl*len-nx*w*.6,dy/dl*len-ny*w*.6);c.quadraticCurveTo(dx/dl*len*.5-nx*w*.3,dy/dl*len*.5-ny*w*.3,-nx*r,-ny*r);c.fill();
    // Ion tail: straight, thin, blue — always points away from the star.
    const il=len*1.35,ig=c.createLinearGradient(0,0,ax*il,ay*il);ig.addColorStop(0,'rgba(160,230,255,.7)');ig.addColorStop(1,'rgba(120,200,255,0)');c.fillStyle=ig;c.beginPath();c.moveTo(-ay*r*.7,ax*r*.7);c.lineTo(ax*il-ay*r*1.6,ay*il+ax*r*1.6);c.lineTo(ax*il+ay*r*1.6,ay*il-ax*r*1.6);c.lineTo(ay*r*.7,-ax*r*.7);c.fill();
    const coma=c.createRadialGradient(0,0,0,0,0,r*5*Math.sqrt(k));coma.addColorStop(0,'rgba(230,250,255,.9)');coma.addColorStop(.3,'rgba(170,230,245,.35)');coma.addColorStop(1,'rgba(150,220,240,0)');c.fillStyle=coma;c.beginPath();c.arc(0,0,r*5*Math.sqrt(k),0,TAU);c.fill();
    c.globalCompositeOperation='source-over';c.fillStyle='#f2fbff';c.beginPath();c.arc(0,0,r*.8,0,TAU);c.fill();
  }
  rings(b,r,front){
    const c=this.ctx,saturn=b.type==='gas',tilt=saturn?-.42:1.2,ratio=saturn?.3:.22,from=front?0:Math.PI,to=front?Math.PI:TAU;
    const bands=saturn?[[1.35,.35,'#cdb894'],[1.55,.55,'#e9d6b0'],[1.78,.45,'#d9c39c'],[1.95,.2,'#b9a17e'],[2.15,.4,'#efe0c0'],[2.3,.18,'#cdb894']]:[[1.55,.4,'#c3efe9'],[1.75,.25,'#a4dcd6']];
    for(const [k,a,col] of bands){c.strokeStyle=col;c.globalAlpha*=a;c.lineWidth=r*(saturn?.16:.05);c.beginPath();c.ellipse(0,0,r*k,r*k*ratio,tilt,from,to);c.stroke();c.globalAlpha/=a;}
  }
  planet(b,t,time,zoom){
    const c=this.ctx,r=Math.max(b.r,1.5/zoom),L=this.lightFor(b),surf=SURFACES[b.type]||{},ga=c.globalAlpha;
    if(r*zoom<2.6){const col=b.stage>=3?'#9fe8c6':t.color;c.globalCompositeOperation='lighter';const g=c.createRadialGradient(0,0,0,0,0,r*3);g.addColorStop(0,col);g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.globalAlpha=ga*.6;c.beginPath();c.arc(0,0,r*3,0,TAU);c.fill();c.globalAlpha=ga;c.globalCompositeOperation='source-over';c.fillStyle=col;c.beginPath();c.arc(0,0,r,0,TAU);c.fill();return;}
    const atmo=surf.atmo&&rgb(b.stage>=2&&b.type!=='gas'&&b.type!=='jupiter'?'#9fe8d2':surf.atmo);
    if(atmo){c.globalCompositeOperation='lighter';const g=c.createRadialGradient(L.x*r*.25,L.y*r*.25,r*.85,0,0,r*1.55);g.addColorStop(0,rgba(atmo,.38*ga));g.addColorStop(1,rgba(atmo,0));c.fillStyle=g;c.beginPath();c.arc(0,0,r*1.55,0,TAU);c.fill();c.globalCompositeOperation='source-over';}
    if(b.type==='gas'||b.type==='uranus')this.rings(b,r,false);
    const lifeBucket=SURFACES[b.type]?.life||SURFACES[b.type]?.kind==='ocean'?Math.min(2,b.stage):0;
    const tex=this.texture(`p-${b.type}-${(b.seed*1000|0)}-${lifeBucket}`,()=>planetTexture(b.type,b.seed,lifeBucket));
    c.save();c.beginPath();c.arc(0,0,r,0,TAU);c.clip();
    const spin=(['gas','jupiter','neptune','uranus'].includes(b.type)?.03:.016),off=((time*spin+b.seed)%1)*4*r;
    c.drawImage(tex,-r-off,-r,4*r,2*r);c.drawImage(tex,-r-off+4*r,-r,4*r,2*r);
    const lit=.35+.65*Math.max(L.k,.25),g=c.createLinearGradient(L.x*r,L.y*r,-L.x*r,-L.y*r);
    g.addColorStop(0,'rgba(255,248,232,.12)');g.addColorStop(.4,'rgba(2,5,12,0)');g.addColorStop(.6,`rgba(2,5,12,${.55+.25*lit})`);g.addColorStop(1,`rgba(2,5,12,${.75+.2*lit})`);c.fillStyle=g;c.fillRect(-r,-r,r*2,r*2);
    const limb=c.createRadialGradient(L.x*r*.2,L.y*r*.2,r*.45,0,0,r);limb.addColorStop(0,'rgba(0,0,0,0)');limb.addColorStop(1,'rgba(0,0,0,.45)');c.fillStyle=limb;c.fillRect(-r,-r,r*2,r*2);
    if(surf.spec){c.globalCompositeOperation='lighter';const sp=c.createRadialGradient(L.x*r*.45,L.y*r*.45,0,L.x*r*.45,L.y*r*.45,r*.4);sp.addColorStop(0,'rgba(255,255,255,.22)');sp.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=sp;c.fillRect(-r,-r,r*2,r*2);c.globalCompositeOperation='source-over';}
    if(b.stage>=4){
      // City lights only glow on the night hemisphere.
      c.globalCompositeOperation='lighter';let s=(b.seed*7919|0)>>>0;const rnd=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};
      for(let k=0;k<(b.stage>=5?42:24);k++){const px=(rnd()*2-1)*r*.9,py=(rnd()*2-1)*r*.8;if(px*px+py*py>r*r*.85)continue;const dark=clamp(-(px*L.x+py*L.y)/r*2.2,0,1);if(dark<.05)continue;c.fillStyle=`rgba(255,214,140,${dark*(.55+.45*Math.sin(time*2+k))})`;const sz=Math.max(.5/zoom,r*.05);c.fillRect(px-sz/2,py-sz/2,sz,sz);}
      c.globalCompositeOperation='source-over';
    }
    c.restore();
    if(atmo){c.strokeStyle=rgba(atmo,.55*ga);c.lineWidth=Math.max(.7/zoom,r*.07);const a=Math.atan2(L.y,L.x);c.beginPath();c.arc(0,0,r*.98,a-1.25,a+1.25);c.stroke();}
    if(b.type==='gas'||b.type==='uranus')this.rings(b,r,true);
    if(b.stage>=5){const a=time*.9+b.seed;c.fillStyle='#f4dfa6';c.shadowColor='#f4dfa6';c.shadowBlur=6;c.fillRect(Math.cos(a)*(r+7/zoom)-1.3/zoom,Math.sin(a)*(r+7/zoom)-1.3/zoom,2.6/zoom,2.6/zoom);c.shadowBlur=0;}
  }

  // ---------------------------------------------------------------- screen-space overlays
  orbitIndicators(game){
    const f=game.forecast;if(!f||game.mode!=='playing')return;
    const c=this.ctx,left=24,right=this.w-(this.w<720?175:250),top=128,bottom=this.h-120;
    const flag=(point,label,color)=>{if(!point)return;const p=this.screen(point.x,point.y,game.camera);if(p.x>=left&&p.x<=right&&p.y>=top&&p.y<=bottom)return;
      const cx=(left+right)/2,cy=(top+bottom)/2,dx=p.x-cx,dy=p.y-cy,k=Math.min((right-left)/2/Math.max(.01,Math.abs(dx)),(bottom-top)/2/Math.max(.01,Math.abs(dy))),x=cx+dx*k,y=cy+dy*k,a=Math.atan2(dy,dx);
      c.save();c.translate(x,y);c.rotate(a);c.fillStyle=color;c.beginPath();c.moveTo(7,0);c.lineTo(-5,-5);c.lineTo(-5,5);c.closePath();c.fill();c.restore();c.font='600 10px "Segoe UI"';c.fillStyle=color;c.textAlign=x>cx?'right':'left';c.fillText(label,x+(x>cx?-12:12),y-10);c.textAlign='left';
    };
    flag(f.hostPosition,'DOMINANTE · '+f.hostLabel,'#ffd09d');if(f.risk===2&&!f.collision)flag(f.path.at(-1),'FUGA','#ff939b');
  }
  fieldReadout(game,point){
    const c=this.ctx,f=gravityAt(point,game.bodies,point.id);if(!f.dominant)return;
    const screen=this.screen(point.x,point.y,game.camera),x=Math.max(330,Math.min(this.w-480,screen.x+28)),y=Math.max(140,Math.min(this.h-240,screen.y+44));
    const strength=f.strength>.5?'forte':f.strength>.04?'moderato':'debole',label=f.dominant.label||TYPES[f.dominant.type].name;
    c.font='10px "Segoe UI"';c.fillStyle='#0b1320d8';c.beginPath();c.roundRect?.(x-10,y-16,220,40,6);if(!c.roundRect)c.rect(x-10,y-16,220,40);c.fill();c.fillStyle=f.contested?'#efc28e':'#b5d8d6';c.fillText(`Campo: ${label}`,x,y);c.fillStyle='#9eafbd';c.fillText(f.contested?'Zona contesa · due influenze':`Influenza ${strength} · attrazione continua`,x,y+14);
  }
  signals(game,time){
    const c=this.ctx,cam=game.camera;
    for(const b of game.bodies){if(!(b.signalUntil>game.elapsed))continue;
      const p=this.screen(b.x,b.y,cam),right=this.w-(this.w<720?168:253),left=24,top=118,bottom=this.h-111;
      const off=p.x<left||p.x>right||p.y<top||p.y>bottom;
      const color=b.signal==='sos'||b.signal==='hazard'?'#ffbe87':'#b8f0cc';c.strokeStyle=color;c.fillStyle=color;c.lineWidth=1.5;
      let x=p.x,y=p.y;
      if(off){const cx=(left+right)/2,cy=(top+bottom)/2,dx=p.x-cx,dy=p.y-cy,scale=Math.min((right-left)/2/Math.max(.01,Math.abs(dx)),(bottom-top)/2/Math.max(.01,Math.abs(dy)));x=cx+dx*scale;y=cy+dy*scale;const a=Math.atan2(dy,dx);c.save();c.translate(x,y);c.rotate(a);c.beginPath();c.moveTo(7,0);c.lineTo(-5,-5);c.lineTo(-5,5);c.closePath();c.fill();c.restore();}
      else{const radius=b.r*cam.zoom+9+Math.sin(time*4)*2;c.beginPath();c.arc(x,y,radius,0,TAU);c.stroke();c.globalAlpha=.4;c.beginPath();c.arc(x,y,radius+7,0,TAU);c.stroke();c.globalAlpha=1;}
      c.font='600 10px "Segoe UI"';c.textAlign=x>right-90?'right':'left';const tx=x>right-90?x-12:x+14;
      c.shadowColor='#000';c.shadowBlur=6;c.fillText(`${b.signal==='civiltà'?'✦ ':b.signal==='sos'?'SOS · ':''}${b.label||TYPES[b.type].name}`,tx,y-16);
      if(b.signal==='civiltà'){c.font='9px "Segoe UI"';c.fillText('UNA CIVILTÀ È NATA',tx,y-2);}
      c.shadowBlur=0;c.textAlign='left';
    }
  }
  trajectory(forecast,body,zoom,time){
    const c=this.ctx,color=forecast.dirty?'#8895a5':['#9fe2c8','#f5c682','#ff939b'][forecast.risk];
    if(forecast.guide&&forecast.risk<2){c.strokeStyle=color;c.globalAlpha=.28;c.lineWidth=1/zoom;c.setLineDash([3/zoom,8/zoom]);c.beginPath();forecast.guide.points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.stroke();c.setLineDash([]);}
    const path=forecast.path;if(path.length){
      c.lineCap='round';c.lineJoin='round';c.globalCompositeOperation='lighter';c.strokeStyle=color;
      c.beginPath();c.moveTo(body.x,body.y);for(const p of path)c.lineTo(p.x,p.y);
      c.globalAlpha=.16;c.lineWidth=7/zoom;c.stroke();
      c.globalAlpha=.85;c.lineWidth=1.8/zoom;c.setLineDash([10/zoom,7/zoom]);c.lineDashOffset=-time*40/zoom;c.stroke();c.setLineDash([]);
      c.globalCompositeOperation='source-over';
    }
    c.globalAlpha=1;
    const mark=(p,label,col,offset=-8)=>{c.strokeStyle=col;c.fillStyle=col;c.lineWidth=1.2/zoom;c.beginPath();c.arc(p.x,p.y,4/zoom,0,TAU);c.stroke();c.font=`${9/zoom}px "Segoe UI"`;c.fillText(label,p.x+8/zoom,p.y+offset/zoom);};
    if(forecast.guide&&forecast.risk<2){mark(forecast.guide.peri,'P · VICINO',color,-25);mark(forecast.guide.apo,'A · LONTANO',color);}
    if(forecast.returnPoint&&forecast.risk<2)mark(forecast.returnPoint,'↶ RITORNO',color,22);
    if(forecast.risk===2&&path.length){const end=path.at(-1),p=(time*2)%1;c.strokeStyle='#ff7e85';c.globalAlpha=1-p;c.lineWidth=1.5/zoom;c.beginPath();c.arc(end.x,end.y,(5+p*14)/zoom,0,TAU);c.stroke();c.globalAlpha=1;mark(end,forecast.collision?'IMPATTO':'FUGA','#ff7e85');}
  }
}
