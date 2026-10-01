/* Circular then-and-now lens shared by index.html and slider.html.
   The colour photo fills the frame. A circle shows the older print and follows the pointer. */
(function(){
'use strict';
var PAIRS=[
 {id:'pair01',w:1600,h:930,
  cap:'Looking down a small wash toward the valley, with steeply tilted rock layers on the right. The colour photo is from the top of a wooden walkway; the lamp pole and walkway are not in the print.'},
 {id:'pair02',w:1600,h:913,
  cap:'Elevated view over the Calico buildings toward the tilted rock ridge and the valley beyond. The old frame is a black-and-white print; the new one is a colour photo from the ghost-town overlook.'},
 {id:'pair03',w:1600,h:1273,
  cap:'Overlook with a dark foreground rock and a small opening at its top, buildings below, and the valley and distant mountains. Old: black-and-white print. New: colour photo from the ghost-town overlook.'},
 {id:'pair04',w:1600,h:1012,
  cap:'The Maggie Mine building against a rocky hillside, with a wooden headframe behind it. The old print shows signs for Maggie Mining Co., Glory Tunnel and Commissary, two ore carts, and a man standing at the right. The colour photo shows the building with its current sign, rail track and fence.'}
];
function place(ba, cx, cy){
  var w=ba.clientWidth, h=ba.clientHeight;
  if(!(w>2&&h>2)) return;
  var d=Math.min(w*0.38, h*0.92);
  var m=d/2;
  cx=Math.max(m, Math.min(w-m, cx));
  cy=Math.max(m, Math.min(h-m, cy));
  var lens=ba.querySelector('.lens');
  var old=lens.querySelector('.old');
  lens.style.width=d+'px';
  lens.style.height=d+'px';
  lens.style.left=cx+'px';
  lens.style.top=cy+'px';
  old.style.width=w+'px';
  old.style.height=h+'px';
  old.style.left=(-(cx-m))+'px';
  old.style.top=(-(cy-m))+'px';
  ba._cx=cx; ba._cy=cy; ba._fx=cx/w; ba._fy=cy/h;
  ba.setAttribute('aria-valuetext', 'Circle at '+Math.round(cx/w*100)+' percent across and '+Math.round(cy/h*100)+' percent down');
}
function mount(list){
  if(!list || list.dataset.mounted) return;
  list.dataset.mounted='1';
  var sec=document.createElement('section');
  sec.className='pair';
  sec.innerHTML=
    '<div class="lensbox" tabindex="0" role="application" aria-label="Then and now. The older photo is inside the circle. Arrow keys move the circle.">'+
      '<img class="now" alt="Now: colour photo">'+
      '<div class="lens" aria-hidden="true"><img class="old" alt=""></div>'+
      '<span class="tag then">Then (inside the circle)</span>'+
      '<span class="tag now">Now (outside)</span>'+
    '</div>'+
    '<div class="row">'+
      '<button type="button" class="pairnav prevp">Previous pair</button>'+
      '<span class="pairn" aria-live="polite"></span>'+
      '<button type="button" class="pairnav nextp">Next pair</button>'+
    '</div>'+
    '<p class="cap"></p>';
  list.appendChild(sec);
  var ba=sec.querySelector('.lensbox');
  var now=ba.querySelector('.now');
  var old=ba.querySelector('.old');
  var cap=sec.querySelector('.cap');
  var pairn=sec.querySelector('.pairn');
  var index=0, dragging=false;
  function show(i){
    index=(i+PAIRS.length)%PAIRS.length;
    var p=PAIRS[index];
    now.src='assets/pairs/'+p.id+'_new.jpg';
    now.width=p.w; now.height=p.h;
    old.src='assets/pairs/'+p.id+'_old.jpg';
    old.alt='Then: black-and-white print';
    cap.textContent=p.cap;
    pairn.textContent='Pair '+(index+1)+' of '+PAIRS.length;
    ba._fx=null;
    if(now.complete && now.naturalWidth) center();
  }
  function center(){
    place(ba, ba.clientWidth/2, ba.clientHeight/2);
  }
  function layout(){
    if(ba._fx==null) center();
    else place(ba, ba.clientWidth*ba._fx, ba.clientHeight*ba._fy);
  }
  function atEvent(e){
    var r=ba.getBoundingClientRect();
    place(ba, e.clientX-r.left, e.clientY-r.top);
  }
  now.addEventListener('load', center);
  ba.addEventListener('pointerdown', function(e){
    dragging=true;
    ba.focus({preventScroll:true});
    try{ ba.setPointerCapture(e.pointerId); }catch(err){}
    atEvent(e);
  });
  ba.addEventListener('pointermove', function(e){
    if(!dragging) return;
    atEvent(e);
  });
  function end(){ dragging=false; }
  ba.addEventListener('pointerup', end);
  ba.addEventListener('pointercancel', end);
  ba.addEventListener('keydown', function(e){
    var keys={ArrowLeft:[-1,0], ArrowRight:[1,0], ArrowUp:[0,-1], ArrowDown:[0,1]};
    var dir=keys[e.key];
    if(!dir) return;
    e.preventDefault();
    var step=Math.max(16, ba.clientWidth*0.04);
    if(ba._cx==null) center();
    place(ba, ba._cx+dir[0]*step, ba._cy+dir[1]*step);
  });
  sec.querySelector('.prevp').addEventListener('click', function(){ show(index-1); });
  sec.querySelector('.nextp').addEventListener('click', function(){ show(index+1); });
  addEventListener('resize', layout);
  show(0);
  if(now.complete) center();
}
window.THEN_NOW={mount:mount, place:place};
})();
