// ===== Audio Core (WebAudio fallback) =====
const AudioKit = (()=>{
  // Create AudioContext ONLY after a user gesture to satisfy autoplay policy
  let ctx=null, master=null, musicG=null, sfxG=null, timer=null, step=0;
  const SCALE=[0,2,3,5,7,9,10];

  function isReady(){ return !!ctx; }

  function unlock(){
    if(isReady()) { if(ctx.state==='suspended') ctx.resume(); return; }
    try{
      ctx = new (window.AudioContext||window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value=0.9; master.connect(ctx.destination);
      musicG = ctx.createGain(); musicG.gain.value=0.22; musicG.connect(master);
      sfxG = ctx.createGain(); sfxG.gain.value=0.9;  sfxG.connect(master);
    }catch(e){
      // If creation fails, keep silent; user can try again
      ctx = null;
    }
  }

  function mute(on){ if(!isReady()) return; master.gain.value = on? 0 : 0.9; }
  function beep({freq=880, dur=0.07, type='square'}){
    if(!isReady()) return;
    const t0=ctx.currentTime; const o=ctx.createOscillator(); const g=ctx.createGain();
    o.type=type; o.frequency.value=freq; g.gain.value=0;
    g.gain.linearRampToValueAtTime(0.6,t0+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
    o.connect(g).connect(sfxG); o.start(t0); o.stop(t0+dur+0.02);
  }
  function n2f(n){ return 440*Math.pow(2,(n-69)/12) }
  function play(freq,len=0.24,vol=0.15){
    if(!isReady()) return;
    const t=ctx.currentTime; const o=ctx.createOscillator(); const g=ctx.createGain();
    o.type='triangle'; o.frequency.value=freq; g.gain.value=0;
    g.gain.linearRampToValueAtTime(vol,t+0.02);
    g.gain.exponentialRampToValueAtTime(0.0001,t+len);
    o.connect(g).connect(musicG); o.start(t); o.stop(t+len+0.05);
  }
  function startMusic(){
    if(!isReady()) return; stopMusic(); step=0; const base=57;
    timer=setInterval(()=>{ const deg=SCALE[step%SCALE.length];
      play(n2f(base+deg+12),0.22,0.18);
      if(step%2===0) play(n2f(base+deg-12),0.28,0.12);
      step=(step+1)%32;
    }, 280);
  }
  function stopMusic(){ if(timer){ clearInterval(timer); timer=null; } }
  return {unlock, mute, beep, startMusic, stopMusic};
})();

// ===== External Music via YouTube (with fallback) =====
const Music = (()=>{
  const YT_ID = "mdViuOHgiaQ"; // requested video ID
  const START_SEC = 16;          // start at 15 seconds
  let usingYT = false, ytReady = false, player = null, muted = false;

  function setup(){
    if(window.YT && window.YT.Player){
      create();
    } else {
      window.onYouTubeIframeAPIReady = ()=> create();
    }
  }
  function create(){
    try{
      player = new YT.Player('ytbg', {
        videoId: YT_ID,
        playerVars: {
          autoplay: 0, controls: 0, disablekb: 1, fs: 0, modestbranding: 1,
          playsinline: 1, rel: 0, loop: 1, playlist: YT_ID, start: START_SEC
        },
        events: {
          'onReady': ()=>{ ytReady = true; usingYT = true; if(muted) player.mute(); },
          'onStateChange': (e)=>{
            // Ensure loop restarts from START_SEC
            if(e.data === YT.PlayerState.ENDED){
              player.seekTo(START_SEC, true);
              player.playVideo();
            }
          },
          'onError': ()=>{ usingYT = false; }
        }
      });
    }catch(e){ usingYT = false; }
  }
  function play(){
    if(usingYT && ytReady){
      // Make sure we start at 15s even on first gesture
      try { player.seekTo(START_SEC, true); } catch(_) {}
      player.setVolume(55);
      player.playVideo();
    } else {
      AudioKit.startMusic();
    }
  }
  function stop(){ if(usingYT && ytReady){ player.pauseVideo(); } else { AudioKit.stopMusic(); } }
  function setMute(on){ muted = on; if(usingYT && ytReady){ if(on) player.mute(); else player.unMute(); } AudioKit.mute(on); }
  return { setup, play, stop, setMute };
})();

// ===== Game (Desktop + Mobile, DPR, delta-time, mobile zoom 0.6) =====
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let DPR = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
let mode = 'desktop'; // 'desktop' | 'mobile'
let W=0, H=0, groundY=0, scale=1;

const overlay = document.getElementById('overlay');
const card = document.getElementById('card');
const scoreEl = document.getElementById('score');
const btnStart = document.getElementById('btnStart');
const btnMute = document.getElementById('btnMute');
const btnToggle = document.getElementById('btnToggle');
const btnFS = document.getElementById('btnFS');

let running=false, gameOver=false, lastTs=0, t=0, speed=0;
const MOBILE_ZOOM = 0.6;
const DESKTOP_START_SPEED = 360;
const MOBILE_START_SPEED = 420;
const DESKTOP_RAMP = 24;
const MOBILE_RAMP = 30;
const currentStartSpeed = ()=> mode==='mobile' ? MOBILE_START_SPEED : DESKTOP_START_SPEED;
const currentRamp = ()=> mode==='mobile' ? MOBILE_RAMP : DESKTOP_RAMP;

let score=0, best=0;
const gravity = 1800;
const jumpVelBase = -820;

// Capybara sprite (provided base64), flipped horizontally, no shadow
const CAPY_SRC = 'data:image/png;base64,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';
const capyImg = new Image(); capyImg.src = CAPY_SRC; let capyReady=false; capyImg.onload=()=>capyReady=true;

const player = { x:120, y:0, w:60, h:60, vy:0, onGround:false };
const pops = []; let spawnTimer=0;

const keys = new Set(); let touchDown=false; const wantJump=()=> keys.has(' ')||keys.has('ArrowUp')||touchDown;
window.addEventListener('keydown',e=>{ if(['Space','ArrowUp'].includes(e.code)) e.preventDefault(); keys.add(e.key); if((e.code==='Space'||e.code==='ArrowUp')&&!running) start(); if(e.key.toLowerCase()==='m') toggleMute(); }, {passive:false});
window.addEventListener('keyup',e=> keys.delete(e.key));
canvas.addEventListener('pointerdown',e=>{ e.preventDefault(); touchDown=true; if(!running) start(); }, {passive:false});
window.addEventListener('pointerup',()=> touchDown=false, {passive:true});
window.addEventListener('touchmove',e=> e.preventDefault(), {passive:false});

let muted=false; function toggleMute(){ muted=!muted; Music.setMute(muted); if(btnMute) btnMute.textContent = muted? '🔈 Unmute' : '🔇 Mute'; }
if(btnStart) btnStart.addEventListener('click', start, {passive:true});
if(btnMute) btnMute.addEventListener('click', toggleMute, {passive:true});
if(btnToggle) btnToggle.addEventListener('click', ()=>{ setMode(mode==='desktop'?'mobile':'desktop', true); });
if(btnFS) btnFS.addEventListener('click', ()=>{ const el = document.documentElement; if(!document.fullscreenElement){ el.requestFullscreen?.(); } else { document.exitFullscreen?.(); } });

function setMode(next, manual=false){
  if(mode===next) return;
  mode = next;
  document.body.classList.toggle('mobile', mode==='mobile');
  document.body.classList.toggle('desktop', mode==='desktop');
  if(btnToggle) btnToggle.textContent = mode==='mobile' ? '🖥️ Desktop mode' : '📱 Mobile mode';
  resize(); reset();
  if(manual){ localStorage.setItem('capy_mode', mode); }
}

function autoMode(){
  const saved = localStorage.getItem('capy_mode');
  if(saved==='desktop' || saved==='mobile'){ mode=saved; }
  else { mode = Math.min(window.innerWidth, window.innerHeight) < 700 ? 'mobile' : 'desktop'; }
  document.body.classList.add(mode);
}

function resize(){
  DPR = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  if(mode==='mobile'){
    const Wcss = window.innerWidth, Hcss = window.innerHeight;
    W = Math.floor(Wcss * DPR); H = Math.floor(Hcss * DPR);
    canvas.width = W; canvas.height = H;
    canvas.style.width = '100vw'; canvas.style.height = '100vh';
    ctx.setTransform(1,0,0,1,0,0); ctx.scale(DPR, DPR);
    groundY = (H/DPR) - 80;
    scale = ((H/DPR) / 360) * 0.6;
  } else {
    const baseW=960, baseH=360;
    W = Math.floor(baseW * DPR); H = Math.floor(baseH * DPR);
    canvas.width = W; canvas.height = H;
    canvas.style.width = 'min(960px,96vw)'; canvas.style.height = 'auto';
    ctx.setTransform(1,0,0,1,0,0); ctx.scale(DPR, DPR);
    groundY = baseH - 64;
    scale = 1;
  }
}
window.addEventListener('resize', ()=>{ const prev=mode; if(!localStorage.getItem('capy_mode')){ const m = Math.min(window.innerWidth, window.innerHeight) < 700 ? 'mobile' : 'desktop'; if(m!==prev){ mode=m; document.body.className=m; } } resize(); });

function reset(){ running=false; gameOver=false; t=0; score=0; spawnTimer=0; pops.length=0; speed = currentStartSpeed(); player.x = mode==='mobile'? Math.max(32, 0.12*(W/DPR)) : 120; player.w=Math.round(60*scale); player.h=Math.round(60*scale); player.y=groundY-player.h; player.vy=0; player.onGround=true; if(scoreEl) scoreEl.textContent='Score: '+score; }
function start(){ AudioKit.unlock(); Music.play(); if(overlay) overlay.style.display='none'; if(gameOver) reset(); if(!running){ running=true; lastTs=performance.now(); requestAnimationFrame(loop); } }
function end(){ running=false; gameOver=true; best=Math.max(best,score); Music.stop(); if(overlay) overlay.style.display='grid'; if(card) card.innerHTML = `
      <h1>Game Over 😵‍💫</h1>
      <p>Score: <strong>${score}</strong> • Best: <strong>${best}</strong></p>
      <p>${mode==='mobile'?'Tap':'Press'} <span class="kbd">Space</span> to retry.</p>
      <div style="margin-top:10px"><button onclick="(${start.toString()})()">Retry</button></div>`; }

function spawnPop(){
  const baseW=28*scale, baseH=50*scale;
  const w = baseW + Math.random()*10*scale;
  const h = baseH + Math.random()*15*scale;
  pops.push({ x:(mode==='mobile'?(W/DPR):960)+20, y:groundY-h, w, h });
}
function collide(a,b){ return !(a.x+a.w < b.x+6 || a.x+6 > b.x+b.w || a.y+a.h < b.y+6 || a.y+6 > b.y+b.h); }

function drawPop(x,y,w,h){
  ctx.fillStyle = '#c79c55'; roundRect(x+w*0.4, y+h*0.9, w*0.2, h*0.5, 6*scale); ctx.fill();
  const colors = ['#ff6b6b','#ffd93d','#6bcb77','#4d96ff','#a78bfa'];
  ctx.fillStyle = colors[Math.floor((x/37)%colors.length)]; roundRect(x, y, w, h, 12*scale); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.5)'; roundRect(x+w*0.1, y+h*0.1, w*0.12, h*0.5, 6*scale); ctx.fill();
}
function roundRect(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }

function drawCapy(x,y,w,h){
  if(capyReady || (capyImg.complete && capyImg.naturalWidth>0)){
    ctx.save(); ctx.scale(-1,1); ctx.drawImage(capyImg, -x - w, y, w, h); ctx.restore();
  } else { ctx.fillStyle='#b88b5c'; ctx.fillRect(x,y,w,h); }
}

function drawGround(){
  const gcol=getComputedStyle(document.documentElement).getPropertyValue('--ground');
  const viewW = (mode==='mobile'? (W/DPR) : 960);
  const viewH = (mode==='mobile'? (H/DPR) : 360);
  ctx.fillStyle=gcol; ctx.fillRect(0, groundY, viewW, viewH-groundY);
  ctx.strokeStyle='rgba(0,0,0,.06)'; ctx.lineWidth=1; const step = 20*scale; for(let x=0;x<viewW;x+=step){ ctx.beginPath(); ctx.moveTo((x-(t*speed*0.06)% step),groundY); ctx.lineTo((x-(t*speed*0.06)%step)+10*scale, groundY-4*scale); ctx.stroke(); }
}
function drawBackground(){ const viewW = (mode==='mobile'? (W/DPR) : 960); ctx.save(); ctx.globalAlpha=0.7; const n=6; for(let i=0;i<n;i++){ const nx=(i*240*scale - (t*speed*0.18)%(viewW+240*scale)) - 80*scale; const ny=40*scale + (i%3)*25*scale; cloud(nx,ny,80*scale+(i%2)*30*scale, 30*scale+(i%2)*10*scale); } ctx.restore(); }
function cloud(x,y,w,h){ ctx.fillStyle='rgba(255,255,255,.9)'; ctx.beginPath(); ctx.ellipse(x,y,w*0.6,h,0,0,Math.PI*2); ctx.ellipse(x+w*0.3,y-8*scale,w*0.4,h*1.1,0,0,Math.PI*2); ctx.ellipse(x-w*0.2,y-6*scale,w*0.35,h*0.9,0,0,Math.PI*2); ctx.fill(); }

function update(dt){
  if(!running) return;
  t += dt; score += Math.floor(60*dt);
  const targetSpeed = currentStartSpeed() + Math.min(600, t*currentRamp());
  speed += (targetSpeed - speed)*0.02;
  spawnTimer -= dt; const spawnEvery = Math.max(0.7, 1.6 - t*0.02);
  if(spawnTimer<=0){ spawnPop(); spawnTimer = spawnEvery; }
  const jumpVel = jumpVelBase * Math.max(0.85, Math.min(1.25, scale));
  player.vy += gravity * dt; player.y += player.vy * dt; player.onGround=false;
  if(player.y + player.h >= groundY){ player.y = groundY - player.h; player.vy = 0; player.onGround = true; }
  if(wantJump() && player.onGround){ player.vy = jumpVel; player.onGround=false; AudioKit.beep({freq:880,dur:0.07,type:'square'}); }
  for(let i=pops.length-1;i>=0;i--){ const o=pops[i]; o.x -= speed*dt; const viewLeft=-20; if(o.x + o.w < viewLeft) pops.splice(i,1); if(collide({x:player.x,y:player.y,w:player.w,h:player.h}, o)){ AudioKit.beep({freq:120,dur:0.2,type:'sawtooth'}); end(); } }
  if(scoreEl) scoreEl.textContent = 'Score: '+score;
}

function render(){ const viewW = (mode==='mobile'? (W/DPR) : 960); const viewH = (mode==='mobile'? (H/DPR) : 360); ctx.clearRect(0,0,viewW,viewH); drawBackground(); drawGround(); drawCapy(player.x,player.y,player.w,player.h); for(const o of pops) drawPop(o.x,o.y,o.w,o.h); }
function loop(now){ const dt = Math.min(0.05, (now - lastTs)/1000); lastTs = now; update(dt); render(); if(running) requestAnimationFrame(loop); }

document.addEventListener('visibilitychange', ()=>{ if(document.hidden && running){ running=false; Music.stop(); } });

// init
autoMode(); resize(); reset(); Music.setup();

// Tests
(function runTests(){
  const out = document.getElementById('tests');
  const results = []; const ok=(n)=>results.push(`✔️ ${n}`); const ko=(n,m)=>results.push(`❌ ${n} — ${m||''}`);
  try { const a={x:0,y:0,w:10,h:10}, b={x:5,y:5,w:10,h:10}, c={x:20,y:20,w:5,h:5}; (collide(a,b)&&!collide(a,c))?ok('AABB collide'):ko('AABB collide'); } catch(e){ ko('AABB collide', e.message); }
  try { let vy=200, y=100-40-1, dt=1/60; vy+=1800*dt; y+=vy*dt; if(y+40>=100){y=100-40;vy=0;} (y===60&&vy===0)?ok('Ground physics'):ko('Ground physics'); } catch(e){ ko('Ground physics', e.message); }
  setTimeout(()=>{ (capyReady || (capyImg.complete && capyImg.naturalWidth>0))?ok('Capy sprite loaded'):ko('Capy sprite loaded','not ready'); if(out) out.innerHTML = 'Tests: ' + results.map(x=>`<b>${x}</b>`).join(' · ').replaceAll('❌','<span class=\"fail\">❌</span>'); }, 150);
})();