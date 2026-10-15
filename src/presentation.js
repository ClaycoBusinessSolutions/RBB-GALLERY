import { mountArtField } from './art-field.js';
import { mountArcTransition } from './arc-transition.js';
import { mountMuseumMenu } from './museum-menu.js';
import { addQueuedReveal, createQueuedReveal } from './queued-reveal.js';
import { mountVariableTitle } from './variable-title.js';
import { mountLocationPlan } from './location-plan.js';
import { mountFilmSequence } from './film-sequence.js';

const $ = s => document.querySelector(s);
const scenes = [...document.querySelectorAll('.scene')];
const gsap = window.gsap;
const arcs = mountArcTransition($('#stage'));
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const state = { index: 0, transitioning: false, motion: !reduced.matches, autoplay: false, mode: 'live', options: { experience: 'table', prefunction: 'shelf', timeline: 'wall' }, lighting: 'day', views: { experience: 'axon', prefunction: 'axon', timeline: 'axon' } };
const source = {
 table: { image:'assets/images/option-table.webp', name:'Model table', slide:17 },
 glass: { image:'assets/images/option-glass.webp', name:'Glass floor', slide:19 },
 shelf: { image:'assets/images/option-shelf-table.webp', name:'Shelves + table', slide:21 },
 wall: { image:'assets/images/option-wall.webp', name:'Timeline wall', slide:23 }
};
let museumMenu, menuBusy=false;
const sheet=document.createElement('div');sheet.id='presentation-sheet';$('#stage').before(sheet);sheet.append($('#stage'),$('#deck-chrome'));
let art, artworks = [], films = {}, spatial, spatialPromise, queue = null, autoTimer, transition, historyTween, spotlightTimer;
const timelines = window.__timelines ||= {};
const focus = { value:0 };
const filmPlayers = new Map();
const afterFrames = () => new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
const isOverlay = () => !$('#overview').hidden || !!document.querySelector('dialog[open]');
const moving = () => state.motion && !reduced.matches && !document.hidden && !isOverlay();
const variableTitle = mountVariableTitle($('.cover-title'), { surface: $('#stage'), enabled: () => state.index === 0 && !state.transitioning && moving() && state.mode === 'live' });
const locationPlan = mountLocationPlan($('.location-plan-host'), { onSelect: zone => go(`${zone}-model`) });

function resize(){const width=document.documentElement.clientWidth,height=document.documentElement.clientHeight;document.documentElement.style.setProperty('--scale',Math.min(width/1920,height/1080));$('#stage').style.top=`${height/2}px`;}
addEventListener('resize',resize);resize();

// Paused, seekable scene timelines also support the HyperFrames presentation wrapper.
for(const scene of scenes){
 const tl=gsap.timeline({paused:true});
 tl.fromTo(scene.querySelector('.scene-inner'),{y:42,opacity:0},{y:0,opacity:1,duration:1.15,ease:'power3.out'},0);
 tl.to({}, {duration:Math.max(0,Number(scene.dataset.duration)-1.15)});
 timelines[scene.dataset.compositionId]=tl;
}
function updateChrome(){
 const current=scenes[state.index];
 $('#slide-label').textContent=current.dataset.label;
 $('#counter').textContent=`${String(state.index+1).padStart(2,'0')} / ${scenes.length}`;
 $('#prev').disabled=state.index===0;$('#next').disabled=state.index===scenes.length-1;
 $('#progress').style.width=`${(state.index+1)/scenes.length*100}%`;
 $('#autoplay-button').textContent=state.autoplay?'Pause':'Play';
 $('#autoplay-button').setAttribute('aria-label',state.autoplay?'Pause presentation':'Play presentation');
 $('#motion-button').textContent=state.motion?'Motion on':'Motion off';
 $('#motion-button').setAttribute('aria-label',state.motion?'Pause motion':'Resume motion');
 $('#motion-button').setAttribute('aria-pressed',String(state.motion));
 $('#status').textContent=`Slide ${state.index+1}. ${current.dataset.label}`;
 museumMenu?.setIndex(state.index);
}
function controlState(scene){
 const zone=scene.dataset.model||scene.dataset.film;
 const option=scene.dataset.film ? filmPlayers.get(scene)?.state.option : state.options[zone];
 scene.querySelectorAll('[data-option]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.option===option)));
 scene.querySelectorAll('[data-light]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.light===state.lighting)));
 scene.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===state.views[zone])));
 scene.classList.toggle('night',!!scene.dataset.model&&state.lighting==='night');
}
function buildControls(){for(const scene of scenes.filter(s=>s.dataset.model)){
 scene.querySelector('.model-controls').innerHTML='<div class="group" aria-label="Model view"><button data-view="axon">Spatial</button><button data-view="plan">Plan</button></div><div class="group" aria-label="Lighting"><button data-light="day">Day</button><button data-light="night">Night</button></div>';
 const note=document.createElement('p');note.className='model-note';note.textContent='Illustrative spatial study · drag to explore';scene.querySelector('.scene-inner').append(note);
 controlState(scene);
}}
function ensureSpatial(){
 if(!spatialPromise) spatialPromise=import('./spatial.js').then(async({mountSpatial})=>{
  spatial=mountSpatial($('#stage .model-slot'));spatial.update({active:false,motion:state.motion,reveal:false});
  await spatial.prepare?.();return spatial;
 }).catch(error=>{spatialPromise=null;console.error(error);return null});
 return spatialPromise;
}
async function prepareScene(scene){
 if(scene.dataset.model){
  const model=await ensureSpatial();if(!model){scene.querySelector('.model-note').textContent='3D view unavailable in this browser.';return;}
  const zone=scene.dataset.model,slot=scene.querySelector('.model-slot');
  model.rehost?.(slot);if(!model.rehost)slot.append(model.canvas);
  model.update({option:state.options[zone],lighting:state.lighting,view:state.views[zone],motion:moving(),active:false,reveal:false});
  await model.prepare?.();
 }
 if(scene.dataset.compositionId==='overall-plan'){locationPlan.setActive(false);locationPlan.seek(state.mode==='live'&&!moving()?locationPlan.duration:0);}
 if(scene.dataset.film) await prepareFilm(scene);
 if(scene.dataset.compositionId==='voices')showSpotlight(0);
 controlState(scene);
}
function defaultFilmOption(scene){return scene.dataset.film==='experience'?state.options.experience:scene.dataset.film==='prefunction'?'shelf':'wall';}
function sourceForClip(scene,clip){
 const option=clip?.option||defaultFilmOption(scene);
 return source[option]||Object.values(source).find(item=>item.slide===Number(clip?.source_slide))||source[defaultFilmOption(scene)];
}
function updateFilmStatus(scene,status){
 const clip=status.clip,spec=sourceForClip(scene,clip),count=status.clipCount||0;
 scene.classList.toggle('pending',!clip?.src||!!status.error);
 scene.querySelector('[data-replay]').disabled=!count;
 scene.querySelector('[data-replay]').textContent=status.error?'Retry':'Replay';
 scene.querySelector('[data-source]').disabled=!spec;
 const note=scene.querySelector('.film-note');
 if(status.error)note.textContent='Film unavailable · original proposal available';
 else if(clip?.src){
  const label=clip.label||spec?.name||'Gallery view';
  note.textContent=`${String((status.clipIndex||0)+1).padStart(2,'0')} / ${String(count).padStart(2,'0')} · ${label} · Cinematic concept`;
 }else note.textContent='Source rendering · cinematic sequence pending';
 scene.dataset.filmOption=clip?.option||'';
 scene.dataset.filmClip=clip?.id||'';
 scene.querySelectorAll('[data-option]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.option===clip?.option)));
}
function ensureFilmPlayer(scene){
 if(!filmPlayers.has(scene)){
  const spec=source[defaultFilmOption(scene)];
  const player=mountFilmSequence(scene.querySelector('.film-picture'),{
   location:scene.dataset.film,manifest:films,poster:spec.image,expectedCount:3,showIndicator:false,
   onStatus:status=>updateFilmStatus(scene,status)
  });
  filmPlayers.set(scene,player);
 }
 return filmPlayers.get(scene);
}
async function prepareFilm(scene){
 const player=ensureFilmPlayer(scene);
 player.setActive(false);
 await player.setContext({location:scene.dataset.film,...(scene.dataset.film==='experience'?{option:state.options.experience}:{})});
 await player.prepare();
 updateFilmStatus(scene,player.state);
}
function stopAmbient(scene){
 if(scene.classList.contains('cover'))variableTitle.setActive(false);
 if(scene.dataset.film)filmPlayers.get(scene)?.setActive(false);
 if(scene.dataset.compositionId==='overall-plan')locationPlan.setActive(false);
 if(scene.dataset.model)spatial?.update({active:false});
 if(scene.classList.contains('cover'))art?.setActive(false);
 clearInterval(spotlightTimer);historyTween?.pause();
}
function startAmbient(scene){
 variableTitle.setActive(scene.classList.contains('cover') && moving() && state.mode === 'live');
 $('#art-field').inert=!scene.classList.contains('cover');
 art?.setActive(scene.classList.contains('cover')&&moving());art?.setMotion(moving());
 if(scene.dataset.model)spatial?.update({active:true,motion:moving(),reveal:false});
 if(scene.dataset.compositionId==='overall-plan')locationPlan.setActive(true,{motion:moving()&&state.mode==='live'});
 if(scene.dataset.film){
  const player=filmPlayers.get(scene);
  player?.setOverlayOpen(isOverlay());player?.setMotion(moving()&&state.mode==='live');
  if(state.mode==='live')player?.resumeLive();
  player?.setActive(true);
 }
 if(scene.dataset.compositionId==='voices'&&moving()&&state.mode==='live'){
  let n=0;spotlightTimer=setInterval(()=>showSpotlight(++n,true),6200);
 }
 if(scene.dataset.compositionId==='history'){
  const img=scene.querySelector('img');
  const run=()=>{historyTween?.kill();historyTween=gsap.fromTo(img,{x:0},{x:-Math.max(0,img.naturalWidth/img.naturalHeight*370-1920),duration:38,ease:'none',repeat:-1,yoyo:true,paused:!moving()||state.mode!=='live'});};
  if(img.complete)run();else img.addEventListener('load',run,{once:true});
 }
}
function refreshMotion(){
 const scene=scenes[state.index];stopAmbient(scene);startAmbient(scene);updateChrome();scheduleAuto();
}
function scheduleAuto(){clearTimeout(autoTimer);if(state.autoplay&&!document.hidden&&!isOverlay()&&!state.transitioning)autoTimer=setTimeout(()=>{if(state.index<scenes.length-1)go(state.index+1);else{state.autoplay=false;updateChrome();}},Number(scenes[state.index].dataset.duration)*1000);}
async function go(index,{instant=false,seek=false}={}){
 if(typeof index==='string'&&!/^\d+$/.test(index)){index=scenes.findIndex(scene=>scene.dataset.compositionId===index);if(index<0)return;}
 index=Math.max(0,Math.min(scenes.length-1,Number(index)));
 if(!Number.isFinite(index))return;
 if(state.transitioning){queue=index;return;}
 if(index===state.index&&scenes[index].classList.contains('active'))return;
 state.transitioning=true;clearTimeout(autoTimer);
 variableTitle.setActive(false);
 const from=scenes[state.index],to=scenes[index],direction=index>=state.index?1:-1;
 if(from.dataset.film)filmPlayers.get(from)?.setActive(false);
 if(from.dataset.compositionId==='overall-plan')locationPlan.setActive(false);
 let outgoingSnapshot;
 if(from!==to&&from.dataset.model&&to.dataset.model&&spatial?.snapshot){
  outgoingSnapshot=new Image();outgoingSnapshot.src=spatial.snapshot();outgoingSnapshot.className='spatial-transition-snapshot';outgoingSnapshot.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none';from.querySelector('.model-slot').append(outgoingSnapshot);
 }
 gsap.set(to,{opacity:0});
 await prepareScene(to);
 // Keep the current slide visible until the incoming assets have a first frame.
 const hasFrom=from.classList.contains('active');
 state.index=index;controlState(to);updateChrome();
 const arc = !instant&&!reduced.matches&&hasFrom ? arcs.begin(to,{direction,curve:12}) : null;
 to.classList.add('active');to.inert=false;to.setAttribute('aria-hidden','false');
 from.inert=true;from.style.pointerEvents='none';
 to.style.zIndex='3';from.style.zIndex='2';
 timelines[to.dataset.compositionId].progress(1).pause();
 gsap.set(to.querySelector('.scene-inner'),{clearProps:'transform,opacity'});
 if(to.classList.contains('cover')){art?.setActive(moving());focus.value=1;art?.setFocus(1);$('#art-field').style.opacity='1';}
 if(to.dataset.model){spatial?.update({active:true,motion:moving(),reveal:false});await afterFrames();}
 const duration=instant||reduced.matches||!hasFrom?0:1.3;
 await new Promise(resolve=>{
  transition=gsap.timeline({onComplete:resolve});
  if(duration)addQueuedReveal(transition,to,{at:.18,reducedMotion:reduced.matches,instant:state.mode==='seek'});
  else createQueuedReveal(to,{instant:true});
  if(arc){gsap.set(to,{opacity:1});const arcClock={progress:0};transition.to(arcClock,{progress:1,duration,ease:'power2.inOut',onUpdate:()=>arc.draw(arcClock.progress)},0);}else transition.to(to,{opacity:1,duration:duration*.82,ease:'power2.inOut'},0);
  transition.fromTo(to.querySelector('.scene-inner'),{y:duration?direction*38:0,scale:duration?.965:1},{y:0,scale:1,duration,ease:'power3.out'},0);
  if(hasFrom&&from!==to){
   if(!arc)transition.to(from,{opacity:0,duration:duration*.9,ease:'power2.inOut'},0);
   transition.to(from.querySelector('.scene-inner'),{y:-direction*26,scale:1.025,duration,ease:'power2.inOut'},0);
  }
  if(from.classList.contains('cover')||to.classList.contains('cover')){
   transition.to(focus,{value:to.classList.contains('cover')?0:1,duration,ease:'power3.inOut',onUpdate:()=>art?.setFocus(focus.value)},0);
  }
  const controls=to.querySelectorAll('.model-options,.model-controls,.scene-cta');
  if(controls.length)transition.fromTo(controls,{opacity:duration?0:1,y:duration?14:0},{opacity:1,y:0,duration:duration*.5,ease:'power2.out',stagger:.04},duration*.5);
  if(!duration)transition.progress(1);
 });
 arc?.dispose();
 for(const scene of scenes){const active=scene===to;scene.classList.toggle('active',active);scene.inert=!active;scene.setAttribute('aria-hidden',String(!active));if(!active){if(scene.dataset.film)filmPlayers.get(scene)?.setActive(false);gsap.set(scene,{clearProps:'opacity,zIndex,pointerEvents'});gsap.set(scene.querySelector('.scene-inner'),{clearProps:'transform,opacity'});}}
 gsap.set(to,{clearProps:'opacity,zIndex,pointerEvents'});to.inert=false;
 clearInterval(spotlightTimer);historyTween?.pause();
 if(!to.dataset.model)spatial?.update({active:false});
 if(!to.classList.contains('cover')){$('#art-field').style.opacity='0';art?.setActive(false);}
 outgoingSnapshot?.remove();
 state.transitioning=false;startAmbient(to);
 if(!seek){history.replaceState(null,'',`#${to.dataset.compositionId}`);scheduleAuto();}
 // Preparing only the next scene keeps the catalogue and films bounded in memory.
 if(index<=3)ensureSpatial();
 const next=scenes[index+1];if(next?.dataset.film)prepareFilm(next).catch(()=>{});
 if(queue!==null){const target=queue;queue=null;if(target!==state.index)go(target);}
}
function showSpotlight(n,animate=false){
 if(!artworks.length)return;
 const selections=[1,0,5,11,18,40,65,96,122,160,203];const item=artworks[selections[n%selections.length]%artworks.length];
 const img=$('#spotlight-art'),credit=$('#spotlight-credit');
 const update=()=>{img.src=item.preview_src||item.src;img.alt=item.alt;credit.textContent=[item.artist,item.title,item.year].filter(Boolean).join(' / ');};
 if(animate){gsap.to([img,credit],{opacity:0,y:-12,duration:.6,onComplete:()=>{update();gsap.fromTo([img,credit],{opacity:0,y:18},{opacity:1,y:0,duration:.9,ease:'power2.out'});}});}else update();
}
function pauseForOverlay(){stopAmbient(scenes[state.index]);clearTimeout(autoTimer);}
let menuWanted=false,menuGeneration=0,menuPromise=Promise.resolve(true),menuSheetTween;
function setOverviewOpen(wanted){
 if(wanted===menuWanted&&(menuBusy||$('#overview').hidden===!wanted))return menuPromise;
 menuWanted=wanted;menuBusy=true;const generation=++menuGeneration;
 if(wanted){pauseForOverlay();sheet.inert=true;}
 const menuMotion=wanted?museumMenu.open():museumMenu.close();
 menuSheetTween?.kill();
 const sheetMotion=new Promise(resolve=>{
  menuSheetTween=gsap.to(sheet,{yPercent:wanted?-100:0,duration:reduced.matches?0:1.2,ease:'power3.inOut',onComplete:()=>resolve(true),onInterrupt:()=>resolve(false)});
 });
 menuPromise=Promise.all([menuMotion,sheetMotion]).then(()=>{
  if(generation!==menuGeneration)return false;
  menuBusy=false;
  if(!wanted){sheet.inert=false;refreshMotion();$('#stage').focus({preventScroll:true});}
  return true;
 });
 return menuPromise;
}
function closeOverview(){return setOverviewOpen(false);}
function openOverview(){if(state.transitioning&&!menuBusy)return Promise.resolve(false);return setOverviewOpen(true);}
function toggleOverview(){if(!menuWanted&&state.transitioning&&!menuBusy)return Promise.resolve(false);return setOverviewOpen(!menuWanted);}
function openArt(item){$('#art-image').src=item.preview_src||item.src;$('#art-image').alt=item.alt;$('#art-caption').textContent=[item.artist,item.title,item.year,`Catalogue p. ${item.page}`].filter(Boolean).join(' / ');pauseForOverlay();$('#art-dialog').showModal();}
function openSource(scene){
 const clip=filmPlayers.get(scene)?.state.clip,spec=sourceForClip(scene,clip);if(!spec)return;
 $('#source-image').src=spec.image;
 $('#source-caption').textContent=`${spec.name} / Exhibition Brief 2026.10.07 / slide ${spec.slide}. Original proposal rendering.`;
 pauseForOverlay();$('#source-dialog').showModal();
}
function fullscreen(){if(document.fullscreenElement)document.exitFullscreen?.();else document.documentElement.requestFullscreen?.().catch(()=>{});}
for(const [i,scene]of scenes.entries()){
 scene.inert=true;scene.setAttribute('aria-hidden','true');
}
buildControls();
museumMenu=mountMuseumMenu($('#overview'),{scenes,getIndex:()=>state.index,onSelect:async i=>{await closeOverview();await go(i);},onClose:()=>closeOverview()});
document.addEventListener('click',async e=>{
 const b=e.target.closest('button');if(!b)return;const scene=b.closest('.scene');
 if(b.hasAttribute('data-next'))go(state.index+1);
 if(b.hasAttribute('data-go'))go(b.dataset.go);
 if(b.dataset.option&&scene){
  if(scene.dataset.model){
   const zone=scene.dataset.model;state.options[zone]=b.dataset.option;if(b.dataset.option==='combined')state.views[zone]='plan';
   controlState(scene);spatial?.update({option:b.dataset.option,view:state.views[zone],reveal:false});
  }else if(scene.dataset.film){
   // Film browsing is independent of the design selected in the 3D model.
   await ensureFilmPlayer(scene).selectOption(b.dataset.option);
  }
 }
 if(b.dataset.view&&scene){state.views[scene.dataset.model]=b.dataset.view;spatial?.update({view:b.dataset.view});controlState(scene);}
 if(b.dataset.light&&scene){state.lighting=b.dataset.light;spatial?.update({lighting:b.dataset.light});controlState(scene);}
 if(b.hasAttribute('data-replay'))await filmPlayers.get(scene)?.replay();
 if(b.hasAttribute('data-source'))openSource(scene);
 if(b.classList.contains('close-dialog'))b.closest('dialog').close();
});
for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('close',refreshMotion);
$('#next').onclick=()=>go(state.index+1);$('#prev').onclick=()=>go(state.index-1);
$('#overview-button').onclick=openOverview;
$('#autoplay-button').onclick=()=>{state.autoplay=!state.autoplay;updateChrome();scheduleAuto();};
$('#motion-button').onclick=()=>{state.motion=!state.motion;refreshMotion();};$('#fullscreen-button').onclick=fullscreen;
addEventListener('keydown',e=>{
 if(document.querySelector('dialog[open]'))return;
 if(!$('#overview').hidden||menuBusy){if(e.key==='Escape'){e.preventDefault();closeOverview();}else if(e.key.toLowerCase()==='g'){e.preventDefault();if(!e.repeat)toggleOverview();}return;}
 if(/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))return;
 if(e.key==='ArrowRight'||e.key==='PageDown'||(e.code==='Space'&&e.target.tagName!=='BUTTON')){e.preventDefault();go(state.index+1);}
 if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();go(state.index-1);}
 if(e.key==='Home'){e.preventDefault();go(0);}if(e.key==='End'){e.preventDefault();go(scenes.length-1);}
 if(e.key.toLowerCase()==='f')fullscreen();if(e.key.toLowerCase()==='g'){e.preventDefault();if(!e.repeat)toggleOverview();}if(e.key.toLowerCase()==='m'){state.motion=!state.motion;refreshMotion();}
});
let touch;
$('#stage').addEventListener('touchstart',e=>{if(e.target.closest('canvas,button'))return;touch={x:e.touches[0].clientX,y:e.touches[0].clientY};},{passive:true});
$('#stage').addEventListener('touchend',e=>{if(!touch)return;const dx=e.changedTouches[0].clientX-touch.x,dy=e.changedTouches[0].clientY-touch.y;touch=null;if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.8)go(state.index+(dx<0?1:-1));},{passive:true});
document.addEventListener('visibilitychange',refreshMotion);reduced.addEventListener('change',()=>{state.motion=!reduced.matches;refreshMotion();});
addEventListener('fullscreenchange',()=>{$('#fullscreen-button').textContent=document.fullscreenElement?'Exit full screen':'Full screen';resize();});
let quietTimer;addEventListener('pointermove',()=>{document.body.classList.remove('chrome-quiet');clearTimeout(quietTimer);if(document.fullscreenElement)quietTimer=setTimeout(()=>document.body.classList.add('chrome-quiet'),3500);},{passive:true});

async function seekTime(time){
 state.mode='seek';state.autoplay=false;clearTimeout(autoTimer);
 const index=Math.max(0,scenes.findLastIndex(s=>Number(s.dataset.start)<=time));
 await go(index,{instant:true,seek:true});stopAmbient(scenes[index]);art?.setMotion(false);
 const local=Math.max(0,time-Number(scenes[index].dataset.start));
 timelines[scenes[index].dataset.compositionId].seek(local).pause();
 if(index===0){art?.seek(local);art?.setFocus(0);}
 if(scenes[index].dataset.model)spatial?.seek?.(local);
 if(scenes[index].dataset.compositionId==='overall-plan')locationPlan.seek(local);
 if(scenes[index].dataset.film)await filmPlayers.get(scenes[index])?.seek(local);
 updateChrome();
}
addEventListener('hf-seek',e=>{const p=seekTime(Number(e.detail?.time)||0);e.detail?.waitUntil?.(p);});
const ready=(async()=>{
 const results=await Promise.allSettled([fetch('assets/art/manifest.json').then(r=>r.json()),fetch('assets/video/manifest.json').then(r=>r.ok?r.json():{})]);
 if(results[0].status==='fulfilled'){artworks=results[0].value;art=mountArtField($('#art-field'),artworks,{onSelect:openArt});$('#art-field').removeAttribute('aria-hidden');}
 if(results[1].status==='fulfilled')films=results[1].value;
 showSpotlight(0);
 const hash=decodeURIComponent(location.hash.slice(1));const initial=scenes.findIndex(s=>s.dataset.compositionId===hash);
 await go(initial<0?0:initial,{instant:true});
 if('requestIdleCallback'in window)requestIdleCallback(()=>ensureSpatial(),{timeout:2000});else setTimeout(ensureSpatial,1000);
 return true;
})();
window.rbbDeck={go,next:()=>go(state.index+1),prev:()=>go(state.index-1),seek:seekTime,ready,get state(){return JSON.parse(JSON.stringify(state));},get spatialStats(){return spatial?.stats||null;},get catalogueCount(){return artworks.length;},get planStats(){return locationPlan.stats;},get filmStates(){return Object.fromEntries([...filmPlayers].map(([scene,player])=>[scene.dataset.film,player.state]));},openMenu:openOverview,closeMenu:closeOverview,resumeLive(){state.mode='live';refreshMotion();},async reloadFilms(){films=await fetch('assets/video/manifest.json',{cache:'no-store'}).then(r=>r.json());await Promise.all([...filmPlayers.values()].map(player=>player.setManifest(films)));if(scenes[state.index].dataset.film)startAmbient(scenes[state.index]);}};
