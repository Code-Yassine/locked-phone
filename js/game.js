/*
 * The Locked Phone — game logic
 * Plain JavaScript, no build step. Settings live in config.js.
 * Answers are stored as hashes (see KEY) so they don't appear in the source as plain text.
 * Each browser keeps its own progress in localStorage.
 */
(function(){
'use strict';

/* ---------------- helpers ---------------- */
var $ = function(s){ return document.querySelector(s); };
function esc(s){ return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
function cyrb53(str,seed){seed=seed||0;var h1=0xdeadbeef^seed,h2=0x41c6ce57^seed;for(var i=0,ch;i<str.length;i++){ch=str.charCodeAt(i);h1=Math.imul(h1^ch,2654435761);h2=Math.imul(h2^ch,1597334677);}h1=Math.imul(h1^(h1>>>16),2246822507);h1^=Math.imul(h2^(h2>>>13),3266489909);h2=Math.imul(h2^(h2>>>16),2246822507);h2^=Math.imul(h1^(h1>>>13),3266489909);return 4294967296*(2097151&h2)+(h1>>>0);}
function H(s){ return cyrb53('kickoff|'+s); }
var KEY = {note:5959051710134575, vault:4259045571662077, pin:2748570842210942};
function norm(s){ return String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]/g,''); }
function pad2(n){ return (n<10?'0':'')+n; }
function hhmm(d){ return pad2(d.getHours())+':'+pad2(d.getMinutes()); }
function clock(sec){ sec=Math.floor(sec); var h=Math.floor(sec/3600), m=Math.floor(sec%3600/60), s=sec%60; return (h?h+':'+pad2(m):pad2(m))+':'+pad2(s); }

/* ---------------- storage ---------------- */
var LS_STATE='locked-phone-state-v2', LS_SET='locked-phone-settings-v2';
function freshState(){ return {started:false,team:'',startedAt:0,finishedAt:0,dead:false,diedAt:0,stage:0,wrong:0,hints:0,hintStep:[0,0,0,0],hintLog:[],seen:[],proof:'',lowWarned:false,id:''}; }
var GC = window.GAME_CONFIG || {};
var DEF_SET = {
  place: (typeof GC.flag==='string' && GC.flag.trim()) ? GC.flag.trim() : 'n7sec{3a572180f81e0ea8}',
  drainMin: Math.min(240, Math.max(20, parseInt(GC.batteryMinutes,10) || 60))
};
function load(k,d){ try{ var v=localStorage.getItem(k); if(!v) return d; var o=JSON.parse(v); for(var p in d){ if(!(p in o)) o[p]=d[p]; } return o; }catch(e){ return d; } }
function store(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }
var S = load(LS_STATE, freshState());
var CFG = load(LS_SET, {place:DEF_SET.place, drainMin:DEF_SET.drainMin});
function saveS(){ store(LS_STATE,S); }

/* ---------------- game content ---------------- */
var OWNER='Rayan';
var G = {
  chat:'<path d="M4 5h16v11H9l-5 4z"/>',
  photo:'<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-5-5-9 7"/>',
  mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  note:'<path d="M6 3h9l4 4v14H6z"/><path d="M9 11h7M9 15h7M9 7h3"/>',
  calc:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01"/>',
  music:'<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  wallet:'<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 15h2"/>',
  pin:'<path d="M12 21s-7-6.5-7-12a7 7 0 0114 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  cloud:'<path d="M7 18h10a4 4 0 000-8 6 6 0 00-11.5 1.5A3.5 3.5 0 007 18z"/>',
  camera:'<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  calg:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
  mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>',
  back:'<path d="M15 5l-7 7 7 7"/>',
  next:'<path d="M9 5l7 7-7 7"/>'
};
function icon(n){ return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(G[n]||'')+'</svg>'; }

var APPS = {
  messages:{name:'Messages',c:'#2fa866',g:'chat'},
  photos:{name:'Photos',c:'#e0643f',g:'photo'},
  mail:{name:'Mail',c:'#3b7cf0',g:'mail'},
  music:{name:'Musique',c:'#e2456b',g:'music'},
  notes:{name:'Notes',c:'#d9a521',g:'note'},
  calendar:{name:'Calendrier',c:'#f5f5f4',g:'calg'},
  calc:{name:'Calculatrice',c:'#3a3a3f',g:'calc'},
  wallet:{name:'Wallet',c:'#1a2233',g:'wallet'},
  maps:{name:'Maps',c:'#14a37f',g:'pin'},
  weather:{name:'Météo',c:'#2f9fd8',g:'cloud'},
  camera:{name:'Caméra',c:'#4f4f57',g:'camera'},
  settings:{name:'Paramètres',c:'#6b6b75',g:'gear'}
};
var GRID=['notes','calendar','calc','wallet','maps','weather','camera','settings'];
var DOCK=['messages','photos','mail','music'];

/* Darija day and month names (Latin script) */
var DAYS=['L7ed','Letnin','Tlat','Larb3','Lkhmis','Jjem3a','Ssebt'];
var DAYS_S=['L7d','Tnin','Tlat','Larb','Khmis','Jm3a','Sbt'];
var MONTHS=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
function fmtDay(d){ return DAYS[d.getDay()]+' '+d.getDate()+' '+MONTHS[d.getMonth()]; }

/* Lock 1: the passcode is Rayan's birthday, which is always "tomorrow" (DDMM). */
function bdayCode(from){ var t=new Date(from); t.setDate(t.getDate()+1); return pad2(t.getDate())+pad2(t.getMonth()+1); }
function isBdayCode(code){ return code===bdayCode(now()) || (S.startedAt && code===bdayCode(S.startedAt)); }

var LOCK_NOTIFS = [
  {from:'Yassir',when:'daba',c:'#2fa866',g:'chat',text:'Rayan fin nta?? lkickoff bda'},
  {from:'Calendrier',when:'lyoum',c:'#d97706',g:'calg',text:'🎂 Tadkir: ghedda 3id miladek! 🎉'},
  {from:'BANK',when:'9bel 17 d',c:'#2fa866',g:'chat',text:'Lcode dyal ta2kid dyalk howa 4821. Matsifto l7ta chi wa7ed.'},
  {from:'Calendrier',when:'lyoum',c:'#d64545',g:'calg',text:'Kickoff dyal club · 18:00'},
  {from:'Mama',when:'16:20',c:'#2fa866',g:'chat',text:'L3cha f 20:30, mat3atalch 🙏'}
];

var CHATS = [
  {id:'yassir',name:'Yassir',av:'Y',c:'#5b7cf0',when:'18:02',msgs:[
    ['in','khoya nta labas? had simana kamla w nta ghrib','Letnin 21:14'],
    ['out','labas. ghir kanwajed chi 7aja l kickoff 👀'],
    ['in','chno howa lmot de passe dyal la note lmsdouda? 9olti liya n9der n9raha ila w9e3 chi 7aja'],
    ['out','nta deja 3arfo'],
    ['out','smiya dyal awel café mchina lih jouj + l3am. kolchi b lettres sghar, bla espaces'],
    ['in','hadak li fih atay b na3na3 khayb?? 😂'],
    ['out','howa hadak. matgoulha l7ta wa7ed'],
    ['in','Rayan fin nta?? lkickoff bda','Lyoum 18:02']
  ]},
  {id:'lina',name:'Lina (Vice-présidente)',av:'L',c:'#c2569b',when:'17:55',msgs:[
    ['in','Kolchi kaysowel 3lik fin nta 😭','Lyoum 17:51'],
    ['in','Lal3ab kaybdaw m3a 18:00. Jawbni!!']
  ]},
  {id:'bank',name:'BANK',av:'B',c:'#4b5563',when:'17:47',msgs:[
    ['in','Lcode dyal ta2kid dyalk howa 4821. Matsifto l7ta chi wa7ed.','Lyoum 17:47']
  ]},
  {id:'unknown',name:'+212 6•• ••41 07',av:'?',c:'#64748b',when:'17:31',msgs:[
    ['in','L9iti fin ttkhba wla mazal? 😏','Lyoum 17:29'],
    ['out','9rib. 7ta wa7ed mayl9ani'],
    ['in','ghanchoufo 👀']
  ]},
  {id:'mom',name:'Mama',av:'M',c:'#d97706',when:'16:24',msgs:[
    ['in','Ghedda 3id miladek a weldi 🎂 chno bghiti ntayeb lik?','Lyoum 16:12'],
    ['in','L3cha f 20:30, mat3atalch 🙏','Lyoum 16:20'],
    ['in','w 3ayet 3la jedda dyalk'],
    ['out','wakha a mama ❤️']
  ]},
  {id:'coach',name:'Coach Hamid',av:'H',c:'#0f766e',when:'Lbare7',msgs:[
    ['in','Check dyal lmaillots l final 👕 Yassir 9 · Rayan 17 · Hamza 4 · Anas 11. Jibohom maghsoulin had lmerra 😤','Jjem3a 19:30'],
    ['out','wakha coach 🫡'],
    ['in','Chouf l email dyalk. Kayn tbdil f lfinal.','Lbare7 10:12']
  ]}
];

/* Gallery. To use your own picture, add img:'media/photos/yourfile.jpg' to a photo.
   Without img, the emoji on a colored background is shown. Keep d/place/people: the Info panel shows them,
   and the Café Atlas 2019 photo is the clue for the note password. */
var PHOTOS = [
  {e:'⚽🏟️',img:'media/photos/stade.jpg',a:'#1f7a52',b:'#0b3326',d:'2026-11-08T17:20',place:'Stade dyal campus',people:'Rayan, Hamza'},
  {e:'📣🎉',img:'media/photos/club-stand.jpeg',a:'#c2410c',b:'#6b2210',d:'2026-10-15T12:05',place:'Stand dyal club, Grande salle',people:'nas dyal club'},
  {e:'🌅',img:'media/photos/plage-manesman.webp',a:'#f59e0b',b:'#a3195b',d:'2026-08-22T19:48',place:'Plage Manesman',people:'Rayan'},
  {e:'☕🥐',img:'media/photos/cafe.webp',a:'#9a4a12',b:'#3d1c06',d:'2025-03-08T10:31',place:'Café Bahia',people:'Hamza, Rayan'},
  {e:'🧋',img:'media/photos/cafe-life.jpg',a:'#0e7490',b:'#123b4d',d:'2023-09-06T16:15',place:'Café Lune',people:'Hamza, Rayan'},
  {e:'🍵',img:'media/photos/cafe-atlas.jpg',a:'#17a24f',b:'#06301a',d:'2019-03-16T17:42',place:'Café Atlas',people:'Yassir, Rayan'}
];
function photoStyle(p){ return '--a:'+p.a+';--b:'+p.b+(p.img?';background-image:url(&quot;'+esc(encodeURI(p.img))+'&quot;)':''); }
function fmtPhotoDate(iso){ var d=new Date(iso); return fmtDay(d)+' '+d.getFullYear()+' · '+hhmm(d); }

var NOTES = [
  {id:'locked',title:'Ila w9e3 chi 7aja',date:'Letnin',locked:true},
  {id:'games',title:'Afkar dyal l3ab l kickoff',date:'L7ed',body:'– quiz battle\n– human bingo\n– blind test (musique)\n– escape room?? yemken b telephone dyali 🤔'},
  {id:'wifi',title:'Wi-Fi dyal salle dyal club',date:'2 Octobre',body:'Réseau: CLUB-ROOM\nMot de passe: kickoff2026'},
  {id:'buy',title:'Bach nchri',date:'28 Septembre',body:'– protège-tibias jdad\n– atay b na3na3 l salle dyal club\n– cadre l tswira dyal trophée 2024'}
];
var NOTE_SECRET = 'Ila kunti kat9ra hadchi, rak 9rib.\n\nKolchi kayn f Calculatrice. Machi ghir calculatrice. Rah coffre.\n\nBach t7elo, 7seb:\nra9m dyal lcasier dyali × nhar dyal lfinal dyal tournoi\nmn ba3d dghet 3la =\n\nRedd balek: chi m3lomat dyali 9dima. Dima chouf lkhra.\n\n— R.';

var MAILS = [
  {id:'m1',from:'Coach Hamid',av:'H',c:'#0f766e',subj:'⚠️ Tbdil f lfinal',date:'Lbare7',unread:true,body:'Salam l’équipe,\n\nB sbab chta li ghadi tji, lfinal dyal tournoi tbedlat mn Ssebt 14 l L7ed 15 Novembre. Nefs lw9t, nefs stade.\n\nTickets dyalkom ba9in valables. Mat3atlouch.\n\nCoach Hamid'},
  {id:'m2',from:'Bureau des sports',av:'S',c:'#7c3aed',subj:'Tbdil dyal lcasier',date:'3 Novembre',unread:true,body:'Salam Rayan,\n\nB sbab lkhdma f Bâtiment A, lcasier n°12 tlgha.\n\nLcasier ljdid dyalk howa n°38, Bâtiment B. Sarout l9dim maba9ich ghaykhdem.\n\nBureau des sports'},
  {id:'m3',from:'Souk Express',av:'S',c:'#ea580c',subj:'Lcommande #29104 dyalk tsiftat',date:'1 Novembre',body:'Khbar zwin! Lcommande dyalk dyal 2 7wayej (protège-tibias, taille M) tsiftat.\n\nWsoul: mn 4 l 6 ayam.'},
  {id:'m4',from:'Bureau dyal club',av:'C',c:'#be185d',subj:'Checklist dyal kickoff',date:'30 Octobre',body:'Baffles ✔\nSnacks ✔\nÉquipes dyal 5 ✔\n\nLal3ab kaybdaw m3a 18:00.\n\nRayan, 9olti 3ndek surprise l kolchi. Chno hiya??'},
  {id:'m5',from:'Prof. Bennani — Analyse',av:'B',c:'#475569',subj:'Examen final: salle w tarikh',date:'28 Octobre',body:'Salam a talaba,\n\nLexamen final ghadi ykoun nhar Ssebt 21 Novembre m3a 09:00, salle B12.\n\nJibo carte d’étudiant.'},
  {id:'m6',from:'Radio dyal campus',av:'R',c:'#0891b2',subj:'Had simana f Radio dyal campus 🎙️',date:'25 Octobre',body:'Interviews, top 10 dyal simana, w émission khassa 3la tournoi dyal lkoura.'},
  {id:'m7',from:'Bureau des sports',av:'S',c:'#7c3aed',subj:'Lcasier dyalk had l3am',date:'2 Septembre',body:'Salam Rayan,\n\nLcasier dyalk had l3am howa n°12, Bâtiment A. 7afed 3la sarout.\n\nBureau des sports'}
];

var EVENTS = {
  7:[['Demi-finale ⚽','16:00 · Stade dyal campus','#0f766e']],
  10:[['Kickoff dyal club','18:00 · Grande salle','#d64545']],
  14:[['Finale dyal tournoi 🏆','16:00 · Stade dyal campus','#0f766e']],
  21:[['Examen final dyal Analyse','09:00 · Salle B12','#5b7cf0']],
  26:[['3id milad Mama 🎂','Nhar kamel','#d97706']]
};

var PLAYLISTS = [
  {id:'pre',name:'9bel lmatch 🔥',e:'🔥',a:'#e2456b',b:'#5c1026',desc:'Kol nhar fih match. Dima nefs lghenya lwla.',tracks:[['Lionheart Run','Riad Collective',63],['Red Lights Fade','Nadia Rouge',12],['Sahara Drift','Dune Theory',9],['Golden Hour Mode','Medina Club',15],['Midnight Engine','North Coast',7]]},
  {id:'study',name:'Concentration',e:'📚',a:'#2f62d6',b:'#141f45',desc:'Lexamens. Casque f wdniya.',tracks:[['Rainfall Study Mix','Lo-Fi Desk',214],['Quiet Library','Paper Planes',88],['Night Shift','Lo-Fi Desk',61]]},
  {id:'drive',name:'Tsara f lil',e:'🌙',a:'#6d28d9',b:'#1e1037',desc:'Corniche f lil.',tracks:[['Midnight Engine','North Coast',34],['Neon Tide','Blue Hour',22],['Ocean Mode','Salt & Static',18]]}
];
var TOP = [['Rainfall Study Mix','Lo-Fi Desk',214],['Quiet Library','Paper Planes',88],['Lionheart Run','Riad Collective',63],['Night Shift','Lo-Fi Desk',61],['Midnight Engine','North Coast',41]];

var USED='Mosta3mel';
var PASSES = [
  {id:'final',kind:'Ticket dyal match',title:'Finale dyal tournoi',venue:'Stade dyal campus',when:'Ssebt 14 Novembre 2026 · 16:00',gate:'C',row:'4',seat:'17',status:'Valable',a:'#0f766e',b:'#073b35'},
  {id:'semi',kind:'Ticket dyal match',title:'Demi-finale',venue:'Stade dyal campus',when:'Ssebt 7 Novembre 2026 · 16:00',gate:'F',row:'9',seat:'3',status:USED,a:'#475569',b:'#1e2735'},
  {id:'concert',kind:'Ticket dyal concert',title:'Sunset Live',venue:'Corniche Arena',when:'Ssebt 19 Décembre 2026 · 20:00',gate:'A',row:'—',seat:'Wa9fin',status:'Valable',a:'#9333ea',b:'#3b0f66'},
  {id:'member',kind:'Adhésion',title:'Carte dyal membre',venue:'Président · 2026–2027',when:'Membre mn 2023',gate:'—',row:'—',seat:'—',status:'Valable',a:'#b8892a',b:'#4a3410'}
];

var MEMO = 'Salam. Ila kunti kat9ra hadchi, rak dki. Ana machi mfe9oud. Ana mkhebbi f chi blassa f lkickoff. Blasti m9ayda f Maps, walakin sddit 3liha. Sarout howa lkelma lwla mn lghenya li dima kanchghel 9bel lmatch, w mn ba3dha 7arf dyal lbab (gate) f ticket dyal lfinal. Bla espaces. Zreb, batterie dyali ghadi tsala.';

var HINTS = [
  ['Chouf la notification dyal Calendrier f lock screen. O chouf tarikh dyal lyoum lfo9.',
   'Lcode howa tarikh dyal ghedda: nhar b jouj ar9am + chhar b jouj ar9am. Matalan ila kan ghedda 5 Mars → 0503.'],
  ['F Notes kayna note msdouda. Yassir sowel 3la nefs lmot de passe f Messages.',
   'F Photos, 7el tswira w dghet 3la Info: katban tarikh, lblassa w chkoun fiha. Khassek a9dem tswira f café fiha Yassir.'],
  ['La note li t7lat katchra7 kifach t7el lcoffre dyal Calculatrice. Khassek ra9m mn Mail w ra9m 3la lfinal.',
   '9ra kol les emails, mn ljdid l l9dim. Lcasier tbdel, w 7ta nhar dyal lfinal tbdel. Dreb ra9m lcasier ljdid f nhar ljdid, w dghet =.'],
  ['9ra lmessage li f lcoffre. Khassek ghenya w 7arf dyal bab.',
   'Musique → playlist "9bel lmatch": lghenya lwla. Wallet → ticket dyal lfinal: lbab. Ktebhom m3a ba3d, bla espaces, f lblassa lmsdouda f Maps.']
];
var LOCK_NAMES = ['Code dyal telephone','Note msdouda','Coffre dyal Calculatrice','Blassa msdouda f Maps'];

/* ---------------- state & navigation ---------------- */
var nav = [];
var ui = {padOpen:false,pad:'',info:false,cal:10,pinSheet:false};
var calc = {disp:'0',acc:null,op:null,fresh:true};
var view = $('#view'), screen = $('#screen');
var lastKey = '';

function now(){ return Date.now(); }
function elapsed(){
  if(!S.started) return 0;
  var end = S.finishedAt || (S.dead ? S.diedAt : now());
  return Math.max(0,(end - S.startedAt)/1000);
}
function drainPer(){ return Math.max(6, (Number(CFG.drainMin)||60)*60/100); }
function battery(){
  if(S.dead) return 0;
  var b = 100 - Math.floor(elapsed()/drainPer()) - S.wrong*5 - S.hints*10;
  return Math.max(0, Math.min(100, b));
}
function playing(){ return S.started && !S.finishedAt && !S.dead; }

function current(){ return nav.length ? nav[nav.length-1] : {v:'home'}; }
function go(v){ nav.push(v); render(); }
function back(){ nav.pop(); ui.pinSheet=false; render(); }
function goHome(){ if(S.dead || S.stage===0) return; nav=[]; ui.pinSheet=false; render(); }
function openApp(id){
  if(S.stage===0 || S.dead) return;
  if(S.seen.indexOf(id)<0){ S.seen.push(id); saveS(); }
  nav=[{v:id}]; ui.pinSheet=false; render();
}

/* ---------------- renderers ---------------- */
function head(title){ return '<div class="ah"><button class="back" type="button" data-act="back">'+icon('back')+'<span>Rje3</span></button><h1>'+esc(title)+'</h1><span></span></div>'; }
function appIcon(id){
  var a=APPS[id];
  if(id==='calendar'){
    var d=new Date();
    return '<span class="icon cal-ic"><b>'+DAYS_S[d.getDay()]+'</b><span>'+d.getDate()+'</span></span>';
  }
  return '<span class="icon" style="--c:'+a.c+'">'+icon(a.g)+'</span>';
}
function badgeFor(id){
  if(S.seen.indexOf(id)>=0) return '';
  if(id==='messages') return '<span class="badge">3</span>';
  if(id==='mail') return '<span class="badge">2</span>';
  return '';
}
function tile(id,inDock){
  return '<button class="tile" type="button" data-act="open" data-app="'+id+'" aria-label="'+APPS[id].name+'"><span class="iw">'+appIcon(id)+badgeFor(id)+'</span>'+(inDock?'':'<span class="tl">'+APPS[id].name+'</span>')+'</button>';
}

var R = {};
R.lock = function(){
  var d=new Date();
  if(ui.padOpen){
    var dots=''; for(var i=0;i<4;i++) dots+='<i class="'+(i<ui.pad.length?'on':'')+'"></i>';
    var keys=['1','2','3','4','5','6','7','8','9','','0','del'].map(function(k){
      if(!k) return '<span></span>';
      return '<button class="key" type="button" data-act="pad" data-k="'+k+'" aria-label="'+(k==='del'?'Mse7':k)+'">'+(k==='del'?'⌫':k)+'</button>';
    }).join('');
    return '<div class="pad-screen"><div class="pad-top">'+icon('lock')+'<div class="pad-title">Dkhel lcode</div><div class="dots" id="dots">'+dots+'</div></div><div class="keys">'+keys+'</div><button class="pad-cancel" type="button" data-act="padClose">Lgha</button></div>';
  }
  var notifs = LOCK_NOTIFS.map(function(n){
    return '<div class="notif"><div class="ni" style="--c:'+n.c+'">'+icon(n.g)+'</div><div class="nb"><div class="nt"><b>'+esc(n.from)+'</b><span>'+esc(n.when)+'</span></div><p>'+esc(n.text)+'</p></div></div>';
  }).join('');
  return '<div class="lock"><div class="lock-head">'+icon('lock')+'<div class="lock-date">'+fmtDay(d)+'</div><div class="lock-time">'+hhmm(d)+'</div><div class="lock-owner">Telephone dyal '+OWNER+'</div></div><div class="notifs">'+notifs+'</div><button class="unlock" type="button" data-act="padOpen">Dghet bach t7el</button></div>';
};
R.home = function(){
  return '<div class="home"><div class="widget"><div class="w-lbl">Ljay</div><div class="w-title">Finale dyal tournoi 🏆</div><div class="w-sub">Ssebt 14 Novembre · 16:00 · Stade dyal campus</div></div><div class="grid">'+GRID.map(function(id){return tile(id,false);}).join('')+'</div><div class="dock">'+DOCK.map(function(id){return tile(id,true);}).join('')+'</div></div>';
};
R.messages = function(){
  var rows = CHATS.map(function(c){
    var last=c.msgs[c.msgs.length-1];
    var unread = (c.id==='yassir'||c.id==='lina'||c.id==='unknown') && S.seen.indexOf('chat:'+c.id)<0;
    return '<button class="row" type="button" data-act="go" data-v="chat" data-id="'+c.id+'"><span class="av" style="--c:'+c.c+'">'+esc(c.av)+'</span><span class="rb"><span class="rt"><b>'+esc(c.name)+'</b><small>'+esc(c.when)+'</small></span><span class="rs'+(unread?' strong':'')+'">'+(last[0]==='out'?'Nta: ':'')+esc(last[1])+'</span></span>'+(unread?'<span class="udot"></span>':'')+'</button>';
  }).join('');
  return '<div class="app">'+head('Messages')+'<div>'+rows+'</div></div>';
};
R.chat = function(c){
  var ch = CHATS.filter(function(x){return x.id===c.id;})[0];
  if(S.seen.indexOf('chat:'+ch.id)<0){ S.seen.push('chat:'+ch.id); saveS(); }
  var m = ch.msgs.map(function(x){ return (x[2]?'<div class="stamp">'+esc(x[2])+'</div>':'')+'<div class="b '+x[0]+'">'+esc(x[1])+'</div>'; }).join('');
  return '<div class="app">'+head(ch.name)+'<div class="msgs">'+m+'</div></div>';
};
R.photos = function(){
  var t = PHOTOS.map(function(p,i){ return '<button class="ph'+(p.img?' img':'')+'" type="button" style="'+photoStyle(p)+'" data-act="go" data-v="photo" data-id="'+i+'" aria-label="Tswira '+(i+1)+'">'+(p.img?'':p.e)+'</button>'; }).join('');
  return '<div class="app">'+head('Photos')+'<div class="pcount">Ljdad · '+PHOTOS.length+' tswira · ljdida lwla</div><div class="pgrid">'+t+'</div></div>';
};
R.photo = function(c){
  var i=+c.id, p=PHOTOS[i];
  var info = ui.info ? '<dl class="info"><div><dt>Tarikh</dt><dd>'+fmtPhotoDate(p.d)+'</dd></div><div><dt>Blassa</dt><dd>'+esc(p.place)+'</dd></div><div><dt>Nas</dt><dd>'+esc(p.people)+'</dd></div></dl>' : '';
  return '<div class="app">'+head('Tswira '+(i+1)+' mn '+PHOTOS.length)+'<div class="pv'+(p.img?' img':'')+'" style="'+photoStyle(p)+'">'+(p.img?'':p.e)+'</div><div class="pv-bar"><button type="button" data-act="photoNav" data-d="-1"'+(i===0?' disabled':'')+'>‹ Jdida</button><button type="button" data-act="info" class="'+(ui.info?'on':'')+'">Info</button><button type="button" data-act="photoNav" data-d="1"'+(i===PHOTOS.length-1?' disabled':'')+'>9dima ›</button></div>'+info+'</div>';
};
R.notes = function(){
  var rows = NOTES.map(function(n){
    var lockedNow = n.locked && S.stage<2;
    var preview = n.locked ? (lockedNow?'🔒 Note msdouda':'Ila kunti kat9ra hadchi, rak 9rib.') : n.body.split('\n')[0];
    return '<button class="row" type="button" data-act="go" data-v="note" data-id="'+n.id+'"><span class="rb"><span class="rt"><b>'+esc(n.title)+'</b><small>'+esc(n.date)+'</small></span><span class="rs">'+esc(preview)+'</span></span><span class="chev">'+icon('next')+'</span></button>';
  }).join('');
  return '<div class="app">'+head('Notes')+'<div>'+rows+'</div></div>';
};
R.note = function(c){
  var n = NOTES.filter(function(x){return x.id===c.id;})[0];
  if(n.locked && S.stage<2){
    return '<div class="app">'+head('Notes')+'<div class="locked">'+icon('lock')+'<h2>'+esc(n.title)+'</h2><p>Had la note msdouda. Dkhel lmot de passe bach t9raha.</p><form class="field" data-form="note" autocomplete="off"><input id="notePass" type="text" placeholder="Mot de passe" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Mot de passe dyal la note"><button type="submit">T7el</button></form></div></div>';
  }
  return '<div class="app">'+head('Notes')+'<div class="note-title">'+esc(n.title)+'</div><div class="note-meta">Tbdlat '+esc(n.date)+'</div><div class="note-body">'+esc(n.locked?NOTE_SECRET:n.body)+'</div></div>';
};
R.mail = function(){
  var rows = MAILS.map(function(m){
    var unread = m.unread && S.seen.indexOf('mail:'+m.id)<0;
    return '<button class="row" type="button" data-act="go" data-v="mailItem" data-id="'+m.id+'"><span class="udot'+(unread?'':' off')+'"></span><span class="rb"><span class="rt"><b>'+esc(m.from)+'</b><small>'+esc(m.date)+'</small></span><span class="rs'+(unread?' strong':'')+'">'+esc(m.subj)+'</span></span></button>';
  }).join('');
  return '<div class="app">'+head('Boîte de réception')+'<div>'+rows+'</div></div>';
};
R.mailItem = function(c){
  var m = MAILS.filter(function(x){return x.id===c.id;})[0];
  if(S.seen.indexOf('mail:'+m.id)<0){ S.seen.push('mail:'+m.id); saveS(); }
  return '<div class="app">'+head('Boîte de réception')+'<div class="mail-h"><h2>'+esc(m.subj)+'</h2><div class="mail-from"><span class="av" style="--c:'+m.c+'">'+esc(m.av)+'</span><div><b>'+esc(m.from)+'</b><small>L: Rayan · '+esc(m.date)+'</small></div></div></div><div class="mail-body">'+esc(m.body)+'</div></div>';
};
R.calendar = function(){
  var offset = (new Date(2026,10,1).getDay()+6)%7;
  var cells = ['N','T','L','Kh','J','S','7'].map(function(w){return '<div class="wd">'+w+'</div>';}).join('');
  for(var i=0;i<offset;i++) cells+='<span></span>';
  for(var d=1;d<=30;d++){
    var cls='day'+(EVENTS[d]?' ev':'')+(d===10?' today':'')+(d===ui.cal?' sel':'');
    cells+='<button class="'+cls+'" type="button" data-act="day" data-d="'+d+'">'+d+'</button>';
  }
  var evs = EVENTS[ui.cal];
  var list = evs ? evs.map(function(e){ return '<div class="ev-item"><i style="--c:'+e[2]+'"></i><div><b>'+esc(e[0])+'</b><small>'+esc(e[1])+'</small></div></div>'; }).join('') : '<div class="ev-none">Ta 7aja nhar '+ui.cal+' Novembre.</div>';
  return '<div class="app">'+head('Calendrier')+'<div class="cal-h"><b>Novembre 2026</b><span>Lyoum: 10</span></div><div class="cal-grid">'+cells+'</div><div class="evs">'+list+'</div></div>';
};
R.calc = function(){
  if(S.stage>=3) return R.vault();
  var k = function(key,cls){ var act = (cls==='op' && calc.op===key && calc.fresh) ? ' act' : ''; return '<button class="ck '+(cls||'')+act+'" type="button" data-act="ck" data-k="'+key+'">'+key+'</button>'; };
  return '<div class="app">'+head('Calculatrice')+'<div class="calc"><div class="calc-disp" id="calcDisp">'+esc(calc.disp)+'</div><div class="ckeys" id="ckeys">'+
    k('AC','fn')+k('±','fn')+k('%','fn')+k('÷','op')+
    k('7')+k('8')+k('9')+k('×','op')+
    k('4')+k('5')+k('6')+k('−','op')+
    k('1')+k('2')+k('3')+k('+','op')+
    '<button class="ck zero" type="button" data-act="ck" data-k="0">0</button>'+k('.')+k('=','op')+
  '</div></div></div>';
};
R.vault = function(){
  return '<div class="app vault">'+head('Coffre')+
    '<div class="v-hero">'+icon('lock')+'<b>Coffre privé</b><span>Mkhebbi wra Calculatrice</span></div>'+
    '<div class="v-item memo"><div class="memo-top"><span class="mi">'+icon('note')+'</span><div><b>l ay wa7ed l9a hadchi</b><small>Message mktoub</small></div></div><p class="transcript">'+esc(MEMO)+'</p></div>'+
    '<button class="v-item" type="button" data-act="go" data-v="maps"><span class="mi">'+icon('pin')+'</span><span><b>Blasti</b><small>Blassa m9ayda f Maps · msdouda</small></span></button>'+
    '<div class="v-foot">Lcoffre kayt7el kol merra t7el Calculatrice.</div></div>';
};
R.music = function(){
  var pls = PLAYLISTS.map(function(p){ return '<button class="row" type="button" data-act="go" data-v="playlist" data-id="'+p.id+'"><span class="art" style="--a:'+p.a+';--b:'+p.b+'">'+p.e+'</span><span class="rb"><b>'+esc(p.name)+'</b><span class="rs">'+p.tracks.length+' aghani</span></span><span class="chev">'+icon('next')+'</span></button>'; }).join('');
  var top = TOP.map(function(t,i){ return '<li><span class="tn">'+(i+1)+'</span><span class="ti"><b>'+esc(t[0])+'</b><small>'+esc(t[1])+'</small></span><span class="plays">'+t[2]+' merra</span></li>'; }).join('');
  return '<div class="app">'+head('Musique')+'<div class="np"><span class="art" style="--a:#6d28d9;--b:#1e1037">🌙</span><div><b>Midnight Engine</b><small>North Coast · f pause</small></div></div><div class="sec">Playlists</div>'+pls+'<div class="sec">Ktar aghani tsme3o</div><ol class="tracks">'+top+'</ol></div>';
};
R.playlist = function(c){
  var p = PLAYLISTS.filter(function(x){return x.id===c.id;})[0];
  var tr = p.tracks.map(function(t,i){ return '<li><span class="tn">'+(i+1)+'</span><span class="ti"><b>'+esc(t[0])+'</b><small>'+esc(t[1])+'</small></span><span class="plays">'+t[2]+' merra</span></li>'; }).join('');
  return '<div class="app">'+head('Musique')+'<div class="pl-hero"><span class="art" style="--a:'+p.a+';--b:'+p.b+'">'+p.e+'</span><div><b>'+esc(p.name)+'</b><small>'+esc(p.desc)+'</small></div></div><ol class="tracks">'+tr+'</ol></div>';
};
R.wallet = function(){
  var ps = PASSES.map(function(p){ return '<button class="pass" type="button" style="--a:'+p.a+';--b:'+p.b+'" data-act="go" data-v="pass" data-id="'+p.id+'"><small>'+esc(p.kind)+'</small><b>'+esc(p.title)+'</b><span>'+esc(p.when)+'</span>'+(p.status===USED?'<span class="stampu">MOSTA3MEL</span>':'')+'</button>'; }).join('');
  return '<div class="app">'+head('Wallet')+'<div class="passes">'+ps+'</div></div>';
};
R.pass = function(c){
  var p = PASSES.filter(function(x){return x.id===c.id;})[0];
  return '<div class="app">'+head('Wallet')+'<div class="ticket"><div class="t-top" style="--a:'+p.a+';--b:'+p.b+'"><small>'+esc(p.kind)+'</small><b>'+esc(p.title)+'</b><span>'+esc(p.venue)+'</span><span>'+esc(p.when)+'</span></div><div class="t-grid"><div><small>Bab</small><b>'+esc(p.gate)+'</b></div><div><small>Saf</small><b>'+esc(p.row)+'</b></div><div><small>Blassa</small><b>'+esc(p.seat)+'</b></div></div><div class="t-status">L7ala: '+esc(p.status)+'</div><div class="barcode"></div></div></div>';
};
R.maps = function(){
  var open = S.stage>=4;
  var pin = open
    ? '<g class="m-pin open" transform="translate(196 300)"><circle class="pulse" r="16"/><circle class="pc" r="12"/><circle r="4" fill="var(--on-icon)"/><text x="18" y="4">Rayan</text></g>'
    : '<g class="m-pin" data-act="pinOpen" transform="translate(196 300)" role="button" aria-label="Blassa m9ayda msdouda"><circle class="pc" r="14"/><rect class="lk" x="-5" y="-1" width="10" height="8" rx="1.5"/><path class="lk" d="M-3 -1v-3a3 3 0 016 0v3"/><text x="20" y="4">Blasti</text></g>';
  var map = '<svg viewBox="0 0 360 560" preserveAspectRatio="xMidYMid slice" aria-hidden="false">'+
    '<rect class="m-water" x="0" y="470" width="360" height="90"/>'+
    '<rect class="m-green" x="210" y="40" width="130" height="150" rx="10"/>'+
    '<path class="m-road" d="M-10 220 H370 M110 -10 V480 M-10 420 H370 M260 200 V480"/>'+
    '<rect class="m-block" x="20" y="40" width="74" height="70" rx="6"/><text class="m-label" x="28" y="80">Bâtiment A</text>'+
    '<rect class="m-block" x="20" y="130" width="74" height="70" rx="6"/><text class="m-label" x="28" y="170">Bâtiment B</text>'+
    '<rect class="m-block" x="128" y="40" width="70" height="150" rx="6"/><text class="m-label" x="138" y="118">Bibliothèque</text>'+
    '<ellipse cx="275" cy="115" rx="52" ry="58" fill="none" stroke="var(--map-road)" stroke-width="6"/><text class="m-label" x="240" y="119">Stade</text>'+
    '<rect class="m-block" x="128" y="240" width="118" height="164" rx="8"/><text class="m-label" x="160" y="262">Grande salle</text>'+
    '<rect class="m-block" x="20" y="240" width="74" height="76" rx="6"/><text class="m-label" x="28" y="282">Salle club</text>'+
    '<rect class="m-block" x="20" y="336" width="74" height="68" rx="6"/><text class="m-label" x="28" y="374">Cafétéria</text>'+
    '<rect class="m-block" x="278" y="240" width="64" height="164" rx="6"/><text class="m-label" x="286" y="326">Parking</text>'+
    '<rect class="m-block" x="20" y="436" width="140" height="26" rx="6"/><text class="m-label" x="28" y="453">Café Atlas</text>'+
    '<text class="m-label" x="250" y="520">Corniche</text>'+
    pin+'</svg>';
  var sheet='';
  if(open){
    sheet = '<div class="sheet found"><h2>🚩 Lflag</h2><div class="where" style="font-family:var(--f-mono);word-break:break-all">'+esc(CFG.place)+'</div><p>Brawo! L9itou lflag. Lo3ba salat.</p></div>';
  } else if(ui.pinSheet){
    sheet = '<div class="sheet"><button class="x" type="button" data-act="pinClose" aria-label="Close">×</button><h2>Blasti 🔒</h2><p>Had lblassa msdouda. Dkhel sarout bach tban lik.</p><form class="field" data-form="pin" autocomplete="off"><input id="pinKey" type="text" placeholder="Sarout" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Sarout dyal lblassa"><button type="submit">T7el</button></form></div>';
  }
  return '<div class="app">'+head('Maps')+'<div class="map-wrap">'+map+(open?'':'<div class="map-chip">1 blassa m9ayda</div>')+sheet+'</div></div>';
};
R.settings = function(){
  var rows=[['Smiya','Telephone dyal '+OWNER],['Batterie',battery()+'%'],['Sa7a dyal batterie','61% · khassha service'],['Wi-Fi','CLUB-ROOM'],['Code','Mkhdem'],['Modèle','RB-17'],['Stockage','41.2 mn 64 GB mosta3mla']];
  return '<div class="app">'+head('Paramètres')+'<div>'+rows.map(function(r){return '<div class="set-row"><b>'+esc(r[0])+'</b><span>'+esc(r[1])+'</span></div>';}).join('')+'</div></div>';
};
R.camera = function(){
  return '<div class="app">'+head('Caméra')+'<div class="cam-screen">'+icon('camera')+'<b>Caméra makhdamach</b><span>Batterie na9sa bzaf bach tkhdem caméra.</span></div></div>';
};
R.weather = function(){
  var f=[['Tlat 10','☁️','Ghayem','19°'],['Larb3 11','⛅','Chwiya dyal sshab','20°'],['Lkhmis 12','🌦️','Chta khfifa','18°'],['Jjem3a 13','🌧️','Chta','17°'],['Ssebt 14','⛈️','3wasef · 90% chta','16°'],['L7ed 15','☀️','Chems','21°'],['Letnin 16','☀️','Chems','22°']];
  return '<div class="app">'+head('Météo')+'<div class="wx-now"><span>Campus</span><b>19°</b><span>Ghayem · kat7ess b 17°</span></div><div class="wx-list">'+f.map(function(r){return '<div><b>'+r[0]+'</b><span>'+r[1]+'</span><small>'+r[2]+'</small><b>'+r[3]+'</b></div>';}).join('')+'</div></div>';
};
R.dead = function(){ return '<div class="dead"><div class="db"><i></i></div></div>'; };

function render(){
  var c;
  if(S.dead) c={v:'dead'};
  else if(S.stage===0) c={v:'lock'};
  else c=current();
  var key = JSON.stringify(c)+(c.v==='lock'?ui.padOpen:'');
  var keep = key===lastKey ? view.scrollTop : 0;
  screen.classList.toggle('on-wall', c.v==='lock' || c.v==='home');
  $('#sb').style.visibility = c.v==='dead' ? 'hidden' : '';
  view.innerHTML = (R[c.v]||R.home)(c);
  if(c.v==='chat' && key!==lastKey) view.scrollTop = view.scrollHeight;
  else view.scrollTop = keep;
  lastKey = key;
  updStatus();
}

/* ---------------- live scoreboard ---------------- */
/* Score: 100 per lock opened + battery left − 2 per full minute. Same formula as server.js. */
function score(){ return Math.max(0, S.stage*100 + battery() - 2*Math.floor(elapsed()/60)); }
function report(){
  if(!S.started || !S.id || !window.fetch) return;
  try{
    fetch('/api/scores',{method:'POST',headers:{'Content-Type':'application/json'},keepalive:true,body:JSON.stringify({
      id:S.id, team:S.team, locks:S.stage, battery:battery(), seconds:Math.floor(elapsed()),
      wrong:S.wrong, hints:S.hints, status:S.dead?'dead':(S.stage>=4?'found':'playing')
    })}).catch(function(){});
  }catch(e){}
}

/* ---------------- feedback ---------------- */
var toastTimer=null;
function toast(msg,kind){
  var old=screen.querySelector('.toast'); if(old) old.remove();
  var t=document.createElement('div'); t.className='toast'+(kind?' '+kind:''); t.textContent=msg; t.setAttribute('role','status');
  screen.appendChild(t);
  clearTimeout(toastTimer); toastTimer=setTimeout(function(){ t.remove(); }, 2600);
}
function shake(){ screen.classList.remove('shake'); void screen.offsetWidth; screen.classList.add('shake'); }
function wrong(msg){
  if(!playing()) return;
  S.wrong++; saveS(); shake(); toast(msg+' · −5% batterie','bad');
  refreshVitals(); checkDead(); report();
}
function advance(stage,msg){
  S.stage=stage; saveS(); toast(msg,'good'); refreshCase(); refreshVitals(); report();
}

/* ---------------- lock pad ---------------- */
function padKey(k){
  if(!playing() || S.stage!==0) return;
  if(k==='del'){ ui.pad=ui.pad.slice(0,-1); render(); return; }
  if(ui.pad.length>=4) return;
  ui.pad+=k; render();
  if(ui.pad.length===4){
    var code=ui.pad;
    setTimeout(function(){
      if(isBdayCode(code)){
        ui.padOpen=false; ui.pad=''; nav=[];
        advance(1,'T7el! Lbarra lta7t dima katrj3ek l l’accueil.');
        render();
      } else {
        ui.pad=''; render(); wrong('Code ghalat');
      }
    },180);
  }
}

/* ---------------- calculator ---------------- */
function fmt(n){ if(!isFinite(n)) return 'Error'; var s=String(+n.toPrecision(12)); return s.length>11 ? n.toExponential(5) : s; }
function applyOp(a,b,op){ switch(op){case '+':return a+b;case '−':return a-b;case '×':return a*b;case '÷':return b===0?NaN:a/b;} return b; }
function calcKey(k){
  if(S.stage>=3) return;
  if(calc.disp==='Error' && k!=='AC') calc={disp:'0',acc:null,op:null,fresh:true};
  if(/^[0-9]$/.test(k) || k==='.'){
    if(calc.fresh){ calc.disp = k==='.'?'0.':k; calc.fresh=false; }
    else{
      if(k==='.' && calc.disp.indexOf('.')>=0) return;
      if(calc.disp.replace(/[-.]/g,'').length>=9) return;
      calc.disp = (calc.disp==='0' && k!=='.') ? k : calc.disp+k;
    }
  } else if(k==='AC'){ calc={disp:'0',acc:null,op:null,fresh:true}; }
  else if(k==='±'){ if(calc.disp!=='0') calc.disp = calc.disp.charAt(0)==='-' ? calc.disp.slice(1) : '-'+calc.disp; }
  else if(k==='%'){ calc.disp=fmt(parseFloat(calc.disp)/100); calc.fresh=true; }
  else if('+−×÷'.indexOf(k)>=0){
    if(calc.op && !calc.fresh){ calc.acc=applyOp(calc.acc,parseFloat(calc.disp),calc.op); calc.disp=fmt(calc.acc); }
    else if(!calc.op) calc.acc=parseFloat(calc.disp);
    calc.op=k; calc.fresh=true;
  } else if(k==='='){
    if(calc.op){ calc.disp=fmt(applyOp(calc.acc,parseFloat(calc.disp),calc.op)); calc.acc=null; calc.op=null; }
    calc.fresh=true;
    checkVault();
  }
  updCalc();
}
function updCalc(){
  var d=document.getElementById('calcDisp'); if(!d) return;
  d.textContent=calc.disp;
  var len=calc.disp.length; d.style.fontSize = len>9?'40px':len>7?'50px':'';
  var keys=document.querySelectorAll('#ckeys .ck.op');
  for(var i=0;i<keys.length;i++){ keys[i].classList.toggle('act', calc.op===keys[i].dataset.k && calc.fresh); }
}
function checkVault(){
  if(S.stage!==2 || !playing()) return;
  if(H(calc.disp)===KEY.vault){
    setTimeout(function(){
      screen.classList.add('glitch');
      setTimeout(function(){
        screen.classList.remove('glitch');
        calc={disp:'0',acc:null,op:null,fresh:true};
        advance(3,'Lcoffre t7el');
        render();
      },900);
    },500);
  }
}

/* ---------------- forms ---------------- */
function submitNote(val){
  if(!playing() || S.stage!==1) return;
  var n=norm(val); if(!n) return;
  var ok = H(n)===KEY.note || (n.indexOf('cafe')===0 && H(n.slice(4))===KEY.note);
  if(ok){ advance(2,'La note t7lat'); render(); }
  else { wrong('Mot de passe ghalat'); var i=document.getElementById('notePass'); if(i){ i.value=''; } }
}
function submitPin(val){
  if(!playing()) return;
  var n=norm(val); if(!n) return;
  var ok = H(n)===KEY.pin || H(n.replace('gate',''))===KEY.pin;
  if(ok && S.stage===3){
    S.stage=4; S.finishedAt=now(); S.proof='RB-'+cyrb53(S.team+'|'+S.finishedAt).toString(36).toUpperCase().slice(-5);
    saveS(); report(); ui.pinSheet=false; refreshCase(); refreshVitals(); render(); toast('🚩 L9itou lflag!','good');
    setTimeout(showEnd,1600);
  } else { wrong('Sarout ghalat'); var i=document.getElementById('pinKey'); if(i){ i.value=''; } }
}

/* ---------------- events ---------------- */
view.addEventListener('click',function(e){
  var t=e.target.closest('[data-act]'); if(!t) return;
  var a=t.getAttribute('data-act');
  switch(a){
    case 'padOpen': if(!playing()) return; ui.padOpen=true; ui.pad=''; render(); break;
    case 'padClose': ui.padOpen=false; ui.pad=''; render(); break;
    case 'pad': padKey(t.getAttribute('data-k')); break;
    case 'open': openApp(t.getAttribute('data-app')); break;
    case 'go': go({v:t.getAttribute('data-v'),id:t.getAttribute('data-id')||undefined}); break;
    case 'back': back(); break;
    case 'photoNav': var cur=current(); var i=+cur.id + +t.getAttribute('data-d'); if(i>=0 && i<PHOTOS.length){ cur.id=String(i); render(); } break;
    case 'info': ui.info=!ui.info; render(); break;
    case 'day': ui.cal=+t.getAttribute('data-d'); render(); break;
    case 'ck': calcKey(t.getAttribute('data-k')); break;
    case 'pinOpen': if(S.stage<4){ ui.pinSheet=true; render(); } break;
    case 'pinClose': ui.pinSheet=false; render(); break;
  }
});
view.addEventListener('submit',function(e){
  e.preventDefault();
  var f=e.target, inp=f.querySelector('input'); var v=inp?inp.value:'';
  if(f.getAttribute('data-form')==='note') submitNote(v);
  if(f.getAttribute('data-form')==='pin') submitPin(v);
});
$('#homeBar').addEventListener('click',goHome);
document.addEventListener('keydown',function(e){
  if(e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
  if(!playing()) return;
  if(S.stage===0){
    if(/^[0-9]$/.test(e.key)){ if(!ui.padOpen){ ui.padOpen=true; ui.pad=''; } padKey(e.key); }
    else if(e.key==='Backspace' && ui.padOpen) padKey('del');
    return;
  }
  if(current().v==='calc' && S.stage===2){
    var map={'*':'×','x':'×','/':'÷','-':'−','+':'+','Enter':'=','=':'=','Escape':'AC','.':'.',',':'.','%':'%'};
    var k = /^[0-9]$/.test(e.key) ? e.key : map[e.key];
    if(k){ e.preventDefault(); calcKey(k); }
  }
});

/* ---------------- hints ---------------- */
var MAX_HINTS=2; /* hints allowed in the whole game */
function hintsLeft(){ if(S.stage>3) return 0; return Math.max(0, Math.min(MAX_HINTS-S.hints, HINTS[S.stage].length-S.hintStep[S.stage])); }
var hintBtn=$('#hintBtn'), hintArm=null;
hintBtn.addEventListener('click',function(){
  if(!playing() || S.stage>3) return;
  if(S.hints>=MAX_HINTS){ toast('Kheddemtou les 2 tlmi7at dyal lo3ba kamla'); return; }
  if(S.hintStep[S.stage]>=HINTS[S.stage].length){ toast('Mab9awch tlmi7at l had l9fel'); return; }
  if(!hintArm){
    hintBtn.classList.add('confirm'); hintBtn.textContent='Dghet 3awed bach tconfirmi · −10%';
    hintArm=setTimeout(disarmHint,4000); return;
  }
  disarmHint();
  var i=S.hintStep[S.stage]; S.hintStep[S.stage]=i+1; S.hints++;
  S.hintLog.push({stage:S.stage,text:HINTS[S.stage][i]}); saveS();
  toast('Tlmi7 tzad f dossier · −10%','bad');
  refreshCase(); refreshVitals(); checkDead(); report();
});
function disarmHint(){ clearTimeout(hintArm); hintArm=null; hintBtn.classList.remove('confirm'); refreshVitals(); }

/* ---------------- vitals & case ---------------- */
function battClass(b){ return b<=20?'low':b<=45?'mid':''; }
function refreshVitals(){
  var b=battery();
  $('#vTeam').textContent = S.started ? S.team : 'Mazal mabdatch';
  $('#vTime').textContent = clock(elapsed());
  var vb=$('#vBatt'); vb.textContent=b+'%'; vb.className='batt '+battClass(b);
  var bar=$('#vBar'); bar.style.width=b+'%'; bar.className=battClass(b);
  if(!hintArm){
    var left = hintsLeft(), total = Math.max(0, MAX_HINTS-S.hints);
    hintBtn.disabled = !playing() || left<=0;
    var narrow = window.matchMedia && window.matchMedia('(max-width:820px)').matches;
    hintBtn.textContent = !playing() ? (narrow?'Ta tlmi7':'Tlmi7at ma kaynach') : left<=0 ? (narrow?'Mab9a tlmi7':(total<=0?'Kheddemtou les 2 tlmi7at':'Mab9awch tlmi7at l had l9fel')) : (narrow?'Tlmi7 · −10% ('+total+')':'Khoud tlmi7 · −10% ('+total+'/'+MAX_HINTS+' ba9in)');
  }
}
function updStatus(){
  var b=battery();
  $('#sbTime').textContent=hhmm(new Date());
  $('#sbPct').textContent=b+'%';
  $('#sbBi').style.width=b+'%';
  $('#sbB').classList.toggle('low', b<=20);
}
function refreshCase(){
  var html='';
  for(var i=0;i<4;i++){
    var st = S.stage>i ? 'done' : S.stage===i ? 'now' : 'wait';
    var name = st==='done' ? LOCK_NAMES[i] : '9fel '+(i+1);
    var label = st==='done' ? 'Me7loul' : st==='now' ? (S.started?'Khdamin':'Wajed') : 'Msdoud';
    html+='<li class="'+st+'"><span class="num">'+(i+1)+'</span><span>'+esc(name)+'</span><span class="st '+st+'">'+label+'</span></li>';
  }
  $('#locks').innerHTML=html;
  $('#hintLog').innerHTML = S.hintLog.length ? S.hintLog.map(function(h){ return '<li><b>9fel '+(h.stage+1)+'</b>'+esc(h.text)+'</li>'; }).join('') : '<li class="empty">Mazal walou. 3ndkom ghir 2 tlmi7at f lo3ba kamla, kol wa7ed b 10% mn batterie.</li>';
}
function checkDead(){
  if(playing() && battery()<=0){
    S.dead=true; S.diedAt=now(); saveS();
    render(); refreshVitals(); report(); showEnd();
  }
}

/* ---------------- overlays ---------------- */
function showEnd(){
  var card=$('#endCard');
  var stats = '<div class="where-big" style="text-align:center">Score: '+score()+'</div><div class="stats"><div><small>Lw9t</small><b>'+clock(elapsed())+'</b></div><div><small>Batterie ba9ya</small><b>'+battery()+'%</b></div><div><small>Ajwiba ghalta</small><b>'+S.wrong+'</b></div><div><small>Tlmi7at</small><b>'+S.hints+'</b></div></div>';
  if(S.dead){
    card.innerHTML='<div class="tag"><span>Dalil 017</span><span>'+esc(S.team)+'</span></div><div class="card-body"><h1>Telephone tfa.</h1><p>Batterie wslat 0% 9bel matl9aw lflag. Score dyalkom tsjjel f tableau.</p><div class="where-big" style="text-align:center">Score: '+score()+'</div><div class="stats"><div><small>L9foul li t7lo</small><b>'+S.stage+' / 4</b></div><div><small>Lw9t</small><b>'+clock(elapsed())+'</b></div><div><small>Ajwiba ghalta</small><b>'+S.wrong+'</b></div><div><small>Tlmi7at</small><b>'+S.hints+'</b></div></div><div class="gm-row"><button class="btn-main" type="button" data-new>Bda lo3ba jdida</button><button class="btn-ghost" type="button" data-close>Sedd</button></div></div>';
  } else {
    card.innerHTML='<div class="tag"><span>L9adiya tsddat</span><span>'+esc(S.team)+'</span></div><div class="card-body"><h1>🚩 L9itou lflag!</h1><div class="proof" style="font-size:clamp(18px,5vw,26px);word-break:break-all">'+esc(CFG.place)+'</div><p>Lo3ba salat. Score dyalkom tsjjel f tableau.</p>'+stats+'<div class="gm-row"><button class="btn-main" type="button" data-close>Rje3 l telephone</button><button class="btn-ghost" type="button" data-new>Bda lo3ba jdida</button></div></div>';
  }
  $('#end').hidden=false;
}
$('#end').addEventListener('click',function(e){
  if(e.target.closest('[data-close]')) $('#end').hidden=true;
  if(e.target.closest('[data-new]')) newGame();
});
function newGame(){
  S=freshState(); saveS(); nav=[]; ui={padOpen:false,pad:'',info:false,cal:10,pinSheet:false}; calc={disp:'0',acc:null,op:null,fresh:true};
  $('#end').hidden=true; render(); refreshCase(); refreshVitals(); showIntro();
}

function showIntro(){
  $('#drainTxt').textContent='1% / '+Math.round(drainPer())+'s';
  $('#teamInput').value='';
  $('#intro').hidden=false;
}
$('#startForm').addEventListener('submit',function(e){
  e.preventDefault();
  var name=$('#teamInput').value.trim() || 'Équipe 1';
  S=freshState(); S.started=true; S.team=name; S.startedAt=now(); S.id=now().toString(36)+Math.random().toString(36).slice(2,10); saveS(); report();
  nav=[]; ui={padOpen:false,pad:'',info:false,cal:10,pinSheet:false}; calc={disp:'0',acc:null,op:null,fresh:true};
  $('#intro').hidden=true; render(); refreshCase(); refreshVitals();
});

/* ---------------- game master ---------------- */
/* The panel stays hidden from players. Add #gm to the address to show it. */
function gmVisibility(){ $('#gmPanel').hidden = location.hash !== '#gm'; }
gmVisibility(); window.addEventListener('hashchange', gmVisibility);
$('#gmPlace').value=CFG.place; $('#gmDrain').value=CFG.drainMin;
$('#gmForm').addEventListener('submit',function(e){
  e.preventDefault();
  var p=$('#gmPlace').value.trim(); var d=Math.min(240,Math.max(20,parseInt($('#gmDrain').value,10)||60));
  CFG={place:p||DEF_SET.place, drainMin:d}; store(LS_SET,CFG);
  $('#gmDrain').value=d; $('#gmMsg').textContent='Tsejjel. Batterie daba kat9es 1% kol '+Math.round(drainPer())+' tanya.';
  refreshVitals(); updStatus(); if(S.stage>=4) render();
});
var resetArm=null, resetBtn=$('#gmReset');
resetBtn.addEventListener('click',function(){
  if(!resetArm){
    resetBtn.classList.add('confirm'); resetBtn.textContent='Dghet 3awed bach tmse7 had lo3ba';
    resetArm=setTimeout(function(){ resetArm=null; resetBtn.classList.remove('confirm'); resetBtn.textContent='Bda telephone mn jdid l équipe jdida'; },4000);
    return;
  }
  clearTimeout(resetArm); resetArm=null; resetBtn.classList.remove('confirm'); resetBtn.textContent='Bda telephone mn jdid l équipe jdida';
  newGame();
});

/* ---------------- loop ---------------- */
function tick(){
  refreshVitals(); updStatus();
  if(playing()){
    if(Math.floor(elapsed())%15===0) report();
    var b=battery();
    if(b<=0) checkDead();
    else if(b<=20 && !S.lowWarned){ S.lowWarned=true; saveS(); toast('Batterie na9sa: '+b+'%','bad'); }
  }
  if(S.stage===0 && !ui.padOpen && current().v!=='x'){ var lt=view.querySelector('.lock-time'); if(lt) lt.textContent=hhmm(new Date()); }
}

render(); refreshCase(); refreshVitals();
if(!S.started) showIntro();
else if(S.finishedAt || S.dead) showEnd();
setInterval(tick,1000);
})();
