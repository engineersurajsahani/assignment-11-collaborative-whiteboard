const socket=io();
const canvas=document.getElementById('canvas'),ctx=canvas.getContext('2d');
const params=new URLSearchParams(location.search);
let boardId=params.get('board')||'demo';
let username=localStorage.getItem('whiteboardName')||'';
let color=localStorage.getItem('whiteboardColor')||'#5b465c',size=5,drawing=false,last=null,strokes=[],users=new Map(),cursors=new Map();
const $=id=>document.getElementById(id);
$('joinRoomInput').value=boardId;
$('nameInput').value=username;
$('boardInput').value=boardId;
$('colorPicker').value=color;

document.querySelectorAll('.colors button').forEach(b=>{if(b.dataset.color===color)b.classList.add('selected')});

function setRoomUI(){ $('roomName').textContent=boardId;$('boardTitle').textContent=boardId;$('boardInput').value=boardId; }
function openBoard(){ $('joinScreen').classList.add('hidden');$('app').hidden=false;setRoomUI();resize(); }
function openJoin(){ $('joinScreen').classList.remove('hidden');$('app').hidden=true;$('joinRoomInput').value=boardId;$('nameInput').value=username;setTimeout(()=>$('joinRoomInput').focus(),100); }
function join(){
  const next=($('boardInput').value||'demo').trim()||'demo';
  if(next===boardId && socket.connected && socket.id && socket.dataJoined)return;
  boardId=next.slice(0,50); history.replaceState({},'',`?board=${encodeURIComponent(boardId)}`); setRoomUI();
  socket.emit('board:join',{boardId,username:username||'Guest',userColor:color}); socket.dataJoined=true;
}
function joinFromScreen(){
  username=($('nameInput').value||'Guest').trim().slice(0,24)||'Guest';
  boardId=($('joinRoomInput').value||'demo').trim().slice(0,50)||'demo';
  localStorage.setItem('whiteboardName',username);localStorage.setItem('whiteboardColor',color);
  history.replaceState({},'',`?board=${encodeURIComponent(boardId)}`);setRoomUI();openBoard();
  if(socket.connected)join();
}
$('joinForm').onsubmit=e=>{e.preventDefault();joinFromScreen()};
$('demoRoom').onclick=()=>{$('joinRoomInput').value='demo';$('nameInput').focus()};
$('switchRoom').onclick=openJoin;

function resize(){const r=canvas.getBoundingClientRect(),d=devicePixelRatio||1;canvas.width=r.width*d;canvas.height=r.height*d;ctx.setTransform(d,0,0,d,0,0);render()}
addEventListener('resize',resize);
function line(s){ctx.beginPath();ctx.moveTo(s.prevX,s.prevY);ctx.lineTo(s.currX,s.currY);ctx.strokeStyle=s.color;ctx.lineWidth=s.size;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke()}
function render(){ctx.clearRect(0,0,canvas.clientWidth,canvas.clientHeight);strokes.forEach(line);$('empty').style.opacity=strokes.length?'0':'1'}

socket.on('connect',()=>{$('connection').textContent='● Connected';if(!$('app').hidden)join()});
socket.on('disconnect',()=>{$('connection').textContent='○ Disconnected';socket.dataJoined=false});
socket.on('board:init',d=>{strokes=d.strokes||[];users.clear();(d.activeUsers||[]).forEach(u=>users.set(u.userId,u));updateUsers();render();openBoard()});
socket.on('draw:broadcast',({stroke})=>{strokes.push(stroke);render()});
socket.on('board:sync',d=>{strokes=d.strokes||[];render()});
socket.on('board:cleared',()=>{strokes=[];render()});
socket.on('user:joined',u=>{users.set(u.userId,u);updateUsers()});
socket.on('user:left',u=>{users.delete(u.userId);removeCursor(u.userId);updateUsers()});
socket.on('cursor:update',u=>showCursor(u));

function pos(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}}
canvas.addEventListener('pointerdown',e=>{drawing=true;canvas.setPointerCapture(e.pointerId);last=pos(e)});
canvas.addEventListener('pointermove',e=>{const p=pos(e);socket.emit('cursor:move',{boardId,x:p.x,y:p.y});if(!drawing)return;const s={prevX:last.x,prevY:last.y,currX:p.x,currY:p.y,color,size};line(s);strokes.push(s);socket.emit('draw:stroke',{boardId,stroke:s});last=p});
canvas.addEventListener('pointerup',()=>{drawing=false;last=null});canvas.addEventListener('pointerleave',()=>{drawing=false;last=null});
function updateUsers(){const el=$('users');el.innerHTML='';users.forEach((u,id)=>{const d=document.createElement('div');d.className='person';d.innerHTML=`<span class="avatar" style="background:${u.color}">${u.username[0].toUpperCase()}</span><div>${escapeHtml(u.username)}${id===socket.id?'<small>You</small>':'<small>Collaborating</small>'}</div>`;el.appendChild(d)});$('count').textContent=users.size}
function escapeHtml(s){return s.replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function showCursor(u){let el=cursors.get(u.userId);if(!el){el=document.createElement('div');el.className='cursor';el.innerHTML='<div class="pointer"></div><div class="name"></div>';$('cursors').appendChild(el);cursors.set(u.userId,el)}el.querySelector('.name').textContent=u.username;el.querySelector('.name').style.background=u.color;el.querySelector('.pointer').style.borderLeftColor=u.color;el.style.transform=`translate(${u.x}px,${u.y}px)`}
function removeCursor(id){const e=cursors.get(id);if(e)e.remove();cursors.delete(id)}

$('joinBtn').onclick=()=>{join();openBoard()};
$('undo').onclick=()=>socket.emit('draw:undo',{boardId});
$('clear').onclick=()=>{if(confirm('Clear this shared canvas for everyone?'))socket.emit('board:clear',{boardId})};
$('download').onclick=()=>{const a=document.createElement('a');a.download=`${boardId}-whiteboard.png`;a.href=canvas.toDataURL('image/png');a.click()};
$('copyRoom').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);$('copyRoom').textContent='✓';setTimeout(()=>$('copyRoom').textContent='⧉',1200)}catch{}};
$('size').oninput=e=>{size=+e.target.value;$('sizeValue').textContent=size};
document.querySelectorAll('.colors button').forEach(b=>b.onclick=()=>{color=b.dataset.color;localStorage.setItem('whiteboardColor',color);$('colorPicker').value=color;document.querySelectorAll('.colors button').forEach(x=>x.classList.remove('selected'));b.classList.add('selected')});
$('colorPicker').oninput=e=>{color=e.target.value;localStorage.setItem('whiteboardColor',color);document.querySelectorAll('.colors button').forEach(x=>x.classList.remove('selected'))};
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'){e.preventDefault();$('undo').click()}});

if(username && params.get('board'))openBoard();
