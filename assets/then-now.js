/* Then-and-now slider shared by index.html and slider.html. */
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
  var img=ba.querySelector('.old');
  img.style.width=ba.clientWidth+'px';
}
function setSplit(ba, pct){
  pct=Math.max(0, Math.min(100, pct));
  ba.style.setProperty('--pct', pct+'%');
  ba.setAttribute('aria-valuenow', String(Math.round(pct)));
  layout(ba);
}
function fromEvent(ba, e){
  var r=ba.getBoundingClientRect();
  setSplit(ba, (e.clientX-r.left)/Math.max(1,r.width)*100);
}
function mount(list){
  if(!list) return;
  PAIRS.forEach(function(p, n){
    var sec=document.createElement('section');
    sec.className='pair';
    sec.innerHTML=
      '<h2>Pair '+(n+1)+'</h2>'+
      '<div class="ba" tabindex="0" role="slider" aria-label="Then and now, pair '+(n+1)+'" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50">'+
        '<img class="now" alt="" width="'+p.w+'" height="'+p.h+'" src="assets/pairs/'+p.id+'_new.jpg">'+
        '<div class="clip"><img class="old" alt="Then: black-and-white print. Now: colour photo." width="'+p.w+'" height="'+p.h+'" src="assets/pairs/'+p.id+'_old.jpg"></div>'+
        '<img class="ov" alt="50/50 overlay of the print and the colour photo" width="'+p.w+'" height="'+p.h+'">'+
        '<span class="tag then">Then</span><span class="tag now">Now</span>'+
        '<div class="handle" aria-hidden="true"><i></i><b></b></div>'+
      '</div>'+
      '<div class="row"><button type="button" class="toggle" aria-pressed="false">Show 50/50 overlay</button><span class="hint">Drag the line, or use the arrow keys</span></div>'+
      '<p class="cap"></p>';
    sec.querySelector('.cap').textContent=p.cap;
    var ba=sec.querySelector('.ba');
    var ov=ba.querySelector('.ov');
    var btn=sec.querySelector('.toggle');
    ba.addEventListener('pointerdown', function(e){
      if(ba.classList.contains('show-ov')) return;
      ba.setPointerCapture(e.pointerId);
      fromEvent(ba, e);
    });
    ba.addEventListener('pointermove', function(e){
      if(!ba.hasPointerCapture(e.pointerId)) return;
      fromEvent(ba, e);
    });
    ba.addEventListener('keydown', function(e){
      if(e.key!=='ArrowLeft' && e.key!=='ArrowRight') return;
      e.preventDefault();
      var cur=parseFloat(ba.getAttribute('aria-valuenow'))||50;
      setSplit(ba, cur+(e.key==='ArrowLeft'?-4:4));
    });
    btn.addEventListener('click', function(){
      var on=btn.getAttribute('aria-pressed')!=='true';
      btn.setAttribute('aria-pressed', on?'true':'false');
      btn.textContent=on?'Show the slider':'Show 50/50 overlay';
      ba.classList.toggle('show-ov', on);
      if(on && !ov.getAttribute('src')) ov.src='assets/pairs/'+p.id+'_overlay.jpg';
    });
    list.appendChild(sec);
    setSplit(ba, 50);
    var now=ba.querySelector('.now');
    if(now.complete) layout(ba);
    else now.addEventListener('load', function(){ layout(ba); });
  });
  addEventListener('resize', function(){
    list.querySelectorAll('.ba').forEach(layout);
  });
}
window.THEN_NOW={mount:mount, setSplit:setSplit};
})();
