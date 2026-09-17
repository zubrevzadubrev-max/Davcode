'use strict';
// Музыка и эффекты имеют отдельные регуляторы. Учебное хранилище не изменяется.
const SOUND_KEY = 'davcode.sound.v1';
function readSoundSettings() {
  const defaults={effects:true,effectVolume:0.18,musicVolume:0.3,muted:false};
  try {
    const saved=JSON.parse(localStorage.getItem(SOUND_KEY)||'null');
    if(saved && typeof saved==='object') {
      for(const key of ['effects','muted']) if(typeof saved[key]==='boolean') defaults[key]=saved[key];
      for(const key of ['effectVolume','musicVolume']) if(Number.isFinite(saved[key])) defaults[key]=Math.max(0,Math.min(1,saved[key]));
    }
  } catch { /* При запрете хранилища настройки живут в памяти. */ }
  return defaults;
}
const soundSettings=readSoundSettings();
function saveSoundSettings() { try {localStorage.setItem(SOUND_KEY,JSON.stringify(soundSettings));} catch { /* Сеанс продолжается. */ } }
const soundIcons={
  music:'<path d="M9 18V5l11-2v13M9 8l11-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="17" cy="16" rx="3" ry="2"/>',
  play:'<path d="m8 4 12 8-12 8Z"/>',pause:'<path d="M8 4v16M16 4v16"/>',
  previous:'<path d="M5 5v14m14-14L7 12l12 7Z"/>',next:'<path d="M19 5v14M5 5l12 7-12 7Z"/>',
  volume:'<path d="M3 9h4l5-4v14l-5-4H3Zm12-1a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute:'<path d="M3 9h4l5-4v14l-5-4H3Zm13 0 6 6m0-6-6 6"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',minimize:'<path d="M5 16h14"/>',expand:'<path d="m5 15 7-7 7 7"/>',
  settings:'<path d="m9 3-1 3-3 1-2 5 2 5 3 1 1 3h6l1-3 3-1 2-5-2-5-3-1-1-3Z"/><circle cx="12" cy="12" r="3"/>'
};
function audioIcon(name) {return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${soundIcons[name]}</svg>`;}
function mediaTime(seconds) { if(!Number.isFinite(seconds)||seconds<0)return '0:00';return `${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`; }

// Один контроллер и один HTMLAudioElement на всё время жизни страницы.
class MusicController {
  constructor(audio,tracks,onChange=()=>{}) {
    this.audio=audio;this.tracks=tracks;this.current=tracks[0]?.id;this.filter='Все';this.loaded=null;
    this.onChange=onChange;this.error='';this.wantsPlay=false;this.revision=0;
    audio.preload='none';audio.volume=soundSettings.musicVolume;audio.muted=soundSettings.muted;
    for(const name of ['timeupdate','durationchange','loadedmetadata','play','pause','volumechange','waiting','playing']) audio.addEventListener(name,()=>this.onChange());
    audio.addEventListener('ended',()=>{if(this.wantsPlay)this.next(1);});
    audio.addEventListener('error',()=>{
      this.revision++;this.wantsPlay=false;audio.pause();
      this.error='Не удалось загрузить композицию. Повтори попытку или выбери другой трек.';this.onChange();
    });
  }
  track() { return this.tracks.find(t=>t.id===this.current); }
  visible() {return this.tracks.filter(t=>this.filter==='Все'||t.genre===this.filter);}
  setFilter(value) {this.filter=value;this.onChange();}
  async select(id) {
    if(!this.tracks.some(t=>t.id===id))return;
    this.revision++;this.audio.pause();this.current=id;this.wantsPlay=false;
    if(this.loaded!==id) {this.audio.src=this.track().file;this.audio.load();this.loaded=id;}
    await this.play();
  }
  async play() {
    const track=this.track();if(!track)return;
    const ticket=++this.revision;
    this.error='';this.wantsPlay=true;
    if(this.loaded!==track.id||this.audio.error) {this.audio.src=track.file;this.audio.load();this.loaded=track.id;}
    this.onChange();
    try {await this.audio.play();if(ticket===this.revision&&!this.wantsPlay)this.audio.pause();}
    catch(error) {if(ticket!==this.revision)return;this.wantsPlay=false;this.audio.pause();this.error=error.name==='NotAllowedError'?'Браузер не разрешил запуск. Нажми «Воспроизвести» ещё раз.':'Не удалось воспроизвести файл. Повтори попытку или выбери другой трек.';}
    this.onChange();
  }
  pause() {this.revision++;this.wantsPlay=false;this.audio.pause();this.onChange();}
  toggle() {if(this.wantsPlay)this.pause();else this.play();}
  next(direction) {
    const list=this.visible();if(!list.length)return;
    const index=list.findIndex(t=>t.id===this.current);
    const next=index<0?(direction>0?0:list.length-1):(index+direction+list.length)%list.length;
    this.select(list[next].id);
  }
  seek(seconds) {if(Number.isFinite(this.audio.duration)&&this.audio.duration>0)this.audio.currentTime=Math.max(0,Math.min(this.audio.duration,seconds));this.onChange();}
  volume(value) {soundSettings.musicVolume=Math.max(0,Math.min(1,value));this.audio.volume=soundSettings.musicVolume;saveSoundSettings();this.onChange();}
  mute() {soundSettings.muted=!soundSettings.muted;this.audio.muted=soundSettings.muted;saveSoundSettings();this.onChange();}
}

let effectContext=null,lastEffect=-Infinity;
async function playEffect(kind='correct') {
  if(!soundSettings.effects||soundSettings.effectVolume===0)return false;
  const now=Date.now();if(now-lastEffect<350)return false;lastEffect=now;
  try {
    const AudioCtx=window.AudioContext||window.webkitAudioContext;
    if(!AudioCtx)return false;
    effectContext ||= new AudioCtx();
    if(effectContext.state==='suspended')await effectContext.resume();
    if(effectContext.state!=='running'||!soundSettings.effects)return false;
    const patterns={correct:[523,659],wrong:[294,262],lesson:[523,659,784],test:[587,740,880],achievement:[659,784,988],certificate:[523,659,784,1047]};
    const notes=patterns[kind]||patterns.correct;
    notes.forEach((frequency,i)=>{
      const oscillator=effectContext.createOscillator(),gain=effectContext.createGain(),start=effectContext.currentTime+i*0.09;
      oscillator.type='sine';oscillator.frequency.value=frequency;
      gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(soundSettings.effectVolume*0.16,start+0.015);gain.gain.exponentialRampToValueAtTime(0.0001,start+0.13);
      oscillator.connect(gain);gain.connect(effectContext.destination);oscillator.start(start);oscillator.stop(start+0.15);
      oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
    });return true;
  } catch {return false;}
}
window.DavSound={play:playEffect};

function setupAudioInterface() {
  const panel=document.createElement('section');panel.id='music-player';panel.className='music-player';panel.hidden=true;
  panel.setAttribute('aria-label','Музыкальный плеер');
  panel.innerHTML=`<div class="player-header"><span id="player-drag" tabindex="0" aria-label="Плеер. На компьютере перемещается мышью или стрелками клавиатуры">${audioIcon('music')} <b>Музыка для твоего ритма</b></span><button class="ghost icon-button" id="player-minimize" aria-label="Свернуть плеер">${audioIcon('minimize')}</button><button class="ghost icon-button" id="player-close" aria-label="Закрыть плеер и поставить на паузу">${audioIcon('close')}</button></div><div class="player-body"><div class="now-playing"><div class="track-art" aria-hidden="true">${audioIcon('music')}<span>DavCode</span></div><div><b id="track-title"></b><p id="track-meta"></p></div></div><div class="player-transport"><button class="secondary icon-button" id="track-prev" aria-label="Предыдущий трек">${audioIcon('previous')}</button><button id="track-play" aria-label="Воспроизвести">${audioIcon('play')}<span>Слушать</span></button><button class="secondary icon-button" id="track-next" aria-label="Следующий трек">${audioIcon('next')}</button></div><div class="player-seek"><label for="track-seek" class="sr-only">Позиция в композиции</label><input type="range" id="track-seek" min="0" max="100" step="0.1" value="0" disabled><div><span id="track-time">0:00</span><span id="track-duration">0:00</span></div></div><div class="player-volume"><button class="ghost icon-button" id="track-mute" aria-label="Выключить музыку">${audioIcon('volume')}</button><label for="track-volume">Громкость</label><input type="range" id="track-volume" min="0" max="1" step="0.01"><output id="track-volume-value"></output></div><p id="player-error" class="feedback error" role="status"></p><div class="player-library"><label class="input-label" for="music-genre">Жанр<select id="music-genre"></select></label><p class="hint">Переключение вперёд и назад — внутри выбранного жанра.</p><div id="track-list" class="track-list" role="group" aria-label="Композиции"></div><p class="hint music-shortage">${escapeHtml(MUSIC_NOTICE)}</p><details><summary>О музыке и лицензиях</summary><p class="hint">Композиции используются по CC0 или CC BY 4.0. Инструментальные треки отмечены в списке. Автор и источник указаны для каждого трека.</p><div id="music-credits"></div><a class="text-link" href="./MUSIC_CREDITS.md" target="_blank" rel="noopener">Полные сведения об источниках</a></details></div></div><audio id="davcode-audio" preload="none"></audio>`;
  document.body.append(panel);
  const settings=document.createElement('dialog');settings.id='sound-settings';
  settings.innerHTML=`<div class="section-head"><h2>Настройки звука</h2><button id="close-settings" class="ghost icon-button" aria-label="Закрыть настройки">${audioIcon('close')}</button></div><label class="option"><input type="checkbox" id="effects-enabled">Звуковые эффекты</label><label class="input-label" for="effects-volume">Громкость эффектов <output id="effects-volume-value"></output><input id="effects-volume" type="range" min="0" max="1" step="0.01"></label><button id="test-sound" class="secondary">Проверить звук</button><p id="sound-message" class="hint" role="status"></p><label class="input-label" for="settings-music-volume">Громкость музыки <output id="settings-music-value"></output><input id="settings-music-volume" type="range" min="0" max="1" step="0.01"></label><p id="settings-muted" class="hint"></p><p class="hint">Музыка и эффекты независимы. Музыка запускается только по твоему нажатию.</p>`;
  document.body.append(settings);
  const audio=$('#davcode-audio');let minimized=false,open=false,position=null,drag=null,lastLibrary='';
  const player=new MusicController(audio,MUSIC,refresh);
  const mobile=()=>window.matchMedia('(max-width: 620px)').matches;
  function reserveSpace() {
    document.body.style.setProperty('--player-space',open&&mobile()?`${panel.offsetHeight+16}px`:'0px');
    document.body.classList.toggle('music-open',open);
  }
  function clampPosition() {
    if(mobile()){panel.style.left='';panel.style.top='';return;}
    if(!position && !panel.hidden) {const rect=panel.getBoundingClientRect();position={x:rect.left,y:rect.top};}
    if(position) {
      position.x=Math.max(8,Math.min(position.x,Math.max(8,window.innerWidth-panel.offsetWidth-8)));
      position.y=Math.max(8,Math.min(position.y,Math.max(8,window.innerHeight-panel.offsetHeight-8)));
      panel.style.left=position.x+'px';panel.style.top=position.y+'px';
    }
  }
  function refresh() {
    const track=player.track();
    $('#track-title').textContent=track?.title||'Подборка недоступна';
    $('#track-meta').textContent=track?`${track.artist} · ${track.genre} · Инструментал`:'';
    $('#track-play').innerHTML=audioIcon(player.wantsPlay?'pause':'play')+`<span>${player.wantsPlay?'Пауза':'Слушать'}</span>`;
    $('#track-play').setAttribute('aria-label',player.wantsPlay?'Пауза':'Воспроизвести');
    $('#track-time').textContent=mediaTime(audio.currentTime);$('#track-duration').textContent=mediaTime(audio.duration);
    const seek=$('#track-seek'),valid=Number.isFinite(audio.duration)&&audio.duration>0;
    seek.disabled=!valid;seek.max=valid?audio.duration:100;seek.value=valid?audio.currentTime:0;seek.setAttribute('aria-valuetext',mediaTime(audio.currentTime)+' из '+mediaTime(audio.duration));
    for(const id of ['#track-volume','#settings-music-volume']) $(id).value=soundSettings.musicVolume;
    for(const id of ['#track-volume-value','#settings-music-value']) $(id).textContent=Math.round(soundSettings.musicVolume*100)+'%';
    $('#track-mute').innerHTML=audioIcon(audio.muted?'mute':'volume');$('#track-mute').setAttribute('aria-label',audio.muted?'Включить музыку':'Выключить музыку');$('#track-mute').setAttribute('aria-pressed',String(audio.muted));
    $('#settings-muted').textContent=audio.muted?'Музыка сейчас выключена кнопкой в плеере.':'';
    $('#player-error').textContent=player.error;
    const library=player.filter+'|'+player.current;
    if(library!==lastLibrary) {
      lastLibrary=library;
      $('#track-list').innerHTML=player.visible().map(t=>`<button class="track-item ${t.id===player.current?'selected':''}" data-track="${t.id}" aria-pressed="${t.id===player.current}"><span>${audioIcon('music')}</span><span><b>${escapeHtml(t.title)}</b><small>${escapeHtml(t.artist)} · ${t.genre} · инструментал</small></span></button>`).join('')||'<p class="hint">В этом жанре пока нет файлов. Выбери другой жанр.</p>';
    }
  }
  $('#music-genre').innerHTML=['Все',...new Set(MUSIC.map(t=>t.genre))].map(g=>`<option>${g}</option>`).join('');
  $('#music-credits').innerHTML=MUSIC.map(t=>`<p class="hint"><b>${escapeHtml(t.title)}</b> — <a href="${t.artistUrl}" target="_blank" rel="noopener">${escapeHtml(t.artist)}</a>. <a href="${t.source}" target="_blank" rel="noopener">Источник</a> · <a href="${t.license==='CC BY 4.0'?'./licenses/CC-BY-4.0.txt':'./licenses/CC0-1.0.txt'}" target="_blank" rel="noopener">${t.license}</a>. ${escapeHtml(t.changes)}</p>`).join('');
  $('#open-player').innerHTML=audioIcon('music');$('#open-settings').innerHTML=audioIcon('settings');
  $('#open-player').addEventListener('click',()=>{open=true;panel.hidden=false;$('#open-player').setAttribute('aria-expanded','true');refresh();clampPosition();reserveSpace();$('#track-play').focus();});
  function closePlayer() {player.pause();open=false;panel.hidden=true;$('#open-player').setAttribute('aria-expanded','false');reserveSpace();$('#open-player').focus();}
  $('#player-close').addEventListener('click',closePlayer);
  $('#player-minimize').addEventListener('click',()=>{minimized=!minimized;panel.classList.toggle('minimized',minimized);$('#player-minimize').innerHTML=audioIcon(minimized?'expand':'minimize');$('#player-minimize').setAttribute('aria-label',minimized?'Развернуть плеер':'Свернуть плеер');clampPosition();reserveSpace();});
  $('#track-play').addEventListener('click',()=>player.toggle());$('#track-prev').addEventListener('click',()=>player.next(-1));$('#track-next').addEventListener('click',()=>player.next(1));
  $('#track-seek').addEventListener('input',e=>player.seek(Number(e.target.value)));$('#track-mute').addEventListener('click',()=>player.mute());
  for(const id of ['#track-volume','#settings-music-volume']) $(id).addEventListener('input',e=>player.volume(Number(e.target.value)));
  $('#music-genre').addEventListener('change',e=>player.setFilter(e.target.value));
  $('#track-list').addEventListener('click',e=>{const button=e.target.closest('[data-track]');if(button)player.select(button.dataset.track);});
  const handle=$('#player-drag');
  handle.addEventListener('pointerdown',e=>{
    if(mobile()||e.button!==0)return;const rect=panel.getBoundingClientRect();
    position={x:rect.left,y:rect.top};drag={x:e.clientX,y:e.clientY,left:rect.left,top:rect.top};handle.setPointerCapture(e.pointerId);e.preventDefault();
  });
  handle.addEventListener('pointermove',e=>{if(!drag)return;position={x:drag.left+e.clientX-drag.x,y:drag.top+e.clientY-drag.y};clampPosition();});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])handle.addEventListener(name,()=>{drag=null;});
  handle.addEventListener('keydown',e=>{
    if(mobile())return;const shifts={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]};
    if(!shifts[e.key])return;e.preventDefault();const rect=panel.getBoundingClientRect();position={x:rect.left+shifts[e.key][0],y:rect.top+shifts[e.key][1]};clampPosition();
  });
  panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();closePlayer();}});
  window.addEventListener('resize',()=>{clampPosition();reserveSpace();});
  if(window.ResizeObserver)new ResizeObserver(()=>{clampPosition();reserveSpace();}).observe(panel);
  function syncEffects() {$('#effects-enabled').checked=soundSettings.effects;$('#effects-volume').value=soundSettings.effectVolume;$('#effects-volume-value').textContent=Math.round(soundSettings.effectVolume*100)+'%';}
  $('#open-settings').addEventListener('click',()=>{syncEffects();refresh();settings.showModal();});
  $('#close-settings').addEventListener('click',()=>settings.close());
  $('#effects-enabled').addEventListener('change',e=>{soundSettings.effects=e.target.checked;saveSoundSettings();});
  $('#effects-volume').addEventListener('input',e=>{soundSettings.effectVolume=Number(e.target.value);saveSoundSettings();syncEffects();});
  $('#test-sound').addEventListener('click',async()=>{
    if(!soundSettings.effects){$('#sound-message').textContent='Сначала включи звуковые эффекты.';return;}
    if(soundSettings.effectVolume===0){$('#sound-message').textContent='Увеличь громкость эффектов.';return;}
    const played=await playEffect('correct');$('#sound-message').textContent=played?'Проверочный звук воспроизведён.':'Звук недоступен или нажатия слишком частые. Попробуй ещё раз.';
  });
  syncEffects();refresh();
  return player;
}
const musicPlayer=setupAudioInterface();
