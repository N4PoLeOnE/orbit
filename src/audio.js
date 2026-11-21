// Fully synthesized: Web Audio for sound, speechSynthesis for the radio voices.
const SCALE=[0,2,4,7,9,12,14,16,19,21];
export class Audio {
  constructor(){this.enabled=true;this.context=null;this.lastVoice=0;this.drone=null;}
  init(){
    if(!this.context){
      const C=globalThis.window?.AudioContext||globalThis.window?.webkitAudioContext;if(!C)return;
      const ctx=this.context=new C();
      this.master=ctx.createGain();this.master.gain.value=this.enabled?.9:0;
      const comp=ctx.createDynamicsCompressor();comp.threshold.value=-18;comp.ratio.value=4;
      this.master.connect(comp);comp.connect(ctx.destination);
      // A long, dark synthetic reverb gives everything a sense of space.
      const len=ctx.sampleRate*3.2,impulse=ctx.createBuffer(2,len,ctx.sampleRate);
      for(let ch=0;ch<2;ch++){const d=impulse.getChannelData(ch);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,3.2);}
      this.reverb=ctx.createConvolver();this.reverb.buffer=impulse;const wet=ctx.createGain();wet.gain.value=.42;this.reverb.connect(wet);wet.connect(this.master);
      this.bus=ctx.createGain();this.bus.connect(this.master);this.bus.connect(this.reverb);
      const n=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),nd=n.getChannelData(0);for(let i=0;i<nd.length;i++)nd[i]=Math.random()*2-1;this.noiseBuffer=n;
    }
    this.context.resume?.().catch(()=>{});
  }
  // Slow evolving pad under the whole game.
  ambient(on=true){
    if(!this.context||(on&&this.drone)||(!on&&!this.drone))return;
    const ctx=this.context,t=ctx.currentTime;
    if(!on){this.drone.gain.gain.setTargetAtTime(0,t,1.5);const d=this.drone;setTimeout(()=>d.oscs.forEach(o=>o.stop()),5000);this.drone=null;return;}
    const gain=ctx.createGain();gain.gain.value=0;gain.gain.setTargetAtTime(.05,t,4);
    const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=520;filter.Q.value=.7;filter.connect(gain);gain.connect(this.master);
    const send=ctx.createGain();send.gain.value=.5;gain.connect(send);send.connect(this.reverb);
    const lfo=ctx.createOscillator(),lfoGain=ctx.createGain();lfo.frequency.value=.045;lfoGain.gain.value=260;lfo.connect(lfoGain);lfoGain.connect(filter.frequency);
    const oscs=[lfo];
    for(const [f,type,v,detune] of [[55,'sine',1,0],[82.41,'triangle',.45,4],[110,'sine',.5,-5],[164.8,'triangle',.18,7],[246.9,'sine',.08,-3]]){
      const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.value=f;o.detune.value=detune;g.gain.value=v;o.connect(g);g.connect(filter);o.start(t);oscs.push(o);
    }
    lfo.start(t);this.drone={gain,oscs};
  }
  tone(freq=440,duration=.15,type='sine',volume=.07,slide=1,delay=0){
    if(!this.enabled||!this.context)return;const ctx=this.context,t=ctx.currentTime+delay,o=ctx.createOscillator(),g=ctx.createGain();
    o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(20,freq*slide),t+duration);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(volume,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+duration);
    o.connect(g);g.connect(this.bus);o.start(t);o.stop(t+duration+.05);
  }
  noise(duration=.4,volume=.1,from=1200,to=200,type='lowpass',q=.8,delay=0){
    if(!this.enabled||!this.context)return;const ctx=this.context,t=ctx.currentTime+delay,src=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();
    src.buffer=this.noiseBuffer;f.type=type;f.Q.value=q;f.frequency.setValueAtTime(from,t);f.frequency.exponentialRampToValueAtTime(Math.max(30,to),t+duration);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(volume,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+duration);
    src.connect(f);f.connect(g);g.connect(this.bus);src.start(t);src.stop(t+duration+.05);
  }
  bell(freq,delay=0,volume=.05){this.tone(freq,1.4,'sine',volume,1,delay);this.tone(freq*2.76,.7,'sine',volume*.35,1,delay);this.tone(freq*5.4,.3,'sine',volume*.12,1,delay);}
  play(kind,arg=1){
    if(!this.enabled||!this.context)return;
    const note=i=>523.25*Math.pow(2,SCALE[Math.max(0,Math.min(SCALE.length-1,i))]/12);
    switch(kind){
      case 'launch':this.noise(.45,.07,500,3200,'bandpass',1.4);this.tone(160,.35,'sine',.08,2.6);break;
      case 'auto':this.tone(210,.6,'triangle',.08,.5);this.tone(310,.4,'triangle',.05,.5,.18);break;
      case 'collision':this.noise(.7,.22,1600,120);this.tone(95,.6,'sawtooth',.05,.3);this.tone(55,.8,'sine',.12,.6);break;
      case 'supernova':this.noise(2.8,.38,2400,60);this.tone(48,2.4,'sine',.2,.5);this.tone(70,1.8,'sawtooth',.05,.3);break;
      case 'life':[0,4,7].forEach((s,i)=>this.bell(392*Math.pow(2,s/12),i*.11,.05));break;
      case 'contract':[0,4,7,12].forEach((s,i)=>this.tone(523.25*Math.pow(2,s/12),.5,'triangle',.06,1,i*.07));[0,1,2,3,4].forEach(i=>this.tone(2093*Math.pow(2,i*2/12),.25,'sine',.025,1,.3+i*.05));break;
      case 'rank':[0,7,12,16,19,24].forEach((s,i)=>this.bell(261.6*Math.pow(2,s/12),i*.12,.06));this.noise(1.6,.05,3000,8000,'highpass',.5,.2);break;
      case 'dust':this.tone(note(arg+3)*2,.5,'sine',.045);this.tone(note(arg+5)*2,.6,'sine',.03,1,.06);break;
      case 'score':this.tone(note(arg-1),.35,'sine',.045);this.tone(note(arg-1)*2,.2,'triangle',.012);break;
      default:this.tone(660,.13,'sine',.035,1.2);
    }
  }
  say(text,priority=false){if(!this.enabled||!('speechSynthesis'in window)||(!priority&&(performance.now()-this.lastVoice<9000||speechSynthesis.speaking)))return;this.lastVoice=performance.now();const u=new SpeechSynthesisUtterance(text);u.lang='it-IT';u.rate=1;u.pitch=1.15;u.volume=priority?.65:.42;if(!priority)speechSynthesis.cancel();speechSynthesis.speak(u);}
  mute(){this.enabled=!this.enabled;if(this.master)this.master.gain.setTargetAtTime(this.enabled?.9:0,this.context.currentTime,.05);if(!this.enabled&&'speechSynthesis'in window)speechSynthesis.cancel();return this.enabled;}
}
