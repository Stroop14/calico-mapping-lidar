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
const keys={}; let yaw=0,pitch=0,speed=2.0,collide=true,lampOn=true,auto=false,autoT=0,msgT=0,msg='';
const path=new THREE.CatmullRomCurve3(M.path.map(p=>new THREE.Vector3().fromArray(p)),false,'centripetal');
const pathLen=path.getLength();
function lookAt(p){const d=new THREE.Vector3().subVectors(p,camera.position);yaw=Math.atan2(-d.x,-d.z);pitch=Math.atan2(d.y,Math.hypot(d.x,d.z));}
// start ~6 m along the survey path: just inside the portal (past the entrance clutter), looking down the tunnel
const START_D=6.0;
function reset(){ const t=Math.min(START_D/pathLen,1); camera.position.copy(path.getPointAt(t)); lookAt(path.getPointAt(Math.min(t+3.0/pathLen,1))); pitch-=0.05; }
reset();
function flash(t){msg=t;msgT=2.5;}
addEventListener('keydown',e=>{keys[e.code]=true;
 if(e.code==='KeyC'){collide=!collide;flash('Collision '+(collide?'ON':'OFF'));}
 if(e.code==='KeyL'){lampOn=!lampOn;flash('Headlamp '+(lampOn?'ON':'OFF (flat light)'));}
 if(e.code==="KeyR"){reset();auto=false;}
 if(e.code==='KeyB'){U.uCull.value=1-U.uCull.value;flash('Back-face point culling '+(U.uCull.value?'ON':'OFF'));}
 if(e.code==='KeyH'){document.body.classList.toggle('hidehelp');}
 if(e.code==='KeyP'){auto=!auto; if(auto){autoT=nearestT();} flash(auto?'Auto fly-through (P to stop)':'Manual');}
 if(e.code==='KeyM'){loadMesh(()=>{mesh.visible=!mesh.visible;group.visible=!mesh.visible;flash(mesh.visible?'Surface mesh':'Points');});}
 if(e.code==='BracketRight')U.uSize.value*=1.15; if(e.code==='BracketLeft')U.uSize.value/=1.15;
 if(e.code==='Equal'||e.code==='NumpadAdd'){speed=Math.min(speed*1.25,40);flash('Speed '+speed.toFixed(1)+' m/s');}
 if(e.code==='Minus'||e.code==='NumpadSubtract'){speed=Math.max(speed/1.25,0.2);flash('Speed '+speed.toFixed(1)+' m/s');}
 if(e.code==='Space'||e.code.startsWith('Arrow'))e.preventDefault();});
addEventListener('keyup',e=>{keys[e.code]=false;});
addEventListener('wheel',e=>{speed=Math.min(40,Math.max(0.2,speed*(e.deltaY<0?1.12:1/1.12)));flash('Speed '+speed.toFixed(1)+' m/s');},{passive:true});
const ov=document.getElementById('overlay'), hint=document.getElementById('hint'); let entered=false, hintTimer=0;
ov.addEventListener('click',()=>{ if(ov.dataset.ready) renderer.domElement.requestPointerLock(); });
renderer.domElement.addEventListener('click',()=>{ if(ov.dataset.ready) renderer.domElement.requestPointerLock(); });
function showHint(html,ms){ hint.innerHTML=html; hint.classList.add('show'); clearTimeout(hintTimer); hintTimer=setTimeout(()=>hint.classList.remove('show'),ms); }
document.addEventListener('pointerlockchange',()=>{const L=document.pointerLockElement===renderer.domElement;
 if(L){ ov.style.display='none';
  if(!entered){ entered=true; showHint("You're just inside the mine portal, facing into the tunnel.<br><b>W</b> to walk forward · mouse to look · <b>P</b> for an automatic fly-through",6000); } }
 else if(ov.dataset.ready){ ov.style.display='flex'; document.querySelector('#enter .big').textContent='▶ Paused — click to continue'; LD.status('Paused. Click anywhere to continue.'); hint.classList.remove('show'); }});
addEventListener('mousemove',e=>{ if(document.pointerLockElement!==renderer.domElement) return;
 yaw-=e.movementX*0.0022; pitch=Math.max(-1.5,Math.min(1.5,pitch-e.movementY*0.0022)); });
function blocked(p){ const R=0.22; for(let dx=-R;dx<=R+1e-6;dx+=0.1)for(let dy=-R;dy<=R+1e-6;dy+=0.1)for(let dz=-R;dz<=R+1e-6;dz+=0.1){
  if(dx*dx+dy*dy+dz*dz>R*R*1.4) continue; if(occ.has(okey(p.x+dx,p.y+dy,p.z+dz))) return true;} return false;}
function nearestT(){let best=0,bd=1e9;for(let i=0;i<=400;i++){const d=path.getPointAt(i/400).distanceTo(camera.position);if(d<bd){bd=d;best=i/400;}}return best;}
function poseAt(t){ const p=path.getPointAt(Math.min(t,1)); const q=path.getPointAt(Math.min(t+3.0/pathLen,1));
 if(t>=1){const a=path.getPointAt(0.995);q.copy(p).add(p.clone().sub(a).normalize());}
 camera.position.copy(p); lookAt(q); pitch-=0.05; }
CALICO.poseAt=poseAt; CALICO.pathLen=pathLen; CALICO.reset=reset; CALICO.blockedHere=()=>blocked(camera.position);
CALICO.setPose=(p,l)=>{camera.position.fromArray(p);lookAt(new THREE.Vector3().fromArray(l));};
CALICO.renderNow=()=>{update(0);renderer.render(scene,camera);};
CALICO.toggleMesh=(on,cb)=>loadMesh(()=>{mesh.visible=on;group.visible=!on;cb&&cb();});
CALICO.setLamp=v=>{lampOn=v;};

const fwd=new THREE.Vector3(), right=new THREE.Vector3(), mv=new THREE.Vector3();
function update(dt){
 if(auto){ autoT+=dt*speed/pathLen; if(autoT>=1){autoT=1;auto=false;} poseAt(autoT); }
 camera.rotation.set(pitch,yaw,0);
 if(!auto && dt>0){
  fwd.set(-Math.sin(yaw),0,-Math.cos(yaw)); right.set(Math.cos(yaw),0,-Math.sin(yaw)); mv.set(0,0,0);
  if(keys.KeyW||keys.ArrowUp)mv.add(fwd); if(keys.KeyS||keys.ArrowDown)mv.sub(fwd);
  if(keys.KeyD||keys.ArrowRight)mv.add(right); if(keys.KeyA||keys.ArrowLeft)mv.sub(right);
  if(keys.KeyE||keys.Space)mv.y+=1; if(keys.KeyQ||keys.ShiftLeft||keys.ShiftRight)mv.y-=1;
  if(mv.lengthSq()>0){ mv.normalize().multiplyScalar(speed*dt);
   const steps=Math.ceil(mv.length()/0.05); const s=mv.clone().divideScalar(steps);
   for(let k=0;k<steps;k++) for(const ax of ['x','y','z']){ const old=camera.position[ax]; camera.position[ax]+=s[ax];
     if(collide&&blocked(camera.position)) camera.position[ax]=old; } }
 }
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
 LD.done(); update(0); renderer.render(scene,camera);
 LD.log(`Headlamp on, scene ready — ${(loadedPts/1e6).toFixed(2)} M points, first frame rendered just inside the portal.`,'ok');
 LD.log('Ready — click to enter.','ok');
 LD.status(`All ${M.files.length} tunnel sections loaded (${(loadedPts/1e6).toFixed(2)} M points). Click anywhere to enter.`);
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
 const p=camera.position, o=M.origin_las;
 hud.textContent=`${(loadedPts/1e6).toFixed(2)} M pts   ${fpsA.toFixed(0)} fps   speed ${speed.toFixed(1)} m/s   collision ${collide?'on':'off'}   lamp ${lampOn?'on':'off'}\n`+
  `LAS xyz  ${(p.x+o[0]).toFixed(2)}, ${(-p.z+o[1]).toFixed(2)}, ${(p.y+o[2]).toFixed(2)}`+(msgT>0?`\n${msg}`:'');}
requestAnimationFrame(loop);
})();
