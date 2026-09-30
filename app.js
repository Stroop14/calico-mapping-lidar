(function(){
'use strict';
const M=CALICO.meta, qs=new URLSearchParams(location.search), LD=window.LOADER;
const W=()=>innerWidth, Hh=()=>innerHeight;
const renderer=new THREE.WebGLRenderer({antialias:false,preserveDrawingBuffer:qs.has('capture'),powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,qs.has('capture')?1:2));
renderer.setSize(W(),Hh()); renderer.setClearColor(0x050403,1);
document.body.appendChild(renderer.domElement);
const scene=new THREE.Scene();
LD.log('WebGL renderer created ('+(renderer.capabilities.isWebGL2?'WebGL 2':'WebGL 1')+').','ok');
const camera=new THREE.PerspectiveCamera(72,W()/Hh(),0.05,400);
camera.rotation.order='YXZ';

// ---------- shared uniforms / point material ----------
const U={uCam:{value:new THREE.Vector3()},uDir:{value:new THREE.Vector3(0,0,-1)},uLamp:{value:1.0},
  uSize:{value:0.011},uMaxPx:{value:7},uScreen:{value:Hh()},uFov:{value:1.0},uTime:{value:0},uFogDist:{value:38.0},uCull:{value:1.0}};
const common=`
uniform vec3 uCam; uniform vec3 uDir; uniform float uLamp; uniform float uTime; uniform float uFogDist;
float h3(vec3 p){p=fract(p*0.3183099+0.1);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float vnoise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.0-2.0*f);
 return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
            mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}
vec3 clayColor(vec3 wp, vec3 n, float hgt, float mat){
 float n1=vnoise(wp*1.1), n2=vnoise(wp*4.3), n3=vnoise(wp*17.0);
 vec3 ceilc=vec3(0.80,0.42,0.31), wallc=vec3(0.76,0.51,0.36), lowc=vec3(0.66,0.52,0.40), floorc=vec3(0.60,0.54,0.42);
 vec3 c=mix(lowc,wallc,smoothstep(0.25,1.1,hgt)); c=mix(c,ceilc,smoothstep(1.0,1.9,hgt));
 // ochre / cream / red mottling in the altered volcanic clay
 c=mix(c,vec3(0.80,0.52,0.26),smoothstep(0.55,0.85,n1)*0.55);
 c=mix(c,vec3(0.82,0.68,0.55),smoothstep(0.62,0.9,n2)*0.30);
 c=mix(c,vec3(0.66,0.30,0.24),smoothstep(0.6,0.95,1.0-n1)*0.40);
 float isFloor=(1.0-smoothstep(0.08,0.2,hgt))*smoothstep(0.55,0.8,abs(n.y));
 c=mix(c,floorc*(0.85+0.3*n2),isFloor);
 if(mat>0.955 && mat<0.985) c=vec3(0.36,0.24,0.14)*(0.7+0.6*n3);      // timber portal frame
 if(mat>0.985) c=vec3(0.56,0.34,0.25)*(0.8+0.4*n2);                    // exterior talus
 c*=0.86+0.28*n3; c=mix(vec3(dot(c,vec3(0.33))),c,1.35);
 return c;}
vec3 light(vec3 wp, vec3 n, vec3 base){
 vec3 toC=uCam-wp; float d=length(toC); vec3 L=toC/max(d,1e-4);
 float ndl=abs(dot(n,L));
 float cs=dot(-L,uDir);
 float cone=smoothstep(0.80,0.975,cs);
 float spill=smoothstep(0.35,0.85,cs);
 float att=1.0/(1.0+0.25*d+0.10*d*d);
 float lamp=(0.05+1.5*cone+0.3*spill)*att*(0.15+0.85*ndl*ndl);
 float amb=0.012+0.02*max(n.y,0.0);
 float li=mix(0.55*(0.35+0.65*ndl)*(1.0/(1.0+0.004*d*d))+0.1, lamp+amb, uLamp);
 vec3 col=base*li*mix(vec3(1.0),vec3(1.07,1.0,0.88),uLamp); // warm lamp tint
 float fog=exp(-pow(d/uFogDist,2.0)*2.2);
 return col*fog;}
`;
const pmat=new THREE.ShaderMaterial({uniforms:U,vertexShader:common+`
attribute vec3 nrm; attribute float tone; uniform float uSize; uniform float uMaxPx; uniform float uScreen; uniform float uFov; uniform float uCull;
varying vec3 vCol;
void main(){ vec4 wp=modelMatrix*vec4(position,1.0); vec4 mv=viewMatrix*wp;
 float hgt=tone*2.6/0.902; if(tone>0.95) hgt=1.0;
 vec3 base=clayColor(wp.xyz,nrm,hgt,tone);
 vCol=light(wp.xyz,nrm,base);
 gl_Position=projectionMatrix*mv;
 float sz=uSize*(tone>0.985?0.65:1.0);
 gl_PointSize=clamp(sz*uScreen/(uFov*-mv.z),1.0,uMaxPx);
 if(uCull>0.5 && tone<0.95 && dot(nrm,normalize(uCam-wp.xyz))<-0.3){gl_Position=vec4(2.0,2.0,2.0,1.0);gl_PointSize=0.0;}}`,
 fragmentShader:`varying vec3 vCol; void main(){ vec2 c=gl_PointCoord-0.5; if(dot(c,c)>0.25) discard;
 float lm=dot(vCol,vec3(0.3,0.55,0.15)); vec3 col=vCol*(1.9/(1.0+1.9*lm*0.75)); gl_FragColor=vec4(pow(col,vec3(1.0/2.2)),1.0);}`});

// ---------- load & decode chunks ----------
const bmin=new THREE.Vector3().fromArray(M.bmin), ext=new THREE.Vector3().fromArray(M.ext);
const maxExt=Math.max(ext.x,ext.y,ext.z);
const group=new THREE.Group(); group.position.copy(bmin); group.scale.copy(ext); scene.add(group);
const chunkObjs=[], pointSrc=[]; let loadedFiles=0, loadedPts=0;
let qualityHigh=true, walkT=0;
function pokeUi(){ walkT=0; document.body.classList.remove('uidim'); }
function dprCap(){ if(qs.has('capture')&&!qs.has('dpr')) return 1; return qualityHigh?3:2; }
function applyPixelRatio(){
 renderer.setPixelRatio(Math.min(devicePixelRatio||1, dprCap()));
 renderer.setSize(W(),Hh());
 U.uScreen.value=Hh()*renderer.getPixelRatio();
 U.uSize.value=qualityHigh?0.011:0.018;
 U.uMaxPx.value=qualityHigh?7:12;
}
function keepPoint(pos,i){
 if(qualityHigh) return true;
 const h=(pos[3*i]*374761393 ^ pos[3*i+1]*668265263 ^ pos[3*i+2]*2146121005)>>>0;
 return (h%5)<2;
}
function mountChunk(src){
 const n=src.n; let p=src.pos, nn=src.nrm, tt=src.tone, cnt=n;
 if(!qualityHigh){
  let k=0; for(let i=0;i<n;i++) if(keepPoint(src.pos,i)) k++;
  p=new Uint16Array(k*3); nn=new Int8Array(k*3); tt=new Uint8Array(k); let w=0;
  for(let i=0;i<n;i++) if(keepPoint(src.pos,i)){
   p[3*w]=src.pos[3*i]; p[3*w+1]=src.pos[3*i+1]; p[3*w+2]=src.pos[3*i+2];
   nn[3*w]=src.nrm[3*i]; nn[3*w+1]=src.nrm[3*i+1]; nn[3*w+2]=src.nrm[3*i+2];
   tt[w]=src.tone[i]; w++;
  }
  cnt=w;
 }
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.BufferAttribute(p,3,true));
 g.setAttribute('nrm',new THREE.BufferAttribute(nn,3,true));
 g.setAttribute('tone',new THREE.BufferAttribute(tt,1,true));
 g.boundingSphere=src.sphere;
 const o=new THREE.Points(g,pmat); o.userData.c=src.c; o.userData.r=src.r; group.add(o); chunkObjs.push(o);
 return cnt;
}
function rebuildPoints(){
 for(const o of chunkObjs){ group.remove(o); o.geometry.dispose(); }
 chunkObjs.length=0;
 let shown=0; for(const s of pointSrc) shown+=mountChunk(s);
 return shown;
}
function setQuality(high){
 qualityHigh=!!high; applyPixelRatio();
 const shown=pointSrc.length?rebuildPoints():0;
 flash((qualityHigh?'High':'Standard')+(shown?(' · '+(shown/1e6).toFixed(2)+' M points on screen'):''));
 if(CALICO.syncQuality) CALICO.syncQuality();
}
const OCC=0.1, occ=new Set();
// Up-facing / down-facing point counts, 25 cm in plan and 10 cm in height. The eye is measured from this grid
// (lowest dense floor directly under the viewer). Keep the sizes in sync with test/eye-route.js.
const FCELL=0.25, FY0=-4, FYN=120, fgrid=new Map();
function fbin(x,y,z,up){ const yi=Math.round((y-FY0)/0.1); if(yi<0||yi>=FYN) return;
 const ix=Math.round(x/FCELL), iz=Math.round(z/FCELL), k=ix*100000+iz;
 let h=fgrid.get(k); if(!h){ h=new Uint16Array(FYN*2); h.ix=ix; h.iz=iz; fgrid.set(k,h); }
 const i=yi+(up?0:FYN); if(h[i]<65535) h[i]++; }
function b64(s){const bin=atob(s),n=bin.length,u=new Uint8Array(n);for(let i=0;i<n;i++)u[i]=bin.charCodeAt(i);return u;}
// Wall voxels stay the previous 2 cm shell. The denser cloud fills air just inside that shell, and those
// extra 10 cm cells were thick enough to count as rock and close the guided view.
if(CALICO.wall){ const u=b64(CALICO.wall), n=u.length>>3;
 for(let i=0;i<n;i++){ const o=i*8;
  const lo=(u[o]+(u[o+1]<<8)+(u[o+2]<<16)+u[o+3]*16777216)>>>0;
  const hi=u[o+4]+(u[o+5]<<8)+(u[o+6]<<16)+u[o+7]*16777216;
  occ.add(hi*4294967296+lo); } }
function decodeFile(fi){
 const arr=CALICO.files[fi];
 M.chunks.forEach(ch=>{ if(ch.f!==fi) return;
  const u=b64(arr[ch.i]), n=ch.n;
  const pos=new Uint16Array(new Uint16Array(u.buffer,0,n*3));
  const nrm=new Int8Array(new Int8Array(u.buffer,n*6,n*3));
  const tone=new Uint8Array(new Uint8Array(u.buffer,n*9,n));
  const c=new THREE.Vector3().fromArray(ch.c);
  const sphere=new THREE.Sphere(c.clone().sub(bmin).divide(ext),ch.r/maxExt+1e-4);
  const src={pos,nrm,tone,n,c,r:ch.r,sphere};
  pointSrc.push(src); mountChunk(src);
  for(let i=0;i<n;i++){ const x=bmin.x+pos[3*i]/65535*ext.x, y=bmin.y+pos[3*i+1]/65535*ext.y, z=bmin.z+pos[3*i+2]/65535*ext.z;
   const ny=nrm[3*i+1]/127; if(ny>0.5||ny<-0.5) fbin(x,y,z,ny>0.5); }
  loadedPts+=n; });
 delete CALICO.files[fi]; loadedFiles++;
 LD.sectionAdded(fi,loadedPts);
 if(loadedFiles===M.files.length) onLoaded();
}
CALICO.setQuality=on=>{ setQuality(on); }; CALICO.quality=()=>qualityHigh;
// data files are fetched as text by the loader in index.html (byte-accurate progress) and evaluated in order
CALICO.onFile=fi=>decodeFile(fi);

// ---------- optional mesh ----------
let mesh=null;
const mmat=new THREE.ShaderMaterial({uniforms:U,side:THREE.DoubleSide,vertexShader:common+`
attribute vec3 nrm; attribute float tone; varying vec3 vW; varying vec3 vN; varying float vT;
void main(){ vec4 wp=modelMatrix*vec4(position,1.0); vW=wp.xyz; vN=nrm; vT=tone; gl_Position=projectionMatrix*viewMatrix*wp;}`,
 fragmentShader:common+`varying vec3 vW; varying vec3 vN; varying float vT;
void main(){ vec3 n=normalize(vN); float hgt=vT*2.6/0.902; if(vT>0.95) hgt=1.0; vec3 c=light(vW,n,clayColor(vW,n,hgt,vT));
 float lm=dot(c,vec3(0.3,0.55,0.15)); c=c*(1.9/(1.0+1.9*lm*0.75)); gl_FragColor=vec4(pow(c,vec3(1.0/2.2)),1.0);}`});
function loadMesh(cb){
 if(mesh){cb&&cb();return;} if(!M.mesh){flash('No surface mesh in this build');return;}
 window.CALICO_MESH=function(d){
  const u=b64(d.b64), nv=d.nv, nt=d.nt;
  const pos=new Uint16Array(u.buffer,0,nv*3); const nrm=new Int8Array(u.buffer,nv*6,nv*3); const tone=new Uint8Array(u.buffer,nv*9,nv);
  const off=nv*10+((4-(nv*10)%4)%4); const idx=new Uint32Array(u.buffer,off,nt*3);
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(pos,3,true));
  g.setAttribute('nrm',new THREE.BufferAttribute(nrm,3,true)); g.setAttribute('tone',new THREE.BufferAttribute(tone,1,true));
  g.setIndex(new THREE.BufferAttribute(idx,1));
  mesh=new THREE.Mesh(g,mmat); mesh.frustumCulled=false; mesh.position.copy(bmin); mesh.scale.copy(ext); mesh.visible=false; scene.add(mesh); cb&&cb();};
 if(meshLoading) return; meshLoading=true;
 const tot=LD.SIZES[M.mesh]||18783875, t0=performance.now();
 LD.log('Surface mesh: downloading '+LD.fmtMB(tot)+' MB…');
 LD.fetchText(M.mesh,(n,done)=>{ msg=done?'Surface mesh downloaded — building…':`Loading surface mesh… ${Math.min(100,100*n/tot).toFixed(0)}%  (${LD.fmtMB(n)} / ${LD.fmtMB(tot)} MB)`; msgT=done?5:1e9; })
  .then(t=>{ LD.log('Surface mesh downloaded ('+LD.fmtMB(t.length)+' MB, '+((performance.now()-t0)/1000).toFixed(1)+' s).','ok');
   setTimeout(()=>{ LD.evalScript(t,M.mesh); LD.log('Surface mesh built ('+M.mesh_tris.toLocaleString()+' triangles).','ok'); meshLoading=false; },20); })
  .catch(e=>{ meshLoading=false; LD.log('ERROR: surface mesh failed — '+e.message,'err'); msg='Surface mesh failed to load: '+e.message+' (press M to retry)'; msgT=6; });
}
let meshLoading=false;

// ---------- controls ----------
const keys={}; let yaw=0,pitch=0,speed=2.0,fastWalk=false,lampOn=true,auto=false,autoT=0,msgT=0,msg='';
const WALK_FAST=4;
let guided=false, guideS=0, guideOff=0, guideV=0, peekYaw=0, peekPitch=0, peekHold=false, guideInited=false;
let lookAxisX=0, lookAxisY=0, peekTimer=0;
let lookYaw=0, lookPitch=0;   // steadicam: the camera eases toward yaw/pitch (mouse targets) instead of snapping
const path=new THREE.CatmullRomCurve3(M.path.map(p=>new THREE.Vector3().fromArray(p)),false,'centripetal');
const pathLen=path.getLength();
function lookAt(p){const d=new THREE.Vector3().subVectors(p,camera.position);yaw=Math.atan2(-d.x,-d.z);pitch=Math.atan2(d.y,Math.hypot(d.x,d.z));}
// start ~6 m along the survey path: just inside the portal (past the entrance clutter), looking down the tunnel
const START_D=6.0;
function reset(){ const t=Math.min(START_D/pathLen,1); poseAt(t); guideInited=false; guideOff=0; guideV=0; peekYaw=0; peekPitch=0; }
function flash(t){msg=t;msgT=2.5;}
addEventListener('keydown',e=>{keys[e.code]=true;
 if(e.code==='KeyC'){keepIn=!keepIn;outT=0;flash('Keep-inside pull-back '+(keepIn?'ON':'OFF (free flight)'));}
 if(e.code==='KeyL'){lampOn=!lampOn;flash('Headlamp '+(lampOn?'ON':'OFF (flat light)')); if(CALICO.syncTouchBtns) CALICO.syncTouchBtns();}
 if(e.code==="KeyR"){reset();auto=false;resetGuard();snapLook(); if(CALICO.syncTouchBtns) CALICO.syncTouchBtns();}
 if(e.code==='KeyB'){U.uCull.value=1-U.uCull.value;flash('Back-face point culling '+(U.uCull.value?'ON':'OFF'));}
 if(e.code==='KeyH'){document.body.classList.toggle('hidehelp');}
 if(e.code==='KeyF'&&!e.repeat){ fastWalk=!fastWalk; flash(fastWalk?'Walking 4×':'Walking normal speed'); if(CALICO.syncTouchBtns) CALICO.syncTouchBtns(); }
 if(e.code==='KeyG'&&!e.repeat){ setGuided(!guided); }
 if(e.code==='KeyP'){ if(auto) stopAuto(); else startAuto(); flash(auto?(FLY?'Auto fly-through to the northwest end and back (P to stop)':'Auto fly-through (P to stop)'):'Manual'); if(CALICO.syncTouchBtns) CALICO.syncTouchBtns(); }
 if(e.code==='KeyM'){loadMesh(()=>{mesh.visible=!mesh.visible;group.visible=!mesh.visible;flash(mesh.visible?'Surface mesh':'Points');});}
 if(e.code==='BracketRight')U.uSize.value*=1.15; if(e.code==='BracketLeft')U.uSize.value/=1.15;
 if(e.code==='Equal'||e.code==='NumpadAdd'){speed=Math.min(speed*1.25,40);flash('Speed '+speed.toFixed(1)+' m/s');}
 if(e.code==='Minus'||e.code==='NumpadSubtract'){speed=Math.max(speed/1.25,0.2);flash('Speed '+speed.toFixed(1)+' m/s');}
 if(e.code==='Space'||e.code.startsWith('Arrow'))e.preventDefault();});
addEventListener('keyup',e=>{keys[e.code]=false;});
addEventListener('wheel',e=>{speed=Math.min(40,Math.max(0.2,speed*(e.deltaY<0?1.12:1/1.12)));flash('Speed '+speed.toFixed(1)+' m/s');},{passive:true});
const ov=document.getElementById('overlay'), hint=document.getElementById('hint'); let entered=false, hintTimer=0;
ov.addEventListener('click',()=>{ if(!ov.dataset.ready) return; if(TOUCH) enterTouch(); else renderer.domElement.requestPointerLock(); });
renderer.domElement.addEventListener('click',()=>{ if(TOUCH||!ov.dataset.ready) return; renderer.domElement.requestPointerLock(); });
function showHint(html,ms){ hint.innerHTML=html; hint.classList.add('show'); clearTimeout(hintTimer); hintTimer=setTimeout(()=>hint.classList.remove('show'),ms); }
document.addEventListener('pointerlockchange',()=>{const L=document.pointerLockElement===renderer.domElement;
 if(L){ ov.style.display='none';
  if(!entered){ entered=true; showHint("You're just inside the mine portal, facing into the tunnel.<br><b>W</b> to walk forward · mouse to look · <b>P</b> for an automatic fly-through",6000); showKeyHint(4500); } }
 else if(ov.dataset.ready){ ov.style.display='flex'; document.querySelector('#enter .big').textContent='▶ Paused — click to continue'; LD.status('Paused. Click anywhere to continue.'); hint.classList.remove('show'); }});
addEventListener('mousemove',e=>{ if(document.pointerLockElement!==renderer.domElement) return;
 if(guided){ peekYaw=Math.max(-1,Math.min(1,peekYaw-e.movementX*0.0022)); peekPitch=Math.max(-0.6,Math.min(0.6,peekPitch-e.movementY*0.0022));
  peekHold=true; clearTimeout(peekTimer); peekTimer=setTimeout(()=>{peekHold=false;},160); }
 else { yaw-=e.movementX*0.0022; pitch=Math.max(-1.5,Math.min(1.5,pitch-e.movementY*0.0022)); } });
// ---------- touch: guided stick, or free-view twin sticks (no pointer lock) ----------
// Phones never get a locked pointer. Guided is the default: the right thumb follows the fly-through
// route, and a drag anywhere else peeks, then eases back down the hallway. Free View puts a move
// stick on the left and a look stick on the right (the old free roam). F or 4× quadruples walk speed.
// Walking still goes through update(), so the eye stays floor + EYE_HEIGHT.
const TOUCH=matchMedia('(pointer: coarse)').matches||('ontouchstart' in window);
qualityHigh=!TOUCH;
applyPixelRatio();
guided=TOUCH;
document.body.classList.toggle('guided', guided);
document.body.classList.toggle('freeview', !guided);
let keyTimer=0;
function showKeyHint(ms){
 if(TOUCH) return;
 let el=document.getElementById('keyhint');
 if(!el){
  el=document.createElement('div'); el.id='keyhint';
  el.innerHTML='<div class="row wrow"><div class="key"><b>W</b><span>forward</span></div></div>'
   +'<div class="row"><div class="key"><b>A</b><span>left</span></div><div class="key"><b>S</b><span>back</span></div><div class="key"><b>D</b><span>right</span></div></div>'
   +'<div class="mouse">Mouse: look</div>';
  document.body.appendChild(el);
 }
 el.classList.add('show');
 clearTimeout(keyTimer);
 keyTimer=setTimeout(()=>{ el.classList.remove('show'); }, ms==null?4500:ms);
}
CALICO.showKeyHint=showKeyHint;
let stickX=0, stickY=0;   // -1..1, x = strafe right, y = forward
function enterTouch(){
 ov.style.display='none';
 if(!entered){ entered=true; showHint(guided?'Guided: push forward to follow the tunnel<br>Drag to peek · 4× walks faster':'Free View: left stick moves, right stick looks. Tap Guided to go back to auto-steer.',7000); }
}
if(TOUCH){
 document.body.classList.add('touch');
 const big=document.querySelector('#enter .big'), ctl=document.querySelector('#enter .ctl');
 if(big) big.textContent='▶ Tap to enter';
 if(ctl) ctl.innerHTML='<b>Guided</b> follows the tunnel · <b>Free View</b> for two sticks · <b>4×</b> walks faster';
 const ui=document.createElement('div'); ui.id='touchui';
 ui.innerHTML='<div id="stick"><div class="pad"><div class="knob"></div></div></div>'+
  '<div id="lookstick"><div class="pad"><div class="knob"></div></div></div>'+
  '<div id="tbtns"><button type="button" id="tFly" title="Fly">▶</button>'+
  '<button type="button" id="tReset" title="Reset">↺</button><button type="button" id="tLamp" title="Lamp">☀</button>'+
  '<button type="button" id="tFast" title="Walk speed">4×</button><button type="button" id="tMode" title="Steering mode">Guided</button></div>';
 document.body.appendChild(ui);
 const flyBtn=ui.querySelector('#tFly'), lampBtn=ui.querySelector('#tLamp'), fastBtn=ui.querySelector('#tFast'), modeBtn=ui.querySelector('#tMode');
 const STICK_R=26;
 function bindStick(el, onChange){
  const knob=el.querySelector('.knob'); let tid=null;
  const setKnob=(x,y)=>{ knob.style.transform=`translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`; };
  function apply(t){
   const b=el.getBoundingClientRect(), cx=b.left+b.width/2, cy=b.top+b.height/2;
   let dx=t.clientX-cx, dy=t.clientY-cy; const d=Math.hypot(dx,dy)||1, m=Math.min(STICK_R,d);
   const nx=dx/d*m, ny=dy/d*m; setKnob(nx,ny); onChange(nx/STICK_R, -ny/STICK_R);
  }
  function end(id){ if(id!==tid) return; tid=null; setKnob(0,0); onChange(0,0); }
  el.addEventListener('touchstart',e=>{ if(!entered) return; e.preventDefault(); const t=e.changedTouches[0]; tid=t.identifier; apply(t); },{passive:false});
  el.addEventListener('touchmove',e=>{ for(const t of e.changedTouches) if(t.identifier===tid){ e.preventDefault(); apply(t); } },{passive:false});
  el.addEventListener('touchend',e=>{ for(const t of e.changedTouches) end(t.identifier); },{passive:true});
  el.addEventListener('touchcancel',e=>{ for(const t of e.changedTouches) end(t.identifier); },{passive:true});
 }
 bindStick(ui.querySelector('#stick'), (x,y)=>{ stickX=x; stickY=y; });
 bindStick(ui.querySelector('#lookstick'), (x,y)=>{ lookAxisX=x; lookAxisY=y; });
 let lookTid=null, lookX=0, lookY=0;
 const onLookStart=e=>{
  if(!entered||!guided) return;
  for(const t of e.changedTouches){
   if(lookTid!==null) continue;
   lookTid=t.identifier; lookX=t.clientX; lookY=t.clientY; peekHold=true; e.preventDefault();
  }
 };
 const onLookMove=e=>{
  if(lookTid===null||!guided) return;
  for(const t of e.changedTouches) if(t.identifier===lookTid){
   peekYaw=Math.max(-1,Math.min(1,peekYaw-(t.clientX-lookX)*0.004));
   peekPitch=Math.max(-0.55,Math.min(0.55,peekPitch-(t.clientY-lookY)*0.003));
   lookX=t.clientX; lookY=t.clientY; e.preventDefault();
  }
 };
 const onLookEnd=e=>{ for(const t of e.changedTouches) if(t.identifier===lookTid){ lookTid=null; peekHold=false; } };
 renderer.domElement.addEventListener('touchstart',onLookStart,{passive:false});
 renderer.domElement.addEventListener('touchmove',onLookMove,{passive:false});
 renderer.domElement.addEventListener('touchend',onLookEnd,{passive:true});
 renderer.domElement.addEventListener('touchcancel',onLookEnd,{passive:true});
 function syncTouchBtns(){ flyBtn.textContent=auto?'■':'▶'; lampBtn.classList.toggle('off',!lampOn);
  lampBtn.textContent=lampOn?'☀':'○';
  fastBtn.classList.toggle('on',fastWalk); fastBtn.textContent=fastWalk?'4×':'4×';
  modeBtn.classList.toggle('on', guided); modeBtn.classList.toggle('free', !guided);
  modeBtn.textContent=guided?'Guided':'Free'; }
document.addEventListener('touchstart', pokeUi, {passive:true});
 flyBtn.addEventListener('click',()=>{ if(auto) stopAuto(); else startAuto();
  flash(auto?(FLY?'Auto fly-through to the northwest end and back':'Auto fly-through'):'Manual'); syncTouchBtns(); });
 ui.querySelector('#tReset').addEventListener('click',()=>{ reset(); auto=false; resetGuard(); snapLook(); syncTouchBtns(); });
 lampBtn.addEventListener('click',()=>{ lampOn=!lampOn; flash('Headlamp '+(lampOn?'ON':'OFF (flat light)')); syncTouchBtns(); });
 fastBtn.addEventListener('click',()=>{ fastWalk=!fastWalk; flash(fastWalk?'Walking 4×':'Walking normal speed'); syncTouchBtns(); });
 modeBtn.addEventListener('click',()=>{ setGuided(!guided); });
 CALICO.syncTouchBtns=syncTouchBtns;
 syncTouchBtns();
}
function nearestT(){let best=0,bd=1e9;for(let i=0;i<=400;i++){const d=path.getPointAt(i/400).distanceTo(camera.position);if(d<bd){bd=d;best=i/400;}}return best;}
// ---------- soft noclip ----------
// Movement is never hard-blocked. Before this change, a few stray LiDAR noise points stopped the player dead.
// Instead we track whether the player is in valid space, i.e. inside the mine, and ease them back if they
// stay outside it for OUT_GRACE seconds.
// Wall: a 10 cm voxel counts as wall only if its 50 cm (5x5x5 voxel) neighbourhood has at least WALL_MIN
//   occupied voxels. Rock surfaces fill about 25 or more of those; isolated noise fills 1 to 10, so it is ignored.
// Inside: rays in 26 directions from the player. Inside the tunnel nearly all of them (26/26 measured
//   along the whole tunnel) hit a wall within RAY_MAX. Outside the rock shell, or under the floor,
//   at most about half do (7 to 14 measured). A spot is valid if at least ENCL_MIN rays hit.
// Portal: at the mine entrance, rays escape out of the portal, so there a spot within 4 m of the first few
//   metres of the centreline also counts as valid if that centreline point sees it without crossing a wall.
// Note: the centreline in meta.js drifts about 1 m outside the rock between ~65 and 85 m, so it is not
//   used as the main in/out test.
const WALL_MIN=18, OUT_GRACE=2.0, CHECK_DT=0.1, RAY_MAX=12.0, ENCL_MIN=20, SKIN=0.15;
const ikey=(i,j,k)=>((i+2000)*4096+(j+2000))*4096+(k+2000);
const wallCache=new Map();
function isWall(x,y,z){ const i=Math.floor(x/OCC), j=Math.floor(y/OCC), k=Math.floor(z/OCC), key=ikey(i,j,k);
 if(!occ.has(key)) return false; let v=wallCache.get(key); if(v!==undefined) return v; let c=0;
 for(let a=-2;a<=2;a++)for(let b=-2;b<=2;b++)for(let d=-2;d<=2;d++) if(occ.has(ikey(i+a,j+b,k+d))) c++;
 v=c>=WALL_MIN; wallCache.set(key,v); return v; }
const DIRS=[]; for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)for(let c=-1;c<=1;c++) if(a||b||c){ const l=Math.hypot(a,b,c); DIRS.push([a/l,b/l,c/l]); }
function enclosure(p){ let h=0; for(const d of DIRS){ for(let r=SKIN;r<=RAY_MAX;r+=0.05){ if(isWall(p.x+d[0]*r,p.y+d[1]*r,p.z+d[2]*r)){h++;break;} } } return h; }
const CL=[]; { const n=Math.ceil(pathLen/0.25); for(let i=0;i<=n;i++) CL.push(path.getPointAt(i/n)); }
function nearestCL(p){ let bi=0,bd=1e18; for(let i=0;i<CL.length;i++){const d=CL[i].distanceToSquared(p); if(d<bd){bd=d;bi=i;}} return bi; }
const losV=new THREE.Vector3();
function losClear(a,p){ const d=a.distanceTo(p), end=d-SKIN; if(end<=0) return true; const n=Math.ceil(end/0.05);
 for(let s=1;s<=n;s++){ losV.lerpVectors(a,p,(s/n)*end/d); if(isWall(losV.x,losV.y,losV.z)) return false; } return true; }
function inValidSpace(p){
 if(p.x<bmin.x-2||p.y<bmin.y-2||p.z<bmin.z-2||p.x>bmin.x+ext.x+2||p.y>bmin.y+ext.y+2||p.z>bmin.z+ext.z+2) return false;
 if(enclosure(p)>=ENCL_MIN) return true;
 for(let j=0;j<=16&&j<CL.length;j+=2) if(CL[j].distanceTo(p)<4 && losClear(CL[j],p)) return true;   // portal zone (first 4 m)
 return false; }
function nearestValid(p){ const idx=CL.map((c,i)=>i).sort((a,b)=>CL[a].distanceToSquared(p)-CL[b].distanceToSquared(p));
 for(let k=0;k<Math.min(60,idx.length);k++){ if(inValidSpace(CL[idx[k]])) return CL[idx[k]].clone(); } return null; }
let keepIn=true, outT=0, chkT=0, curValid=true, pull=null; const lastGood=new THREE.Vector3();
function resetGuard(){ outT=0; chkT=0; curValid=true; pull=null; lastGood.copy(camera.position); }
function guard(dt){
 if(pull){ pull.t+=dt; const u=Math.min(1,pull.t/pull.dur), e=u*u*(3-2*u); camera.position.lerpVectors(pull.from,pull.to,e);
  if(u>=1){ pull=null; outT=0; curValid=true; chkT=CHECK_DT; } return; }
 chkT-=dt; if(chkT<=0){ chkT=CHECK_DT; curValid=inValidSpace(camera.position); if(curValid) lastGood.copy(camera.position); }
 if(curValid||!keepIn){ outT=0; return; }
 outT+=dt;
 if(outT>=OUT_GRACE){ let to=lastGood.clone(); if(!inValidSpace(to)) to=nearestValid(camera.position)||(reset(),camera.position.clone());
  pull={from:camera.position.clone(),to,t:0,dur:Math.min(1.0,0.5+0.1*to.distanceTo(camera.position))}; flash('Back inside the mine'); }
}
// ---------- eye height (floor + 1.635 m) ----------
// The handheld GeoSLAM was carried at about waist height. The meta.js survey path is not the raw scanner track:
// build.py set it to floor + PATH_EYE (1.40 m), capped at ceiling - 0.35 m and smoothed. Before this change the camera sat
// on that path (start pose, R, P fly-through) and then flew freely with no floor following at all.
// Now the eye sits EYE_HEIGHT above the tunnel floor (1.635 m, about 2.5 inches below a 6 ft eye), measured from the actual
// up-facing points directly under the viewer (the lowest dense 10 cm band within 0.5 m). It is never taken from a fixed
// or zero elevation, so a rising floor lifts the eye with it. The ceiling is the underside of the dominant roof above
// that floor, not a stray ledge: the eye ducks to ceiling - HEAD_CLEAR only when that roof is too low to stand under.
// The floor profile is a moving average over FLOOR_SPAN metres of travel (about 8 ft): a gentle ramp, not a
// foot-by-foot step. On a normal floor the commanded height, and the camera after the spring, change by at most
// about 2 cm per 0.3 m. A low ceiling (roof under 1.85 m above the floor) may drop the eye faster, down to
// ceiling - HEAD_CLEAR. The critically damped spring (EYE_OMEGA) still glides on top of that command.
// Voxel probes and the tunnel.js stations are only a fallback where the point grid has no floor.
// Space/E and Shift/Q still fly up and down: they add an offset (hOff) on top of the floor-following eye height.
// If no floor is found (outside the rock shell), the height is held.
// (TUN, routeProj: defined further down; only used at run time.)
const EYE_HEIGHT=1.635, HEAD_CLEAR=0.15, PATH_EYE=1.40, EYE_MIN=0.5, FLOOR_SCAN=2.6, CEIL_SCAN=3.5;
const EYE_OMEGA=7.0, FLOOR_SPAN=2.6, EYE_RATE=0.02/0.30, LOOK_RATE=12, LOOK_RATE_AUTO=2.2, ACCEL_RATE=4.5;
const EYE_COLS=[[0,0],[0.2,0],[-0.2,0],[0,0.2],[0,-0.2]], TUN=CALICO.tunnel||null;
const FLYP=TUN?TUN.fly.map(p=>new THREE.Vector3().fromArray(p)):[], FLYS=[0];   // route polyline + horizontal distance along it
for(let i=1;i<FLYP.length;i++) FLYS.push(FLYS[i-1]+Math.hypot(FLYP[i].x-FLYP[i-1].x,FLYP[i].z-FLYP[i-1].z));
let eyeY=0, eyeV=0, eyeCmd=null, eyePrev=0, eyeMark=null, hOff=0, hVel=0, odo=0;
const vel=new THREE.Vector3(), eyeBuf=[], lastXZ=new THREE.Vector2();
function med(a){ a=a.slice().sort((x,y)=>x-y); return a[a.length>>1]; }
function floorCeil(x,z,yRef){ const F=[],C=[];
 for(const [dx,dz] of EYE_COLS){ const cx=x+dx, cz=z+dz; let f=null, free=false;
  for(let y=yRef; y>=yRef-FLOOR_SCAN; y-=0.05){ if(!isWall(cx,y,cz)) free=true; else if(free){ f=y; break; } }
  if(f===null) continue; F.push(f);
  for(let y=f+EYE_MIN; y<=f+CEIL_SCAN; y+=0.05) if(isWall(cx,y,cz)){ C.push(y); break; } }
 if(F.length<3) return null;
 return {floor:med(F), ceil:C.length>=3?med(C):null}; }
// Fallback only where the point grid has no floor (the open portal). Within 1 m of the centreline the
// tunnel.js 1 ft stations are the same point-derived floor and ceiling, median-filtered along the route.
function stationFC(x,z){ if(!TUN||!TUN.stations) return null; const r=routeProj({x,z}); if(r.d>1.0) return null;
 const S=TUN.stations, i=Math.max(0,Math.min(S.floor.length-1,Math.round(r.s/0.3048))); return {floor:S.floor[i],ceil:S.ceil[i]}; }
// Lowest dense up-facing band within 0.5 m, and the bottom of the dominant roof above it.
function pointFC(x,z){ const ix=Math.round(x/FCELL), iz=Math.round(z/FCELL);
 const up=new Uint32Array(FYN), dn=new Uint32Array(FYN); let any=false;
 for(let dx=-2;dx<=2;dx++) for(let dz=-2;dz<=2;dz++){ const cx=(ix+dx)*FCELL, cz=(iz+dz)*FCELL;
  if((cx-x)*(cx-x)+(cz-z)*(cz-z)>0.25) continue; const h=fgrid.get((ix+dx)*100000+(iz+dz)); if(!h) continue; any=true;
  for(let i=0;i<FYN;i++){ up[i]+=h[i]; dn[i]+=h[FYN+i]; } }
 if(!any) return null;
 let peakUp=0; for(let i=0;i<FYN;i++) if(up[i]>peakUp) peakUp=up[i];
 const needUp=Math.max(40,peakUp*0.12); let floor=null;
 for(let i=0;i<FYN;i++) if(up[i]>=needUp){ floor=FY0+i*0.1; break; }
 if(floor===null) return null;
 let ceil=null, peakI=-1, peakDn=0;
 for(let i=0;i<FYN;i++) if(FY0+i*0.1>=floor+0.85&&dn[i]>peakDn){ peakDn=dn[i]; peakI=i; }
 if(peakI>=0){ const needDn=Math.max(80,peakDn*0.2); let c=peakI;
  while(c>0&&FY0+(c-1)*0.1>=floor+0.85&&dn[c-1]>=needDn) c--; ceil=FY0+c*0.1; }
 return {floor, ceil}; }
function fcAt(x,z,yRef){ return pointFC(x,z)||stationFC(x,z)||floorCeil(x,z,yRef); }
function eyeFrom(floor,ceil){ let y=floor+EYE_HEIGHT; if(ceil!==null) y=Math.min(y,ceil-HEAD_CLEAR); return Math.max(y,floor+EYE_MIN); }
function eyeTarget(x,z,yRef){ const fc=fcAt(x,z,yRef); return fc?eyeFrom(fc.floor,fc.ceil):null; }
// A one-foot notch in the roof is not a duck: require several samples in the travel window.
function sustainedCeil(s){ let n=0, c=null;
 for(const b of eyeBuf){ if(Math.abs(b.s-s)>0.55||b.c===null||b.c-b.f>=1.85) continue; n++; c=c===null?b.c:Math.min(c,b.c); }
 return n>=3?c:null; }
// Box average of the floor (and the roof) over the last/next half of FLOOR_SPAN. A step in the raw floor
// becomes a ramp about 8 ft long.
function avgNear(s){ const half=FLOOR_SPAN*0.5; let sf=0,nf=0,sc=0,nc=0;
 for(const b of eyeBuf){ if(Math.abs(b.s-s)>half) continue; sf+=b.f; nf++; if(b.c!==null){ sc+=b.c; nc++; } }
 if(!nf) return null; return {floor:sf/nf, ceil:nc?sc/nc:null}; }
function feedPoints(pts, sNow){
 for(const p of pts){ let have=false; for(const b of eyeBuf) if(Math.abs(b.s-p.s)<0.12){ have=true; break; } if(have) continue;
  const fc=fcAt(p.x,p.z,p.y); if(fc) eyeBuf.push({s:p.s,f:fc.floor,c:fc.ceil}); }
 eyeBuf.sort((a,b)=>a.s-b.s);
 while(eyeBuf.length&&eyeBuf[0].s<sNow-FLOOR_SPAN) eyeBuf.shift(); }
function spanPoints(s,x,z,dx,dz,yRef){ const half=FLOOR_SPAN*0.5, pts=[];
 for(let d=-half;d<=half+1e-9;d+=0.28) pts.push({s:s+d,x:x+dx*d,z:z+dz*d,y:yRef}); return pts; }
// Rate-limit the smoothed standing height. A low roof may pull the command down immediately.
function commandEye(travelS, moved, x, z, yRef){
 const sm=avgNear(travelS), now=fcAt(x,z,yRef);
 if(!sm&&!now) return {cmd:eyeCmd, duck:false, now};
 const floor=sm?sm.floor:now.floor;
 let stand=floor+EYE_HEIGHT;
 const lowC=sustainedCeil(travelS);
 const here=now&&now.ceil!==null&&now.ceil-now.floor<1.85;
 const duck=!!(here&&lowC!==null);   // only while actually under a roof that stays low, not one noisy foot
 if(duck) stand=Math.min(stand, lowC-HEAD_CLEAR);
 let cmd=eyeCmd===null?stand:eyeCmd;
 const allow=EYE_RATE*Math.max(0,moved);
 if(duck && stand<cmd) cmd=stand;   // a real low roof may pull the eye down faster than the ramp
 else if(stand>cmd) cmd=Math.min(stand, cmd+allow);
 else cmd=Math.max(stand, cmd-allow);
 if(!duck && now) cmd=Math.max(cmd, now.floor+1.40);
 if(duck && now && now.ceil!==null) cmd=Math.min(cmd, now.ceil-0.05);
 eyeCmd=cmd; return {cmd, duck, now}; }
function glideTo(cmd, dt, moved, duck){
 if(cmd===null) return;
 if(dt>0){ eyeV+=(EYE_OMEGA*EYE_OMEGA*(cmd-eyeY)-2*EYE_OMEGA*eyeV)*dt; eyeY+=eyeV*dt; }
 else { eyeY=cmd; eyeV=0; }
 if(!duck && moved>0){ const cap=EYE_RATE*moved+1e-4, lo=eyePrev-cap, hi=eyePrev+cap;
  if(eyeY>hi){ eyeY=hi; eyeV=Math.min(eyeV,0); } if(eyeY<lo){ eyeY=lo; eyeV=Math.max(eyeV,0); } }
 eyePrev=eyeY; }
function snapEye(){ eyeBuf.length=0; eyeV=0; eyeCmd=null; eyeMark=null; hOff=0; hVel=0; vel.set(0,0,0);
 eyeY=camera.position.y; eyePrev=eyeY; lastXZ.set(camera.position.x,camera.position.z); }
function followEye(dt){
 const p=camera.position, step=lastXZ.distanceTo(new THREE.Vector2(p.x,p.z));
 odo+=step; lastXZ.set(p.x,p.z);
 const sp=Math.hypot(vel.x,vel.z);
 const dx=sp>0.15?vel.x/sp:-Math.sin(lookYaw), dz=sp>0.15?vel.z/sp:-Math.cos(lookYaw);
 feedPoints(spanPoints(odo,p.x,p.z,dx,dz,eyeY), odo);
 const moved=eyeMark===null?0:Math.max(0,odo-eyeMark); eyeMark=odo;
 const r=commandEye(odo, moved, p.x, p.z, eyeY);
 glideTo(r.cmd, dt, moved, r.duck);
 if(r.now&&r.now.ceil!==null&&r.duck&&eyeY>r.now.ceil-0.05){ eyeY=r.now.ceil-0.05; eyeV=Math.min(eyeV,0); eyePrev=eyeY; }
 p.y=eyeY+hOff; }
function poseAt(t){ const p=path.getPointAt(Math.min(t,1)); const q=path.getPointAt(Math.min(t+3.0/pathLen,1));
 if(t>=1){const a=path.getPointAt(0.995);q.copy(p).add(p.clone().sub(a).normalize());}
 const tg=eyeTarget(p.x,p.z,p.y), dy=tg===null?EYE_HEIGHT-PATH_EYE:tg-p.y;   // fallback: path y - 1.40 m + 1.635 m
 p.y+=dy; q.y+=dy; camera.position.copy(p); lookAt(q); pitch-=0.05; snapEye(); snapLook(); }
function snapLook(){ lookYaw=yaw; lookPitch=pitch; }
function easeLook(dt,rate){ if(!(dt>0)){ snapLook(); return; } const k=1-Math.exp(-dt*rate);
 let d=yaw-lookYaw; d=Math.atan2(Math.sin(d),Math.cos(d)); lookYaw+=d*k; lookPitch+=(pitch-lookPitch)*k; }

// ---------- P fly-through: portal -> northwest end -> back to the portal ----------
// Starts from CALICO.tunnel (data/tunnel.js): the smoothed centreline of the main drift. Once the point cloud is in,
// retargetNorthwest() walks the open-tunnel graph and replaces the last stretch so the flight ends at the reachable
// dead-end farthest toward the northwest (maximum north + west, using TUNNEL_BEARING_DEG). Height is unchanged:
// smoothed floor + 1.635 m, then the steadicam spring, ducked only when the roof is too low. The stored polyline
// was generated at TUN.eye (1.66 m) and is only a fallback where those points are missing. Speed eases
// in and out (FLY_ACC), slows to a stop at the end, pauses while the view pans round, then returns.
// Without tunnel.js it falls back to the old meta.js path (raised to eye height).
const FLY_ACC=0.45, FLY_DWELL=3.5;
let FLY=TUN&&TUN.fly&&TUN.fly.length>3?new THREE.CatmullRomCurve3(TUN.fly.map(p=>new THREE.Vector3().fromArray(p)),false,'centripetal'):null;
let FLY_LEN=FLY?FLY.getLength():0;
const flyAt=d=>FLY.getPointAt(Math.max(0,Math.min(1,d/FLY_LEN)));
let flyD=0, flyV=0, flyDwell=0, flyBlend=1; const flyFrom=new THREE.Vector3(), flyQ=new THREE.Vector3();
function nearestFlyD(p){ let best=0,bd=1e18; for(let i=0;i<=600;i++){ const q=flyAt(i/600*FLY_LEN), d=(q.x-p.x)**2+(q.z-p.z)**2+0.3*(q.y-p.y)**2; if(d<bd){bd=d;best=i/600*FLY_LEN;} } return best; }
function startAuto(){ auto=true; if(!FLY){ autoT=nearestT(); return; }
 flyD=nearestFlyD(camera.position); if(flyD>FLY_LEN-1) flyD=2*FLY_LEN-flyD;   // at the chamber already: head back
 flyV=0; flyDwell=0; flyBlend=0; flyFrom.copy(camera.position);
 eyeBuf.length=0; eyeMark=null; eyeV=0; }   // fresh travel window; keep the current eye height
function stopAuto(){ auto=false; snapEye(); }
function flyStep(dt){
 const L=FLY_LEN, out=flyD<L, stopAt=out?L:2*L;
 if(flyD>=L-0.02&&flyD<L+0.02&&flyDwell<FLY_DWELL){ flyDwell+=dt; flyV=0; if(flyDwell>=FLY_DWELL) flyD=L+0.021; }
 else { const vt=Math.min(speed,Math.sqrt(2*FLY_ACC*Math.max(0,stopAt-flyD))+0.03);
  flyV+=Math.max(-2*FLY_ACC*dt,Math.min(FLY_ACC*dt,vt-flyV)); flyD=Math.min(stopAt,flyD+flyV*dt); }
 const back=flyD>L||(flyD>=L-0.02&&flyDwell>=FLY_DWELL*0.25), s=flyD>L?2*L-flyD:flyD;
 const p=flyAt(s);
 const gen=(TUN&&typeof TUN.eye==='number')?TUN.eye:EYE_HEIGHT, yRef=p.y+(EYE_HEIGHT-gen);
 const half=FLOOR_SPAN*0.5, pts=[];
 for(let d=-half;d<=half+1e-9;d+=0.28){ const fd=flyD+d; if(fd<0||fd>2*L) continue;
  const along=fd>L?2*L-fd:fd, q=flyAt(along); pts.push({s:fd,x:q.x,z:q.z,y:yRef}); }
 feedPoints(pts, flyD);
 const moved=eyeMark===null?0:Math.max(0,flyD-eyeMark); eyeMark=flyD;
 const r=commandEye(flyD, moved, p.x, p.z, yRef);
 if(r.cmd===null) p.y+=EYE_HEIGHT-gen;   // no floor points here: keep the centreline, shifted up to 1.635 m
 else { glideTo(r.cmd, dt, moved, r.duck); if(r.duck&&r.now&&r.now.ceil!==null&&eyeY>r.now.ceil-0.05){ eyeY=r.now.ceil-0.05; eyeV=Math.min(eyeV,0); eyePrev=eyeY; } p.y=eyeY; }
 let qs=back?s-3:s+3; flyQ.copy(flyAt(qs));
 if(flyQ.distanceTo(p)<0.5){ const a=flyAt(back?s+1:s-1); flyQ.copy(p).add(p.clone().sub(a).normalize()); }
 flyQ.y=p.y-0.15;
 if(flyBlend<1){ flyBlend=Math.min(1,flyBlend+dt/2.0); const e=flyBlend*flyBlend*(3-2*flyBlend); const y=p.y; p.lerpVectors(flyFrom,p,e); p.y=y; }
 camera.position.copy(p); lookAt(flyQ); eyeY=p.y; hOff=0; if(r.cmd===null){ eyeV=0; eyePrev=eyeY; } vel.set(0,0,0);
 if(flyD>=2*L-0.01){ auto=false; snapEye(); flash('Fly-through finished, back at the portal'); } }
reset();

CALICO.poseAt=t=>{poseAt(t);}; CALICO.pathLen=pathLen; CALICO.reset=reset; CALICO.validHere=()=>inValidSpace(camera.position);
CALICO.setPose=(p,l)=>{camera.position.fromArray(p);lookAt(new THREE.Vector3().fromArray(l));snapEye();snapLook();};
CALICO.eye={floorCeil:(x,z,y)=>floorCeil(x,z,y),pointFloor:(x,z)=>pointFC(x,z),target:(x,z,y)=>eyeTarget(x,z,y),state:()=>({eyeY,eyeV,hOff,flyD,flyV,auto}),EYE_HEIGHT,HEAD_CLEAR,get flyLen(){return FLY_LEN;}};
CALICO.touch={on:TOUCH,stick:()=>({x:stickX,y:stickY}),look:()=>({yaw,pitch})};
CALICO.renderNow=()=>{update(0);drawMini();renderer.render(scene,camera);};
CALICO.toggleMesh=(on,cb)=>loadMesh(()=>{mesh.visible=on;group.visible=!on;cb&&cb();});
CALICO.setLamp=v=>{lampOn=v;};

const fwd=new THREE.Vector3(), right=new THREE.Vector3(), mv=new THREE.Vector3();
// Guided steering follows the same polyline as P. Forward/back ride that centreline; the view eases
// onto its tangent (the fly-through's look-ahead) so the hallway stays in front of the camera. Near the
// northwest end the look turns back into the chamber instead of into the end wall. A small side nudge
// is allowed, then a spring returns to the centreline. Peek offsets decay on their own.
const GUIDE_NUDGE=0.45;
let yawKey='', yawVal=0;
function routeLenM(){ return FLYS.length?FLYS[FLYS.length-1]:0; }
function yawToward(ax,az,bx,bz){ return Math.atan2(-(bx-ax),-(bz-az)); }
function clearRay(x,y,z,yw,max){ const fx=-Math.sin(yw), fz=-Math.cos(yw);
 for(let r=0.2;r<=max;r+=0.1) if(isWall(x+fx*r,y,z+fz*r)) return r; return max; }
// Same idea as the fly-through: look ahead along the polyline. A chord through a bend can point at
// rock, so small (then larger) yaw offsets are tried until the hallway in front is open. In the last
// few metres a clear look back into the chamber is preferred over the end wall.
function guideYawAt(s, eyeY){
 const L=routeLenM(); if(!(L>1)) return yaw;
 const y=eyeY!=null?eyeY:camera.position.y;
 const key=Math.round(s*5)+'|'+Math.round(y*4);
 if(key===yawKey) return yawVal;
 const here=routeAt(Math.max(0,Math.min(L,s)));
 const tang=yawToward(here.x,here.z,routeAt(Math.min(L,s+0.8)).x,routeAt(Math.min(L,s+0.8)).z);
 const aims=[tang];
 for(const ahead of [2.2,3.2]){ const q=routeAt(Math.min(L,s+ahead));
  if(Math.hypot(q.x-here.x,q.z-here.z)>0.35) aims.push(yawToward(here.x,here.z,q.x,q.z)); }
 const near=L-s<6;
 if(near){ for(const back of [2.5,4.5,7]){ const q=routeAt(Math.max(0,s-back));
  if(Math.hypot(q.x-here.x,q.z-here.z)>0.35) aims.push(yawToward(here.x,here.z,q.x,q.z)); } }
 const offs=[0,0.14,-0.14,0.28,-0.28,0.5,-0.5,0.75,-0.75,1.05,-1.05,1.25,-1.25];
 let bestY=tang, bestS=-1e9;
 for(const aim of aims) for(const off of offs){
  const yw=aim+off, c=clearRay(here.x,y,here.z,yw,5);
  let d=yw-tang; d=Math.abs(Math.atan2(Math.sin(d),Math.cos(d)));
  const back=near&&L-s<3.5&&d>1.15&&c>=1.7?4:0;
  const sc=(c>=1.65?12+Math.min(c,4):c)-d*1.35+back-Math.abs(off)*0.25;
  if(sc>bestS){ bestS=sc; bestY=yw; }
 }
 yawKey=key; yawVal=bestY; return bestY; }
function setGuided(on){
 const prev=guided;
 guided=!!on; document.body.classList.toggle('guided', guided); document.body.classList.toggle('freeview', !guided);
 if(!TOUCH && entered && prev!==guided) showKeyHint(2600);
 stickX=0; stickY=0; lookAxisX=0; lookAxisY=0; yawKey='';
 if(guided){ guideInited=false; guideOff=0; guideV=0; peekYaw=0; peekPitch=0; peekHold=false;
  flash('Guided: forward follows the tunnel'); }
 else if(TOUCH) showHint('Free View: left stick moves, right stick looks. Tap Guided to go back to auto-steer.',5000);
 else flash('Free view');
 if(CALICO.syncTouchBtns) CALICO.syncTouchBtns();
}
function snapGuide(s){
 setGuided(true);
 const L=routeLenM(), ss=Math.max(0,Math.min(L,+s||0)), p=routeAt(ss);
 const gen=(TUN&&typeof TUN.eye==='number')?TUN.eye:EYE_HEIGHT, tg=eyeTarget(p.x,p.z,p.y);
 const y=tg==null?p.y+(EYE_HEIGHT-gen):tg;
 camera.position.set(p.x,y,p.z);
 guideS=ss; guideInited=true; guideOff=0; guideV=0; peekYaw=0; peekPitch=0; peekHold=false; hOff=0;
 yawKey=''; yaw=guideYawAt(ss,y); pitch=-0.06; snapEye(); snapLook();
}
function clearAhead(max){ const p=camera.position; return clearRay(p.x,p.y,p.z,lookYaw,max==null?8:max); }
function guidedStep(dt){
 const L=routeLenM(); if(!(L>1)) return;
 if(!guideInited){ guideInited=true; guideS=routeProj(camera.position).s; }
 let along=0, nudge=0;
 const sm=Math.hypot(stickX,stickY);
 if(sm>0.16){ const a=Math.min(1,(sm-0.16)/0.84); along+=stickY/sm*a; nudge+=stickX/sm*a; }
 if(keys.KeyW||keys.ArrowUp) along+=1; if(keys.KeyS||keys.ArrowDown) along-=1;
 if(keys.KeyD||keys.ArrowRight) nudge+=1; if(keys.KeyA||keys.ArrowLeft) nudge-=1;
 along=Math.max(-1,Math.min(1,along)); nudge=Math.max(-1,Math.min(1,nudge));
 const sp=speed*(fastWalk?WALK_FAST:1);
 const k=1-Math.exp(-dt*ACCEL_RATE);
 guideV+=(along*sp-guideV)*k;
 guideS=Math.max(0,Math.min(L, guideS+guideV*dt));
 const c=routeAt(guideS), a=routeAt(Math.min(L, guideS+0.8));
 let tx=a.x-c.x, tz=a.z-c.z; const tl=Math.hypot(tx,tz)||1; tx/=tl; tz/=tl;
 const rx=-tz, rz=tx;   // camera-right of the route tangent
 const ty=Math.atan2(-tx,-tz), yEye=camera.position.y;
 const openL=clearRay(c.x,yEye,c.z,ty+Math.PI/2,1.2), openR=clearRay(c.x,yEye,c.z,ty-Math.PI/2,1.2);
 let bias=0;
 if(openL<0.45&&openR>openL+0.2) bias=Math.min(0.35,0.45-openL);
 else if(openR<0.45&&openL>openR+0.2) bias=-Math.min(0.35,0.45-openR);
 guideOff+=(nudge*GUIDE_NUDGE+bias-guideOff)*(1-Math.exp(-dt*4));
 const desX=c.x+rx*guideOff, desZ=c.z+rz*guideOff;
 const pull=1-Math.exp(-dt*3.5);
 camera.position.x+=(desX-camera.position.x)*pull;
 camera.position.z+=(desZ-camera.position.z)*pull;
 const lat=(camera.position.x-c.x)*rx+(camera.position.z-c.z)*rz;
 if(Math.abs(lat)>0.75){ camera.position.x+=(desX-camera.position.x)*0.4; camera.position.z+=(desZ-camera.position.z)*0.4; }
 vel.set(tx*guideV, 0, tz*guideV);
 if(keys.KeyE||keys.Space) hVel+=(1-hVel)*k; else if(keys.KeyQ||keys.ShiftLeft||keys.ShiftRight) hVel+=(-1-hVel)*k; else hVel*=Math.exp(-dt*3);
 hOff+=hVel*dt;
 followEye(dt);
 if(!peekHold){ const decay=Math.exp(-dt*2.6); peekYaw*=decay; peekPitch*=decay; }
 yaw=guideYawAt(guideS, camera.position.y)+peekYaw;
 pitch=Math.max(-1.05,Math.min(0.9, -0.06+peekPitch));
 guard(dt);
}
function update(dt){
 if(auto&&dt>0){ if(FLY) flyStep(dt); else { autoT+=dt*speed/pathLen; if(autoT>=1){autoT=1;auto=false;} poseAt(autoT); } resetGuard(); }
 else if(guided&&dt>0) guidedStep(dt);
 if(!guided && !auto && dt>0 && (Math.abs(lookAxisX)>0.12||Math.abs(lookAxisY)>0.12)){
  yaw-=lookAxisX*1.8*dt; pitch=Math.max(-1.2,Math.min(1.2, pitch+lookAxisY*1.3*dt)); }
 easeLook(dt, auto?LOOK_RATE_AUTO:(guided?4.5:LOOK_RATE));
 camera.rotation.set(lookPitch,lookYaw,0);
 if(!auto && !guided && dt>0){
  fwd.set(-Math.sin(lookYaw),0,-Math.cos(lookYaw)); right.set(Math.cos(lookYaw),0,-Math.sin(lookYaw)); mv.set(0,0,0);
  if(keys.KeyW||keys.ArrowUp)mv.add(fwd); if(keys.KeyS||keys.ArrowDown)mv.sub(fwd);
  if(keys.KeyD||keys.ArrowRight)mv.add(right); if(keys.KeyA||keys.ArrowLeft)mv.sub(right);
  const sm=Math.hypot(stickX,stickY);   // free view: left stick, camera-relative, same floor following
  if(sm>0.16){ const a=Math.min(1,(sm-0.16)/0.84); mv.addScaledVector(fwd,stickY/sm*a); mv.addScaledVector(right,stickX/sm*a); }
  if(keys.KeyE||keys.Space)mv.y+=1; if(keys.KeyQ||keys.ShiftLeft||keys.ShiftRight)mv.y-=1;
  if(mv.lengthSq()>0){
   const keyed=keys.KeyW||keys.ArrowUp||keys.KeyS||keys.ArrowDown||keys.KeyA||keys.ArrowLeft||keys.KeyD||keys.ArrowRight||keys.KeyE||keys.Space||keys.KeyQ||keys.ShiftLeft||keys.ShiftRight;
   mv.normalize().multiplyScalar(speed*(keyed?1:Math.min(1,sm)));
   if(fastWalk){ mv.x*=WALK_FAST; mv.z*=WALK_FAST; }   // 4× walk; up/down (Space/Shift) stays at the base speed
  }
  // gentle acceleration / deceleration (exponential approach to the key velocity)
  const k=1-Math.exp(-dt*ACCEL_RATE); vel.x+=(mv.x-vel.x)*k; vel.z+=(mv.z-vel.z)*k; hVel+=(mv.y-hVel)*k;
  if(pull){ vel.set(0,0,0); hVel=0; eyeY=camera.position.y; eyePrev=eyeY; eyeCmd=null; eyeMark=null; hOff=0; eyeBuf.length=0; eyeV=0; }
  else { camera.position.x+=vel.x*dt; camera.position.z+=vel.z*dt; hOff+=hVel*dt; followEye(dt); }   // eye = floor + 1.635 m (+ Space/Shift offset)
  guard(dt);
 }
 if(TOUCH&&entered){ const moving=Math.hypot(vel.x,vel.z)>0.12||Math.abs(guideV)>0.12; if(moving) walkT+=dt; if(walkT>3.2) document.body.classList.add('uidim'); }
 tunnelPanel();
 U.uCam.value.copy(camera.position);
 camera.updateMatrixWorld();
 const d=new THREE.Vector3(); camera.getWorldDirection(d);
 // headlamp aims slightly below the view axis, with a faint breathing flicker
 d.y-=0.08; d.normalize(); U.uDir.value.copy(d);
 U.uLamp.value+= ((lampOn?1:0)-U.uLamp.value)*Math.min(1,dt*8+ (dt===0?1:0));
 U.uFogDist.value=lampOn?38:80;
 const fd=U.uFogDist.value*1.3;
 for(const o of chunkObjs) o.visible=o.userData.c.distanceTo(camera.position)-o.userData.r<fd;
}
// Farthest northwest reachable dead-end. Open cells are 25 cm floor/ceiling columns from the point cloud.
// A dead-end is a cell you cannot walk farther from the portal. Among those, pick maximum north + west
// (north − east) in the same compass frame as the HUD (entrance bearing N17.5°E). The flight follows the
// existing centreline until that branch, then the graph path out to the dead-end.
function retargetNorthwest(){
 if(!TUN||FLYP.length<4||!fgrid.size) return;
 const G=FCELL, N8=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
 const kOf=(ix,iz)=>ix*100000+iz;
 function columnOpen(h){
  let peakUp=0; for(let i=0;i<FYN;i++) if(h[i]>peakUp) peakUp=h[i];
  const needUp=Math.max(8,peakUp*0.1); let floor=null;
  for(let i=0;i<FYN;i++) if(h[i]>=needUp){ floor=FY0+i*0.1; break; }
  if(floor===null) return null;
  let peakI=-1, peakDn=0;
  for(let i=0;i<FYN;i++) if(FY0+i*0.1>=floor+0.7&&h[FYN+i]>peakDn){ peakDn=h[FYN+i]; peakI=i; }
  if(!(peakI>=0&&peakDn>=5)) return null;
  const needDn=Math.max(5,peakDn*0.15); let c=peakI;
  while(c>0&&FY0+(c-1)*0.1>=floor+0.7&&h[FYN+c-1]>=needDn) c--;
  const ceil=FY0+c*0.1, head=ceil-floor;
  if(head<1.05||head>14) return null;
  return {floor,ceil,head};
 }
 const open=new Map();
 for(const h of fgrid.values()){ if(h.ix===undefined) continue; const fc=columnOpen(h); if(!fc) continue;
  open.set(kOf(h.ix,h.iz),{ix:h.ix,iz:h.iz,floor:fc.floor,ceil:fc.ceil,head:fc.head}); }
 let start=null, sd=1e18;
 for(const c of open.values()){ const d=(c.ix*G)**2+(c.iz*G)**2; if(d<sd){ sd=d; start=c; } }
 if(!start) return;
 const comp=new Map(); const q=[start]; comp.set(kOf(start.ix,start.iz),start);
 for(let qi=0;qi<q.length;qi++){ const c=q[qi];
  for(const [dx,dz] of N8){ const k=kOf(c.ix+dx,c.iz+dz); if(comp.has(k)||!open.has(k)) continue;
   const n=open.get(k); comp.set(k,n); q.push(n); } }
 const dist=new Map(), parent=new Map();
 dist.set(kOf(start.ix,start.iz),0); const qq=[start];
 for(let qi=0;qi<qq.length;qi++){ const c=qq[qi], cd=dist.get(kOf(c.ix,c.iz));
  for(const [dx,dz] of N8){ const k=kOf(c.ix+dx,c.iz+dz); if(!comp.has(k)||dist.has(k)) continue;
   dist.set(k,cd+Math.hypot(dx,dz)*G); parent.set(k,kOf(c.ix,c.iz)); qq.push(comp.get(k)); } }
 function nw(x,z){ const d=Math.hypot(x,z), t=(sceneBearing(x,z)-NORTH_OFFSET_DEG)*Math.PI/180;
  const n=d*Math.cos(t), e=d*Math.sin(t); return {d,n,e,score:n-e,brg:(t*180/Math.PI+360)%360}; }
 let best=null, bestS=-1e18;
 for(const c of comp.values()){ const cd=dist.get(kOf(c.ix,c.iz)); if(cd<12) continue; let farther=false;
  for(const [dx,dz] of N8){ const nd=dist.get(kOf(c.ix+dx,c.iz+dz)); if(nd!=null&&nd>cd+0.02){ farther=true; break; } }
  if(farther) continue; const g=nw(c.ix*G,c.iz*G); if(g.score>bestS){ bestS=g.score; best=c; } }
 if(!best) return;
 // The rock-face cell can be too low to stand in. Step back along the route until a 1.635 m eye fits.
 let stand=best, guard=0;
 while(stand&&stand.head<1.75&&guard++<8){ const pk=parent.get(kOf(stand.ix,stand.iz)); const nxt=pk==null?null:comp.get(pk); if(!nxt) break; stand=nxt; }
 best=stand;
 const orig=FLYP.map(p=>p.clone());
 const chain=[]; let cell=best, flyI=0;
 while(cell&&chain.length<80){
  chain.push(cell);
  const x=cell.ix*G, z=cell.iz*G; let bd=1e18, bi=0;
  for(let i=0;i<orig.length;i++){ const d=Math.hypot(orig[i].x-x,orig[i].z-z); if(d<bd){ bd=d; bi=i; } }
  flyI=bi;
  if(bd<0.9&&chain.length>1) break;
  const pk=parent.get(kOf(cell.ix,cell.iz)); cell=pk==null?null:comp.get(pk);
 }
 const eye0=(TUN&&typeof TUN.eye==='number')?TUN.eye:EYE_HEIGHT;
 const pts=orig.slice(0,flyI+1);
 for(let i=chain.length-1;i>=0;i--){ const c=chain[i], x=c.ix*G, z=c.iz*G, prev=pts[pts.length-1];
  if(Math.hypot(prev.x-x,prev.z-z)<0.2) continue;
  pts.push(new THREE.Vector3(x,c.floor+eye0,z)); }
 if(pts.length<4) return;
 FLYP.length=0; for(const p of pts) FLYP.push(p);
 FLYS.length=0; FLYS.push(0);
 for(let i=1;i<FLYP.length;i++) FLYS.push(FLYS[i-1]+Math.hypot(FLYP[i].x-FLYP[i-1].x,FLYP[i].z-FLYP[i-1].z));
 FLY=new THREE.CatmullRomCurve3(FLYP.slice(),false,'centripetal');
 FLY_LEN=FLY.getLength();
 const end=FLYP[FLYP.length-1], g=nw(end.x,end.z), routeM=FLYS[FLYS.length-1];
 FN={x:end.x,z:end.z,floor_y:best.floor,route_m:routeM,route_ft:routeM*3.28084,straight_m:g.d,bearing:g.brg,north_m:g.n,east_m:g.e};
 for(const f of FEATS) if(f.kind==='far_north'){
  f.x=end.x; f.z=end.z; f.floor_y=best.floor; f.dist_ft=Math.round(routeM*3.28084); f.kind='nw_end';
  f.lines=['Northwest end — farthest northwest reachable point',
   `${f.dist_ft} ft (${routeM.toFixed(0)} m) from the portal by tunnel, about N${Math.round(g.brg)}°E`];
 }
 CALICO.nw={x:end.x,z:end.z,floor:best.floor,routeM,routeFt:routeM*3.28084,straightM:g.d,straightFt:g.d*3.28084,bearing:g.brg,northM:g.n,eastM:g.e};
}
function onLoaded(){
 retargetNorthwest();
 buildMiniMap();
 if(CALICO.nw) LD.log('Fly-through retargeted to the northwest end: '+Math.round(CALICO.nw.routeFt)+' ft along the tunnel, '+Math.round(CALICO.nw.straightFt)+' ft from the portal at about N'+Math.round(CALICO.nw.bearing)+'°E.','ok');
 LD.done(); if(!entered) reset(); update(0); renderer.render(scene,camera);
 LD.log(`Headlamp on, scene ready — ${(loadedPts/1e6).toFixed(2)} M points, first frame rendered just inside the portal.`,'ok');
 LD.log(TOUCH?'Ready — tap to enter.':'Ready — click to enter.','ok');
 LD.status(`All ${M.files.length} tunnel sections loaded (${(loadedPts/1e6).toFixed(2)} M points). ${TOUCH?'Tap':'Click'} anywhere to enter.`);
 ov.dataset.ready=1; ov.classList.add('ready');
 CALICO.ready=true; if(qs.has('capture')){ov.style.display='none';document.getElementById('help').style.display='none';document.getElementById('hud').style.display='none';}
}
addEventListener('resize',()=>{camera.aspect=W()/Hh();camera.updateProjectionMatrix();renderer.setSize(W(),Hh());U.uScreen.value=Hh()*renderer.getPixelRatio();});
U.uScreen.value=Hh()*renderer.getPixelRatio(); U.uFov.value=Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*2;
let last=performance.now(), fpsA=60; const hud=document.getElementById('hud');
function loop(now){ requestAnimationFrame(loop); if(qs.has('capture')) return;
 const dt=Math.min(0.1,(now-last)/1000); last=now; fpsA=fpsA*0.95+0.05/Math.max(dt,1e-3); U.uTime.value=now/1000;
 update(dt); drawMini(); renderer.render(scene,camera);
 if(msgT>0)msgT-=dt;
 navHud();
 const p=camera.position, o=M.origin_las;
 hud.textContent=`${(loadedPts/1e6).toFixed(2)} M pts   ${fpsA.toFixed(0)} fps   speed ${(speed*(fastWalk?WALK_FAST:1)).toFixed(1)} m/s${fastWalk?'  4×':''}   noclip, keep-inside ${keepIn?'on':'off'}   lamp ${lampOn?'on':'off'}\n`+
  `LAS xyz  ${(p.x+o[0]).toFixed(2)}, ${(-p.z+o[1]).toFixed(2)}, ${(p.y+o[2]).toFixed(2)}`+(keepIn&&!curValid&&!pull&&outT>0.3?`
Outside the tunnel: pulling you back in ${Math.max(0,OUT_GRACE-outT).toFixed(1)} s`:'')+(msgT>0?`
${msg}`:'');}
// ---------- nav HUD: distance from the portal along the centreline + approximate compass ----------
// Silver King Mine, Calico. The scan is in a local SLAM frame with no true north. Mike Murrey confirmed that
// the adit runs into the hill at about N15-20°E, so we take TUNNEL_BEARING_DEG=17.5 as the true bearing of the
// first 10 m of the centreline from the portal, and derive the north offset from it. NORTH_OFFSET_DEG is the
// scene bearing of true north, measured clockwise from scene -Z (LAS +Y) seen from above.
// It works out to about 280°, so true north is roughly scene -X, turned about 10° toward -Z.
// Terrain check (USGS 3DEP 1/3" DEM at the corrected portal 34.951171,-116.863070): the face right at the portal
// (8-15 m) rises toward about 25-30° at a 17-24° slope. The wider hillside (40-60 m) rises toward about 57°. The local face
// roughly agrees with 17.5°, so we keep 17.5° and the 'approx.' label.
const TUNNEL_BEARING_DEG=17.5, PORTAL_LAT=34.951171, PORTAL_LON=-116.863070;   // WGS84, portal = scene origin
const sceneBearing=(x,z)=>(Math.atan2(x,-z)*180/Math.PI+360)%360;
const NORTH_OFFSET_DEG=(()=>{ const a=path.getPointAt(0), b=path.getPointAt(Math.min(1,10/pathLen)); return (sceneBearing(b.x-a.x,b.z-a.z)-TUNNEL_BEARING_DEG+360)%360; })();
function sceneToLatLon(p){ const d=Math.hypot(p.x,p.z), t=(sceneBearing(p.x,p.z)-NORTH_OFFSET_DEG)*Math.PI/180, n=d*Math.cos(t), e=d*Math.sin(t);
 return [PORTAL_LAT+n/111320, PORTAL_LON+e/(111320*Math.cos(PORTAL_LAT*Math.PI/180))]; }
// Top-down map, north up. Footprint is the floor bins; the route, entrance, and northwest end sit on top.
// Open on a desktop, collapsed to a button on a phone so it stays clear of the sticks.
let mapOpen=false, mapReady=false, mapCtx=null, mapBase=null, mapXY=null, mapDest=null;
function neOf(x,z){ const d=Math.hypot(x,z); if(d<1e-6) return {e:0,n:0};
 const t=(sceneBearing(x,z)-NORTH_OFFSET_DEG)*Math.PI/180; return {e:d*Math.sin(t),n:d*Math.cos(t)}; }
function drawMini(){
 if(!mapReady||!mapOpen||!mapCtx) return;
 const W=mapCtx.canvas.width, H=mapCtx.canvas.height;
 mapCtx.setTransform(1,0,0,1,0,0); mapCtx.clearRect(0,0,W,H); mapCtx.drawImage(mapBase,0,0);
 const ne=neOf(camera.position.x,camera.position.z), xy=mapXY(ne.e,ne.n);
 const fx=-Math.sin(lookYaw), fz=-Math.cos(lookYaw), Nr=NORTH_OFFSET_DEG*Math.PI/180;
 const fN=fx*Math.sin(Nr)+fz*(-Math.cos(Nr)), fE=fx*Math.cos(Nr)+fz*Math.sin(Nr);
 const k=Math.max(0.45, W/360);
 mapCtx.save(); mapCtx.translate(xy[0],xy[1]); mapCtx.rotate(Math.atan2(fE,fN));
 mapCtx.beginPath(); mapCtx.moveTo(0,-18*k); mapCtx.lineTo(8*k,10*k); mapCtx.lineTo(-8*k,10*k); mapCtx.closePath();
 mapCtx.fillStyle='rgba(255,214,170,.95)'; mapCtx.fill();
 mapCtx.beginPath(); mapCtx.arc(0,0,5*k,0,Math.PI*2); mapCtx.fillStyle='#fff'; mapCtx.fill();
 mapCtx.restore();
 if(mapDest){ const xy=mapXY(mapDest.e, mapDest.n);
  mapCtx.beginPath(); mapCtx.arc(xy[0],xy[1],8*k,0,Math.PI*2); mapCtx.strokeStyle='#ffd7a8'; mapCtx.lineWidth=Math.max(1.5,3*k); mapCtx.stroke();
  mapCtx.font='700 '+Math.round(15*k)+'px system-ui,Segoe UI,Helvetica,Arial,sans-serif'; mapCtx.fillStyle='#ffd7a8'; mapCtx.textAlign='left';
  const ly=xy[1]<40*k?xy[1]+22*k:xy[1]-12*k; mapCtx.fillText('NW', Math.min(xy[0]+12*k, mapCtx.canvas.width-28*k), ly); }
}
function buildMiniMap(){
 const wrap=document.createElement('div'); wrap.id='mapwrap';
 wrap.innerHTML='<button type="button" id="mapBtn">Map</button><button type="button" id="qBtn">High</button><div id="qpop"><button type="button" data-q="0">Standard</button><button type="button" data-q="1">High</button></div><canvas id="minimap" width="360" height="300"></canvas>';
 document.body.appendChild(wrap);
 const btn=wrap.querySelector('#mapBtn'), qBtn=wrap.querySelector('#qBtn'), qpop=wrap.querySelector('#qpop'), cv=wrap.querySelector('#minimap'), ctx=cv.getContext('2d');
 if(TOUCH){ cv.width=180; cv.height=148; } else { cv.width=360; cv.height=300; }
 const W=cv.width, H=cv.height, cells=[];
 let minE=0, maxE=1, minN=0, maxN=1, seen=false;
 function grow(e,n){ if(!seen){ minE=maxE=e; minN=maxN=n; seen=true; return; }
  if(e<minE)minE=e; if(e>maxE)maxE=e; if(n<minN)minN=n; if(n>maxN)maxN=n; }
 for(const h of fgrid.values()){ if(h.ix===undefined) continue; let up=0; for(let i=0;i<FYN;i++) up+=h[i]; if(up<6) continue;
  const ne=neOf(h.ix*FCELL, h.iz*FCELL); cells.push(ne); grow(ne.e,ne.n); }
 grow(0,0);
 for(const p of FLYP){ const ne=neOf(p.x,p.z); grow(ne.e,ne.n); }
 const padE=Math.max(4,(maxE-minE)*0.08), padN=Math.max(4,(maxN-minN)*0.08);
 minE-=padE; maxE+=padE; minN-=padN; maxN+=padN;
 const pad=TOUCH?12:22, spanE=Math.max(8,maxE-minE), spanN=Math.max(8,maxN-minN);
 const sc=Math.min((W-pad*2)/spanE,(H-pad*2)/spanN);
 const ox=pad+((W-pad*2)-spanE*sc)/2, oy=pad+((H-pad*2)-spanN*sc)/2;
 mapXY=(e,n)=>[ox+(e-minE)*sc, oy+(maxN-n)*sc];
 const base=document.createElement('canvas'); base.width=W; base.height=H; const b=base.getContext('2d');
 b.fillStyle=TOUCH?'rgba(0,0,0,0.5)':'rgba(12,9,7,0.88)'; b.fillRect(0,0,W,H);
 b.fillStyle='rgba(196,154,122,.9)';
 const s=Math.max(1.6, sc*FCELL*0.95);
 for(const c of cells){ const xy=mapXY(c.e,c.n); b.fillRect(xy[0]-s*0.5, xy[1]-s*0.5, s, s); }
 if(FLYP.length>1){ b.beginPath(); FLYP.forEach((p,i)=>{ const ne=neOf(p.x,p.z), xy=mapXY(ne.e,ne.n); if(i) b.lineTo(xy[0],xy[1]); else b.moveTo(xy[0],xy[1]); });
  b.strokeStyle='#e9a066'; b.lineWidth=2.2; b.stroke(); }
 const ent=mapXY(0,0);
 b.beginPath(); b.arc(ent[0],ent[1],6,0,Math.PI*2); b.fillStyle='#7dcea0'; b.fill();
 const lab=TOUCH?11:14;
 b.font='600 '+lab+'px system-ui,Segoe UI,Helvetica,Arial,sans-serif'; b.fillStyle='#b7e6c8'; b.textAlign='left'; b.fillText(TOUCH?'in':'entrance', ent[0]+8, ent[1]+4);
 if(FLYP.length){ const end=FLYP[FLYP.length-1], ne=neOf(end.x,end.z); mapDest=ne; const xy=mapXY(ne.e,ne.n);
  b.beginPath(); b.arc(xy[0],xy[1],7,0,Math.PI*2); b.strokeStyle='#f0b27a'; b.lineWidth=2.5; b.stroke();
  b.fillStyle='#f0b27a'; b.font='700 '+lab+'px system-ui,Segoe UI,Helvetica,Arial,sans-serif'; b.textAlign='left'; b.fillText(TOUCH?'NW':'NW end', xy[0]+8, xy[1]+4); }
 b.fillStyle='#f3c79a'; b.font='700 14px system-ui,Segoe UI,Helvetica,Arial,sans-serif'; b.textAlign='center';
 b.fillText('N', W/2, 16);
 mapBase=base; mapCtx=ctx; mapReady=true; mapOpen=!TOUCH;
 function sync(){ document.body.classList.toggle('mapopen', mapOpen); btn.textContent=mapOpen?'Hide':'Map'; btn.classList.toggle('on', mapOpen); if(mapOpen) drawMini(); }
 btn.addEventListener('click',()=>{ mapOpen=!mapOpen; sync(); pokeUi(); });
 function syncQ(){ qBtn.textContent=qualityHigh?'High':'Std'; qBtn.classList.toggle('on', qualityHigh);
  qpop.querySelectorAll('button').forEach(b=>b.classList.toggle('on', (b.dataset.q==='1')===qualityHigh)); }
 qBtn.addEventListener('click',()=>{ qpop.classList.toggle('open'); pokeUi(); });
 qpop.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{ setQuality(b.dataset.q==='1'); qpop.classList.remove('open'); pokeUi(); }));
 CALICO.syncQuality=syncQ; syncQ();
 CALICO.toggleMap=on=>{ mapOpen=on==null?!mapOpen:!!on; sync(); };
 sync();
}
const navEl=document.createElement('div'); navEl.id='navhud';
navEl.innerHTML='<div class="ttl">Silver King Mine · Calico</div><canvas width="300" height="30"></canvas><div class="hd"></div><div class="dist"></div><div class="ll"></div>';
const navCss=document.createElement('style');
navCss.textContent='#navhud{position:fixed;left:50%;top:10px;transform:translateX(-50%);background:rgba(10,7,5,.55);padding:5px 10px 6px;border-radius:6px;pointer-events:none;z-index:5;text-align:center;font-size:12px;line-height:1.45;color:#e8d8c4}'+
 '#navhud canvas{display:block;width:300px;height:30px}#navhud .hd{opacity:.85;font-size:11.5px}#navhud .dist{font-variant-numeric:tabular-nums;font-size:13px}#navhud .dist b{color:#f0b27a;font-weight:600}#navhud .ttl{font-weight:600;color:#f3c79a;font-size:12.5px;letter-spacing:.03em}#navhud .ll{opacity:.75;font-size:11px;font-variant-numeric:tabular-nums}'+
 'body.hidehelp #navhud{display:none}';
document.head.appendChild(navCss); document.body.appendChild(navEl);
if(qs.has('capture')&&!qs.has('hud')) navEl.style.display='none';
const navCv=navEl.querySelector('canvas'), navCtx=navCv.getContext('2d'), navHd=navEl.querySelector('.hd'), navDist=navEl.querySelector('.dist'), navLL=navEl.querySelector('.ll');
const CL_STEP=pathLen/(CL.length-1);
function distAlongPath(p){ // project onto the nearest centreline segment; cumulative length from the portal (path start)
 const i=nearestCL(p); let best=i*CL_STEP, bd=CL[i].distanceToSquared(p);
 for(const j of [i-1,i]){ if(j<0||j+1>=CL.length) continue; const a=CL[j], ab=new THREE.Vector3().subVectors(CL[j+1],a);
  const t=Math.max(0,Math.min(1,new THREE.Vector3().subVectors(p,a).dot(ab)/ab.lengthSq())); const q=a.clone().addScaledVector(ab,t), d=q.distanceToSquared(p);
  if(d<=bd){bd=d;best=(j+t)*CL_STEP;} }
 return best; }
function headingDeg(){ const fx=-Math.sin(yaw), fz=-Math.cos(yaw); return ((Math.atan2(fx,-fz)*180/Math.PI-NORTH_OFFSET_DEG)%360+360)%360; }
const CARD=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
let navLastH=-1, navLastD=-1;
function drawCompass(h){ const c=navCtx, W=300, H=30, pxPerDeg=W/120; c.clearRect(0,0,W,H); c.font='600 12px system-ui,Segoe UI,Helvetica,Arial,sans-serif'; c.textAlign='center';
 for(let a=Math.ceil((h-62)/15)*15; a<=h+62; a+=15){ const x=W/2+(a-h)*pxPerDeg, n=((a%360)+360)%360, major=n%90===0;
  c.fillStyle=major?'#f0b27a':'rgba(232,216,196,.7)'; c.fillRect(Math.round(x),major?17:(n%45===0?19:22),1,major?11:(n%45===0?9:6));
  if(n%45===0){ c.fillStyle=major?'#f0b27a':'rgba(232,216,196,.8)'; c.fillText(CARD[n/22.5],x,13); } }
 const g=c.createLinearGradient(0,0,W,0); g.addColorStop(0,'rgba(10,7,5,1)'); g.addColorStop(.14,'rgba(10,7,5,0)'); g.addColorStop(.86,'rgba(10,7,5,0)'); g.addColorStop(1,'rgba(10,7,5,1)');
 c.globalCompositeOperation='destination-out'; c.fillStyle=g; c.fillRect(0,0,W,H); c.globalCompositeOperation='source-over';
 c.fillStyle='#fff'; c.beginPath(); c.moveTo(W/2-5,H); c.lineTo(W/2+5,H); c.lineTo(W/2,H-7); c.closePath(); c.fill(); }
function navHud(){ const h=headingDeg(); if(Math.abs(h-navLastH)>0.2){ navLastH=h; drawCompass(h);
  navHd.textContent=`heading ${Math.round(h)%360}° ${CARD[Math.round(h/22.5)%16]} · true north approx.`; }
 const m=distAlongPath(camera.position); if(Math.abs(m-navLastD)>0.01){ navLastD=m;
  navDist.innerHTML=`from entrance <b>${Math.round(m*3.28084)} ft</b> · <b>${m.toFixed(1)} m</b> · <b>${(m/1609.344).toFixed(3)} mi</b>`;
  const ll=sceneToLatLon(camera.position);
  navLL.textContent=`portal ${PORTAL_LAT.toFixed(5)}, ${PORTAL_LON.toFixed(5)} · you ≈ ${ll[0].toFixed(5)}, ${ll[1].toFixed(5)}`; } }
CALICO.navHud=navHud; CALICO.distAlongPath=()=>distAlongPath(camera.position); CALICO.heading=headingDeg; CALICO.northOffset=NORTH_OFFSET_DEG; CALICO.latLon=()=>sceneToLatLon(camera.position);
CALICO.sim={update:u=>update(u),keys,pos:()=>camera.position,setYaw:y=>{yaw=y;},setPitch:p=>{pitch=p;},path,pathLen,reset:()=>{reset();resetGuard();},auto:on=>{if(on)startAuto();else stopAuto();},
 state:()=>pull?'pulling':(curValid?'valid':'out '+outT.toFixed(1)+'s'),setKeepIn:v=>{keepIn=v;},valid:a=>inValidSpace(new THREE.Vector3().fromArray(a)),encl:a=>enclosure(new THREE.Vector3().fromArray(a)),isWall,
 routeAt:s=>{const p=routeAt(s);return{x:p.x,y:p.y,z:p.z};}, get routeLen(){return FLYS.length?FLYS[FLYS.length-1]:0;},
 routeProj:(x,z)=>{const r=routeProj({x,z});return{s:r.s,d:r.d};},
 place:(x,y,z)=>{camera.position.set(x,y,z);snapEye();},
 face:(x,z)=>{lookAt(new THREE.Vector3(x,camera.position.y,z));snapLook();},
 render:()=>{drawMini();renderer.render(scene,camera);},
 setGuided:on=>{setGuided(on);}, guided:()=>guided, snapGuide:s=>{snapGuide(s);}, clearAhead:m=>clearAhead(m)};
// ---------- tunnel-change callouts + northwest-end guide (right-edge panel; hidden with H) ----------
// CALICO.tunnel.features: the major changes along the tunnel (wall steps >= 1.5 ft, floor/ceiling >= 1 ft, low headroom),
// precomputed per 1 ft station by eyeheight/tunnel.py; one is shown while you are within CALLOUT_R (10 ft) of it.
const CALLOUT_R=10*0.3048, NORTH_REACH=4.0, FT_M=3.28084;
const tpEl=document.createElement('div'); tpEl.id='tunpanel'; tpEl.innerHTML='<div class="co"></div><div class="gd"><span class="ar">&#10148;</span><span class="gt"></span></div>';
const tpCss=document.createElement('style');
tpCss.textContent='#tunpanel{position:fixed;right:12px;bottom:10px;max-width:290px;background:rgba(10,7,5,.55);padding:6px 10px;border-radius:6px;pointer-events:none;z-index:5;font-size:12px;line-height:1.5;color:#e8d8c4;display:none}'+
 '#tunpanel .co div{margin:1px 0}#tunpanel .co .h{color:#f3c79a;font-weight:600;font-size:12.5px}#tunpanel .co .l1{color:#f0b27a}#tunpanel .gd{font-variant-numeric:tabular-nums}'+
 '#tunpanel .co:not(:empty)+.gd:not(:empty){border-top:1px solid rgba(232,216,196,.18);margin-top:4px;padding-top:4px}#tunpanel .ar{display:inline-block;color:#f0b27a;margin-right:6px;transition:transform .15s linear}'+
 'body.hidehelp #tunpanel{display:none!important}'+
 'body.touch #hud{left:8px;right:auto;top:78px;bottom:auto;max-width:42vw}'+
 'body.touch #tunpanel{left:max(8px,env(safe-area-inset-left));right:auto;top:auto;bottom:max(12px,env(safe-area-inset-bottom));max-width:min(210px,44vw)}';
document.head.appendChild(tpCss); document.body.appendChild(tpEl);
const tpCo=tpEl.querySelector('.co'), tpGd=tpEl.querySelector('.gd'), tpAr=tpEl.querySelector('.ar'), tpGt=tpEl.querySelector('.gt');
const FEATS=TUN?TUN.features:[]; let FN=TUN?TUN.farNorth:null;
let northReached=false, reachedT=0, tpLast='';
const fmtFt=m=>`${Math.round(m*FT_M)} ft (${m.toFixed(0)} m)`;
function routeProj(p){ let best={s:0,d:1e18};   // nearest point on the fly-through centreline (horizontal)
 for(let i=0;i+1<FLYP.length;i++){ const a=FLYP[i], b=FLYP[i+1], abx=b.x-a.x, abz=b.z-a.z, l2=abx*abx+abz*abz||1e-9;
  const t=Math.max(0,Math.min(1,((p.x-a.x)*abx+(p.z-a.z)*abz)/l2)), qx=a.x+abx*t-p.x, qz=a.z+abz*t-p.z, d=qx*qx+qz*qz;
  if(d<best.d) best={s:FLYS[i]+t*(FLYS[i+1]-FLYS[i]),d}; }
 best.d=Math.sqrt(best.d); return best; }
function routeAt(s){ for(let i=0;i+1<FLYP.length;i++) if(FLYS[i+1]>=s){ const t=(s-FLYS[i])/Math.max(1e-9,FLYS[i+1]-FLYS[i]); return FLYP[i].clone().lerp(FLYP[i+1],Math.max(0,Math.min(1,t))); } return FLYP[FLYP.length-1].clone(); }
function tunnelPanel(){
 if(!TUN||(qs.has('capture')&&!qs.has('hud'))){ tpEl.style.display='none'; return; }
 const p=camera.position; let html='', best=null, bd=1e9;
 for(const f of FEATS){ const d=Math.hypot(f.x-p.x,f.z-p.z); if(d<CALLOUT_R&&Math.abs(p.y-(f.floor_y+1.2))<3&&d<bd){bd=d;best=f;} }
 if(best) html='<div class="h">'+(best.kind==='nw_end'||best.kind==='far_north'?'Northwest end':`${Math.round(best.dist_ft)} ft in`)+`<span style="opacity:.7;font-weight:400"> · ${Math.round(bd*FT_M)} ft away</span></div>`+
   best.lines.map((l,i)=>`<div class="${i?'':'l1'}">${l}</div>`).join('');
 let g='', ang=null;
 if(FN){ const toN=Math.hypot(FN.x-p.x,FN.z-p.z);
  if(!northReached&&toN<NORTH_REACH&&Math.abs(p.y-(FN.floor_y+1.2))<3){ northReached=true; reachedT=5; }
  if(northReached){ if(reachedT>0){ g='&#10003; Reached the northwest end'; } }
  else { const r=routeProj(p), L=FLYS[FLYS.length-1], left=Math.max(0,L-r.s)+r.d;
   const tgt=r.d>4?routeAt(r.s):routeAt(Math.min(L,r.s+5));   // head back to the route if you're off in a side passage
   const brg=Math.atan2(-(tgt.x-p.x),-(tgt.z-p.z)); let rel=brg-lookYaw; rel=Math.atan2(Math.sin(rel),Math.cos(rel)); ang=-rel*180/Math.PI-90;
   g=`Northwest end: ${fmtFt(left)} ahead`; } }
 if(ang!==null) tpAr.style.transform=`rotate(${ang.toFixed(0)}deg)`;   // the glyph points right; -90 = up = straight ahead
 tpAr.style.display=ang===null?'none':'inline-block';
 const key=html+'|'+g; if(key!==tpLast){ tpLast=key; tpCo.innerHTML=html; tpGt.innerHTML=g; }
 tpEl.style.display=(html||g)?'block':'none'; }
setInterval(()=>{ if(reachedT>0){ reachedT-=0.25; } },250);
CALICO.tunnelPanel=()=>{tunnelPanel();return {text:tpEl.innerText,visible:tpEl.style.display!=='none',northReached};};
requestAnimationFrame(loop);
})();
