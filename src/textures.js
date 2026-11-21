// Procedural textures, generated lazily the first time a body is drawn.
// Nothing here runs in the Node tests: canvases are only created from draw().
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function hash(x,y,s){let h=(Math.imul(x|0,374761393)+Math.imul(y|0,668265263)+Math.imul(s|0,982451653))|0;h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;return (h>>>0)/4294967296;}
// Value noise, periodic along x so planet maps wrap seamlessly while they spin.
function vnoise(x,y,s,period){
  const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);
  const p=Math.max(1,Math.round(period)),x0=((xi%p)+p)%p,x1=(x0+1)%p;
  const a=hash(x0,yi,s),b=hash(x1,yi,s),c=hash(x0,yi+1,s),d=hash(x1,yi+1,s);
  return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;
}
export function fbm(x,y,s,period=1e6,oct=5){let sum=0,amp=.5,f=1,norm=0;for(let i=0;i<oct;i++){sum+=amp*vnoise(x*f,y*f,s+i*31,period*f);norm+=amp;amp*=.5;f*=2;}return sum/norm;}
export const rgb=hex=>{const n=parseInt(hex.slice(1,7),16);return [n>>16&255,n>>8&255,n&255];};
export const mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
export const ramp=(stops,t)=>{t=clamp(t,0,1)*(stops.length-1);const i=Math.min(stops.length-2,Math.floor(t));return mix(stops[i],stops[i+1],t-i);};
export const rgba=(c,a)=>`rgba(${c[0]|0},${c[1]|0},${c[2]|0},${a})`;
const P=6;
export const SURFACES={
  small:{kind:'rock',stops:['#3e3733','#6d625b','#9a8b80','#c4b6a9'],crater:1,life:true,atmo:null},
  rocky:{kind:'rock',stops:['#4a261c','#8a4a2f','#c0714a','#e6a77c'],crater:.6,life:true,atmo:'#ffb48e'},
  ocean:{kind:'ocean',water:['#0a2853','#17558f','#3592c6','#62b7dd'],land:['#c8b088','#9aa56c'],sea:.72,clouds:.6,atmo:'#7cc8ff',spec:true},
  earth:{kind:'ocean',water:['#081f45','#134f8f','#2a86c2','#4fb0d8'],land:['#4f8a45','#7ea353','#b59b68','#e1d4ae'],sea:.5,ice:true,clouds:.56,atmo:'#8ccaff',spec:true},
  superEarth:{kind:'ocean',water:['#0b3442','#17656e','#33968f'],land:['#4c6a3a','#7b8e4b','#a8a067','#cfc79a'],sea:.44,clouds:.62,atmo:'#bfe6a0',spec:true},
  uranus:{kind:'gas',stops:['#7fc8c6','#9fdfd9','#c3f1eb','#a2e0da'],bands:4,turb:.2,atmo:'#bdf3ec'},
  neptune:{kind:'gas',stops:['#1d3a8f','#2f5cc2','#4b7fe0','#7aa6f2','#3a69d2'],bands:7,turb:.7,spot:{u:.62,v:.42,w:.08,h:.05,color:'#142a66'},atmo:'#6c9bff'},
  gas:{kind:'gas',stops:['#9c7a58','#d6b98d','#f2dfb8','#c7a37b','#e9d1a5'],bands:10,turb:.45,atmo:'#f3d9aa'},
  jupiter:{kind:'gas',stops:['#7c4d39','#c4906c','#f1dcbd','#b27552','#e8c8a0','#9a6248'],bands:13,turb:1,spot:{u:.3,v:.64,w:.09,h:.045,color:'#b44a32'},atmo:'#f2c49b'},
  moon:{kind:'rock',stops:['#4e5259','#7f848d','#aeb3bb','#d9dde2'],crater:1.2},
  asteroid:{kind:'rock',stops:['#3a332e','#665b52','#958778'],crater:.8},
  debris:{kind:'rock',stops:['#3d3634','#6c625e','#9b8f88'],crater:.5},
  comet:{kind:'rock',stops:['#56696e','#97b2b5','#dceeee'],crater:.3},
};
function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
// Equirectangular-like strip (2:1). Drawn twice side by side and scrolled to fake rotation.
export function planetTexture(type,seed,stage=0){
  const W=256,H=128,cv=canvas(W,H),x=cv.getContext('2d'),img=x.createImageData(W,H),d=img.data;
  const s=SURFACES[type]||SURFACES.asteroid,sd=(seed*977)|0;
  const st=(s.stops||[]).map(rgb),water=(s.water||[]).map(rgb),land=(s.land||[]).map(rgb);
  const lushLand=['#2f6b3c','#4f8c45','#83a25a','#c9c08f'].map(rgb),sea=['#0d3060','#1d5f99','#4596c8'].map(rgb);
  for(let j=0;j<H;j++){const v=j/H,lat=(v-.5)*2;
    for(let i=0;i<W;i++){const u=i/W;
      const n=clamp((fbm(u*P,v*3,sd,P,5)-.5)*2.4+.5,0,1);let col;
      if(s.kind==='gas'){
        const t=fbm(u*P*.5,v*7,sd+7,P*.5,4),swirl=fbm(u*P*2,v*14,sd+19,P*2,3);
        const band=.5+.5*Math.sin(lat*s.bands*Math.PI*.5+(t-.5)*s.turb*7+(swirl-.5)*s.turb*2);
        col=ramp(st,band*.82+n*.18);
        col=mix(col,[255,255,255],Math.max(0,swirl-.62)*.6);
      }else if(s.kind==='ocean'){
        const seaLevel=stage>=2?s.sea-.04:s.sea;
        if(n<seaLevel)col=ramp(water,Math.pow(n/seaLevel,1.4));
        else{const m=(n-seaLevel)/(1-seaLevel);col=ramp(stage>=2?lushLand:land,m);}
        if(s.ice&&Math.abs(lat)>.82-n*.16)col=mix(col,[236,244,250],.92);
      }else{
        col=ramp(st,n);
        const r2=fbm(u*P*3,v*9,sd+3,P*3,3),ridge=1-Math.abs(r2*2-1);
        col=mix(col,[10,8,8],(1-ridge)*.28*(s.crater||.5));
        // Life visibly transforms barren rock: first oceans, then vegetation.
        if(s.life&&stage>=1&&n<.42)col=ramp(sea,n/.42);
        else if(s.life&&stage>=2&&n<.72)col=mix(col,ramp(lushLand,(n-.42)/.3),.75);
        if(s.life&&stage>=1&&Math.abs(lat)>.86)col=mix(col,[235,242,248],.8);
      }
      if(s.clouds){const cl=fbm(u*8,v*4+9,sd+11,8,5);const a=clamp((cl-s.clouds)*3.6,0,.88);col=mix(col,[246,249,252],a);}
      const k=(j*W+i)*4;d[k]=col[0];d[k+1]=col[1];d[k+2]=col[2];d[k+3]=255;
    }
  }
  x.putImageData(img,0,0);
  if(s.spot){const sp=s.spot;for(const off of [0,-W,W]){x.fillStyle=sp.color;x.globalAlpha=.85;x.beginPath();x.ellipse(sp.u*W+off,sp.v*H,sp.w*W,sp.h*H,0,0,Math.PI*2);x.fill();x.globalAlpha=.5;x.strokeStyle='#ffffff';x.lineWidth=1.5;x.stroke();}x.globalAlpha=1;}
  if(s.kind==='rock'&&s.crater){
    let r=sd;const rnd=()=>{r=(Math.imul(r,1664525)+1013904223)>>>0;return r/4294967296;};
    for(let k=0;k<Math.round(14*s.crater);k++){const cx=rnd()*W,cy=(.15+rnd()*.7)*H,cr=2+rnd()*rnd()*10;
      for(const off of [0,-W,W]){const g=x.createRadialGradient(cx+off-cr*.2,cy-cr*.2,0,cx+off,cy,cr);g.addColorStop(0,'rgba(0,0,0,.35)');g.addColorStop(.75,'rgba(0,0,0,.15)');g.addColorStop(.9,'rgba(255,255,255,.18)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.beginPath();x.arc(cx+off,cy,cr,0,Math.PI*2);x.fill();}
    }
  }
  return cv;
}
export function starTexture(color,seed,compact=false){
  const S=160,cv=canvas(S,S),x=cv.getContext('2d'),img=x.createImageData(S,S),d=img.data,c=rgb(color),hot=compact?[245,250,255]:[255,249,228],sd=(seed*331)|0;
  for(let j=0;j<S;j++)for(let i=0;i<S;i++){
    const dx=(i+.5)/S*2-1,dy=(j+.5)/S*2-1,rr=Math.hypot(dx,dy),k=(j*S+i)*4;
    if(rr>1){d[k+3]=0;continue;}
    const n=fbm(dx*5+9,dy*5+9,sd,1e6,4),cell=fbm(dx*14,dy*14,sd+5,1e6,2);
    let col=mix(hot,c,Math.pow(clamp(rr*1.05,0,1),1.6));
    const grain=.8+.32*n+.12*(cell-.5),limb=1-.42*rr*rr;
    col=[col[0]*grain*limb,col[1]*grain*limb,col[2]*grain*limb].map(v=>clamp(v,0,255));
    d[k]=col[0];d[k+1]=col[1];d[k+2]=col[2];d[k+3]=clamp((1-rr)*S*.5,0,1)*255;
  }
  x.putImageData(img,0,0);return cv;
}
// Large, soft nebula painted once per resize.
export function nebula(w,h,seed=7){
  const scale=.25,W=Math.ceil(w*scale),H=Math.ceil(h*scale),cv=canvas(W,H),x=cv.getContext('2d'),img=x.createImageData(W,H),d=img.data;
  const a=rgb('#1d4a66'),b=rgb('#4a2a68'),c=rgb('#6a3a2c'),base=rgb('#060a13');
  for(let j=0;j<H;j++)for(let i=0;i<W;i++){
    const u=i/W*3,v=j/H*3*h/w,k=(j*W+i)*4;
    const n1=fbm(u,v,seed,1e6,6),n2=fbm(u+5.2,v+1.3,seed+9,1e6,5),n3=fbm(u*1.7+2,v*1.7,seed+21,1e6,4);
    const m1=Math.pow(clamp((n1-.45)*2.6,0,1),2)*.55,m2=Math.pow(clamp((n2-.5)*2.8,0,1),2)*.45,m3=Math.pow(clamp((n3-.56)*3,0,1),2)*.32;
    let col=base;col=mix(col,a,m1);col=mix(col,b,m2);col=mix(col,c,m3);
    const dust=clamp((fbm(u*3,v*3,seed+40,1e6,4)-.55)*3,0,1)*.35;col=mix(col,[2,3,6],dust);
    d[k]=col[0];d[k+1]=col[1];d[k+2]=col[2];d[k+3]=255;
  }
  x.putImageData(img,0,0);return cv;
}
export function vignette(w,h){
  const cv=canvas(w,h),x=cv.getContext('2d'),g=x.createRadialGradient(w/2,h/2,Math.min(w,h)*.35,w/2,h/2,Math.max(w,h)*.75);
  g.addColorStop(0,'rgba(2,4,9,0)');g.addColorStop(1,'rgba(2,4,9,.72)');x.fillStyle=g;x.fillRect(0,0,w,h);return cv;
}
