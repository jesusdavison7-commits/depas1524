// ── Firebase init (compat SDK, no modules) ─────────────────────────────────
var firebaseConfig = {
  apiKey: "AIzaSyBC5HCRflZ7wStkwC6aEzJIpCZD0PX14qU",
  authDomain: "depas-1524.firebaseapp.com",
  projectId: "depas-1524",
  storageBucket: "depas-1524.firebasestorage.app",
  messagingSenderId: "47667863513",
  appId: "1:47667863513:web:22db1a6f1961c9f5c083c8"
};
firebase.initializeApp(firebaseConfig);
var auth = firebase.auth();
var db   = firebase.firestore();

// ── Auth ───────────────────────────────────────────────────────────────────
auth.onAuthStateChanged(function(user) {
  if (user) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    document.getElementById('user-info').textContent = user.email;
    initApp();
  } else {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
  }
});

function doLogin() {
  var email = document.getElementById('login-email').value.trim();
  var pass  = document.getElementById('login-pass').value;
  var err   = document.getElementById('login-error');
  err.textContent = '';
  auth.signInWithEmailAndPassword(email, pass).catch(function() {
    err.textContent = 'Correo o contraseña incorrectos';
  });
}
function doLogout() { auth.signOut(); }
document.getElementById('login-pass').addEventListener('keydown', function(e) {
  if(e.key==='Enter') doLogin();
});

// ── Mobile sidebar ─────────────────────────────────────────────────────────
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

// ── State ──────────────────────────────────────────────────────────────────
var DEPTOS = [];
var VACIOS = [];
var PAGOS  = {};
var SERVICIOS = {};
var CFE_HIST = [];
var CONTRATO_HIST = [];
var INQ_HIST = [];
var BOLSA_JESUS = 0;
var BOLSA_CARLITOS = 0;
var BOLSA_MANT = 0; // historial de inquilinos eliminados
var FIN_HIST = {};
var FONDO_INICIAL = 0;
var MANT_STATE = {};
var MANT_HIST_OPEN = false;
var FIN_HIST_OPEN = false;
var editIdx = null;

var MANT_LAVADORAS = ['Planta baja','Planta alta'];
var MANT_INFRA = [
  {key:'impermeabilizacion_parcial', label:'Sellado impermeabilización', freq:'Según necesidad'},
  {key:'tinacos', label:'Limpieza tinacos', freq:'Cada 1.5–2 años'},
  {key:'impermeabilizacion_completa', label:'Impermeabilización completa', freq:'Cada 4 años'},
  {key:'bomba', label:'Bomba entrada principal', freq:'~2 años de vida'},
];

var MEX_MES = 11;
var MS_UP = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
var MS    = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
var MS_FULL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
var HIST_LABELS = ['Jul 25','Ago 25','Sep 25','Oct 25','Nov 25','Dic 25','Ene 26','Feb 26','Mar 26','Abr 26','May 26','Jun 26'];
var AVS = ['av-teal','av-blue','av-purple','av-coral','av-amber'];
var SRV_META = [
  {key:'internet',      label:'Internet Depas',    icon:'ti-wifi',          tc:'#185FA5', desc:'Fijo mensual'},
  {key:'agua',          label:'Agua JAPAMA',        icon:'ti-droplet',       tc:'#0F6E56', desc:'Variable'},
  {key:'limpieza',      label:'Limpieza',           icon:'ti-brush',         tc:'#534AB7', desc:'Variable'},
  {key:'internetPinos', label:'Internet Los Pinos', icon:'ti-wifi-off',      tc:'#993C1D', desc:'Variable · se suma a Jesús'},
  {key:'celular',       label:'Saldo celular',      icon:'ti-device-mobile', tc:'#854F0B', desc:'Variable · número de atención'},
  {key:'cfe',           label:'Luz áreas comunes',  icon:'ti-bolt',          tc:'#854F0B', desc:'Bimestral'},
];

// ── Helpers ────────────────────────────────────────────────────────────────
function fmt(n) { return '$' + Math.round(n).toLocaleString('es-MX'); }
function avI(name) { var p=name.trim().split(' '); return (p[0][0]+(p[1]?p[1][0]:'')).toUpperCase(); }
function avEl(name,i,cls) { cls=cls||'avatar'; return '<div class="'+cls+' '+AVS[i%5]+'">'+avI(name)+'</div>'; }
function fmtD(iso) { if(!iso)return'—'; var d=new Date(iso+'T12:00:00'); return d.getDate()+' '+MS[d.getMonth()]+' '+d.getFullYear(); }

function getContractMonths(d) {
  if(!d.finDate) return [];
  var mesesN = d.contrato==='1 año'?12:d.contrato==='6 meses'?6:1;
  var finD = new Date(d.finDate+'T12:00:00');
  var iniD = new Date(finD); iniD.setMonth(iniD.getMonth()-mesesN);
  var months=[],cur=new Date(iniD.getFullYear(),iniD.getMonth(),1),end=new Date(finD.getFullYear(),finD.getMonth(),1),safety=0;
  while(cur<=end&&safety<24){
    var y=cur.getFullYear(),m=cur.getMonth();
    var label=MS[m].charAt(0).toUpperCase()+MS[m].slice(1)+' '+y.toString().slice(2);
    var key=(y-2025)*12+(m-6);
    months.push({label:label,key:key,year:y,month:m});
    cur.setMonth(cur.getMonth()+1); safety++;
  }
  return months;
}

function getSrv(mi) {
  if(!SERVICIOS[mi]) SERVICIOS[mi]={internet:{monto:1000,fijo:true,pagado:false},agua:{monto:400,fijo:false,pagado:false},limpieza:{monto:2400,fijo:false,pagado:false},internetPinos:{monto:500,fijo:false,pagado:false},celular:{monto:20,fijo:false,pagado:false},cfe:{monto:0,fijo:false,pagado:false}};
  if(!SERVICIOS[mi].internetPinos) SERVICIOS[mi].internetPinos={monto:500,fijo:false,pagado:false};
  if(!SERVICIOS[mi].celular) SERVICIOS[mi].celular={monto:20,fijo:false,pagado:false};
  if(!SERVICIOS[mi].cfe) SERVICIOS[mi].cfe={monto:0,fijo:false,pagado:false};
  return SERVICIOS[mi];
}
function getPago(num,mi) { return PAGOS[num]&&PAGOS[num][mi]; }
function cobradoMes(mi) { return DEPTOS.reduce(function(s,d){var p=getPago(d.num,mi);return s+(p&&p.pagado?d.renta:0);},0); }
function esperado() { return DEPTOS.reduce(function(s,d){return s+d.renta;},0); }
function totalSrvJesus(mi) { var s=getSrv(mi);return s.internet.monto+s.agua.monto+s.internetPinos.monto+(s.celular?s.celular.monto:0)+(s.cfe&&s.cfe.pagado?s.cfe.monto/2:0); }
function calcFinMes(mi) {
  var cob=cobradoMes(mi),srv=getSrv(mi),limp=srv.limpieza.monto;
  var mant=cob*0.10,neto=Math.max(0,cob-mant-limp),srvJ=totalSrvJesus(mi);
  return{cob:cob,mant:mant,limp:limp,neto:neto,srvJ:srvJ,jesus:neto*0.25+srvJ,carlitos:neto*0.75};
}

// ── Firebase helpers ───────────────────────────────────────────────────────
function saveDepto(d) { return db.collection('deptos').doc(String(d.num)).set(d); }
function delDepto(num) { return db.collection('deptos').doc(String(num)).delete(); }
function savePago(num,mi,p) { return db.collection('pagos').doc(num+'_'+mi).set(Object.assign({deptoNum:num,mesIdx:mi},p)); }
function deletePago(num,mi) { return db.collection('pagos').doc(num+'_'+mi).delete(); }
function saveSrv(mi,data) { return db.collection('servicios').doc(String(mi)).set(data); }
function saveCFE(list) { return db.collection('cfe').doc('historial').set({list:list}); }
function saveMant() { return db.collection('config').doc('mantenimiento').set({state:MANT_STATE}); }
function saveFinHist() { return db.collection('config').doc('finHistorial').set({data:FIN_HIST,fondoInicial:FONDO_INICIAL,bolsaJesus:BOLSA_JESUS||0,bolsaCarlitos:BOLSA_CARLITOS||0,bolsaMant:BOLSA_MANT||0}); }
function saveInqHist() { return db.collection('config').doc('inqHistorial').set({data:INQ_HIST}); }

function initApp() {
  db.collection('deptos').get().then(function(snap) {
    DEPTOS=[];snap.forEach(function(d){DEPTOS.push(d.data());});DEPTOS.sort(function(a,b){return a.num-b.num;});
    if(!DEPTOS.length) {
      var seed=[
        {num:2,nombre:'Jeffrey Ruiz Osuna',renta:5000,diaPago:22,contrato:'6 meses',finDate:'2026-04-22',finStr:'22 abr 2026',deposito:true,tel:'',email:'',curp:'',nacimiento:'',ocupacion:'',domicilio:'',notas:'',ineInqUrl:'',ineAvalUrl:'',aval:{nombre:'',parentesco:'',tel:'',email:'',curp:'',calle:'',colonia:'',ciudad:'',estado:'',cp:'',propiedad:'Sí',propDir:'',notas:''}},
        {num:3,nombre:'Sergio Galvez',renta:5500,diaPago:31,contrato:'6 meses',finDate:'2026-08-31',finStr:'31 ago 2026',deposito:true,tel:'',email:'',curp:'',nacimiento:'',ocupacion:'',domicilio:'',notas:'',ineInqUrl:'',ineAvalUrl:'',aval:{nombre:'',parentesco:'',tel:'',email:'',curp:'',calle:'',colonia:'',ciudad:'',estado:'',cp:'',propiedad:'Sí',propDir:'',notas:''}},
        {num:5,nombre:'Jose H. Rodriguez Urias',renta:5000,diaPago:28,contrato:'6 meses',finDate:'2025-10-28',finStr:'28 oct 2025',deposito:true,tel:'',email:'',curp:'',nacimiento:'',ocupacion:'',domicilio:'',notas:'',ineInqUrl:'',ineAvalUrl:'',aval:{nombre:'',parentesco:'',tel:'',email:'',curp:'',calle:'',colonia:'',ciudad:'',estado:'',cp:'',propiedad:'Sí',propDir:'',notas:''}},
        {num:6,nombre:'Diego Tizoc Corral',renta:5500,diaPago:26,contrato:'1 año',finDate:'2026-08-26',finStr:'26 ago 2026',deposito:true,tel:'',email:'',curp:'',nacimiento:'',ocupacion:'',domicilio:'',notas:'',ineInqUrl:'',ineAvalUrl:'',aval:{nombre:'',parentesco:'',tel:'',email:'',curp:'',calle:'',colonia:'',ciudad:'',estado:'',cp:'',propiedad:'Sí',propDir:'',notas:''}},
      ];
      var promises=seed.map(function(d){return saveDepto(d);});
      return Promise.all(promises).then(function(){DEPTOS=seed;return loadRest();});
    }
    return loadRest();
  });
}

function loadRest() {
  VACIOS=[1,2,3,4,5,6,7,8].filter(function(n){return!DEPTOS.find(function(d){return d.num===n;});});
  return db.collection('pagos').get().then(function(snap){
    PAGOS={};snap.forEach(function(p){var d=p.data();if(!PAGOS[d.deptoNum])PAGOS[d.deptoNum]={};PAGOS[d.deptoNum][d.mesIdx]={pagado:d.pagado,forma:d.forma,monto:d.monto,fecha:d.fecha||''};});
    return db.collection('servicios').get();
  }).then(function(snap){
    SERVICIOS={};snap.forEach(function(s){SERVICIOS[s.id]=s.data();});
    return db.collection('cfe').doc('historial').get();
  }).then(function(snap){
    CFE_HIST=snap.exists?snap.data().list:[{inicio:'2026-02-09',fin:'2026-04-09',monto:580,fechaPago:'2026-02-15',notas:''}];
    return db.collection('config').doc('mantenimiento').get();
  }).then(function(snap){
    MANT_STATE=snap.exists?snap.data().state||{}:{};
    return db.collection('config').doc('finHistorial').get();
  }).then(function(snap){
    if(snap.exists){FIN_HIST=snap.data().data||{};FONDO_INICIAL=snap.data().fondoInicial||0;BOLSA_JESUS=snap.data().bolsaJesus||0;BOLSA_CARLITOS=snap.data().bolsaCarlitos||0;BOLSA_MANT=snap.data().bolsaMant||0;}
    else{FIN_HIST={};FONDO_INICIAL=0;BOLSA_JESUS=0;BOLSA_CARLITOS=0;BOLSA_MANT=0;}
    return db.collection('config').doc('inqHistorial').get();
  }).then(function(snap){
    INQ_HIST=snap.exists?(snap.data().data||[]):[];
    renderAll();
  });
}

// ── Nav ────────────────────────────────────────────────────────────────────
function showPage(id,btn) {
  document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active');});
  document.querySelectorAll('.nav-item').forEach(function(n){n.classList.remove('active');});
  var pg=document.getElementById('page-'+id); if(pg)pg.classList.add('active');
  if(btn)btn.classList.add('active');
  closeSidebar();
  var renders={dashboard:renderDashboard,deptos:renderDeptos,pagos:renderPagos,servicios:renderServicios,finanzas:renderFinanzas,contratos:renderContratos,mantenimiento:renderMantenimiento};
  if(renders[id])renders[id]();
}
function openModal(id) {
  var el = document.getElementById(id);
  if (!el) return;
  if (el.parentNode !== document.body) document.body.appendChild(el);
  el.style.cssText = 'display:flex;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:999999;align-items:flex-start;justify-content:center;padding:30px 16px;overflow-y:auto;';
}
function closeModal(id) {
  var el = document.getElementById(id);
  if (!el) return;
  el.style.display = 'none';
}
document.querySelectorAll('.modal-bg').forEach(function(m){m.addEventListener('click',function(e){if(e.target===m)closeModal(m.id);});});
function swTab(tid,gid,btn) {
  document.getElementById(gid).querySelectorAll('.tab-panel').forEach(function(t){t.classList.remove('active');});
  btn.closest('.tabs').querySelectorAll('.tab').forEach(function(t){t.classList.remove('active');});
  document.getElementById(tid).classList.add('active'); btn.classList.add('active');
}
function irAContratos() {
  document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active');});
  document.querySelectorAll('.nav-item').forEach(function(n){n.classList.remove('active');});
  document.getElementById('page-contratos').classList.add('active');
  document.querySelectorAll('.nav-item')[4].classList.add('active');
  closeSidebar(); renderContratos();
}
function irAContrato() { closeModal('modal-ver'); irAContratos(); }

// ── Form helpers ───────────────────────────────────────────────────────────
function syncDia() { var v=document.getElementById('f-inicio').value; if(!v)return; document.getElementById('f-dia').value=new Date(v+'T12:00:00').getDate(); }
function cPiso() { var n=parseInt(document.getElementById('c-depto').value); document.getElementById('c-piso').value=n<=4?'Planta baja':'Planta alta'; }
function cFin() {
  var ini=document.getElementById('c-ini').value,dur=document.getElementById('c-dur').value; if(!ini)return;
  var d=new Date(ini+'T12:00:00');
  var mesesMap={'1 MES':1,'2 MESES':2,'3 MESES':3,'4 MESES':4,'5 MESES':5,'SEIS MESES':6,'7 MESES':7,'8 MESES':8,'9 MESES':9,'10 MESES':10,'11 MESES':11,'UN AÑO':12};
  var meses=mesesMap[dur]||6;
  d.setMonth(d.getMonth()+meses);
  document.getElementById('c-fin-f').value=d.toISOString().split('T')[0];
}
function cfeCalcFin() { var v=document.getElementById('cfe-ini').value; if(!v)return; var d=new Date(v+'T12:00:00'); d.setMonth(d.getMonth()+2); document.getElementById('cfe-fin').value=d.toISOString().split('T')[0]; }
function resetTabsG(gid) {
  var grp=document.getElementById(gid); if(!grp)return;
  grp.querySelectorAll('.tab-panel').forEach(function(t,i){t.classList.toggle('active',i===0);});
  var nav=grp.previousElementSibling;
  if(nav&&nav.classList.contains('tabs'))nav.querySelectorAll('.tab').forEach(function(t,i){t.classList.toggle('active',i===0);});
}

// ── Dashboard ──────────────────────────────────────────────────────────────
function renderDashboard() {
  var mi=MEX_MES,cob=cobradoMes(mi),esp=esperado();
  var pag=DEPTOS.filter(function(d){var p=getPago(d.num,mi);return p&&p.pagado;}).length;
  document.getElementById('dash-mes').textContent='Junio 2026';
  document.getElementById('dash-metrics').innerHTML='<div class="metric"><div class="metric-label">Ocupados</div><div class="metric-value" style="color:#1D9E75">'+DEPTOS.length+'<span style="font-size:14px;color:#6b6b6b">/'+( DEPTOS.length+VACIOS.length)+'</span></div><div class="metric-sub">'+VACIOS.length+' vacíos</div></div><div class="metric"><div class="metric-label">Esperado</div><div class="metric-value">'+fmt(esp)+'</div><div class="metric-sub">este mes</div></div><div class="metric"><div class="metric-label">Cobrado</div><div class="metric-value" style="color:#1D9E75">'+fmt(cob)+'</div><div class="metric-sub">'+pag+' pagados</div></div><div class="metric"><div class="metric-label">Pendiente</div><div class="metric-value" style="color:#a32d2d">'+fmt(esp-cob)+'</div><div class="metric-sub">'+(DEPTOS.length-pag)+' pendientes</div></div>';

  var al=document.getElementById('dash-alertas'); al.innerHTML='';
  var hoy=new Date(); hoy.setHours(0,0,0,0);
  DEPTOS.forEach(function(d){
    if(!d.finDate)return;
    var fin=new Date(d.finDate+'T12:00:00');
    var dias=Math.ceil((fin-hoy)/(1000*60*60*24));
    if(dias>=0&&dias<=31)al.innerHTML+='<div class="alert-banner alert-red"><i class="ti ti-calendar-x" style="font-size:16px;flex-shrink:0"></i><div><strong>Contrato por vencer</strong> — Depto '+d.num+' ('+d.nombre.split(' ')[0]+') vence '+fmtD(d.finDate)+' ('+(dias===0?'hoy':dias+' días')+')</div></div>';
  });

  var srv=getSrv(mi),srvPend=[];
  if(!srv.internet.pagado)srvPend.push('Internet');if(!srv.agua.pagado)srvPend.push('Agua JAPAMA');
  if(!srv.limpieza.pagado)srvPend.push('Limpieza');if(!srv.internetPinos.pagado)srvPend.push('Internet Los Pinos');
  if(!srv.celular||!srv.celular.pagado)srvPend.push('Saldo celular');if(!srv.cfe||!srv.cfe.pagado)srvPend.push('CFE Luz');
  if(srvPend.length)al.innerHTML+='<div class="alert-banner alert-amber"><i class="ti ti-receipt" style="font-size:16px;flex-shrink:0"></i><div><strong>'+srvPend.length+' servicio'+(srvPend.length>1?'s':'')+' pendiente'+(srvPend.length>1?'s':'')+' de pago</strong><div style="font-size:12px;margin-top:2px">'+srvPend.join(' · ')+'</div></div><button class="btn btn-sm" style="margin-left:auto" onclick="showPage(\'servicios\',document.querySelectorAll(\'.nav-item\')[2])">Ver servicios</button></div>';

  var tbody=document.getElementById('dash-tbody'); tbody.innerHTML='';
  DEPTOS.forEach(function(d,i){var p=getPago(d.num,mi),ok=p&&p.pagado;var badge=ok?('<span class="badge badge-green">Pagado</span>'+(p&&p.fecha?' <span style="font-size:11px;color:#6b6b6b">'+fmtD(p.fecha)+'</span>':'')):'<span class="badge badge-amber">Pendiente</span>';var accion=!ok?'<button class="btn btn-xs btn-primary" onclick="marcarPagado('+d.num+','+mi+')">Marcar pagado</button>':'<button class="btn btn-xs btn-danger" onclick="desmarcarPago('+d.num+','+mi+')"><i class="ti ti-rotate-left"></i></button>';tbody.innerHTML+='<tr><td><strong>Depto '+d.num+'</strong></td><td><div class="flex gap-8">'+avEl(d.nombre,i)+'<span>'+d.nombre+'</span></div></td><td class="text-muted">Día '+d.diaPago+'</td><td>'+fmt(d.renta)+'</td><td>'+badge+'</td><td>'+accion+'</td></tr>';});
  VACIOS.forEach(function(n){tbody.innerHTML+='<tr><td><strong>Depto '+n+'</strong></td><td colspan="5" class="text-muted">Vacío</td></tr>';});
}

// ── Deptos ─────────────────────────────────────────────────────────────────
function renderDeptos() {
  var list=document.getElementById('depa-list'); if(!list)return;
  list.innerHTML=''; var mi=MEX_MES;
  DEPTOS.forEach(function(d,i){
    var p=getPago(d.num,mi),ok=p&&p.pagado;
    var pagosBadge=ok?'<span class="badge badge-green">Pagado</span>':'<span class="badge badge-amber">Pendiente</span>';
    var avalBadge=d.aval&&d.aval.nombre?'<span class="badge badge-blue">Aval ✓</span>':'<span class="badge badge-gray">Sin aval</span>';
    var ineBadge=d.ineInqUrl?'<span class="badge badge-purple">INE ✓</span>':'<span class="badge badge-gray">Sin INE</span>';
    list.innerHTML+='<div class="card" style="margin-bottom:.75rem;border-left:3px solid '+(ok?'#1D9E75':'#EF9F27')+';border-radius:0 12px 12px 0"><div class="flex" style="justify-content:space-between;margin-bottom:.75rem;flex-wrap:wrap;gap:8px"><div class="flex gap-8" style="cursor:pointer" onclick="verInq('+i+')"><div style="background:#f0f0f0;border-radius:8px;padding:4px 10px;font-size:18px;font-weight:600;color:#6b6b6b;min-width:40px;text-align:center">'+d.num+'</div>'+avEl(d.nombre,i,'avatar')+'<div><div style="font-weight:600;font-size:14px">'+d.nombre+'</div><div class="text-muted">'+d.contrato+' · '+fmt(d.renta)+'/mes · día '+d.diaPago+(d.finStr?' · vence '+d.finStr:'')+'</div></div></div><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">'+pagosBadge+avalBadge+ineBadge+(d.deposito?'<span class="badge badge-green">Dep. ✓</span>':'<span class="badge badge-red">Sin dep.</span>')+'<button class="btn btn-sm" onclick="editarInq('+i+')"><i class="ti ti-edit"></i> Editar</button></div></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;font-size:12px;border-top:1px solid #eee;padding-top:.75rem"><div><span class="text-muted">Teléfono</span><br><strong>'+(d.tel||'—')+'</strong></div><div><span class="text-muted">Correo</span><br><strong>'+(d.email||'—')+'</strong></div><div><span class="text-muted">Ocupación</span><br><strong>'+(d.ocupacion||'—')+'</strong></div><div><span class="text-muted">Aval</span><br><strong>'+(d.aval&&d.aval.nombre?d.aval.nombre:'—')+'</strong></div></div></div>';
  });
  if(VACIOS.length){
    list.innerHTML+='<div style="font-size:12px;font-weight:500;color:#6b6b6b;margin:1rem 0 .5rem;text-transform:uppercase;letter-spacing:.05em">Departamentos vacíos</div>';
    var vacHtml='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin-bottom:1rem">';
    VACIOS.forEach(function(n){vacHtml+='<div class="depa-card vacio" onclick="irAContratos()"><div class="depa-num" style="color:#6b6b6b">'+n+'</div><div class="depa-name" style="color:#6b6b6b">Vacío</div><div class="depa-renta" style="color:#1D9E75">+ Nuevo contrato</div></div>';});
    list.innerHTML+=vacHtml+'</div>';
  }
}

// ── Pagos ──────────────────────────────────────────────────────────────────
function renderPagos() {
  var tbody=document.getElementById('pagos-tbody'); if(!tbody)return;
  var mi=MEX_MES; tbody.innerHTML='';
  DEPTOS.forEach(function(d,i){var p=getPago(d.num,mi),ok=p&&p.pagado;tbody.innerHTML+='<tr><td>Depto '+d.num+'</td><td><div class="flex gap-8">'+avEl(d.nombre,i)+'<span>'+d.nombre+'</span></div></td><td>'+fmt(d.renta)+'</td><td>Día '+d.diaPago+'</td><td class="text-muted">'+(ok?p.forma:'—')+'</td><td>'+(ok?'<span class="badge badge-green">Pagado</span>':'<span class="badge badge-amber">Pendiente</span>')+'</td><td style="display:flex;gap:4px">'+(!ok?'<button class="btn btn-xs btn-primary" onclick="marcarPagado('+d.num+','+mi+')">Marcar pagado</button>':'<button class="btn btn-xs btn-orange" onclick="desmarcarPago('+d.num+','+mi+')"><i class="ti ti-rotate-left"></i> Deshacer</button>')+'</td></tr>';});
}

function toggleHistPago(num,key) {
  var p=PAGOS[num]&&PAGOS[num][key];
  if(p&&p.pagado){if(!PAGOS[num])PAGOS[num]={};delete PAGOS[num][key];deletePago(num,key);}
  else{if(!PAGOS[num])PAGOS[num]={};var d=DEPTOS.find(function(x){return x.num===num;});var hoy=new Date().toISOString().split('T')[0];var pago={pagado:true,forma:'Transferencia SPEI',monto:d?d.renta:0,fecha:hoy};PAGOS[num][key]=pago;savePago(num,key,pago);}
  renderPagos();renderDashboard();
}

// ── Servicios ──────────────────────────────────────────────────────────────
function renderServicios() {
  var miEl=document.getElementById('srv-mes-sel'); if(!miEl)return;
  var mi=parseInt(miEl.value); var srv=getSrv(mi);
  document.getElementById('cfe-alerta').innerHTML='';
  var cont=document.getElementById('srv-cards'); cont.innerHTML='';
  SRV_META.forEach(function(m){
    var s=srv[m.key]||{monto:0,fijo:false,pagado:false};
    var isCFE=m.key==='cfe';
    cont.innerHTML+='<div class="srv-card '+(s.pagado?'pagado-card':'pendiente-card')+'"><div style="font-size:12px;color:#6b6b6b;display:flex;align-items:center;gap:6px"><i class="ti '+m.icon+'" style="color:'+m.tc+';font-size:14px"></i>'+m.label+(m.key==='internet'?'<span class="badge badge-gray" style="font-size:10px">fijo</span>':isCFE?'<span class="badge badge-orange" style="font-size:10px">bimestral</span>':'')+'</div><div id="sd-'+m.key+'"><div style="font-size:20px;font-weight:600;color:'+m.tc+'">'+(s.monto?fmt(s.monto):'—')+'</div><div style="font-size:11px;color:#6b6b6b">'+m.desc+'</div></div><div id="si-'+m.key+'" style="display:none"><input class="monto-input" type="number" value="'+(s.monto||'')+'" id="sinp-'+m.key+'" placeholder="Monto $" onchange="updSrv(\''+m.key+'\','+mi+',this.value)" style="color:'+m.tc+'"></div><div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:4px"><span class="badge '+(s.pagado?'badge-green':'badge-amber')+'">'+(s.pagado?'Pagado':'Pendiente')+'</span><div style="display:flex;gap:4px"><button style="font-size:11px;color:#1D9E75;background:none;border:none;cursor:pointer;font-family:inherit" onclick="togSrv(\''+m.key+'\')"><i class="ti ti-edit"></i> Editar</button>'+(!s.pagado?'<button class="btn btn-xs btn-primary" onclick="mkSrv(\''+m.key+'\','+mi+')">Pagar</button>':'<button class="btn btn-xs" onclick="unSrv(\''+m.key+'\','+mi+')"><i class="ti ti-rotate-left"></i></button>')+'</div></div></div>';
  });
  document.getElementById('srv-total').textContent=fmt(totalSrvJesus(mi));
  var ht=document.getElementById('cfe-hist'); ht.innerHTML='';
  HIST_LABELS.forEach(function(label,idx){var s=getSrv(idx);SRV_META.forEach(function(m){if(s[m.key]&&s[m.key].pagado)ht.innerHTML+='<tr><td><span class="badge badge-blue">'+m.label+'</span></td><td class="text-muted">'+label+'</td><td class="text-muted">—</td><td style="font-weight:500">'+fmt(s[m.key].monto)+'</td><td><span class="badge badge-green">Pagado</span></td></tr>';});});
  if(!ht.innerHTML)ht.innerHTML='<tr><td colspan="5" class="text-muted center" style="padding:1rem">Sin registros aún</td></tr>';
}
function togSrv(k){var d=document.getElementById('sd-'+k),inp=document.getElementById('si-'+k),h=d.style.display==='none';d.style.display=h?'block':'none';inp.style.display=h?'none':'block';if(!h)document.getElementById('sinp-'+k).focus();}
function updSrv(k,mi,v){getSrv(mi)[k].monto=parseFloat(v)||0;saveSrv(mi,getSrv(mi));renderServicios();renderFinanzas();}
function mkSrv(k,mi){getSrv(mi)[k].pagado=true;saveSrv(mi,getSrv(mi));renderServicios();renderFinanzas();renderDashboard();}
function unSrv(k,mi){getSrv(mi)[k].pagado=false;saveSrv(mi,getSrv(mi));renderServicios();renderFinanzas();renderDashboard();}
function guardarCFE(){
  var ini=document.getElementById('cfe-ini').value,monto=parseFloat(document.getElementById('cfe-monto').value)||0;
  if(!ini||!monto){alert('Ingresa fecha y monto');return;}
  var entry={inicio:ini,fin:document.getElementById('cfe-fin').value,monto:monto,fechaPago:document.getElementById('cfe-pagado').value,notas:document.getElementById('cfe-notas').value};
  CFE_HIST.push(entry); saveCFE(CFE_HIST);
  ['cfe-ini','cfe-fin','cfe-monto','cfe-pagado','cfe-notas'].forEach(function(id){document.getElementById(id).value='';});
  closeModal('modal-cfe');renderServicios();renderDashboard();
}

// ── Finanzas ───────────────────────────────────────────────────────────────
function renderFinanzas(){
  var mi=MEX_MES,f=calcFinMes(mi),srv=getSrv(mi);
  function setT(id,v){var el=document.getElementById(id);if(el)el.textContent=v;}
  setT('f-cob',fmt(f.cob));setT('f-mant','-'+fmt(f.mant));setT('f-limp','-'+fmt(f.limp));setT('f-neto',fmt(f.neto));setT('f-jesus',fmt(f.jesus));setT('f-carlitos',fmt(f.carlitos));
  // Bolsa mantenimiento = FONDO_INICIAL + acumulado de mants no gastados
  var bolsaMantCalc=FONDO_INICIAL;HIST_LABELS.forEach(function(_,idx){bolsaMantCalc+=calcFinMes(idx).mant;});BOLSA_MANT=bolsaMantCalc;
  setT('bolsa-jesus-val',fmt(BOLSA_JESUS));setT('bolsa-carlitos-val',fmt(BOLSA_CARLITOS));setT('bolsa-mant-val',fmt(BOLSA_MANT));
  setT('f-jesus-det','25% neto + internet '+fmt(srv.internet.monto)+' + agua '+fmt(srv.agua.monto)+' + pinos '+fmt(srv.internetPinos.monto)+' + celular '+fmt(srv.celular?srv.celular.monto:20));
  var fh=FIN_HIST[mi]||{};
  var btnJ=document.getElementById('btn-transfer-jesus');var lblJ=document.getElementById('lbl-transfer-jesus');
  var btnC=document.getElementById('btn-transfer-carlitos');var lblC=document.getElementById('lbl-transfer-carlitos');
  if(btnJ){btnJ.className='btn btn-sm '+(fh.jesusTransferido?'btn-primary':'');lblJ.textContent=fh.jesusTransferido?'✓ Transferido':'Marcar transferido';}
  if(btnC){btnC.className='btn btn-sm '+(fh.carlitosTransferido?'btn-primary':'');lblC.textContent=fh.carlitosTransferido?'✓ Transferido':'Marcar transferido';}

  var fondoAcum=FONDO_INICIAL;
  var fondoRows=HIST_LABELS.map(function(label,idx){var ff=calcFinMes(idx);fondoAcum+=ff.mant;return '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #eee;font-size:13px"><span class="text-muted">'+label+'</span><span style="font-weight:500">+'+fmt(ff.mant)+'</span></div>';}).join('');
  var fondoEl=document.getElementById('fondo-mant-display');
  if(fondoEl)fondoEl.innerHTML='<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px"><div style="font-size:28px;font-weight:600;color:#534AB7">'+fmt(fondoAcum)+'</div><button class="btn btn-sm" onclick="editarFondoInicial()"><i class="ti ti-edit"></i> Editar saldo inicial</button></div><div id="fondo-edit-box" style="display:none;margin-bottom:10px"><div class="form-row" style="max-width:300px"><div class="form-group"><label>Saldo inicial ($)</label><input type="number" id="fondo-inicial-inp" value="'+FONDO_INICIAL+'" placeholder="0"></div></div><button class="btn btn-primary btn-sm" onclick="guardarFondoInicial()"><i class="ti ti-check"></i> Guardar</button> <button class="btn btn-sm" onclick="document.getElementById(\'fondo-edit-box\').style.display=\'none\'">Cancelar</button></div><div style="font-size:12px;color:#6b6b6b;margin-bottom:8px">Saldo inicial '+fmt(FONDO_INICIAL)+' + 10% del neto mensual</div><details><summary style="cursor:pointer;font-size:12px;color:#534AB7;margin-bottom:8px">Ver desglose por mes</summary>'+fondoRows+'</details>';

  var hh='';
  HIST_LABELS.forEach(function(label,idx){
    var ff=calcFinMes(idx); if(ff.cob===0)return;
    var ffh=FIN_HIST[idx]||{};
    hh+='<div style="padding:10px 0;border-bottom:1px solid #eee"><div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="font-weight:500;font-size:13px">'+label+'</span><span class="text-muted" style="font-size:12px">Cobrado: '+fmt(ff.cob)+'</span></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div style="background:#E1F5EE;border-radius:8px;padding:8px"><div style="font-size:11px;color:#085041">Jesús</div><div style="font-size:16px;font-weight:600;color:#1D9E75">'+fmt(ff.jesus)+'</div><button class="btn btn-xs '+(ffh.jesusTransferido?'btn-primary':'')+'" style="margin-top:4px" onclick="toggleTransferido('+idx+',\'jesus\')">'+(ffh.jesusTransferido?'✓ Transferido':'Marcar transferido')+'</button></div><div style="background:#E6F1FB;border-radius:8px;padding:8px"><div style="font-size:11px;color:#0C447C">Carlitos</div><div style="font-size:16px;font-weight:600;color:#185FA5">'+fmt(ff.carlitos)+'</div><button class="btn btn-xs '+(ffh.carlitosTransferido?'btn-primary':'')+'" style="margin-top:4px" onclick="toggleTransferido('+idx+',\'carlitos\')">'+(ffh.carlitosTransferido?'✓ Transferido':'Marcar transferido')+'</button></div></div></div>';
  });
  var histEl=document.getElementById('fin-historial');
  if(histEl)histEl.innerHTML=hh?'<details '+(FIN_HIST_OPEN?'open':'')+' onToggle="FIN_HIST_OPEN=this.open"><summary style="cursor:pointer;font-size:13px;color:#185FA5;padding:8px 0">Ver historial de distribuciones</summary>'+hh+'</details>':'<div class="text-muted" style="padding:8px 0;font-size:13px">Sin distribuciones registradas aún</div>';
  calcSim();
}
function editarFondoInicial(){document.getElementById('fondo-edit-box').style.display='block';}
function guardarFondoInicial(){var v=parseFloat(document.getElementById('fondo-inicial-inp').value)||0;FONDO_INICIAL=v;saveFinHist();document.getElementById('fondo-edit-box').style.display='none';renderFinanzas();}
function marcarTransferido(quien){
  var mi=MEX_MES,f=calcFinMes(mi);
  if(!FIN_HIST[mi])FIN_HIST[mi]={jesusTransferido:false,carlitosTransferido:false};
  var antes=FIN_HIST[mi][quien+'Transferido'];
  FIN_HIST[mi][quien+'Transferido']=!antes;
  if(quien==='jesus'){BOLSA_JESUS=Math.max(0,antes?BOLSA_JESUS+f.jesus:BOLSA_JESUS-f.jesus);}
  else if(quien==='carlitos'){BOLSA_CARLITOS=Math.max(0,antes?BOLSA_CARLITOS+f.carlitos:BOLSA_CARLITOS-f.carlitos);}
  saveFinHist();renderFinanzas();
}
function toggleTransferido(mi,quien){
  var f=calcFinMes(mi);
  if(!FIN_HIST[mi])FIN_HIST[mi]={jesus:f.jesus,carlitos:f.carlitos,jesusTransferido:false,carlitosTransferido:false};
  var antes=FIN_HIST[mi][quien+'Transferido'];
  FIN_HIST[mi][quien+'Transferido']=!antes;
  if(quien==='jesus'){BOLSA_JESUS=Math.max(0,antes?BOLSA_JESUS+f.jesus:BOLSA_JESUS-f.jesus);}
  else if(quien==='carlitos'){BOLSA_CARLITOS=Math.max(0,antes?BOLSA_CARLITOS+f.carlitos:BOLSA_CARLITOS-f.carlitos);}
  saveFinHist();renderFinanzas();
}
function calcSim(){var renta=parseFloat(document.getElementById('sim-renta').value)||0,extra=parseFloat(document.getElementById('sim-extra').value)||0,srv=getSrv(MEX_MES),limp=srv.limpieza.monto,neto=Math.max(0,renta-renta*0.10-limp-extra),srvJ=srv.internet.monto+srv.agua.monto+srv.internetPinos.monto+(srv.celular?srv.celular.monto:20);document.getElementById('sim-result').innerHTML='<div class="metric"><div class="metric-label">Neto</div><div class="metric-value">'+fmt(neto)+'</div><div class="metric-sub">tras gastos</div></div><div class="metric" style="border-left:3px solid #1D9E75"><div class="metric-label">Jesús</div><div class="metric-value" style="color:#1D9E75">'+fmt(neto*0.25+srvJ)+'</div><div class="metric-sub">25%+servicios</div></div><div class="metric" style="border-left:3px solid #185FA5"><div class="metric-label">Carlitos</div><div class="metric-value" style="color:#185FA5">'+fmt(neto*0.75)+'</div><div class="metric-sub">75%</div></div>';}

function restaurarInq(idx){
  var d=INQ_HIST[idx];
  if(!d)return;
  if(!confirm('¿Restaurar a '+d.nombre+' al Depto '+d.num+'?'))return;
  var obj=Object.assign({},d);delete obj._eliminado;
  var existing=DEPTOS.find(function(x){return x.num===obj.num;});
  if(existing){if(!confirm('El Depto '+obj.num+' ya está ocupado por '+existing.nombre+'. ¿Reemplazar?'))return;DEPTOS[DEPTOS.indexOf(existing)]=obj;}
  else{DEPTOS.push(obj);DEPTOS.sort(function(a,b){return a.num-b.num;});}
  var vi=VACIOS.indexOf(obj.num);if(vi>-1)VACIOS.splice(vi,1);
  INQ_HIST.splice(idx,1);saveInqHist();saveDepto(obj);renderAll();
  alert(obj.nombre+' restaurado al Depto '+obj.num);
}
// ── Contratos ──────────────────────────────────────────────────────────────
function renderContratos(){
  var sel=document.getElementById('c-sel');if(!sel)return;
  sel.innerHTML='<option value="">— Manual o selecciona —</option>';
  DEPTOS.forEach(function(d,i){sel.innerHTML+='<option value="'+i+'">Depto '+d.num+' — '+d.nombre+'</option>';});
  checkAltaBtn();prevContrato();
  var elimBox=document.getElementById('elim-contrato-box');if(elimBox)elimBox.style.display='none';
  // Historial inquilinos eliminados
  var hl=document.getElementById('inq-hist-list');if(!hl)return;
  if(!INQ_HIST.length){hl.innerHTML='<div class="text-muted" style="font-size:13px;padding:8px 0">Sin inquilinos eliminados aún</div>';return;}
  var rows='<table class="tbl"><thead><tr><th>Inquilino</th><th>Depto</th><th>Renta</th><th>Eliminado</th><th></th></tr></thead><tbody>';
  INQ_HIST.forEach(function(d,i){
    rows+='<tr><td style="font-weight:500">'+d.nombre+'</td><td>Depto '+d.num+'</td><td>'+fmt(d.renta)+'</td><td class="text-muted">'+d._eliminado+'</td><td><button class="btn btn-xs btn-primary" onclick="restaurarInq('+i+')"><i class="ti ti-refresh"></i> Restaurar</button></td></tr>';
  });
  rows+='</tbody></table>';
  hl.innerHTML=rows;
}
function cargarContrato(){
  var v=document.getElementById('c-sel').value;
  var elimBox=document.getElementById('elim-contrato-box');
  if(v===''){if(elimBox)elimBox.style.display='none';return;}
  var d=DEPTOS[parseInt(v)];
  document.getElementById('c-nombre').value=d.nombre;document.getElementById('c-aval').value=d.aval&&d.aval.nombre?d.aval.nombre:'';
  document.getElementById('c-depto').value=d.num;cPiso();document.getElementById('c-monto').value=d.renta||5000;
  document.getElementById('c-dur').value=d.contrato==='1 año'?'UN AÑO':'SEIS MESES';
  document.getElementById('c-tel').value=d.tel||'';document.getElementById('c-email').value=d.email||'';
  document.getElementById('c-nac').value=d.nacimiento||'';document.getElementById('c-dom').value=d.domicilio||'';
  if(elimBox)elimBox.style.display='block';checkAltaBtn();prevContrato();
}
function checkAltaBtn(){var nom=document.getElementById('c-nombre').value.trim(),dep=document.getElementById('c-depto').value,box=document.getElementById('alta-box');if(box)box.style.display=(nom&&dep)?'block':'none';}
function eliminarContrato(){
  var v=document.getElementById('c-sel').value;if(v==='')return;
  var d=DEPTOS[parseInt(v)];
  if(!confirm('¿Eliminar contrato e inquilino '+d.nombre+' del Depto '+d.num+'?'))return;
  var ahora=new Date();
  INQ_HIST.unshift(Object.assign({},d,{_eliminado:ahora.getDate()+'/'+(ahora.getMonth()+1)+'/'+ahora.getFullYear()}));
  saveInqHist();
  delDepto(d.num);DEPTOS.splice(parseInt(v),1);VACIOS.push(d.num);VACIOS.sort(function(a,b){return a-b;});
  document.getElementById('contrato-gen-msg').innerHTML='';renderAll();
}
function darDeAlta(){
  var nom=document.getElementById('c-nombre').value.trim(),dep=parseInt(document.getElementById('c-depto').value);
  if(!nom||!dep){alert('Se necesita al menos nombre y departamento');return;}
  var dur=document.getElementById('c-dur').value,ini=document.getElementById('c-ini').value,renta=parseFloat(document.getElementById('c-monto').value)||5000;
  var mesesMap={'1 MES':1,'2 MESES':2,'3 MESES':3,'4 MESES':4,'5 MESES':5,'SEIS MESES':6,'7 MESES':7,'8 MESES':8,'9 MESES':9,'10 MESES':10,'11 MESES':11,'UN AÑO':12};var mesesN=mesesMap[dur]||6;
  var finDate='',finStr='—',dia=1;
  if(ini){var fd=new Date(ini+'T12:00:00');fd.setMonth(fd.getMonth()+mesesN);finDate=fd.toISOString().split('T')[0];finStr=fd.getDate()+' '+MS[fd.getMonth()]+' '+fd.getFullYear();dia=new Date(ini+'T12:00:00').getDate();}
  var contrato=dur==='UN AÑO'?'1 año':dur==='SEIS MESES'?'6 meses':'3 meses';
  var obj={num:dep,nombre:nom,renta:renta,diaPago:dia,contrato:contrato,finDate:finDate,finStr:finStr,deposito:false,tel:document.getElementById('c-tel').value,email:document.getElementById('c-email').value,curp:'',nacimiento:document.getElementById('c-nac').value,ocupacion:'',domicilio:document.getElementById('c-dom').value,notas:'',ineInqUrl:'',ineAvalUrl:'',aval:{nombre:document.getElementById('c-aval').value,parentesco:'',tel:'',email:'',curp:'',calle:'',colonia:'',ciudad:'',estado:'',cp:'',propiedad:'Sí',propDir:'',notas:''}};
  var existing=DEPTOS.find(function(d){return d.num===dep;});
  if(existing){DEPTOS[DEPTOS.indexOf(existing)]=obj;}else{DEPTOS.push(obj);DEPTOS.sort(function(a,b){return a.num-b.num;});}
  var vi=VACIOS.indexOf(dep);if(vi>-1)VACIOS.splice(vi,1);if(!PAGOS[dep])PAGOS[dep]={};
  saveDepto(obj);
  document.getElementById('contrato-gen-msg').innerHTML='<div class="alert-banner" style="background:#E1F5EE;color:#085041;border:1px solid #b2dfd0"><i class="ti ti-check"></i> Depto '+dep+' — '+nom+' dado de alta en Departamentos</div>';
  renderAll();
}
function prevContrato(){
  var nom=document.getElementById('c-nombre').value||'[NOMBRE INQUILINO]',av=document.getElementById('c-aval').value||'[NOMBRE AVAL]',num=document.getElementById('c-depto').value||'?';
  var dur=document.getElementById('c-dur').value,ini=document.getElementById('c-ini').value,fin=document.getElementById('c-fin-f').value,monto=parseFloat(document.getElementById('c-monto').value)||5000;
  function fD(iso){if(!iso)return'[FECHA]';var d=new Date(iso+'T12:00:00');return d.getDate()+' DE '+MS_UP[d.getMonth()]+' DE '+d.getFullYear();}
  function hl(t){return '<span class="hl">'+t+'</span>';}
  document.getElementById('c-preview').innerHTML='CONTRATO… HOY '+hl(fD(ini))+'\nEL C. '+hl(nom.toUpperCase())+'\n\nSEGUNDO.- '+hl(dur)+', del '+hl(fD(ini))+' al '+hl(fD(fin))+'\nTERCERO.- Depto '+hl(num)+', '+hl(parseInt(num)<=4?'PLANTA BAJA':'PLANTA ALTA')+'\nRenta: '+hl('$'+monto.toLocaleString('es-MX')+'.00 MXN')+'\nAval: '+hl(av.toUpperCase())+'\n\n── Firmas ──\nRAMON ADOLFO ARMENTA RODRIGUEZ · '+nom.toUpperCase()+' · '+av.toUpperCase();
  var ok=nom!=='[NOMBRE INQUILINO]'&&av!=='[NOMBRE AVAL]'&&ini&&fin;
  document.getElementById('c-status').className='badge '+(ok?'badge-green':'badge-amber');document.getElementById('c-status').textContent=ok?'Listo':'Datos incompletos';
}
function genContrato(formato){
  var nom=document.getElementById('c-nombre').value.trim(),av=document.getElementById('c-aval').value.trim();
  if(!nom||!av||!document.getElementById('c-ini').value){alert('Completa nombre, aval y fecha de inicio');return;}
  var num=parseInt(document.getElementById('c-depto').value)||1,dur=document.getElementById('c-dur').value,monto=parseFloat(document.getElementById('c-monto').value)||5000,ini=document.getElementById('c-ini').value,fin=document.getElementById('c-fin-f').value;
  if(formato==='pdf'){genPDFNativo(nom,av,num,dur,ini,fin,monto);return;}
  var btn=document.getElementById('btn-gen-docx'),orig=btn.innerHTML;btn.innerHTML='<div class="loading-dots"><span></span><span></span><span></span></div> Generando…';btn.disabled=true;
  fetch('/.netlify/functions/generar-contrato',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nombreInquilino:nom,nombreAval:av,numDepto:num,monto:monto,fechaInicio:ini,fechaFin:fin,duracion:dur})})
  .then(function(r){return r.json();}).then(function(data){
    if(data.error)throw new Error(data.error);
    var bytes=atob(data.docx),arr=new Uint8Array(bytes.length);
    for(var i=0;i<bytes.length;i++)arr[i]=bytes.charCodeAt(i);
    var blob=new Blob([arr],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
    var url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='contrato_depto'+num+'_'+nom.split(' ')[0].toUpperCase()+'.docx';a.click();URL.revokeObjectURL(url);
    registrarContrato(nom,num,'DOCX');
  }).catch(function(e){document.getElementById('contrato-gen-msg').innerHTML='<div class="alert-banner alert-amber"><i class="ti ti-alert-triangle"></i> Error: '+e.message+'</div>';})
  .finally(function(){btn.innerHTML=orig;btn.disabled=false;});
}
function genPDFNativo(nom,av,num,dur,ini,fin,monto){
  function fD(iso){if(!iso)return'___';var d=new Date(iso+'T12:00:00');return d.getDate()+' de '+MS_FULL[d.getMonth()]+' de '+d.getFullYear();}
  var piso=num<=4?'Primer Piso (Planta Baja)':'Segundo Piso (Planta Alta)';
  var html='<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;font-size:11pt;line-height:1.6;margin:2cm;color:#000}h2{text-align:center;font-size:13pt;margin-bottom:16px}p{margin-bottom:10px;text-align:justify}.c{margin-bottom:12px}.c strong{display:block}.firma{margin-top:40px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;text-align:center}.fl{border-top:1px solid #000;padding-top:6px;margin-top:40px;font-size:10pt}</style></head><body><h2>CONTRATO DE ARRENDAMIENTO</h2><p>En Los Mochis, Sinaloa, el <strong>'+fD(ini)+'</strong>, el C. <strong>RAMÓN ADOLFO ARMENTA RODRÍGUEZ</strong> (arrendador) y el C. <strong>'+nom.toUpperCase()+'</strong> (arrendatario) celebran:</p><div class="c"><strong>PRIMERA.- OBJETO.</strong> Departamento No. <strong>'+num+'</strong>, '+piso+', Av. 10 de Mayo 1524 Oriente, Las Memorias, Los Mochis, Sinaloa.</div><div class="c"><strong>SEGUNDA.- VIGENCIA.</strong> <strong>'+dur+'</strong>, del <strong>'+fD(ini)+'</strong> al <strong>'+fD(fin)+'</strong>.</div><div class="c"><strong>TERCERA.- RENTA.</strong> <strong>$'+monto.toLocaleString('es-MX')+'.00 M.N.</strong> mensuales por adelantado.</div><div class="c"><strong>CUARTA.- SERVICIOS.</strong> Agua y luz por cuenta del arrendatario. Internet incluido.</div><div class="c"><strong>QUINTA.- DEPÓSITO.</strong> Un mes de renta como garantía.</div><div class="c"><strong>SEXTA.- USO.</strong> Exclusivamente habitacional.</div><div class="c"><strong>SÉPTIMA.- CONSERVACIÓN.</strong> El arrendatario conservará el inmueble en buen estado.</div><div class="c"><strong>OCTAVA.- PROHIBICIONES.</strong> Prohibido subarrendar o modificar estructuralmente.</div><div class="c"><strong>NOVENA.- RESCISIÓN.</strong> Por incumplimiento de obligaciones.</div><div class="c"><strong>DÉCIMA.- AVAL.</strong> El C. <strong>'+av.toUpperCase()+'</strong> como aval solidario.</div><div class="c"><strong>DÉCIMA PRIMERA.- JURISDICCIÓN.</strong> Tribunales de Los Mochis, Sinaloa.</div><p>Firman el <strong>'+fD(ini)+'</strong>.</p><div class="firma"><div><div class="fl">RAMÓN ADOLFO ARMENTA RODRÍGUEZ<br><small>Arrendador</small></div></div><div><div class="fl">'+nom.toUpperCase()+'<br><small>Arrendatario</small></div></div><div><div class="fl">'+av.toUpperCase()+'<br><small>Aval</small></div></div></div></body></html>';
  var w=window.open('','_blank');w.document.write(html);w.document.close();setTimeout(function(){w.print();},500);
  registrarContrato(nom,num,'PDF');
}
function registrarContrato(nom,num,formato){
  var ahora=new Date();CONTRATO_HIST.unshift({nombre:nom,depto:num,formato:formato,fecha:ahora.getDate()+'/'+(ahora.getMonth()+1)+'/'+ahora.getFullYear()});
  var ht=document.getElementById('c-hist');if(!ht)return;ht.innerHTML='';
  CONTRATO_HIST.forEach(function(c){ht.innerHTML+='<tr><td style="font-weight:500">'+c.nombre+'</td><td>Depto '+c.depto+'</td><td><span class="badge '+(c.formato==='PDF'?'badge-red':'badge-blue')+'">'+c.formato+'</span></td><td class="text-muted">'+c.fecha+'</td></tr>';});
}

// ── Mantenimiento ──────────────────────────────────────────────────────────
function toggleMantHist(){MANT_HIST_OPEN=!MANT_HIST_OPEN;var panel=document.getElementById('mant-hist-panel'),label=document.getElementById('mant-hist-label');if(panel)panel.classList.toggle('open',MANT_HIST_OPEN);if(label)label.textContent=MANT_HIST_OPEN?'Ocultar historial':'Ver historial';if(MANT_HIST_OPEN)renderMantHistorial();}
function mantKey(type,id){return type+'_'+id;}
function getMantYears(key){if(!MANT_STATE[key])MANT_STATE[key]={};return MANT_STATE[key];}
function toggleMant(key,year){if(!MANT_STATE[key])MANT_STATE[key]={};if(MANT_STATE[key][year]){delete MANT_STATE[key][year];delete MANT_STATE[key][year+'_fecha'];}else{var hoy=new Date();MANT_STATE[key][year]=true;MANT_STATE[key][year+'_fecha']=MS_FULL[hoy.getMonth()]+' '+hoy.getFullYear();}saveMant();renderMantenimiento();if(MANT_HIST_OPEN)renderMantHistorial();}
function mantBtnCur(key,year){var done=getMantYears(key)[year]||false,fecha=getMantYears(key)[year+'_fecha']||'';return '<td><button onclick="toggleMant(\''+key+'\','+year+')" style="background:'+(done?'#1D9E75':'#f5f5f3')+';color:'+(done?'#fff':'#6b6b6b')+';border:1px solid '+(done?'#1D9E75':'#ddd')+';border-radius:6px;padding:4px 12px;cursor:pointer;font-size:12px;font-family:inherit">'+(done?'✓ '+(fecha||year):'Pendiente')+'</button></td>';}
function mantBtnHist(key,year){var done=getMantYears(key)[year]||false,fecha=getMantYears(key)[year+'_fecha']||'';return '<td><button onclick="toggleMant(\''+key+'\','+year+')" style="background:'+(done?'#1D9E75':'#f5f5f3')+';color:'+(done?'#fff':'#6b6b6b')+';border:1px solid '+(done?'#1D9E75':'#ddd')+';border-radius:6px;padding:3px 8px;cursor:pointer;font-size:11px;font-family:inherit">'+(done?'✓ '+(fecha||year):'—')+'</button></td>';}
function renderMantenimiento(){
  var CUR=2026;
  var airesT=document.getElementById('aires-tbody');if(!airesT)return;airesT.innerHTML='';
  for(var i=1;i<=8;i++){var key=mantKey('aire',i),done=getMantYears(key)[CUR]||false,fecha=getMantYears(key)[CUR+'_fecha']||'';airesT.innerHTML+='<tr><td>Depto '+i+'</td>'+mantBtnCur(key,CUR)+'<td>'+(done?'<span class="badge badge-green">OK '+(fecha||CUR)+'</span>':'<span class="badge badge-amber">Pendiente</span>')+'</td></tr>';}
  var lavT=document.getElementById('lavadoras-tbody');if(!lavT)return;lavT.innerHTML='';
  MANT_LAVADORAS.forEach(function(loc){var key=mantKey('lavadora',loc.replace(' ','_')),done=getMantYears(key)[CUR]||false,fecha=getMantYears(key)[CUR+'_fecha']||'';lavT.innerHTML+='<tr><td>'+loc+'</td>'+mantBtnCur(key,CUR)+'<td>'+(done?'<span class="badge badge-green">OK '+(fecha||CUR)+'</span>':'<span class="badge badge-amber">Pendiente</span>')+'</td></tr>';});
  var infraT=document.getElementById('infra-tbody');if(!infraT)return;infraT.innerHTML='';
  MANT_INFRA.forEach(function(item){var key=mantKey('infra',item.key);infraT.innerHTML+='<tr><td><strong>'+item.label+'</strong><div style="font-size:11px;color:#6b6b6b">'+item.freq+'</div></td><td class="text-muted" style="font-size:12px">'+item.freq+'</td>'+mantBtnCur(key,CUR)+'</tr>';});
}
function renderMantHistorial(){
  var airesH=document.getElementById('aires-hist-tbody');if(!airesH)return;airesH.innerHTML='';
  for(var i=1;i<=8;i++){var key=mantKey('aire',i),years=getMantYears(key),lastFecha=years['2026_fecha']||years['2025_fecha']||null;airesH.innerHTML+='<tr><td>Depto '+i+'</td>'+mantBtnHist(key,2025)+mantBtnHist(key,2026)+mantBtnHist(key,2027)+'<td>'+(lastFecha?'<span class="badge badge-green">Último: '+lastFecha+'</span>':'<span class="badge badge-amber">Sin registro</span>')+'</td></tr>';}
  var lavH=document.getElementById('lavadoras-hist-tbody');if(!lavH)return;lavH.innerHTML='';
  MANT_LAVADORAS.forEach(function(loc){var key=mantKey('lavadora',loc.replace(' ','_')),years=getMantYears(key),lastFecha=years['2026_fecha']||years['2025_fecha']||null;lavH.innerHTML+='<tr><td>'+loc+'</td>'+mantBtnHist(key,2025)+mantBtnHist(key,2026)+mantBtnHist(key,2027)+'<td>'+(lastFecha?'<span class="badge badge-green">Último: '+lastFecha+'</span>':'<span class="badge badge-amber">Sin registro</span>')+'</td></tr>';});
  var infraH=document.getElementById('infra-hist-tbody');if(!infraH)return;infraH.innerHTML='';
  MANT_INFRA.forEach(function(item){var key=mantKey('infra',item.key);infraH.innerHTML+='<tr><td><strong>'+item.label+'</strong></td><td class="text-muted" style="font-size:12px">'+item.freq+'</td>'+mantBtnHist(key,2025)+mantBtnHist(key,2026)+mantBtnHist(key,2027)+'</tr>';});
}

// ── Pago actions ───────────────────────────────────────────────────────────
function marcarPagado(num,mi){if(!PAGOS[num])PAGOS[num]={};var d=DEPTOS.find(function(x){return x.num===num;});var hoy=new Date().toISOString().split('T')[0];var pago={pagado:true,forma:'Transferencia SPEI',monto:d?d.renta:0,fecha:hoy};PAGOS[num][mi]=pago;savePago(num,mi,pago);renderAll();}
function desmarcarPago(num,mi){if(PAGOS[num])delete PAGOS[num][mi];deletePago(num,mi);renderAll();}

// ── Inquilino CRUD ─────────────────────────────────────────────────────────
function editarInq(idx){
  editIdx=idx; var d=DEPTOS[idx];
  document.getElementById('mi-title').textContent='Editar — Depto '+d.num;
  var sel=document.getElementById('f-depto');sel.innerHTML='<option value="'+d.num+'">Depto '+d.num+'</option>';
  document.getElementById('f-nombre').value=d.nombre||'';document.getElementById('f-tel').value=d.tel||'';document.getElementById('f-email').value=d.email||'';
  document.getElementById('f-curp').value=d.curp||'';document.getElementById('f-nac').value=d.nacimiento||'';document.getElementById('f-contrato').value=d.contrato||'6 meses';
  document.getElementById('f-renta').value=d.renta||5000;document.getElementById('f-dia').value=d.diaPago||1;document.getElementById('f-ocup').value=d.ocupacion||'';
  document.getElementById('f-dom').value=d.domicilio||'';document.getElementById('f-dep').value=d.deposito?'Sí, pagado':'No';document.getElementById('f-notas').value=d.notas||'';
  var a=d.aval||{};
  document.getElementById('a-nombre').value=a.nombre||'';document.getElementById('a-par').value=a.parentesco||'';document.getElementById('a-tel').value=a.tel||'';
  document.getElementById('a-email').value=a.email||'';document.getElementById('a-curp').value=a.curp||'';document.getElementById('a-calle').value=a.calle||'';
  document.getElementById('a-col').value=a.colonia||'';document.getElementById('a-ciudad').value=a.ciudad||'';document.getElementById('a-estado').value=a.estado||'';
  document.getElementById('a-cp').value=a.cp||'';document.getElementById('a-prop').value=a.propiedad||'Sí';document.getElementById('a-prop-dir').value=a.propDir||'';
  document.getElementById('a-notas').value=a.notas||'';
  var ineInqPrev=document.getElementById('ine-inq-prev'),ineAvalPrev=document.getElementById('ine-aval-prev');
  if(ineInqPrev)ineInqPrev.innerHTML=d.ineInqUrl?'<img src="'+d.ineInqUrl+'" class="ine-preview">':'';
  if(ineAvalPrev)ineAvalPrev.innerHTML=d.ineAvalUrl?'<img src="'+d.ineAvalUrl+'" class="ine-preview">':'';
  resetTabsG('mi-tabs');
  openModal('modal-inq');
}
function eliminarInq(){
  if(editIdx===null)return;var d=DEPTOS[editIdx];
  if(!confirm('¿Eliminar a '+d.nombre+' del Depto '+d.num+'?'))return;
  var ahora=new Date();
  INQ_HIST.unshift(Object.assign({},d,{_eliminado:ahora.getDate()+'/'+(ahora.getMonth()+1)+'/'+ahora.getFullYear()}));
  saveInqHist();
  delDepto(d.num);DEPTOS.splice(editIdx,1);VACIOS.push(d.num);VACIOS.sort(function(a,b){return a-b;});
  editIdx=null;closeModal('modal-inq');renderAll();
}
function guardarInq(){
  var nombre=document.getElementById('f-nombre').value.trim();if(!nombre){alert('El nombre es obligatorio');return;}
  var renta=parseFloat(document.getElementById('f-renta').value)||5000,dia=parseInt(document.getElementById('f-dia').value)||1;
  var contrato=document.getElementById('f-contrato').value,inicio=document.getElementById('f-inicio').value;
  var mesesN=contrato==='1 año'?12:contrato==='6 meses'?6:1,finDate='',finStr='—';
  if(inicio){var fd=new Date(inicio+'T12:00:00');fd.setMonth(fd.getMonth()+mesesN);finDate=fd.toISOString().split('T')[0];finStr=fd.getDate()+' '+MS[fd.getMonth()]+' '+fd.getFullYear();}
  var aval={nombre:document.getElementById('a-nombre').value,parentesco:document.getElementById('a-par').value,tel:document.getElementById('a-tel').value,email:document.getElementById('a-email').value,curp:document.getElementById('a-curp').value,calle:document.getElementById('a-calle').value,colonia:document.getElementById('a-col').value,ciudad:document.getElementById('a-ciudad').value,estado:document.getElementById('a-estado').value,cp:document.getElementById('a-cp').value,propiedad:document.getElementById('a-prop').value,propDir:document.getElementById('a-prop-dir').value,notas:document.getElementById('a-notas').value};
  var num=DEPTOS[editIdx].num;
  var obj={num:num,nombre:nombre,renta:renta,diaPago:dia,contrato:contrato,finDate:finDate,finStr:finStr,deposito:document.getElementById('f-dep').value==='Sí, pagado',tel:document.getElementById('f-tel').value,email:document.getElementById('f-email').value,curp:document.getElementById('f-curp').value,nacimiento:document.getElementById('f-nac').value,ocupacion:document.getElementById('f-ocup').value,domicilio:document.getElementById('f-dom').value,notas:document.getElementById('f-notas').value,ineInqUrl:DEPTOS[editIdx].ineInqUrl||'',ineAvalUrl:DEPTOS[editIdx].ineAvalUrl||'',aval:aval};
  DEPTOS[editIdx]=obj;saveDepto(obj);closeModal('modal-inq');renderAll();
}
function verInq(idx){
  var d=DEPTOS[idx];
  document.getElementById('vi-av').className='avatar-lg '+AVS[idx%5];document.getElementById('vi-av').textContent=avI(d.nombre);
  document.getElementById('vi-nom').textContent=d.nombre;document.getElementById('vi-sub').textContent='Depto '+d.num+' · '+d.contrato+' · '+fmt(d.renta)+'/mes';
  document.getElementById('vi-edit').onclick=function(){editarInq(idx);};
  var fields=[['Teléfono',d.tel||'—'],['Correo',d.email||'—'],['Nacimiento',d.nacimiento||'—'],['Ocupación',d.ocupacion||'—'],['Depósito',d.deposito?'Sí ✓':'No'],['Día de pago','Día '+d.diaPago],['Vence',d.finStr||'—'],['Domicilio',d.domicilio||'—'],['Notas',d.notas||'—']];
  document.getElementById('vi-info').innerHTML=fields.map(function(f){return '<div class="inf-row"><span class="text-muted">'+f[0]+'</span><span style="font-weight:500">'+f[1]+'</span></div>';}).join('');
  var a=d.aval||{};
  document.getElementById('vi-aval').innerHTML=a.nombre?'<div class="flex gap-8 mb-12">'+avEl(a.nombre,idx+1)+'<div><div style="font-weight:500">'+a.nombre+'</div><div class="text-muted">'+(a.parentesco||'—')+'</div></div></div>'+[['Tel',a.tel||'—'],['Correo',a.email||'—'],['Domicilio',(a.calle||'')+' '+(a.colonia||'')+' '+(a.ciudad||'')+', '+(a.estado||'').trim()||'—']].map(function(f){return '<div class="inf-row"><span class="text-muted">'+f[0]+'</span><span style="font-weight:500">'+f[1]+'</span></div>';}).join(''):'<div class="text-muted center" style="padding:1rem">Sin datos de aval</div>';
  var contractMonths=getContractMonths(d),hh='';
  if(!contractMonths.length){hh='<div class="text-muted" style="padding:8px 0">Sin fechas de contrato.</div>';}
  else{hh='<div class="hist-grid" style="grid-template-columns:repeat('+Math.min(contractMonths.length,6)+',1fr)">';contractMonths.forEach(function(cm){var p=PAGOS[d.num]&&PAGOS[d.num][cm.key];hh+='<div class="hist-cell '+(p&&p.pagado?'hist-pagado':'hist-vacio')+'" style="cursor:pointer" onclick="toggleHistPago('+d.num+','+cm.key+')" title="Click para marcar/desmarcar"><div style="font-weight:500;font-size:11px">'+(p&&p.pagado?'✓':'—')+'</div><div style="font-size:10px">'+cm.label+'</div></div>';});hh+='</div>';}
  document.getElementById('vi-hist').innerHTML=hh;
  document.getElementById('vi-ine').innerHTML='<div><div class="section-label" style="margin-top:0">INE inquilino</div>'+(d.ineInqUrl?'<img src="'+d.ineInqUrl+'" class="ine-preview">':'<div class="text-muted center" style="padding:1rem">Sin imagen</div>')+'</div><div><div class="section-label" style="margin-top:0">INE aval</div>'+(d.ineAvalUrl?'<img src="'+d.ineAvalUrl+'" class="ine-preview">':'<div class="text-muted center" style="padding:1rem">Sin imagen</div>')+'</div>';
  resetTabsG('vi-tabs');openModal('modal-ver');
}

// ── INE Reader ─────────────────────────────────────────────────────────────
function leerINEBase(file,tipo,previewId,statusId,onInq,onAval){
  var url=URL.createObjectURL(file);
  document.getElementById(previewId).innerHTML='<img src="'+url+'" class="ine-preview">';
  document.getElementById(statusId).innerHTML='<div style="font-size:11px;color:#6b6b6b;display:flex;align-items:center;gap:4px"><div class="loading-dots"><span></span><span></span><span></span></div> Analizando con IA…</div>';
  var reader=new FileReader();
  reader.onload=function(){
    var b64=reader.result.split(',')[1];
    fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:500,messages:[{role:'user',content:[{type:'image',source:{type:'base64',media_type:file.type||'image/jpeg',data:b64}},{type:'text',text:'Extrae datos del INE mexicano. Responde SOLO JSON sin backticks: {"nombre_completo":"","curp":"","fecha_nacimiento":"YYYY-MM-DD","domicilio_calle":"","domicilio_colonia":"","domicilio_ciudad":"","domicilio_estado":"","domicilio_cp":""}'}]}]})})
    .then(function(r){return r.json();}).then(function(data){
      var txt=data.content.map(function(c){return c.text||'';}).join('').trim();
      var p;try{p=JSON.parse(txt.replace(/```json|```/g,'').trim());}catch(e){p=null;}
      if(p&&p.nombre_completo){
        if(tipo==='inq'&&onInq)onInq(p);if(tipo==='aval'&&onAval)onAval(p);
        document.getElementById(statusId).innerHTML='<div style="padding:4px 8px;background:#E1F5EE;border-radius:6px;font-size:11px;color:#085041"><i class="ti ti-check"></i> Datos extraídos</div>';
      }else{document.getElementById(statusId).innerHTML='<div style="padding:4px 8px;background:#FAEEDA;border-radius:6px;font-size:11px;color:#854F0B">No se pudo leer. Ingresa manualmente.</div>';}
    }).catch(function(){document.getElementById(statusId).innerHTML='<div style="padding:4px 8px;background:#FAEEDA;border-radius:6px;font-size:11px;color:#854F0B">Error. Ingresa manualmente.</div>';});
  };
  reader.readAsDataURL(file);
}
function leerINE(event,tipo){
  var file=event.target.files[0];if(!file)return;
  leerINEBase(file,tipo,'ine-'+tipo+'-prev','ine-'+tipo+'-st',
    function(p){if(p.nombre_completo)document.getElementById('f-nombre').value=p.nombre_completo;if(p.curp)document.getElementById('f-curp').value=p.curp;if(p.fecha_nacimiento)document.getElementById('f-nac').value=p.fecha_nacimiento;if(p.domicilio_calle)document.getElementById('f-dom').value=[p.domicilio_calle,p.domicilio_colonia,p.domicilio_ciudad,p.domicilio_estado].filter(Boolean).join(', ');},
    function(p){if(p.nombre_completo)document.getElementById('a-nombre').value=p.nombre_completo;if(p.curp)document.getElementById('a-curp').value=p.curp;if(p.domicilio_calle)document.getElementById('a-calle').value=p.domicilio_calle;if(p.domicilio_colonia)document.getElementById('a-col').value=p.domicilio_colonia;if(p.domicilio_ciudad)document.getElementById('a-ciudad').value=p.domicilio_ciudad;if(p.domicilio_estado)document.getElementById('a-estado').value=p.domicilio_estado;if(p.domicilio_cp)document.getElementById('a-cp').value=p.domicilio_cp;}
  );
}
function leerINEContrato(event,tipo){
  var file=event.target.files[0];if(!file)return;
  var prevId=tipo==='inq'?'c-ine-inq-prev':'c-ine-aval-prev',stId='c-ine-'+tipo+'-st';
  var url=URL.createObjectURL(file),prevEl=document.getElementById(prevId);
  if(prevEl)prevEl.innerHTML='<img src="'+url+'" class="ine-preview" style="width:100%;max-height:100px;object-fit:cover;border-radius:8px;margin-top:6px">';
  leerINEBase(file,tipo,prevId,stId,
    function(p){if(p.nombre_completo){document.getElementById('c-nombre').value=p.nombre_completo;checkAltaBtn();}if(p.fecha_nacimiento)document.getElementById('c-nac').value=p.fecha_nacimiento;if(p.domicilio_calle)document.getElementById('c-dom').value=[p.domicilio_calle,p.domicilio_colonia,p.domicilio_ciudad,p.domicilio_estado].filter(Boolean).join(', ');prevContrato();},
    function(p){if(p.nombre_completo){document.getElementById('c-aval').value=p.nombre_completo;prevContrato();}}
  );
}

// ── Render all ─────────────────────────────────────────────────────────────
function renderAll(){
  renderDashboard();renderDeptos();renderPagos();renderServicios();renderFinanzas();renderContratos();renderMantenimiento();
}
