/* Full-width then-and-now divider shared by index.html and slider.html.
   The older print is on the left of the line. The colour photo is on the right. */
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
function layout(ba){
  var old=ba.querySelector('.old');
  old.style.width=ba.clientWidth+'px';
  old.style.height=ba.clientHeight+'px';
}
function setSplit(ba, pct){
  var w=ba.clientWidth;
  if(!(w>2)) return;
  pct=Math.max(0, Math.min(100, pct));
  ba.style.setProperty('--pct', pct+'%');
  ba._pct=pct;
  ba.setAttribute('aria-valuenow', String(Math.round(pct)));
  ba.setAttribute('aria-valuetext', 'Divider at '+Math.round(pct)+' percent. Then on the left, now on the right.');
  layout(ba);
}
function mount(list){
  if(!list || list.dataset.mounted) return;
  list.dataset.mounted='1';
  var sec=document.createElement('section');
  sec.className='pair';
  sec.innerHTML=
    '<div class="ba" tabindex="0" role="slider" aria-label="Then and now. The older print is on the left of the line and the colour photo is on the right. Arrow keys move the line." aria-valuemin="0" aria-valuemax="100" aria-valuenow="50">'+
      '<img class="now" alt="Now, on the right: colour photo">'+
      '<div class="clip"><img class="old" alt="Then, on the left: black-and-white print"></div>'+
      '<span class="tag then">Then (left)</span>'+
      '<span class="tag now">Now (right)</span>'+
      '<div class="handle" aria-hidden="true"><i></i><b></b></div>'+
    '</div>'+
    '<div class="row">'+
      '<button type="button" class="pairnav prevp">Previous pair</button>'+
      '<span class="pairn" aria-live="polite"></span>'+
      '<button type="button" class="pairnav nextp">Next pair</button>'+
    '</div>'+
    '<p class="cap"></p>';
  list.appendChild(sec);
  var ba=sec.querySelector('.ba');
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
    cap.textContent=p.cap;
    pairn.textContent='Pair '+(index+1)+' of '+PAIRS.length;
    ba._pct=50;
    if(now.complete && now.naturalWidth) setSplit(ba, 50);
  }
  function atEvent(e){
    var r=ba.getBoundingClientRect();
    setSplit(ba, (e.clientX-r.left)/Math.max(1, r.width)*100);
  }
  now.addEventListener('load', function(){ setSplit(ba, ba._pct==null?50:ba._pct); });
  ba.addEventListener('pointerdown', function(e){
    if(e.button!=null && e.button!==0) return;
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
    if(e.key!=='ArrowLeft' && e.key!=='ArrowRight') return;
    e.preventDefault();
    var cur=ba._pct==null?50:ba._pct;
    setSplit(ba, cur+(e.key==='ArrowLeft'?-4:4));
  });
  sec.querySelector('.prevp').addEventListener('click', function(){ show(index-1); });
  sec.querySelector('.nextp').addEventListener('click', function(){ show(index+1); });
  addEventListener('resize', function(){ setSplit(ba, ba._pct==null?50:ba._pct); });
  show(0);
  if(now.complete && now.naturalWidth) setSplit(ba, 50);
}
window.THEN_NOW={mount:mount, setSplit:setSplit};
})();
