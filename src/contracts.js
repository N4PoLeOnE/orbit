// Cosmic contracts: three short-term goals always on screen.
// count: progress accumulates; state: progress mirrors a live value; timer: seconds held.
export const RANKS=['Polvere stellare','Scintilla','Apprendista di orbite','Artigiano di orbite','Architetto stellare','Tessitore di sistemi','Demiurgo','Divinità quasi competente'];
export const CONTRACTS={
  firstOrbit:{tier:0,title:'Prima orbita',desc:'Lancia un pianeta con la scia verde.',kind:'launch',goal:1,points:300},
  orbits3:{tier:0,title:'Giri di prova',desc:'Completa 3 rivoluzioni.',kind:'orbit',goal:3,points:400},
  oceans:{tier:0,title:'Acqua!',desc:'Porta un pianeta allo stadio Oceani.',kind:'stage1',goal:1,points:350},
  dust3:{tier:0,title:'Raccoglitore',desc:'Raccogli 3 polveri di stelle.',kind:'stardust',goal:3,points:350},
  impact:{tier:0,title:'Fuochi d’artificio',desc:'Fai scontrare due corpi.',kind:'impact',goal:1,points:250},
  moon:{tier:1,title:'Compagnia lunare',desc:'Cattura una Luna attorno a un pianeta.',kind:'moon',goal:1,points:600},
  vegetation:{tier:1,title:'Pollice verde',desc:'Porta un pianeta allo stadio Vegetazione.',kind:'stage2',goal:1,points:600},
  flyby:{tier:1,title:'Brivido',desc:'Esegui 2 passaggi ravvicinati.',kind:'flyby',goal:2,points:500},
  seed:{tier:1,title:'Postino cosmico',desc:'Consegna acqua con una cometa.',kind:'seed',goal:1,points:700},
  cometPass:{tier:1,title:'Passaggio solare',desc:'Fai sfiorare una stella a una cometa.',kind:'cometPass',goal:1,points:600},
  system3:{tier:1,title:'Piccolo sistema',desc:'Tieni 3 pianeti in orbita insieme.',kind:'system',goal:3,points:700,mode:'state'},
  combo4:{tier:1,title:'In serie',desc:'Raggiungi una combo ×4.',kind:'combo',goal:4,points:500,mode:'state'},
  calm:{tier:1,title:'Quiete',desc:'Resta sotto il 25% di instabilità per 45 s.',kind:'calm',goal:45,points:600,mode:'timer'},
  dust6:{tier:1,title:'Scia dorata',desc:'Raccogli 6 polveri di stelle.',kind:'stardust',goal:6,points:700},
  orbits10:{tier:2,title:'Orologeria',desc:'Completa 10 rivoluzioni.',kind:'orbit',goal:10,points:1000},
  slingshot:{tier:2,title:'Fionda',desc:'Esegui una fionda gravitazionale.',kind:'slingshot',goal:1,points:900},
  ellipse:{tier:2,title:'Ellisse improbabile',desc:'Completa un’orbita molto eccentrica.',kind:'ellipse',goal:1,points:900},
  system5:{tier:2,title:'Sistema maturo',desc:'Tieni 5 pianeti in orbita insieme.',kind:'system',goal:5,points:1400,mode:'state'},
  combo6:{tier:2,title:'Catena cosmica',desc:'Raggiungi una combo ×6.',kind:'combo',goal:6,points:1000,mode:'state'},
  civ:{tier:2,title:'Qualcuno lassù',desc:'Fai nascere una civiltà.',kind:'stage4',goal:1,points:1500},
  capture:{tier:2,title:'Nuovo indirizzo',desc:'Fai catturare un corpo da un’altra massa.',kind:'capture',goal:1,points:1000},
  moons2:{tier:2,title:'Luna su luna',desc:'Cattura 2 Lune.',kind:'moon',goal:2,points:1100},
  living2:{tier:3,title:'Giardino',desc:'Abbi 2 mondi con vita insieme.',kind:'living',goal:2,points:1800,mode:'state'},
  combo8:{tier:3,title:'Delirio gravitazionale',desc:'Raggiungi la combo massima ×8.',kind:'combo',goal:8,points:1600,mode:'state'},
  rescue:{tier:3,title:'Salvataggio',desc:'Salva un mondo abitato in pericolo.',kind:'rescue',goal:1,points:1500},
  advanced:{tier:3,title:'Abbiamo inventato le tasse',desc:'Porta un mondo a Civiltà avanzata.',kind:'stage5',goal:1,points:2200},
  dust12:{tier:3,title:'Cercatore d’oro',desc:'Raccogli 12 polveri di stelle.',kind:'stardust',goal:12,points:1600},
};
const OPENING=['firstOrbit','orbits3','dust3'];
export function contractState(){return {active:[],done:0,recent:[],calm:0};}
function make(id){return {id,progress:0,goal:CONTRACTS[id].goal,fresh:1};}
export function startContracts(state){state.active=OPENING.map(make);state.done=0;state.recent=[...OPENING];state.calm=0;}
export function rankOf(done){return Math.min(RANKS.length-1,Math.floor(done/2));}
export function pickContract(state,random=Math.random){
  const top=Math.min(3,1+Math.floor(state.done/3)),active=new Set(state.active.map(c=>c.id));
  const kinds=new Set(state.active.map(c=>CONTRACTS[c.id].kind));
  const pool=Object.entries(CONTRACTS).filter(([id,c])=>c.tier<=top&&c.tier>=top-2&&!active.has(id)&&!kinds.has(c.kind)&&!state.recent.includes(id));
  const list=pool.length?pool:Object.entries(CONTRACTS).filter(([id])=>!active.has(id));
  const weights=list.map(([,c])=>c.tier===top?3:c.tier===top-1?2:1),total=weights.reduce((a,b)=>a+b,0);
  let roll=random()*total;for(let i=0;i<list.length;i++){roll-=weights[i];if(roll<=0)return list[i][0];}
  return list.at(-1)[0];
}
// Returns the contracts completed by this update; they are replaced in place.
export function advance(state,kind,value=1,random=Math.random){
  const completed=[];
  for(let i=0;i<state.active.length;i++){
    const c=state.active[i],def=CONTRACTS[c.id];if(def.kind!==kind)continue;
    c.progress=def.mode==='state'||def.mode==='timer'?value:c.progress+value;
    if(c.progress>=c.goal){
      completed.push({...c,def});state.done++;
      state.recent.push(c.id);if(state.recent.length>6)state.recent.shift();
      state.active[i]=make(pickContract(state,random));
    }
  }
  return completed;
}
