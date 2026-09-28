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
  uSize:{value:0.03},uScreen:{value:Hh()},uFov:{value:1.0},uTime:{value:0},uFogDist:{value:38.0},uCull:{value:1.0}};
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
attribute vec3 nrm; attribute float tone; uniform float uSize; uniform float uScreen; uniform float uFov; uniform float uCull;
varying vec3 vCol;
void main(){ vec4 wp=modelMatrix*vec4(position,1.0); vec4 mv=viewMatrix*wp;
 float hgt=tone*2.6/0.902; if(tone>0.95) hgt=1.0;
 vec3 base=clayColor(wp.xyz,nrm,hgt,tone);
 vCol=light(wp.xyz,nrm,base);
 gl_Position=projectionMatrix*mv;
 float sz=uSize*(tone>0.985?0.6:1.0);
 gl_PointSize=clamp(sz*uScreen/(uFov*-mv.z),1.0,30.0);
 if(uCull>0.5 && tone<0.95 && dot(nrm,normalize(uCam-wp.xyz))<-0.3){gl_Position=vec4(2.0,2.0,2.0,1.0);gl_PointSize=0.0;}}`,
 fragmentShader:`varying vec3 vCol; void main(){ vec2 c=gl_PointCoord-0.5; if(dot(c,c)>0.25) discard;
 float lm=dot(vCol,vec3(0.3,0.55,0.15)); vec3 col=vCol*(1.9/(1.0+1.9*lm*0.75)); gl_FragColor=vec4(pow(col,vec3(1.0/2.2)),1.0);}`});

// ---------- load & decode chunks ----------
const bmin=new THREE.Vector3().fromArray(M.bmin), ext=new THREE.Vector3().fromArray(M.ext);
const maxExt=Math.max(ext.x,ext.y,ext.z);
const group=new THREE.Group(); group.position.copy(bmin); group.scale.copy(ext); scene.add(group);
const chunkObjs=[]; let loadedFiles=0, loadedPts=0;
const OCC=0.1, occ=new Set(); const okey=(x,y,z)=>((Math.floor(x/OCC)+2000)*4096+(Math.floor(y/OCC)+2000))*4096+(Math.floor(z/OCC)+2000);
function b64(s){const bin=atob(s),n=bin.length,u=new Uint8Array(n);for(let i=0;i<n;i++)u[i]=bin.charCodeAt(i);return u;}
function decodeFile(fi){
 const arr=CALICO.files[fi];
 M.chunks.forEach(ch=>{ if(ch.f!==fi) return;
  const u=b64(arr[ch.i]), n=ch.n;
  const pos=new Uint16Array(u.buffer,0,n*3), nrm=new Int8Array(u.buffer,n*6,n*3), tone=new Uint8Array(u.buffer,n*9,n);
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(pos,3,true));
  g.setAttribute('nrm',new THREE.BufferAttribute(nrm,3,true));
  g.setAttribute('tone',new THREE.BufferAttribute(tone,1,true));
  const c=new THREE.Vector3().fromArray(ch.c);
  g.boundingSphere=new THREE.Sphere(c.clone().sub(bmin).divide(ext),ch.r/maxExt+1e-4);
  const o=new THREE.Points(g,pmat); o.userData.c=c; o.userData.r=ch.r; group.add(o); chunkObjs.push(o);
  for(let i=0;i<n;i++) occ.add(okey(bmin.x+pos[3*i]/65535*ext.x,bmin.y+pos[3*i+1]/65535*ext.y,bmin.z+pos[3*i+2]/65535*ext.z));
  loadedPts+=n; });
 delete CALICO.files[fi]; loadedFiles++;
 LD.sectionAdded(fi,loadedPts);
 if(loadedFiles===M.files.length) onLoaded();
}
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
const keys={}; let yaw=0,pitch=0,speed=2.0,lampOn=true,auto=false,autoT=0,msgT=0,msg='';
let lookYaw=0, lookPitch=0;   // steadicam: the camera eases toward yaw/pitch (mouse targets) instead of snapping
const path=new THREE.CatmullRomCurve3(M.path.map(p=>new THREE.Vector3().fromArray(p)),false,'centripetal');
const pathLen=path.getLength();
function lookAt(p){const d=new THREE.Vector3().subVectors(p,camera.position);yaw=Math.atan2(-d.x,-d.z);pitch=Math.atan2(d.y,Math.hypot(d.x,d.z));}
// start ~6 m along the survey path: just inside the portal (past the entrance clutter), looking down the tunnel
const START_D=6.0;
function reset(){ const t=Math.min(START_D/pathLen,1); poseAt(t); }
function flash(t){msg=t;msgT=2.5;}
addEventListener('keydown',e=>{keys[e.code]=true;
 if(e.code==='KeyC'){keepIn=!keepIn;outT=0;flash('Keep-inside pull-back '+(keepIn?'ON':'OFF (free flight)'));}
 if(e.code==='KeyL'){lampOn=!lampOn;flash('Headlamp '+(lampOn?'ON':'OFF (flat light)')); if(CALICO.syncTouchBtns) CALICO.syncTouchBtns();}
 if(e.code==="KeyR"){reset();auto=false;resetGuard();snapLook(); if(CALICO.syncTouchBtns) CALICO.syncTouchBtns();}
 if(e.code==='KeyB'){U.uCull.value=1-U.uCull.value;flash('Back-face point culling '+(U.uCull.value?'ON':'OFF'));}
 if(e.code==='KeyH'){document.body.classList.toggle('hidehelp');}
 if(e.code==='KeyP'){ if(auto) stopAuto(); else startAuto(); flash(auto?(FLY?'Auto fly-through to the far north chamber and back (P to stop)':'Auto fly-through (P to stop)'):'Manual'); if(CALICO.syncTouchBtns) CALICO.syncTouchBtns(); }
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
  if(!entered){ entered=true; showHint("You're just inside the mine portal, facing into the tunnel.<br><b>W</b> to walk forward · mouse to look · <b>P</b> for an automatic fly-through",6000); } }
 else if(ov.dataset.ready){ ov.style.display='flex'; document.querySelector('#enter .big').textContent='▶ Paused — click to continue'; LD.status('Paused. Click anywhere to continue.'); hint.classList.remove('show'); }});
addEventListener('mousemove',e=>{ if(document.pointerLockElement!==renderer.domElement) return;
 yaw-=e.movementX*0.0022; pitch=Math.max(-1.5,Math.min(1.5,pitch-e.movementY*0.0022)); });
// ---------- touch: virtual joystick + drag look (no pointer lock) ----------
// Phones never get a locked pointer. A coarse pointer or a real touch surface turns on on-screen controls.
// The left thumb drives a joystick (forward/back/strafe). One finger on the right half of the screen looks around.
// Walking still goes through the same update() path, so the eye stays floor + EYE_HEIGHT with the steadicam spring.
const TOUCH=matchMedia('(pointer: coarse)').matches||('ontouchstart' in window);
let stickX=0, stickY=0;   // -1..1, x = strafe right, y = forward
function enterTouch(){
 ov.style.display='none';
 if(!entered){ entered=true; showHint('Left thumb: move · Drag: look · ▶ fly-through',7000); }
}
if(TOUCH){
 document.body.classList.add('touch');
 const big=document.querySelector('#enter .big'), ctl=document.querySelector('#enter .ctl');
 if(big) big.textContent='▶ Tap to enter';
 if(ctl) ctl.textContent='Left thumb: move · Drag: look · ▶ fly-through';
 const ui=document.createElement('div'); ui.id='touchui';
 ui.innerHTML='<div id="stick"><div class="pad"><div class="knob"></div></div></div>'+
  '<div id="tbtns"><button type="button" id="tFly">▶ Fly-through</button><button type="button" id="tReset">Reset</button><button type="button" id="tLamp">Lamp</button></div>';
 document.body.appendChild(ui);
 const stick=ui.querySelector('#stick'), knob=ui.querySelector('.knob'), flyBtn=ui.querySelector('#tFly'), lampBtn=ui.querySelector('#tLamp');
 const STICK_R=36;
 let stickTid=null;
 const setKnob=(x,y)=>{ knob.style.transform=`translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`; };
 function applyStick(t){
  const b=stick.getBoundingClientRect(), cx=b.left+b.width/2, cy=b.top+b.height/2;
  let dx=t.clientX-cx, dy=t.clientY-cy; const d=Math.hypot(dx,dy)||1, m=Math.min(STICK_R,d);
  const nx=dx/d*m, ny=dy/d*m; setKnob(nx,ny); stickX=nx/STICK_R; stickY=-ny/STICK_R;
 }
 function endStick(id){ if(id!==stickTid) return; stickTid=null; stickX=0; stickY=0; setKnob(0,0); }
 stick.addEventListener('touchstart',e=>{ if(!entered) return; e.preventDefault(); const t=e.changedTouches[0]; stickTid=t.identifier; applyStick(t); },{passive:false});
 stick.addEventListener('touchmove',e=>{ for(const t of e.changedTouches) if(t.identifier===stickTid){ e.preventDefault(); applyStick(t); } },{passive:false});
 stick.addEventListener('touchend',e=>{ for(const t of e.changedTouches) endStick(t.identifier); },{passive:true});
 stick.addEventListener('touchcancel',e=>{ for(const t of e.changedTouches) endStick(t.identifier); },{passive:true});
 let lookTid=null, lookX=0, lookY=0;
 const onLookStart=e=>{
  if(!entered) return;
  for(const t of e.changedTouches){
   if(lookTid!==null||t.clientX<innerWidth*0.5) continue;   // right half only; the joystick owns the left thumb
   lookTid=t.identifier; lookX=t.clientX; lookY=t.clientY; e.preventDefault();
  }
 };
 const onLookMove=e=>{
  if(lookTid===null) return;
  for(const t of e.changedTouches) if(t.identifier===lookTid){
   yaw-=(t.clientX-lookX)*0.005; pitch=Math.max(-1.2,Math.min(1.2,pitch-(t.clientY-lookY)*0.005));
   lookX=t.clientX; lookY=t.clientY; e.preventDefault();
  }
 };
 const onLookEnd=e=>{ for(const t of e.changedTouches) if(t.identifier===lookTid) lookTid=null; };
 renderer.domElement.addEventListener('touchstart',onLookStart,{passive:false});
 renderer.domElement.addEventListener('touchmove',onLookMove,{passive:false});
 renderer.domElement.addEventListener('touchend',onLookEnd,{passive:true});
 renderer.domElement.addEventListener('touchcancel',onLookEnd,{passive:true});
 function syncTouchBtns(){ flyBtn.textContent=auto?'■ Stop':'▶ Fly-through'; lampBtn.classList.toggle('off',!lampOn); }
 flyBtn.addEventListener('click',()=>{ if(auto) stopAuto(); else startAuto();
  flash(auto?(FLY?'Auto fly-through to the far north chamber and back':'Auto fly-through'):'Manual'); syncTouchBtns(); });
 ui.querySelector('#tReset').addEventListener('click',()=>{ reset(); auto=false; resetGuard(); snapLook(); syncTouchBtns(); });
 lampBtn.addEventListener('click',()=>{ lampOn=!lampOn; flash('Headlamp '+(lampOn?'ON':'OFF (flat light)')); syncTouchBtns(); });
 CALICO.syncTouchBtns=syncTouchBtns;
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
// ---------- eye height (floor + 1.70 m) ----------
// The handheld GeoSLAM was carried at about waist height. The meta.js survey path is not the raw scanner track:
// build.py set it to floor + PATH_EYE (1.40 m), capped at ceiling - 0.35 m and smoothed. Before this change the camera sat
// on that path (start pose, R, P fly-through) and then flew freely with no floor following at all.
// Now the eye sits EYE_HEIGHT above the tunnel floor (1.70 m, eye level for a 6 ft adult). The floor and ceiling come
// from 5 short vertical probes (centre and +-20 cm) through the noise-filtered 10 cm wall voxels (isWall), taking the median.
// Steadicam: the floor/ceiling samples are median-filtered over the last FLOOR_WIN metres walked, the ceiling is also
// probed ~0.4 s ahead, and the eye height follows a critically damped spring (EYE_OMEGA). The eye is capped at
// ceiling - HEAD_CLEAR so it ducks under low spots instead of clipping into the rock (hard cap at the current ceiling as a backstop).
// Space/E and Shift/Q still fly up and down: they add an offset (hOff) on top of the floor-following eye height.
// If no floor is found (outside the rock shell), the height is held.
// (TUN, routeProj: defined further down; only used at run time.)
const EYE_HEIGHT=1.70, HEAD_CLEAR=0.15, PATH_EYE=1.40, EYE_MIN=0.5, FLOOR_SCAN=2.6, CEIL_SCAN=3.5;
const EYE_OMEGA=5.0, FLOOR_WIN=0.5, LOOK_RATE=12, LOOK_RATE_AUTO=2.2, ACCEL_RATE=4.5;
const EYE_COLS=[[0,0],[0.2,0],[-0.2,0],[0,0.2],[0,-0.2]], TUN=CALICO.tunnel||null;
const FLYP=TUN?TUN.fly.map(p=>new THREE.Vector3().fromArray(p)):[], FLYS=[0];   // route polyline + horizontal distance along it
for(let i=1;i<FLYP.length;i++) FLYS.push(FLYS[i-1]+Math.hypot(FLYP[i].x-FLYP[i-1].x,FLYP[i].z-FLYP[i-1].z));
let eyeY=0, eyeV=0, hOff=0, hVel=0, odo=0; const vel=new THREE.Vector3(), eyeBuf=[], lastXZ=new THREE.Vector2();
function med(a){ a=a.slice().sort((x,y)=>x-y); return a[a.length>>1]; }
function floorCeil(x,z,yRef){ const F=[],C=[];
 for(const [dx,dz] of EYE_COLS){ const cx=x+dx, cz=z+dz; let f=null, free=false;
  for(let y=yRef; y>=yRef-FLOOR_SCAN; y-=0.05){ if(!isWall(cx,y,cz)) free=true; else if(free){ f=y; break; } }
  if(f===null) continue; F.push(f);
  for(let y=f+EYE_MIN; y<=f+CEIL_SCAN; y+=0.05) if(isWall(cx,y,cz)){ C.push(y); break; } }
 if(F.length<3) return null;
 return {floor:med(F), ceil:C.length>=3?med(C):null}; }
// On the surveyed route (within 1 m of the centreline in data/tunnel.js) use its 1 ft station floor/ceiling instead:
// those come from all points in each 20 cm column and are median-filtered, so clutter and ghosted scan overlap
// (e.g. ~305-316 ft) can't lift the eye.
function stationFC(x,z){ if(!TUN||!TUN.stations) return null; const r=routeProj({x,z}); if(r.d>1.0) return null;
 const S=TUN.stations, i=Math.max(0,Math.min(S.floor.length-1,Math.round(r.s/0.3048))); return {floor:S.floor[i],ceil:S.ceil[i]}; }
function fcAt(x,z,yRef){ return stationFC(x,z)||floorCeil(x,z,yRef); }
function eyeFrom(floor,ceil){ let y=floor+EYE_HEIGHT; if(ceil!==null) y=Math.min(y,ceil-HEAD_CLEAR); return Math.max(y,floor+EYE_MIN); }
function eyeTarget(x,z,yRef){ const fc=fcAt(x,z,yRef); return fc?eyeFrom(fc.floor,fc.ceil):null; }
function snapEye(){ eyeBuf.length=0; eyeV=0; hOff=0; hVel=0; vel.set(0,0,0); eyeY=camera.position.y; lastXZ.set(camera.position.x,camera.position.z); }
function followEye(dt){
 const p=camera.position; odo+=lastXZ.distanceTo(new THREE.Vector2(p.x,p.z)); lastXZ.set(p.x,p.z);
 const fc=fcAt(p.x,p.z,eyeY);
 if(fc){ const b=eyeBuf[eyeBuf.length-1]; if(!b||odo-b.s>=0.05||(b.t+=dt)>0.25) eyeBuf.push({s:odo,f:fc.floor,c:fc.ceil,t:0}); }
 while(eyeBuf.length>1&&eyeBuf[0].s<odo-FLOOR_WIN) eyeBuf.shift();
 if(eyeBuf.length){
  const f=med(eyeBuf.map(b=>b.f)), cs=eyeBuf.filter(b=>b.c!==null).map(b=>b.c); let c=cs.length?med(cs):null;
  const ah=vel.lengthSq()>0.01?fcAt(p.x+vel.x*0.4,p.z+vel.z*0.4,eyeY):null;   // look ahead for a dropping ceiling
  if(ah&&ah.ceil!==null&&Math.abs(ah.floor-f)<0.6) c=c===null?ah.ceil:Math.min(c,ah.ceil);
  const t=eyeFrom(f,c);
  if(dt>0){ eyeV+=(EYE_OMEGA*EYE_OMEGA*(t-eyeY)-2*EYE_OMEGA*eyeV)*dt; eyeY+=eyeV*dt; } else { eyeY=t; eyeV=0; }
  if(fc&&fc.ceil!==null&&eyeY>fc.ceil-0.05){ eyeY=fc.ceil-0.05; eyeV=Math.min(eyeV,0); }   // never poke through the rock
 }
 p.y=eyeY+hOff; }
function poseAt(t){ const p=path.getPointAt(Math.min(t,1)); const q=path.getPointAt(Math.min(t+3.0/pathLen,1));
 if(t>=1){const a=path.getPointAt(0.995);q.copy(p).add(p.clone().sub(a).normalize());}
 const tg=eyeTarget(p.x,p.z,p.y), dy=tg===null?EYE_HEIGHT-PATH_EYE:tg-p.y;   // fallback: path y - 1.40 m + 1.70 m
 p.y+=dy; q.y+=dy; camera.position.copy(p); lookAt(q); pitch-=0.05; snapEye(); snapLook(); }
function snapLook(){ lookYaw=yaw; lookPitch=pitch; }
function easeLook(dt,rate){ if(!(dt>0)){ snapLook(); return; } const k=1-Math.exp(-dt*rate);
 let d=yaw-lookYaw; d=Math.atan2(Math.sin(d),Math.cos(d)); lookYaw+=d*k; lookPitch+=(pitch-lookPitch)*k; }

// ---------- P fly-through: portal -> far north chamber -> back to the portal ----------
// Uses CALICO.tunnel (data/tunnel.js, from eyeheight/tunnel.py): a smoothed centreline through the main drift and the
// connecting passage to the northernmost chamber. Its height follows the floor under the camera (the 1 ft stations in
// tunnel.js, or a live probe), at floor + EYE_HEIGHT (1.70 m, a 6 ft adult) capped 0.15 m under the ceiling. The stored
// polyline was generated at TUN.eye (1.66 m); flyStep shifts it up to EYE_HEIGHT and reclamps to that ceiling. Speed eases
// in and out (FLY_ACC), slows to a stop at the chamber, pauses while the view pans round, then returns.
// Without tunnel.js it falls back to the old meta.js path (raised to eye height).
const FLY_ACC=0.45, FLY_DWELL=3.5;
const FLY=TUN&&TUN.fly&&TUN.fly.length>3?new THREE.CatmullRomCurve3(TUN.fly.map(p=>new THREE.Vector3().fromArray(p)),false,'centripetal'):null;
const FLY_LEN=FLY?FLY.getLength():0;
const flyAt=d=>FLY.getPointAt(Math.max(0,Math.min(1,d/FLY_LEN)));
let flyD=0, flyV=0, flyDwell=0, flyBlend=1; const flyFrom=new THREE.Vector3(), flyQ=new THREE.Vector3();
function nearestFlyD(p){ let best=0,bd=1e18; for(let i=0;i<=600;i++){ const q=flyAt(i/600*FLY_LEN), d=(q.x-p.x)**2+(q.z-p.z)**2+0.3*(q.y-p.y)**2; if(d<bd){bd=d;best=i/600*FLY_LEN;} } return best; }
function startAuto(){ auto=true; if(!FLY){ autoT=nearestT(); return; }
 flyD=nearestFlyD(camera.position); if(flyD>FLY_LEN-1) flyD=2*FLY_LEN-flyD;   // at the chamber already: head back
 flyV=0; flyDwell=0; flyBlend=0; flyFrom.copy(camera.position); }
function stopAuto(){ auto=false; snapEye(); }
function flyStep(dt){
 const L=FLY_LEN, out=flyD<L, stopAt=out?L:2*L;
 if(flyD>=L-0.02&&flyD<L+0.02&&flyDwell<FLY_DWELL){ flyDwell+=dt; flyV=0; if(flyDwell>=FLY_DWELL) flyD=L+0.021; }
 else { const vt=Math.min(speed,Math.sqrt(2*FLY_ACC*Math.max(0,stopAt-flyD))+0.03);
  flyV+=Math.max(-2*FLY_ACC*dt,Math.min(FLY_ACC*dt,vt-flyV)); flyD=Math.min(stopAt,flyD+flyV*dt); }
 const back=flyD>L||(flyD>=L-0.02&&flyDwell>=FLY_DWELL*0.25), s=flyD>L?2*L-flyD:flyD;
 const p=flyAt(s);
 const gen=(TUN&&typeof TUN.eye==='number')?TUN.eye:EYE_HEIGHT, tg=eyeTarget(p.x,p.z,p.y);
 p.y+=EYE_HEIGHT-gen; if(tg!==null) p.y=Math.min(p.y,tg);   // floor + EYE_HEIGHT, not the baked 1.66 m or the meta.js path
 let qs=back?s-3:s+3; flyQ.copy(flyAt(qs));
 if(flyQ.distanceTo(p)<0.5){ const a=flyAt(back?s+1:s-1); flyQ.copy(p).add(p.clone().sub(a).normalize()); }
 flyQ.y=p.y-0.15;
 if(flyBlend<1){ flyBlend=Math.min(1,flyBlend+dt/2.0); const e=flyBlend*flyBlend*(3-2*flyBlend); p.lerpVectors(flyFrom,p,e); }
 camera.position.copy(p); lookAt(flyQ); eyeY=p.y; hOff=0; eyeBuf.length=0; eyeV=0; vel.set(0,0,0);
 if(flyD>=2*L-0.01){ auto=false; snapEye(); flash('Fly-through finished, back at the portal'); } }
reset();

CALICO.poseAt=t=>{poseAt(t);}; CALICO.pathLen=pathLen; CALICO.reset=reset; CALICO.validHere=()=>inValidSpace(camera.position);
CALICO.setPose=(p,l)=>{camera.position.fromArray(p);lookAt(new THREE.Vector3().fromArray(l));snapEye();snapLook();};
CALICO.eye={floorCeil:(x,z,y)=>floorCeil(x,z,y),target:(x,z,y)=>eyeTarget(x,z,y),state:()=>({eyeY,eyeV,hOff,flyD,flyV,auto}),EYE_HEIGHT,HEAD_CLEAR,flyLen:FLY_LEN};
CALICO.touch={on:TOUCH,stick:()=>({x:stickX,y:stickY}),look:()=>({yaw,pitch})};
CALICO.renderNow=()=>{update(0);renderer.render(scene,camera);};
CALICO.toggleMesh=(on,cb)=>loadMesh(()=>{mesh.visible=on;group.visible=!on;cb&&cb();});
CALICO.setLamp=v=>{lampOn=v;};

const fwd=new THREE.Vector3(), right=new THREE.Vector3(), mv=new THREE.Vector3();
function update(dt){
 if(auto&&dt>0){ if(FLY) flyStep(dt); else { autoT+=dt*speed/pathLen; if(autoT>=1){autoT=1;auto=false;} poseAt(autoT); } resetGuard(); }
 easeLook(dt,auto?LOOK_RATE_AUTO:LOOK_RATE);
 camera.rotation.set(lookPitch,lookYaw,0);
 if(!auto && dt>0){
  fwd.set(-Math.sin(lookYaw),0,-Math.cos(lookYaw)); right.set(Math.cos(lookYaw),0,-Math.sin(lookYaw)); mv.set(0,0,0);
  if(keys.KeyW||keys.ArrowUp)mv.add(fwd); if(keys.KeyS||keys.ArrowDown)mv.sub(fwd);
  if(keys.KeyD||keys.ArrowRight)mv.add(right); if(keys.KeyA||keys.ArrowLeft)mv.sub(right);
  const sm=Math.hypot(stickX,stickY);   // joystick: same floor-following walk, scaled by how far the thumb pushes
  if(sm>0.16){ const a=Math.min(1,(sm-0.16)/0.84); mv.addScaledVector(fwd,stickY/sm*a); mv.addScaledVector(right,stickX/sm*a); }
  if(keys.KeyE||keys.Space)mv.y+=1; if(keys.KeyQ||keys.ShiftLeft||keys.ShiftRight)mv.y-=1;
  if(mv.lengthSq()>0){
   const keyed=keys.KeyW||keys.ArrowUp||keys.KeyS||keys.ArrowDown||keys.KeyA||keys.ArrowLeft||keys.KeyD||keys.ArrowRight||keys.KeyE||keys.Space||keys.KeyQ||keys.ShiftLeft||keys.ShiftRight;
   mv.normalize().multiplyScalar(speed*(keyed?1:Math.min(1,sm)));
  }
  // gentle acceleration / deceleration (exponential approach to the key velocity)
  const k=1-Math.exp(-dt*ACCEL_RATE); vel.x+=(mv.x-vel.x)*k; vel.z+=(mv.z-vel.z)*k; hVel+=(mv.y-hVel)*k;
  if(pull){ vel.set(0,0,0); hVel=0; eyeY=camera.position.y; hOff=0; eyeBuf.length=0; eyeV=0; }
  else { camera.position.x+=vel.x*dt; camera.position.z+=vel.z*dt; hOff+=hVel*dt; followEye(dt); }   // eye = floor + 1.70 m (+ Space/Shift offset)
  guard(dt);
 }
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
function onLoaded(){
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
 update(dt); renderer.render(scene,camera);
 if(msgT>0)msgT-=dt;
 navHud();
 const p=camera.position, o=M.origin_las;
 hud.textContent=`${(loadedPts/1e6).toFixed(2)} M pts   ${fpsA.toFixed(0)} fps   speed ${speed.toFixed(1)} m/s   noclip, keep-inside ${keepIn?'on':'off'}   lamp ${lampOn?'on':'off'}\n`+
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
 state:()=>pull?'pulling':(curValid?'valid':'out '+outT.toFixed(1)+'s'),setKeepIn:v=>{keepIn=v;},valid:a=>inValidSpace(new THREE.Vector3().fromArray(a)),encl:a=>enclosure(new THREE.Vector3().fromArray(a)),isWall};
// ---------- tunnel-change callouts + far north chamber guide (right-edge panel; hidden with H) ----------
// CALICO.tunnel.features: the major changes along the tunnel (wall steps >= 1.5 ft, floor/ceiling >= 1 ft, low headroom),
// precomputed per 1 ft station by eyeheight/tunnel.py; one is shown while you are within CALLOUT_R (10 ft) of it.
const CALLOUT_R=10*0.3048, NORTH_REACH=4.0, FT_M=3.28084;
const tpEl=document.createElement('div'); tpEl.id='tunpanel'; tpEl.innerHTML='<div class="co"></div><div class="gd"><span class="ar">&#10148;</span><span class="gt"></span></div>';
const tpCss=document.createElement('style');
tpCss.textContent='#tunpanel{position:fixed;right:12px;bottom:10px;max-width:290px;background:rgba(10,7,5,.55);padding:6px 10px;border-radius:6px;pointer-events:none;z-index:5;font-size:12px;line-height:1.5;color:#e8d8c4;display:none}'+
 '#tunpanel .co div{margin:1px 0}#tunpanel .co .h{color:#f3c79a;font-weight:600;font-size:12.5px}#tunpanel .co .l1{color:#f0b27a}#tunpanel .gd{font-variant-numeric:tabular-nums}'+
 '#tunpanel .co:not(:empty)+.gd:not(:empty){border-top:1px solid rgba(232,216,196,.18);margin-top:4px;padding-top:4px}#tunpanel .ar{display:inline-block;color:#f0b27a;margin-right:6px;transition:transform .15s linear}'+
 'body.hidehelp #tunpanel{display:none!important}';
document.head.appendChild(tpCss); document.body.appendChild(tpEl);
const tpCo=tpEl.querySelector('.co'), tpGd=tpEl.querySelector('.gd'), tpAr=tpEl.querySelector('.ar'), tpGt=tpEl.querySelector('.gt');
const FEATS=TUN?TUN.features:[], FN=TUN?TUN.farNorth:null;
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
 if(best) html='<div class="h">'+(best.kind==='far_north'?'Far north chamber':`${Math.round(best.dist_ft)} ft in`)+`<span style="opacity:.7;font-weight:400"> · ${Math.round(bd*FT_M)} ft away</span></div>`+
   best.lines.map((l,i)=>`<div class="${i?'':'l1'}">${l}</div>`).join('');
 let g='', ang=null;
 if(FN){ const toN=Math.hypot(FN.x-p.x,FN.z-p.z);
  if(!northReached&&toN<NORTH_REACH&&Math.abs(p.y-(FN.floor_y+1.2))<3){ northReached=true; reachedT=5; }
  if(northReached){ if(reachedT>0){ g='&#10003; Reached far north chamber'; } }
  else { const r=routeProj(p), L=FLYS[FLYS.length-1], left=Math.max(0,L-r.s)+r.d;
   const tgt=r.d>4?routeAt(r.s):routeAt(Math.min(L,r.s+5));   // head back to the route if you're off in a side passage
   const brg=Math.atan2(-(tgt.x-p.x),-(tgt.z-p.z)); let rel=brg-lookYaw; rel=Math.atan2(Math.sin(rel),Math.cos(rel)); ang=-rel*180/Math.PI-90;
   g=`Far north chamber: ${fmtFt(left)} ahead`; } }
 if(ang!==null) tpAr.style.transform=`rotate(${ang.toFixed(0)}deg)`;   // the glyph points right; -90 = up = straight ahead
 tpAr.style.display=ang===null?'none':'inline-block';
 const key=html+'|'+g; if(key!==tpLast){ tpLast=key; tpCo.innerHTML=html; tpGt.innerHTML=g; }
 tpEl.style.display=(html||g)?'block':'none'; }
setInterval(()=>{ if(reachedT>0){ reachedT-=0.25; } },250);
// subtle 3-D markers: a faint amber ring on the floor with a small down-pointing cone above it
const mkGroup=new THREE.Group(); scene.add(mkGroup);
if(TUN){ const ringG=new THREE.RingGeometry(0.28,0.34,40), coneG=new THREE.ConeGeometry(0.07,0.16,16);
 const mkM=new THREE.MeshBasicMaterial({color:0xe9a066,transparent:true,opacity:0.35,side:THREE.DoubleSide,depthWrite:false});
 for(const f of FEATS){ const r=new THREE.Mesh(ringG,mkM); r.rotation.x=-Math.PI/2; r.position.set(f.x,f.floor_y+0.03,f.z);
  const c=new THREE.Mesh(coneG,mkM); c.rotation.x=Math.PI; c.position.set(f.x,f.floor_y+0.55,f.z); mkGroup.add(r,c); } }
CALICO.tunnelPanel=()=>{tunnelPanel();return {text:tpEl.innerText,visible:tpEl.style.display!=='none',northReached};};
requestAnimationFrame(loop);
})();
