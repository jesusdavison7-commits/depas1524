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
  var user  = document.getElementById('login-user').value.trim().toLowerCase();
  var pass  = document.getElementById('login-pass').value;
  var err   = document.getElementById('login-error');
  err.textContent = '';
  if(!user){err.textContent='Ingresa tu nombre de usuario';return;}
  var email = user + '@depas1524.app';
  auth.signInWithEmailAndPassword(email, pass).catch(function() {
    err.textContent = 'Usuario o contraseña incorrectos';
  });
}
function doLogout() { auth.signOut(); }
document.getElementById('login-user').addEventListener('keydown', function(e) {
  if(e.key==='Enter') document.getElementById('login-pass').focus();
});
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
var BOLSA_MANT = 0;
var PINOS = {};
var PINOS_PAGOS = {}; // historial de inquilinos eliminados
var FIN_HIST = {};
var FONDO_INICIAL = 0;
var MANT_STATE = {};
var GASTOS_MANT = [];
var MANT_NOTAS = [];
var MANT_HIST_OPEN = false;
var FIN_HIST_OPEN = false;
var editIdx = null;

var MANT_LAVADORAS = ['Planta baja','Planta alta'];
var MANT_AIRES_MES  = 7;  // agosto (0-indexed) — revisar antes del calor fuerte
var MANT_LAV_MES    = 7;  // agosto
var MANT_INFRA = [
  {key:'impermeabilizacion_parcial', label:'Sellado impermeabilización', freq:'Según necesidad', mes:4},
  {key:'tinacos', label:'Limpieza tinacos', freq:'Cada 1.5–2 años', mes:3},
  {key:'impermeabilizacion_completa', label:'Impermeabilización completa', freq:'Cada 4 años', mes:4},
  {key:'bomba', label:'Bomba entrada principal', freq:'~2 años de vida', mes:4},
];
// Muestra alertas de mant solo si estamos a ≤1 mes del mes programado (o ya pasó)
function mantEnVentana(mesDue) {
  var m = new Date().getMonth(); // 0-indexed
  return m >= mesDue - 1;
}

var MS_UP   = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
var MS      = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
var MS_FULL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// Mes índice 0 = Julio 2025 (inicio del sistema)
var START_YEAR = 2025, START_MON = 6; // 6 = julio (0-indexed)
function mesIdx(y, m) { return (y - START_YEAR) * 12 + (m - START_MON); }
function idxToYM(i)   { var tot = START_MON + i; return { y: START_YEAR + Math.floor(tot / 12), m: tot % 12 }; }
function idxLabel(i)  { var d = idxToYM(i); return MS_FULL[d.m].slice(0,3) + ' ' + String(d.y).slice(2); }

var _now = new Date();
var MEX_MES = mesIdx(_now.getFullYear(), _now.getMonth());

function genHistLabels() {
  var labels = [];
  for (var i = 0; i <= MEX_MES; i++) labels.push(idxLabel(i));
  return labels;
}
var HIST_LABELS = genHistLabels();
var AVS = ['av-teal','av-blue','av-purple','av-coral','av-amber'];
var SRV_META = [
  {key:'internet',      label:'Internet Depas',    icon:'ti-wifi',          tc:'#185FA5', desc:'Fijo mensual'},
  {key:'agua',          label:'Agua JAPAMA',        icon:'ti-droplet',       tc:'#0F6E56', desc:'Variable'},
  {key:'limpieza',      label:'Limpieza',           icon:'ti-brush',         tc:'#534AB7', desc:'Variable'},
  {key:'internetPinos', label:'Internet Los Pinos', icon:'ti-wifi-off',      tc:'#993C1D', desc:'Variable · se suma a Jesús'},
  {key:'celular',       label:'Saldo celular',      icon:'ti-device-mobile', tc:'#854F0B', desc:'6682 46 21 20'},
  {key:'cfe',           label:'Luz áreas comunes',  icon:'ti-bolt',          tc:'#854F0B', desc:'Bimestral'},
];

// ── Helpers ────────────────────────────────────────────────────────────────
function fmt(n) { return '$' + Math.round(n).toLocaleString('es-MX'); }
// Escapa caracteres HTML para prevenir XSS en innerHTML
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function avI(name) { var p=esc(name).trim().split(' '); return (p[0][0]+(p[1]?p[1][0]:'')).toUpperCase(); }
function avEl(name,i,cls) { cls=cls||'avatar'; return '<div class="'+cls+' '+AVS[i%5]+'">'+avI(name)+'</div>'; }
function fmtD(iso) { if(!iso)return'—'; var d=new Date(iso+'T12:00:00'); return d.getDate()+' '+MS[d.getMonth()]+' '+d.getFullYear(); }

var MESES_N_MAP={'1 mes':1,'2 meses':2,'3 meses':3,'4 meses':4,'5 meses':5,'6 meses':6,'7 meses':7,'8 meses':8,'9 meses':9,'10 meses':10,'11 meses':11,'1 año':12,'Mensual':1};
function getContractMonths(d) {
  if(!d.finDate) return [];
  var mesesN = MESES_N_MAP[d.contrato] || 6;
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
// Convierte "DD/MM/YYYY" → mesIdx (para gastos sin mesIdx explícito)
function fechaStrToMesIdx(fechaStr) {
  if(!fechaStr)return null;
  var p=fechaStr.split('/');if(p.length!==3)return null;
  return mesIdx(parseInt(p[2]),parseInt(p[1])-1);
}
function gastoMesIdx(g){ return g.mesIdx!==undefined?g.mesIdx:fechaStrToMesIdx(g.fecha); }

function getPago(num,mi) { return PAGOS[num]&&PAGOS[num][mi]; }
function cobradoMes(mi) {
  return DEPTOS.reduce(function(s,d){
    var p=getPago(d.num,mi);
    if(!p||!p.pagado)return s;
    // Si es vía inmobiliaria, el mes de comisión no suma a ganancias
    if(d.viaInmobiliaria&&d.inmobMesComision!=null&&mi===d.inmobMesComision)return s;
    return s+d.renta;
  },0);
}
function esperado() { return DEPTOS.reduce(function(s,d){return s+d.renta;},0); }
function totalSrvEdificio(mi) {
  var s=getSrv(mi);
  // Solo suma servicios ya marcados como pagados
  var internet=s.internet.pagado?s.internet.monto:0;
  var agua=s.agua.pagado?s.agua.monto:0;
  var cfe=(s.cfe&&s.cfe.pagado)?s.cfe.monto:0;
  var celular=s.celular?s.celular.monto:0; // gasto compartido, sale del pozo común
  return internet+agua+cfe+celular;
}
function totalSrvJesus(mi) { var s=getSrv(mi);return s.internetPinos.monto; } // solo Pinos es cobro a Carlitos
function calcFinMes(mi) {
  var cob=cobradoMes(mi),srv=getSrv(mi);
  var limp=srv.limpieza.pagado?srv.limpieza.monto:0;
  var srvEdif=totalSrvEdificio(mi),srvJ=totalSrvJesus(mi);
  var internet=srv.internet.pagado?srv.internet.monto:0;
  var agua=srv.agua.pagado?srv.agua.monto:0;
  var cfe=(srv.cfe&&srv.cfe.pagado)?srv.cfe.monto:0;
  var gastosMant=GASTOS_MANT.filter(function(g){return gastoMesIdx(g)===mi;}).reduce(function(s,g){return s+g.monto;},0);
  // 10% se calcula sobre lo que queda después de servicios y gastos
  var subtotal=Math.max(0,cob-limp-srvEdif-gastosMant);
  var mant=subtotal*0.10;
  var neto=Math.max(0,subtotal-mant);
  // srvJ (Pinos + celular) = gastos de Carlitos que Jesús adelanta
  // Se descuentan de la parte de Carlitos y se suman a la de Jesús
  var jesusBase=neto*0.25;
  var carlitosBase=neto*0.75;
  return{cob:cob,mant:mant,limp:limp,internet:internet,agua:agua,cfe:cfe,cfePeriodo:srv.cfe&&srv.cfe.periodo||'',srvEdif:srvEdif,gastosMant:gastosMant,neto:neto,srvJ:srvJ,jesus:jesusBase+srvJ,carlitos:Math.max(0,carlitosBase-srvJ)};
}

// ── Toast de errores ───────────────────────────────────────────────────────
function showToast(msg,tipo){
  var t=document.getElementById('app-toast');
  if(!t){t=document.createElement('div');t.id='app-toast';t.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:9999999;padding:10px 20px;border-radius:10px;font-size:13px;font-weight:500;box-shadow:0 4px 16px rgba(0,0,0,.18);transition:opacity .3s;pointer-events:none';document.body.appendChild(t);}
  t.textContent=msg;
  t.style.background=tipo==='error'?'#c0392b':'#1D9E75';
  t.style.color='#fff';t.style.opacity='1';
  clearTimeout(t._timer);t._timer=setTimeout(function(){t.style.opacity='0';},3500);
}
function safeSave(promise,label){
  return promise.catch(function(e){
    console.error('Error guardando '+(label||''),e);
    showToast('⚠ Error al guardar'+(label?' ('+label+')':'')+'. Revisa tu conexión.',' error');
  });
}

// ── Firebase helpers ───────────────────────────────────────────────────────
function saveDepto(d) { return safeSave(db.collection('deptos').doc(String(d.num)).set(d),'depto '+d.num); }
function delDepto(num) { return safeSave(db.collection('deptos').doc(String(num)).delete(),'eliminar depto'); }
function savePago(num,mi,p) { return safeSave(db.collection('pagos').doc(num+'_'+mi).set(Object.assign({deptoNum:num,mesIdx:mi},p)),'pago'); }
function deletePago(num,mi) { return safeSave(db.collection('pagos').doc(num+'_'+mi).delete(),'eliminar pago'); }
function saveSrv(mi,data) { return safeSave(db.collection('servicios').doc(String(mi)).set(data),'servicio'); }
function saveCFE(list) { return safeSave(db.collection('cfe').doc('historial').set({list:list}),'CFE'); }
function saveMant() { return safeSave(db.collection('config').doc('mantenimiento').set({state:MANT_STATE,notas:MANT_NOTAS}),'mantenimiento'); }
function saveMantNotas() { return safeSave(db.collection('config').doc('mantenimiento').set({state:MANT_STATE,notas:MANT_NOTAS}),'notas'); }
function saveGastosMant() { return safeSave(db.collection('config').doc('gastosMant').set({data:GASTOS_MANT}),'gastos'); }
function agregarGastoMant(){
  var desc=document.getElementById('gm-desc').value.trim();
  var monto=parseFloat(document.getElementById('gm-monto').value)||0;
  var fecha=document.getElementById('gm-fecha').value;
  if(!desc||!monto||!fecha){alert('Completa descripción, monto y fecha');return;}
  var parts=fecha.split('-');var d=parts[2]+'/'+parts[1]+'/'+parts[0];
  var gmi=mesIdx(parseInt(parts[0]),parseInt(parts[1])-1);
  GASTOS_MANT.unshift({desc:desc,monto:monto,fecha:d,mesIdx:gmi});
  saveGastosMant();
  document.getElementById('gm-desc').value='';document.getElementById('gm-monto').value='';document.getElementById('gm-fecha').value='';
  renderServicios();renderFinanzas();
}
function eliminarGastoMant(idx){
  if(!confirm('¿Eliminar este gasto?'))return;
  GASTOS_MANT.splice(idx,1);saveGastosMant();renderServicios();renderFinanzas();
}
function saveFinHist() { return safeSave(db.collection('config').doc('finHistorial').set({data:FIN_HIST,fondoInicial:FONDO_INICIAL,bolsaJesus:BOLSA_JESUS||0,bolsaCarlitos:BOLSA_CARLITOS||0,bolsaMant:BOLSA_MANT||0}),'finanzas'); }
function saveInqHist() { return safeSave(db.collection('config').doc('inqHistorial').set({data:INQ_HIST}),'historial'); }

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
  }).catch(function(e){
    console.error('Error cargando deptos:', e);
    renderAll();
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
    MANT_NOTAS=snap.exists?snap.data().notas||[]:[];
    return db.collection('config').doc('finHistorial').get();
  }).then(function(snap){
    if(snap.exists){FIN_HIST=snap.data().data||{};FONDO_INICIAL=snap.data().fondoInicial||0;BOLSA_JESUS=snap.data().bolsaJesus||0;BOLSA_CARLITOS=snap.data().bolsaCarlitos||0;BOLSA_MANT=snap.data().bolsaMant||0;}
    else{FIN_HIST={};FONDO_INICIAL=0;BOLSA_JESUS=0;BOLSA_CARLITOS=0;BOLSA_MANT=0;}
    return db.collection('config').doc('inqHistorial').get();
  }).then(function(snap){
    INQ_HIST=snap.exists?(snap.data().data||[]):[];
    return db.collection('config').doc('gastosMant').get();
  }).then(function(snap){
    GASTOS_MANT=snap.exists?(snap.data().data||[]):[];
    return db.collection('config').doc('pinos').get();
  }).then(function(snap){
    if(snap.exists){PINOS=snap.data();}
    return db.collection('config').doc('pinosPagos').get();
  }).then(function(snap){
    PINOS_PAGOS=snap.exists?(snap.data().pagos||{}):{};
    renderAll();
  }).catch(function(e){
    console.error('Error en initApp:', e);
    renderAll();
  });
}


// ── Nav ────────────────────────────────────────────────────────────────────
function showPage(id,btn) {
  // Recalcular mes actual cada vez que navegas (por si la app lleva horas abierta)
  var _n=new Date(); MEX_MES=mesIdx(_n.getFullYear(),_n.getMonth());
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
  var mi=MEX_MES;
  var dm=idxToYM(MEX_MES);
  var depConPagoEsteMes=DEPTOS;
  var pag=DEPTOS.filter(function(d){var p=getPago(d.num,mesDePago());return p&&p.pagado;}).length;
  var espMes=DEPTOS.reduce(function(s,d){return s+d.renta;},0);
  document.getElementById('dash-mes').textContent=MS_FULL[dm.m]+' '+dm.y;
  var cob=cobradoMes(mi);
  document.getElementById('dash-metrics').innerHTML='<div class="metric"><div class="metric-label">Ocupados</div><div class="metric-value" style="color:#1D9E75">'+DEPTOS.length+'<span style="font-size:14px;color:#6b6b6b">/'+(DEPTOS.length+VACIOS.length)+'</span></div><div class="metric-sub">'+VACIOS.length+' vacíos</div></div><div class="metric"><div class="metric-label">Esperado</div><div class="metric-value">'+fmt(espMes)+'</div><div class="metric-sub">'+depConPagoEsteMes.length+' con pago este mes</div></div><div class="metric"><div class="metric-label">Cobrado</div><div class="metric-value" style="color:#1D9E75">'+fmt(cob)+'</div><div class="metric-sub">'+pag+' pagados</div></div><div class="metric"><div class="metric-label">Pendiente</div><div class="metric-value" style="color:#a32d2d">'+fmt(espMes-cob)+'</div><div class="metric-sub">'+(depConPagoEsteMes.length-pag)+' pendientes</div></div>';

  var al=document.getElementById('dash-alertas'); al.innerHTML='';
  var hoy=new Date(); hoy.setHours(0,0,0,0);
  DEPTOS.forEach(function(d){
    if(!d.finDate)return;
    var fin=new Date(d.finDate+'T12:00:00');
    var dias=Math.ceil((fin-hoy)/(1000*60*60*24));
    if(dias>=0&&dias<=31)al.innerHTML+='<div class="alert-banner alert-red"><i class="ti ti-calendar-x" style="font-size:16px;flex-shrink:0"></i><div><strong>Contrato por vencer</strong> — Depto '+d.num+' ('+esc(d.nombre).split(' ')[0]+') vence '+fmtD(d.finDate)+' ('+(dias===0?'hoy':dias+' días')+')</div></div>';
  });

  var srv=getSrv(mi),srvPend=[];
  if(!srv.internet.pagado)srvPend.push('Internet');if(!srv.agua.pagado)srvPend.push('Agua JAPAMA');
  if(!srv.limpieza.pagado)srvPend.push('Limpieza');if(!srv.internetPinos.pagado)srvPend.push('Internet Los Pinos');
  if(!srv.celular||!srv.celular.pagado)srvPend.push('Saldo celular');if(!srv.cfe||!srv.cfe.pagado)srvPend.push('CFE Luz');
  if(srvPend.length)al.innerHTML+='<div class="alert-banner alert-amber"><i class="ti ti-receipt" style="font-size:16px;flex-shrink:0"></i><div><strong>'+srvPend.length+' servicio'+(srvPend.length>1?'s':'')+' pendiente'+(srvPend.length>1?'s':'')+' de pago</strong><div style="font-size:12px;margin-top:2px">'+srvPend.join(' · ')+'</div></div><button class="btn btn-sm" style="margin-left:auto" onclick="showPage(\'servicios\',document.querySelectorAll(\'.nav-item\')[2])">Ver servicios</button></div>';
  try{alertaCFEProximo();}catch(e){console.warn('alertaCFE:',e);}

  renderTablaCombinada();
}

function tablaMarcarDepto(num){
  var d=DEPTOS.find(function(x){return x.num===num;});if(!d)return;
  var mi=MEX_MES;
  if(!PAGOS[num])PAGOS[num]={};
  var pago={pagado:true,forma:'Transferencia SPEI',monto:d.renta,fecha:new Date().toISOString().split('T')[0]};
  PAGOS[num][mi]=pago;
  savePago(num,mi,pago);
  renderDashboard();renderPagos();renderDeptos();renderFinanzas();
}
function tablaDesmarcarDepto(num){
  var d=DEPTOS.find(function(x){return x.num===num;});if(!d)return;
  var mi=MEX_MES;
  if(PAGOS[num])delete PAGOS[num][mi];
  deletePago(num,mi);
  renderDashboard();renderPagos();renderDeptos();renderFinanzas();
}

function renderTablaCombinada(){
  var el=document.getElementById('dash-tabla');if(!el)return;
  var hoy=new Date();var mesHoy=hoy.getMonth(),anioHoy=hoy.getFullYear();
  var miActual=mesIdx(anioHoy,mesHoy);
  var MESES_CORTOS=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  // Construir filas
  var filas=[];
  DEPTOS.forEach(function(d,i){
    var diaReal=diaEfectivo(d.diaPago,anioHoy,mesHoy);
    var p=getPago(d.num,miActual),ok=p&&p.pagado;
    var badge,rowBg='',accion;
    if(ok){
      badge='<span class="badge badge-green" style="font-size:10px">✓ Pagado</span>'+(p.fecha?'<div style="font-size:10px;color:#6b6b6b;margin-top:2px">'+fmtD(p.fecha)+'</div>':'');
      accion='<button class="btn btn-xs btn-danger" onclick="tablaDesmarcarDepto('+d.num+')"><i class="ti ti-rotate-left"></i></button>';
    } else {
      var fechaLimite=new Date(anioHoy,mesHoy,diaReal+7);
      if(hoy<=fechaLimite){
        var dr=Math.ceil((fechaLimite-hoy)/(1000*60*60*24));
        badge='<span class="badge" style="font-size:10px;background:#FEF3C7;color:#92400E;border:1px solid #F59E0B">⏳ '+dr+'d gracia</span>';
        rowBg='#FFFBEB';
      } else {
        var dv=Math.floor((hoy-fechaLimite)/(1000*60*60*24));
        badge='<span class="badge" style="font-size:10px;background:#FEE2E2;color:#991B1B;border:1px solid #EF4444">⚠ '+dv+'d vencido</span>';
        rowBg='#FFF5F5';
      }
      accion='<button class="btn btn-xs btn-primary" onclick="tablaMarcarDepto('+d.num+')">✓ Pagar</button>';
    }
    var inmobTag=d.viaInmobiliaria?'<span style="font-size:9px;background:#f3e8ff;color:#6b21a8;border:1px solid #d8b4fe;border-radius:3px;padding:1px 4px;margin-left:3px">🏢</span>':'';
    // Meses del contrato: desde inicio hasta finDate + siempre el mes actual
    var mesesContrato={};
    var iniRaw=d.inicio||d.iniDate||'';
    if(d.finDate){
      var fin=new Date(d.finDate+'T12:00:00');
      var iniRef=iniRaw?new Date(iniRaw+'T12:00:00'):new Date(fin.getFullYear(),fin.getMonth()-11,1);
      var cur=new Date(iniRef.getFullYear(),iniRef.getMonth(),1);
      while(cur<=fin){mesesContrato[mesIdx(cur.getFullYear(),cur.getMonth())]=true;cur.setMonth(cur.getMonth()+1);}
    }
    // Siempre incluir mes actual
    mesesContrato[miActual]=true;
    var finKey=d.finDate?mesIdx(new Date(d.finDate+'T12:00:00').getFullYear(),new Date(d.finDate+'T12:00:00').getMonth()):null;
    var iniKey=iniRaw?mesIdx(new Date(iniRaw+'T12:00:00').getFullYear(),new Date(iniRaw+'T12:00:00').getMonth()):null;
    filas.push({tipo:'depto',num:d.num,idx:i,nombre:esc(d.nombre),inmobTag:inmobTag,renta:fmt(d.renta),diaPago:d.diaPago,badge:badge,accion:accion,rowBg:rowBg,mesesContrato:mesesContrato,finKey:finKey,iniKey:iniKey,finStr:d.finStr||'',
      getPagado:function(key){var pp=PAGOS[d.num]&&PAGOS[d.num][key];return pp&&pp.pagado;},
      getToggle:function(key){return 'toggleHistPago('+d.num+','+key+')';}
    });
  });
  VACIOS.forEach(function(n){
    filas.push({tipo:'vacio',num:n,nombre:'Vacío',renta:'—',diaPago:'—',badge:'<span class="badge badge-gray" style="font-size:10px">Vacío</span>',accion:'',rowBg:'',mesesContrato:{}});
  });
  if(PINOS.nombre){
    var pp=PINOS_PAGOS[miActual]||{},pok=pp.pagado;
    var pbadge,paccion,prowBg='#f9f6ff';
    if(pok){
      pbadge='<span class="badge badge-green" style="font-size:10px">✓ Pagado</span>'+(pp.fecha?'<div style="font-size:10px;color:#6b6b6b;margin-top:2px">'+fmtD(pp.fecha)+'</div>':'');
      paccion='<button class="btn btn-xs btn-danger" onclick="desmarcarPagoPinos('+miActual+')"><i class="ti ti-rotate-left"></i></button>';
    } else {
      pbadge='<span class="badge badge-amber" style="font-size:10px">Pendiente</span>';
      paccion='<button class="btn btn-xs btn-primary" onclick="marcarPagoPinos('+miActual+')">✓ Pagar</button>';
    }
    var pinosMeses={};
    if(PINOS.ini&&PINOS.fin){
      var pini=new Date(PINOS.ini+'T12:00:00'),pfin=new Date(PINOS.fin+'T12:00:00');
      var pcur=new Date(pini.getFullYear(),pini.getMonth(),1);
      while(pcur<=pfin){pinosMeses[mesIdx(pcur.getFullYear(),pcur.getMonth())]=true;pcur.setMonth(pcur.getMonth()+1);}
    }
    var pFinKey=PINOS.fin?mesIdx(new Date(PINOS.fin+'T12:00:00').getFullYear(),new Date(PINOS.fin+'T12:00:00').getMonth()):null;
    var pIniKey=PINOS.ini?mesIdx(new Date(PINOS.ini+'T12:00:00').getFullYear(),new Date(PINOS.ini+'T12:00:00').getMonth()):null;
    filas.push({tipo:'pinos',num:'🏠',nombre:esc(PINOS.nombre),inmobTag:'',renta:fmt(PINOS.monto||22000),diaPago:5,badge:pbadge,accion:paccion,rowBg:prowBg,mesesContrato:pinosMeses,finKey:pFinKey,iniKey:pIniKey,finStr:PINOS.fin?fmtD(PINOS.fin):'',
      getPagado:function(key){var pp2=PINOS_PAGOS[key];return pp2&&pp2.pagado;},
      getToggle:function(key){return 'toggleHistPagoPinos('+key+')';}
    });
  }

  var todosKeys={};
  // Ventana fija de 12 columnas: 2 meses atrás + actual + 9 adelante
  var winIni=miActual-2, winFin=miActual+9;
  for(var wi=winIni;wi<=winFin;wi++){todosKeys[wi]=idxToYM(wi);}
  // Si algún fin de contrato cae fuera de la ventana, añadir solo ese mes
  filas.forEach(function(f){
    if(f.tipo==='vacio'||!f.finKey)return;
    if(!todosKeys[f.finKey])todosKeys[f.finKey]=idxToYM(f.finKey);
  });
  var sortedKeys=Object.keys(todosKeys).map(Number).sort(function(a,b){return a-b;});

  var TH='padding:6px 8px;border:1px solid #e5e7eb;white-space:nowrap;';
  var tabId='dash-cal-'+Date.now();
  var html='<div style="overflow-x:auto" id="'+tabId+'"><table style="border-collapse:collapse;font-size:12px;width:100%"><thead><tr>';
  html+='<th style="'+TH+'background:#f9fafb;text-align:left;min-width:90px;position:sticky;left:0;z-index:2">Depto</th>';
  html+='<th style="'+TH+'background:#f9fafb;text-align:left;min-width:150px">Inquilino</th>';
  html+='<th style="'+TH+'background:#f9fafb;text-align:left;min-width:70px">Renta</th>';
  html+='<th style="'+TH+'background:#f9fafb;text-align:left;min-width:130px">Este mes</th>';
  html+='<th style="'+TH+'background:#f9fafb;min-width:76px"></th>';
  sortedKeys.forEach(function(key){
    var ym=todosKeys[key];var esActual=key===miActual;
    html+='<th id="thmes-'+key+'" style="'+TH+'text-align:center;min-width:58px;background:'+(esActual?'#DBEAFE':'#f9fafb')+(esActual?';color:#1d4ed8;font-weight:700':';color:#6b7280')+'">'
      +MESES_CORTOS[ym.m]+'<br><span style="font-weight:400;font-size:10px">'+ym.y+'</span></th>';
  });
  html+='</tr></thead><tbody>';

  filas.forEach(function(f){
    var isPinos=f.tipo==='pinos';
    var isVacio=f.tipo==='vacio';
    // Barra de progreso del contrato
    var progHtml='';
    if(!isVacio&&f.iniKey!=null&&f.finKey!=null){
      var total=f.finKey-f.iniKey||1;
      var transcurrido=Math.min(Math.max(miActual-f.iniKey,0),total);
      var pct=Math.round(transcurrido/total*100);
      var mesesRestantes=f.finKey-miActual;
      var dvLabel=mesesRestantes<0?'<span style="color:#991B1B;font-size:10px">⚠ Vencido</span>':mesesRestantes===0?'<span style="color:#92400E;font-size:10px">⚠ Último mes</span>':mesesRestantes<=2?'<span style="color:#92400E;font-size:10px">⚠ '+mesesRestantes+'m</span>':'<span style="color:#9ca3af;font-size:10px">'+mesesRestantes+'m</span>';
      progHtml='<div style="display:flex;align-items:center;gap:5px;margin-top:3px">'
        +'<div style="flex:1;height:4px;background:#e5e7eb;border-radius:2px;overflow:hidden"><div style="width:'+pct+'%;height:100%;background:'+(pct>=100?'#ef4444':isPinos?'#7c3aed':'#1D9E75')+';border-radius:2px"></div></div>'
        +dvLabel+'</div>';
    }
    var labelStyle=isPinos?'color:#6b21a8;font-weight:700':'font-weight:600';
    html+='<tr style="background:'+(f.rowBg||'')+(isPinos?';border-top:2px solid #e9d5ff':'')+'">';
    html+='<td style="padding:8px 10px;border:1px solid #e5e7eb;'+labelStyle+';white-space:nowrap;position:sticky;left:0;background:'+(f.rowBg||'#fff')+(isPinos?';background:#f9f6ff':'')+';z-index:1'+(isPinos?';cursor:pointer':'')+'"'+(isPinos?' onclick="verPinos()"':'')+' title="'+(isPinos?'Ver detalles Los Pinos':'')+'">'+(isPinos?'🏠 Los Pinos':'Depto '+f.num)+'</td>';
    html+='<td style="padding:8px 10px;border:1px solid #e5e7eb">'
      +(isVacio?'<span class="text-muted">—</span>'
        :(f.tipo==='depto'?'<div class="flex gap-8" style="align-items:center">'+avEl(f.nombre,f.idx)+'<div><div>'+f.nombre+(f.inmobTag||'')+'</div>'+progHtml+'</div></div>'
        :'<div>'+f.nombre+progHtml+'</div>'))
      +'</td>';
    html+='<td style="padding:8px 10px;border:1px solid #e5e7eb;white-space:nowrap">'+f.renta+'</td>';
    html+='<td style="padding:8px 10px;border:1px solid #e5e7eb">'+(isVacio?'<span class="text-muted">Vacío</span>':f.badge)+'</td>';
    html+='<td style="padding:4px 8px;border:1px solid #e5e7eb;text-align:center">'+(isVacio?'':f.accion)+'</td>';
    sortedKeys.forEach(function(key){
      var esFinContrato=f.finKey===key&&!isVacio&&f.finKey!=null;
      if(!f.mesesContrato[key]){html+='<td style="padding:4px;border:1px solid #e5e7eb;background:#f9fafb"></td>';return;}
      if(isVacio){html+='<td style="padding:4px;border:1px solid #e5e7eb"></td>';return;}
      var pagado=f.getPagado(key);
      var esActual=key===miActual;
      var esFuturo=key>miActual;
      // Celda fin de contrato: fondo naranja/morado con fecha
      if(esFinContrato){
        var finBg=isPinos?'#EDE9FE':'#FFF7ED';
        var finColor=isPinos?'#5b21b6':'#92400E';
        var finBorder=isPinos?'2px solid #7c3aed':'2px solid #F59E0B';
        var iconFin=pagado?'<div style="font-size:12px;font-weight:700;color:#065F46">✓</div>':'<div style="font-size:12px;font-weight:700;color:'+finColor+'">—</div>';
        html+='<td style="padding:5px 4px;border:'+finBorder+';background:'+finBg+';text-align:center;cursor:'+(esFuturo?'default':'pointer')+'" title="Último mes del contrato · vence '+f.finStr+'"'+(esFuturo?'':' onclick="'+f.getToggle(key)+';renderTablaCombinada()"')+'>'+
          iconFin+
          '<div style="font-size:9px;font-weight:700;color:'+finColor+';margin-top:1px">'+f.finStr+'</div>'+
          '</td>';
        return;
      }
      var bg=pagado?'#D1FAE5':esFuturo?'#F3F4F6':esActual?'#FEF3C7':'#FEE2E2';
      var color=pagado?'#065F46':esFuturo?'#9ca3af':esActual?'#92400E':'#991B1B';
      var titulo=pagado?'Pagado':esFuturo?'Mes futuro':esActual?'Pendiente':'Sin pagar';
      var diaLabel='<div style="font-size:10px;color:'+color+';opacity:0.75;margin-top:1px">día '+f.diaPago+'</div>';
      html+='<td style="padding:5px 4px;border:1px solid #e5e7eb;background:'+bg+';text-align:center;cursor:'+(esFuturo?'default':'pointer')+'" title="'+titulo+'"'+(esFuturo?'':' onclick="'+f.getToggle(key)+';renderTablaCombinada()"')+'>'+
        '<div style="font-size:13px;font-weight:700;color:'+color+'">'+(pagado?'✓':esFuturo?'':'—')+'</div>'+
        (esFuturo?'':diaLabel)+
        '</td>';
    });
    html+='</tr>';
  });
  html+='</tbody></table></div>';
  el.innerHTML=html;
  // Scroll automático al mes actual
  var thActual=document.getElementById('thmes-'+miActual);
  if(thActual){var wrap=document.getElementById(tabId);if(wrap)wrap.scrollLeft=Math.max(0,thActual.offsetLeft-200);}
}

// ── Deptos ─────────────────────────────────────────────────────────────────
function renderDeptos() {
  var list=document.getElementById('depa-list'); if(!list)return;
  list.innerHTML=''; var mi=MEX_MES; var hoy=new Date();
  DEPTOS.forEach(function(d,i){
    var p=getPago(d.num,mi),ok=p&&p.pagado;
    var pagosBadge=ok?'<span class="badge badge-green">Pagado</span>':'<span class="badge badge-amber">Pendiente</span>';
    var avalBadge=d.aval&&d.aval.nombre?'<span class="badge badge-blue">Aval ✓</span>':'<span class="badge badge-gray">Sin aval</span>';
    var ineBadge=d.ineInqUrl?'<span class="badge badge-purple">INE ✓</span>':'<span class="badge badge-gray">Sin INE</span>';
    var inmobBadge=d.viaInmobiliaria?'<span class="badge" style="background:#f3e8ff;color:#6b21a8;border:1px solid #d8b4fe">🏢 Inmobiliaria</span>':'';
    // Días restantes contrato
    var contratoTag='';
    if(d.finDate){
      var fin=new Date(d.finDate+'T12:00:00');
      var dias=Math.ceil((fin-hoy)/(1000*60*60*24));
      if(dias<0) contratoTag='<span class="badge badge-red">⚠ Vencido</span>';
      else if(dias<=30) contratoTag='<span class="badge badge-amber">⚠ '+dias+'d para vencer</span>';
      else if(dias<=60) contratoTag='<span class="badge" style="background:#FEF3C7;color:#92400E;border:1px solid #FDE68A">'+dias+'d</span>';
    }
    // Bolitas por mes según contrato, solo hasta el mes actual
    var cmsMeses=getContractMonths(d).filter(function(cm){return cm.key<=mi;});
    var recentMeses=cmsMeses.map(function(cm){
      var rp=PAGOS[d.num]&&PAGOS[d.num][cm.key];
      var ok=rp&&rp.pagado;
      return '<span title="'+cm.label+'" style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;font-size:9px;font-weight:700;background:'+(ok?'#D1FAE5':'#FEE2E2')+';color:'+(ok?'#065F46':'#991B1B')+'">'+(ok?'✓':'✗')+'</span>';
    });
    // Teléfono clickeable
    var telHtml=d.tel?'<a href="tel:'+esc(d.tel)+'" style="color:inherit;text-decoration:none;font-weight:600">'+esc(d.tel)+'</a>':'<strong>—</strong>';
    var avalTel=d.aval&&d.aval.tel?'<a href="tel:'+esc(d.aval.tel)+'" style="color:inherit;text-decoration:none">'+esc(d.aval.tel)+'</a>':'—';
    var avalNomTel=d.aval&&d.aval.nombre?(esc(d.aval.nombre)+(d.aval.tel?' · '+avalTel:'')):'—';
    list.innerHTML+='<div class="card" style="margin-bottom:.75rem;border-left:3px solid '+(ok?'#1D9E75':'#EF9F27')+';border-radius:0 12px 12px 0"><div class="flex" style="justify-content:space-between;margin-bottom:.75rem;flex-wrap:wrap;gap:8px"><div class="flex gap-8" style="cursor:pointer" onclick="verInq('+i+')"><div style="background:#f0f0f0;border-radius:8px;padding:4px 10px;font-size:18px;font-weight:600;color:#6b6b6b;min-width:40px;text-align:center">'+d.num+'</div>'+avEl(d.nombre,i,'avatar')+'<div><div style="font-weight:600;font-size:14px">'+esc(d.nombre)+'</div><div class="text-muted">'+esc(d.contrato)+' · '+fmt(d.renta)+'/mes · día '+d.diaPago+(d.finStr?' · vence '+esc(d.finStr):'')+'</div></div></div><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">'+pagosBadge+contratoTag+avalBadge+ineBadge+inmobBadge+(d.deposito?'<span class="badge badge-green">Dep. ✓</span>':'<span class="badge badge-red">Sin dep.</span>')+'<button class="btn btn-sm" onclick="editarInq('+i+')"><i class="ti ti-edit"></i> Editar</button></div></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;font-size:12px;border-top:1px solid #eee;padding-top:.75rem"><div><span class="text-muted">Teléfono</span><br>'+telHtml+'</div><div><span class="text-muted">Correo</span><br><strong>'+esc(d.email||'—')+'</strong></div><div><span class="text-muted">Ocupación</span><br><strong>'+esc(d.ocupacion||'—')+'</strong></div><div><span class="text-muted">Aval</span><br><span style="font-size:12px">'+avalNomTel+'</span></div></div></div>';
  });
  // Tarjeta Los Pinos
  var pc=document.getElementById('pinos-depto-card');if(!pc)return;
  if(PINOS.nombre){
    var pmi=MEX_MES,pp=PINOS_PAGOS[pmi]||{};
    var pbadge=pp.pagado?'<span class="badge badge-green">✓ Pagado</span>':'<span class="badge badge-amber">Pendiente</span>';
    var ptel=PINOS.tel?'<a href="tel:'+esc(PINOS.tel)+'" style="color:inherit;text-decoration:none;font-weight:600">'+esc(PINOS.tel)+'</a>':'<strong>—</strong>';
    var pfin=PINOS.fin?'vence '+fmtD(PINOS.fin):'';
    var pdep=PINOS.deposito?'<span class="badge badge-green">Dep. ✓</span>':'<span class="badge badge-red">Sin dep.</span>';
    pc.innerHTML='<div class="card" style="border-left:3px solid #7c3aed;border-radius:0 12px 12px 0"><div class="flex" style="justify-content:space-between;margin-bottom:.75rem;flex-wrap:wrap;gap:8px"><div class="flex gap-8" style="cursor:pointer" onclick="verPinos()"><div style="background:#f3e8ff;border-radius:8px;padding:4px 10px;font-size:18px;min-width:40px;text-align:center">🏠</div><div><div style="font-weight:600;font-size:14px">'+esc(PINOS.nombre)+'  <span style="font-size:11px;background:#f3e8ff;color:#6b21a8;border:1px solid #d8b4fe;border-radius:4px;padding:2px 7px">Los Pinos</span></div><div class="text-muted">'+(PINOS.dur||'1 año')+' · '+fmt(PINOS.monto||22000)+'/mes'+(pfin?' · '+pfin:'')+'</div></div></div><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">'+pbadge+pdep+'<button class="btn btn-sm" onclick="editarPinos()"><i class="ti ti-edit"></i> Editar</button></div></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;font-size:12px;border-top:1px solid #eee;padding-top:.75rem"><div><span class="text-muted">Teléfono</span><br>'+ptel+'</div><div><span class="text-muted">Correo</span><br><strong>'+esc(PINOS.email||'—')+'</strong></div><div><span class="text-muted">Aval</span><br><strong>'+esc(PINOS.aval||'—')+'</strong></div></div></div>';
  } else {
    pc.innerHTML='<div class="card dashed-card"><div class="flex gap-8 center-content"><i class="ti ti-home muted-icon"></i><span class="text-muted">Los Pinos — sin inquilino · <a href="#" onclick="irAContratosPinos();return false" style="color:#7c3aed">Registrar</a></span></div></div>';
  }
}

// ── Pagos ──────────────────────────────────────────────────────────────────
function renderPagos() {
  var tbody=document.getElementById('pagos-tbody'); if(!tbody)return;
  var mi=MEX_MES; tbody.innerHTML='';
  var lbl=document.getElementById('pagos-mes-label');if(lbl)lbl.textContent=idxLabel(mi);
  DEPTOS.forEach(function(d,i){
    var p=getPago(d.num,mi),ok=p&&p.pagado;
    // Contar meses anteriores sin pagar (dentro del contrato)
    var vencidos=0;
    var cms=getContractMonths(d);
    cms.forEach(function(cm){if(cm.key<mi){var rp=PAGOS[d.num]&&PAGOS[d.num][cm.key];if(!rp||!rp.pagado)vencidos++;}});
    var deudaBadge=vencidos>0?'<span class="badge badge-red" title="Meses anteriores sin pagar">⚠ '+vencidos+' mes'+(vencidos>1?'es':'')+' pendiente'+(vencidos>1?'s':'')+'</span>':'';
    tbody.innerHTML+='<tr><td>Depto '+d.num+'</td><td><div class="flex gap-8">'+avEl(d.nombre,i)+'<div><span>'+d.nombre+'</span>'+(deudaBadge?'<br>'+deudaBadge:'')+'</div></div></td><td class="hide-mobile">'+fmt(d.renta)+'</td><td class="hide-mobile">Día '+d.diaPago+'</td><td class="hide-mobile text-muted">'+(ok?p.forma:'—')+'</td><td>'+(ok?'<span class="badge badge-green">Pagado</span>':'<span class="badge badge-amber">Pendiente</span>')+'</td><td style="display:flex;gap:4px">'+(!ok?'<button class="btn btn-xs btn-primary" onclick="marcarPagado('+d.num+')">Marcar pagado</button>':'<button class="btn btn-xs btn-orange" onclick="desmarcarPago('+d.num+')"><i class="ti ti-rotate-left"></i> Deshacer</button>')+'</td></tr>';
  });
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
  // Rellenar opciones dinámicamente si el mes actual no está presente
  var currentVal=parseInt(miEl.value);
  if(isNaN(currentVal)||currentVal>MEX_MES||miEl.options.length===0||(miEl.options.length>0&&parseInt(miEl.options[0].value)!==MEX_MES)){
    var prev=parseInt(miEl.value);
    miEl.innerHTML='';
    for(var ii=MEX_MES;ii>=0;ii--){
      var opt=document.createElement('option');
      opt.value=ii;opt.textContent=idxLabel(ii);
      miEl.appendChild(opt);
    }
    miEl.value=(prev>=0&&prev<=MEX_MES)?prev:MEX_MES;
  }
  var mi=parseInt(miEl.value); var srv=getSrv(mi);
  document.getElementById('cfe-alerta').innerHTML='';
  var cont=document.getElementById('srv-cards'); cont.innerHTML='';
  SRV_META.forEach(function(m,idx){
    var s=srv[m.key]||{monto:0,fijo:false,pagado:false};
    var isCFE=m.key==='cfe';
    var isJesus=m.key==='internetPinos'||m.key==='celular';
    var border=idx>0?'border-top:1px solid #f0f0ee':'';
    var bg=s.pagado?'':'';
    // Badge tipo
    var tipoBadge=m.key==='internet'?'<span style="font-size:10px;color:#6b6b6b;background:#f0f0ee;padding:1px 6px;border-radius:10px;margin-left:4px">fijo</span>':
                  isCFE?'<span style="font-size:10px;color:#854F0B;background:#FEF3C7;padding:1px 6px;border-radius:10px;margin-left:4px">bimestral</span>':
                  isJesus?'<span style="font-size:10px;color:#185FA5;background:#E6F1FB;padding:1px 6px;border-radius:10px;margin-left:4px">→ Jesús</span>':'';
    // Monto editable
    var montoHtml='<div id="sd-'+m.key+'" style="display:flex;align-items:center;gap:6px">'+
      '<span style="font-weight:600;font-size:14px;color:'+(s.pagado?'#1D9E75':'#1a1a1a')+'">'+(s.monto?fmt(s.monto):'—')+'</span>'+
      '<button onclick="togSrv(\''+m.key+'\')" style="background:none;border:none;cursor:pointer;font-size:11px;color:#999;padding:0">✎</button>'+
    '</div>'+
    '<div id="si-'+m.key+'" style="display:none"><input type="number" value="'+(s.monto||'')+'" id="sinp-'+m.key+'" placeholder="$" onchange="updSrv(\''+m.key+'\','+mi+',this.value)" style="width:90px;padding:3px 8px;border:1px solid #ddd;border-radius:6px;font-size:13px"></div>';
    // Acción
    var accion=!s.pagado
      ?'<button class="btn btn-xs btn-primary" onclick="mkSrv(\''+m.key+'\','+mi+')">Pagar</button>'
      :'<button class="btn btn-xs" onclick="unSrv(\''+m.key+'\','+mi+')" style="color:#6b6b6b">Deshacer</button>';
    cont.innerHTML+='<div style="display:flex;align-items:center;gap:12px;padding:11px 16px;'+border+(s.pagado?'background:#fafffe':'')+'">'+
      '<i class="ti '+m.icon+'" style="color:'+m.tc+';font-size:18px;flex-shrink:0"></i>'+
      '<div style="flex:1;min-width:0">'+
        '<div style="font-size:13px;font-weight:500;display:flex;align-items:center;flex-wrap:wrap">'+m.label+tipoBadge+'</div>'+
        '<div style="font-size:11px;color:#999;margin-top:1px">'+m.desc+'</div>'+
      '</div>'+
      montoHtml+
      '<span class="badge '+(s.pagado?'badge-green':'badge-amber')+'" style="flex-shrink:0">'+(s.pagado?'✓':'Pendiente')+'</span>'+
      '<div style="flex-shrink:0">'+accion+'</div>'+
    '</div>';
  });
  document.getElementById('srv-total').textContent=fmt(totalSrvJesus(mi));
  // Historial
  var ht=document.getElementById('cfe-hist'); ht.innerHTML='';
  HIST_LABELS.forEach(function(label,idx){
    var s=getSrv(idx);
    SRV_META.forEach(function(m){
      if(s[m.key]&&s[m.key].pagado)
        ht.innerHTML+='<tr><td><span class="badge badge-blue">'+m.label+'</span></td><td class="text-muted">'+label+'</td><td style="font-weight:500">'+fmt(s[m.key].monto)+'</td><td><span class="badge badge-green">Pagado</span></td></tr>';
    });
  });
  if(!ht.innerHTML)ht.innerHTML='<tr><td colspan="4" class="text-muted center" style="padding:1rem">Sin registros aún</td></tr>';
  // Fecha default hoy en el formulario de gastos
  var gmFecha=document.getElementById('gm-fecha');if(gmFecha&&!gmFecha.value)gmFecha.value=new Date().toISOString().split('T')[0];
  // Gastos de mantenimiento
  var gastosEl=document.getElementById('gastos-mant-list');if(gastosEl){
    if(!GASTOS_MANT.length){gastosEl.innerHTML='<div style="font-size:13px;color:#999;padding:8px 0">Sin gastos registrados</div>';}
    else{gastosEl.innerHTML=GASTOS_MANT.map(function(g,i){return '<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid #f0f0ee"><div><span style="font-size:13px;font-weight:500">'+esc(g.desc)+'</span><span style="font-size:11px;color:#999;margin-left:8px">'+esc(g.fecha)+'</span></div><div style="display:flex;align-items:center;gap:8px"><span style="font-size:13px;font-weight:600;color:#c0392b">-$'+g.monto.toLocaleString('es-MX',{minimumFractionDigits:2})+'</span><button style="background:none;border:none;cursor:pointer;color:#ccc;font-size:14px;padding:2px 6px" onclick="eliminarGastoMant('+i+')" title="Eliminar">✕</button></div></div>';}).join('');}
  }
}
function togSrv(k){var d=document.getElementById('sd-'+k),inp=document.getElementById('si-'+k),h=d.style.display==='none';d.style.display=h?'block':'none';inp.style.display=h?'none':'block';if(!h)document.getElementById('sinp-'+k).focus();}
function updSrv(k,mi,v){getSrv(mi)[k].monto=parseFloat(v)||0;saveSrv(mi,getSrv(mi));renderServicios();renderFinanzas();}
function mkSrv(k,mi){getSrv(mi)[k].pagado=true;saveSrv(mi,getSrv(mi));renderServicios();renderFinanzas();renderDashboard();}
function unSrv(k,mi){getSrv(mi)[k].pagado=false;saveSrv(mi,getSrv(mi));renderServicios();renderFinanzas();renderDashboard();}
function guardarCFE(){
  var ini=document.getElementById('cfe-ini').value,monto=parseFloat(document.getElementById('cfe-monto').value)||0;
  if(!ini||!monto){alert('Ingresa fecha y monto');return;}
  var fin=document.getElementById('cfe-fin').value;
  var fechaPago=document.getElementById('cfe-pagado').value;
  var notas=document.getElementById('cfe-notas').value;
  var entry={inicio:ini,fin:fin,monto:monto,fechaPago:fechaPago,notas:notas};
  CFE_HIST.push(entry); saveCFE(CFE_HIST);
  // También registrar en SERVICIOS del mes de pago para que aparezca en Finanzas
  var fPago=fechaPago||ini;
  var dp=fPago.split('-');
  if(dp.length===3){
    var mi=mesIdx(parseInt(dp[0]),parseInt(dp[1])-1);
    var srv=getSrv(mi);
    // Construir etiqueta de periodo: "09 Feb - 09 Abr"
    var MS=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    function fmtPer(s){if(!s)return'';var p=s.split('-');return p[2]+' '+MS[parseInt(p[1])-1]+' '+p[0].slice(2);}
    var periodo=fmtPer(ini)+(fin?' – '+fmtPer(fin):'');
    srv.cfe={monto:monto,fijo:false,pagado:true,periodo:periodo};
    saveSrv(mi,srv);
  }
  ['cfe-ini','cfe-fin','cfe-monto','cfe-pagado','cfe-notas'].forEach(function(id){document.getElementById(id).value='';});
  closeModal('modal-cfe');renderServicios();renderFinanzas();renderDashboard();
}

// ── Finanzas ───────────────────────────────────────────────────────────────
function renderFinanzas(){
  var FIN_DESDE=mesIdx(2026,5); // junio 2026
  var sel=document.getElementById('fin-mes-sel');
  if(sel&&sel.dataset.built!=='1'){
    sel.innerHTML='';
    for(var ii=FIN_DESDE;ii<=MEX_MES;ii++){var o=document.createElement('option');o.value=ii;o.textContent=idxLabel(ii);sel.appendChild(o);}
    sel.value=MEX_MES;sel.dataset.built='1';
  }
  var mi=sel?parseInt(sel.value):MEX_MES;
  var titEl=document.getElementById('fin-mes-titulo');if(titEl)titEl.textContent='Finanzas — '+idxLabel(mi);
  var f=calcFinMes(mi),srv=getSrv(mi);
  function setT(id,v){var el=document.getElementById(id);if(el)el.textContent=v;}
  setT('f-cob',fmt(f.cob));setT('f-mant','-'+fmt(f.mant));setT('f-limp','-'+fmt(f.limp));setT('f-neto',fmt(f.neto));setT('f-jesus',fmt(f.jesus));setT('f-carlitos',fmt(f.carlitos));
  // Desglose servicios edificio por línea
  setT('f-srv-internet','-'+fmt(f.internet));
  setT('f-srv-agua','-'+fmt(f.agua));
  var cfeRow=document.getElementById('f-srv-cfe-row');
  if(cfeRow){cfeRow.style.display=f.cfe>0?'flex':'none';}
  setT('f-srv-cfe','-'+fmt(f.cfe));
  setT('f-srv-cfe-periodo',f.cfePeriodo?'('+f.cfePeriodo+')':'');
  var gastosLines=document.getElementById('f-gastos-mant-lines');
  // Gastos del mes seleccionado
  var gastosMes=GASTOS_MANT.filter(function(g){return gastoMesIdx(g)===mi;});
  if(gastosLines){gastosLines.innerHTML=gastosMes.map(function(g){return '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;font-size:13px;color:#6b6b6b;border-top:1px solid #ececea"><span>'+g.desc+'</span><span style="color:#c0392b;font-weight:500">-'+fmt(g.monto)+'</span></div>';}).join('');}
  // Bolsa mantenimiento: valor manual controlado por el usuario
  setT('bolsa-jesus-val',fmt(BOLSA_JESUS));setT('bolsa-carlitos-val',fmt(BOLSA_CARLITOS));setT('bolsa-mant-val',fmt(BOLSA_MANT));
  setT('f-jesus-det','25% neto ('+fmt(f.neto*0.25)+') + cobro a Carlitos por pinos '+fmt(srv.internetPinos.monto));
  setT('f-carlitos-det','75% neto ('+fmt(f.neto*0.75)+') − pinos '+fmt(srv.internetPinos.monto));
  var fh=FIN_HIST[mi]||{};
  var btnJ=document.getElementById('btn-transfer-jesus');var lblJ=document.getElementById('lbl-transfer-jesus');
  var btnC=document.getElementById('btn-transfer-carlitos');var lblC=document.getElementById('lbl-transfer-carlitos');
  if(btnJ){btnJ.className='btn btn-sm '+(fh.jesusTransferido?'btn-primary':'');lblJ.textContent=fh.jesusTransferido?'✓ Transferido':'Marcar transferido';}
  if(btnC){btnC.className='btn btn-sm '+(fh.carlitosTransferido?'btn-primary':'');lblC.textContent=fh.carlitosTransferido?'✓ Transferido':'Marcar transferido';}

  var totalGastosMant=GASTOS_MANT.reduce(function(s,g){return s+g.monto;},0);
  var fondoAcum=FONDO_INICIAL;
  var fondoRows=HIST_LABELS.map(function(label,idx){var ff=calcFinMes(idx);fondoAcum+=ff.mant;return '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #eee;font-size:13px"><span class="text-muted">'+label+'</span><span style="font-weight:500">+'+fmt(ff.mant)+'</span></div>';}).join('');
  var fondoEl=document.getElementById('fondo-mant-display');
  var gastosRows=GASTOS_MANT.length?GASTOS_MANT.map(function(g,i){return '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid #eee;font-size:13px"><span>'+g.fecha+' — '+g.desc+'</span><div style="display:flex;align-items:center;gap:8px"><span style="font-weight:500;color:#c0392b">-'+fmt(g.monto)+'</span><button style="background:none;border:none;cursor:pointer;color:#999;font-size:12px;padding:0 4px" onclick="eliminarGastoMant('+i+')">✕</button></div></div>';}).join(''):'<div style="font-size:12px;color:#999;padding:4px 0">Sin gastos registrados</div>';
  if(fondoEl)fondoEl.innerHTML='<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px"><div style="font-size:28px;font-weight:600;color:#534AB7">'+fmt(fondoAcum-totalGastosMant)+'</div><button class="btn btn-sm" onclick="editarFondoInicial()">✎ Editar saldo inicial</button></div><div id="fondo-edit-box" style="display:none;margin-bottom:10px"><div class="form-row" style="max-width:300px"><div class="form-group"><label>Saldo inicial ($)</label><input type="number" id="fondo-inicial-inp" value="'+FONDO_INICIAL+'" placeholder="0"></div></div><button class="btn btn-primary btn-sm" onclick="guardarFondoInicial()">✓ Guardar</button> <button class="btn btn-sm" onclick="document.getElementById(\'fondo-edit-box\').style.display=\'none\'">Cancelar</button></div><div style="font-size:12px;color:#6b6b6b;margin-bottom:8px">Saldo inicial '+fmt(FONDO_INICIAL)+' + 10% mensual — gastos '+fmt(totalGastosMant)+'</div><details><summary style="cursor:pointer;font-size:12px;color:#534AB7;margin-bottom:8px">Ver desglose por mes</summary>'+fondoRows+'</details><details><summary style="cursor:pointer;font-size:12px;color:#c0392b;margin-bottom:8px">Gastos registrados ('+GASTOS_MANT.length+')</summary>'+gastosRows+'</details>';

  var hh='';
  HIST_LABELS.forEach(function(label,idx){
    if(idx<FIN_DESDE)return;
    var ff=calcFinMes(idx); if(ff.cob===0)return;
    var ffh=FIN_HIST[idx]||{};
    hh+='<div style="padding:10px 0;border-bottom:1px solid #eee"><div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="font-weight:500;font-size:13px">'+label+'</span><span class="text-muted" style="font-size:12px">Cobrado: '+fmt(ff.cob)+'</span></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div style="background:#E1F5EE;border-radius:8px;padding:8px"><div style="font-size:11px;color:#085041">Jesús</div><div style="font-size:16px;font-weight:600;color:#1D9E75">'+fmt(ff.jesus)+'</div><button class="btn btn-xs '+(ffh.jesusTransferido?'btn-primary':'')+'" style="margin-top:4px" onclick="toggleTransferido('+idx+',\'jesus\')">'+(ffh.jesusTransferido?'✓ Transferido':'Marcar transferido')+'</button></div><div style="background:#E6F1FB;border-radius:8px;padding:8px"><div style="font-size:11px;color:#0C447C">Carlitos</div><div style="font-size:16px;font-weight:600;color:#185FA5">'+fmt(ff.carlitos)+'</div><button class="btn btn-xs '+(ffh.carlitosTransferido?'btn-primary':'')+'" style="margin-top:4px" onclick="toggleTransferido('+idx+',\'carlitos\')">'+(ffh.carlitosTransferido?'✓ Transferido':'Marcar transferido')+'</button></div></div></div>';
  });
  var histEl=document.getElementById('fin-historial');
  if(histEl)histEl.innerHTML=hh?'<details '+(FIN_HIST_OPEN?'open':'')+' onToggle="FIN_HIST_OPEN=this.open"><summary style="cursor:pointer;font-size:13px;color:#185FA5;padding:8px 0">Ver historial de distribuciones</summary>'+hh+'</details>':'<div class="text-muted" style="padding:8px 0;font-size:13px">Sin distribuciones registradas aún</div>';

  // ── Depósitos en garantía ────────────────────────────────────────────────
  var depEl=document.getElementById('fin-depositos');if(!depEl)return;
  var conDep=DEPTOS.filter(function(d){return d.deposito;});
  var sinDep=DEPTOS.filter(function(d){return !d.deposito;});
  var totalDep=conDep.reduce(function(s,d){return s+d.renta;},0);
  var resumen='<div style="display:flex;align-items:baseline;gap:10px;margin-bottom:12px"><div style="font-size:26px;font-weight:700;color:#1D9E75">'+fmt(totalDep)+'</div><div style="font-size:12px;color:#6b6b6b">'+conDep.length+' depósito'+(conDep.length!==1?'s':'')+' activo'+(conDep.length!==1?'s':'')+' · equivale a 1 mes de renta cada uno</div></div>';
  var filas=conDep.map(function(d){return '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #f0f0ee;font-size:13px"><div><span style="font-weight:500">Depto '+d.num+'</span> · '+d.nombre.split(' ')[0]+'</div><span style="font-weight:600;color:#1D9E75">'+fmt(d.renta)+'</span></div>';}).join('');
  var sinFila=sinDep.length?'<div style="margin-top:8px;font-size:12px;color:#c0392b">⚠ Sin depósito: '+sinDep.map(function(d){return 'Depto '+d.num;}).join(', ')+'</div>':'';
  depEl.innerHTML=resumen+filas+sinFila;
  // ── Resumen anual (al final para no interrumpir si hay error) ─────────────
  try{renderResumenAnual();}catch(e){console.warn('renderResumenAnual:',e);}
}
function editarFondoInicial(){document.getElementById('fondo-edit-box').style.display='block';}
function guardarFondoInicial(){var v=parseFloat(document.getElementById('fondo-inicial-inp').value)||0;FONDO_INICIAL=v;document.getElementById('fondo-edit-box').style.display='none';renderFinanzas();try{saveFinHist();}catch(e){console.warn('Firebase no disponible:',e);}}

// ── Resumen anual ─────────────────────────────────────────────────────────
function renderResumenAnual(){
  var el=document.getElementById('fin-resumen-anual');if(!el)return;
  // Agrupar meses por año
  var porAnio={};
  for(var i=0;i<=MEX_MES;i++){
    var ym=idxToYM(i);var y=ym.y;
    if(!porAnio[y])porAnio[y]={cob:0,mant:0,limp:0,srvEdif:0,jesus:0,carlitos:0};
    var f=calcFinMes(i);
    porAnio[y].cob+=f.cob;porAnio[y].mant+=f.mant;porAnio[y].limp+=f.limp;
    porAnio[y].srvEdif+=f.srvEdif;porAnio[y].jesus+=f.jesus;porAnio[y].carlitos+=f.carlitos;
  }
  var html='';
  Object.keys(porAnio).sort().forEach(function(y){
    var a=porAnio[y];
    html+='<div style="margin-bottom:16px"><div style="font-size:14px;font-weight:700;color:#1a1a1a;margin-bottom:8px;padding-bottom:4px;border-bottom:2px solid #e0e0de">'+y+'</div>';
    html+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">';
    html+=_anioCard('Renta cobrada',a.cob,'#1D9E75');
    html+=_anioCard('Jesús (25%+)',a.jesus,'#1D9E75');
    html+=_anioCard('Carlitos (75%)',a.carlitos,'#185FA5');
    html+=_anioCard('Mantenimiento 10%',a.mant,'#534AB7');
    html+=_anioCard('Servicios edificio',a.srvEdif,'#c0392b');
    html+=_anioCard('Limpieza',a.limp,'#c0392b');
    html+='</div></div>';
  });
  el.innerHTML=html||'<div class="text-muted" style="font-size:13px">Sin datos aún</div>';
}
function _anioCard(label,val,color){
  return '<div style="background:#f8f8f6;border-radius:8px;padding:8px"><div style="font-size:11px;color:#6b6b6b">'+label+'</div><div style="font-size:15px;font-weight:700;color:'+color+'">'+fmt(val)+'</div></div>';
}

// ── Alerta CFE próximo ────────────────────────────────────────────────────
function alertaCFEProximo(){
  if(!CFE_HIST.length)return;
  // Buscar el entry con fecha fin más reciente
  var ultimo=CFE_HIST.reduce(function(prev,cur){
    return (!prev.fin||(cur.fin&&cur.fin>prev.fin))?cur:prev;
  },{});
  if(!ultimo.fin)return;
  var finDate=new Date(ultimo.fin+'T12:00:00');
  var hoy=new Date();hoy.setHours(0,0,0,0);
  var diasParaVencer=Math.ceil((finDate-hoy)/(1000*60*60*24));
  var al=document.getElementById('dash-alertas');if(!al)return;
  if(diasParaVencer<=30&&diasParaVencer>=-10){
    var txt=diasParaVencer<0?'Venció hace '+Math.abs(diasParaVencer)+'d':diasParaVencer===0?'Vence hoy':'Vence en '+diasParaVencer+'d';
    al.innerHTML='<div class="alert-banner alert-amber"><i class="ti ti-bolt" style="font-size:16px;flex-shrink:0"></i><div><strong>CFE Luz — Próximo bimestre</strong><div style="font-size:12px;margin-top:2px">Periodo actual termina '+fmtD(ultimo.fin)+' · '+txt+'</div></div><button class="btn btn-sm" style="margin-left:auto" onclick="openModal(\'modal-cfe\')">Registrar CFE</button></div>'+al.innerHTML;
  }
}

// ── Export CSV ────────────────────────────────────────────────────────────
function exportarCSV(){
  var csv=[];var sep=',';
  // Hoja 1: Departamentos
  csv.push('=== DEPARTAMENTOS ===');
  csv.push(['Depto','Inquilino','Renta','Día pago','Tel','Contrato','Fin contrato'].join(sep));
  DEPTOS.forEach(function(d){
    csv.push([d.num,'"'+d.nombre+'"',d.renta,d.diaPago,d.tel||'','"'+(d.contrato||'')+'"',d.finDate||''].join(sep));
  });
  // Hoja 2: Pagos por mes
  csv.push('');csv.push('=== PAGOS ===');
  csv.push(['Depto','Mes','Monto','Forma','Fecha'].join(sep));
  for(var i=0;i<=MEX_MES;i++){
    var ym=idxToYM(i);
    DEPTOS.forEach(function(d){
      var p=getPago(d.num,i);
      if(p&&p.pagado)csv.push([d.num,idxLabel(i),p.monto||d.renta,'"'+(p.forma||'')+'",'+'"'+(p.fecha||'')+'"'].join(sep));
    });
  }
  // Hoja 3: Finanzas por mes
  csv.push('');csv.push('=== FINANZAS POR MES ===');
  csv.push(['Mes','Cobrado','Mant 10%','Jesús','Carlitos'].join(sep));
  for(var i=0;i<=MEX_MES;i++){
    var f=calcFinMes(i);
    if(f.cob>0)csv.push([idxLabel(i),f.cob,f.mant,f.jesus,f.carlitos].join(sep));
  }
  // Hoja 4: Gastos mantenimiento
  csv.push('');csv.push('=== GASTOS MANTENIMIENTO ===');
  csv.push(['Fecha','Descripción','Monto'].join(sep));
  GASTOS_MANT.forEach(function(g){csv.push([g.fecha,'"'+g.desc+'"',g.monto].join(sep));});
  // Descargar
  var blob=new Blob(['﻿'+csv.join('\n')],{type:'text/csv;charset=utf-8'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url;a.download='depas1524_'+new Date().toISOString().split('T')[0]+'.csv';
  document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
}

// ── Sync CFE_HIST → SERVICIOS (para historial anterior) ──────────────────
function syncCFEHistToServicios(){
  var MS_SHORT=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  function fmtPer(s){if(!s)return'';var p=s.split('-');return p[2]+' '+MS_SHORT[parseInt(p[1])-1]+' '+p[0].slice(2);}
  CFE_HIST.forEach(function(entry){
    var fPago=entry.fechaPago||entry.inicio;if(!fPago)return;
    var dp=fPago.split('-');if(dp.length!==3)return;
    var mi=mesIdx(parseInt(dp[0]),parseInt(dp[1])-1);
    var srv=getSrv(mi);
    if(!srv.cfe||!srv.cfe.pagado){
      var periodo=fmtPer(entry.inicio)+(entry.fin?' – '+fmtPer(entry.fin):'');
      srv.cfe={monto:entry.monto,fijo:false,pagado:true,periodo:periodo};
      // No hace falta saveSrv aquí — solo sincroniza en memoria para renderizado
    }
  });
}


function marcarTransferido(quien){
  var mi=MEX_MES,f=calcFinMes(mi);
  if(!FIN_HIST[mi])FIN_HIST[mi]={jesusTransferido:false,carlitosTransferido:false};
  var antes=FIN_HIST[mi][quien+'Transferido'];
  var monto=quien==='jesus'?f.jesus:f.carlitos;
  var nombreQ=quien==='jesus'?'Jesús':'Carlitos';
  if(antes){
    if(!confirm('¿Desmarcar transferencia de '+nombreQ+'? Esto restará '+fmt(monto)+' de su bolsa.'))return;
  } else {
    if(!confirm('¿Marcar como transferido? Esto sumará '+fmt(monto)+' a la bolsa de '+nombreQ+'.'))return;
  }
  FIN_HIST[mi][quien+'Transferido']=!antes;
  if(quien==='jesus') BOLSA_JESUS=Math.max(0, antes ? BOLSA_JESUS-monto : BOLSA_JESUS+monto);
  else if(quien==='carlitos') BOLSA_CARLITOS=Math.max(0, antes ? BOLSA_CARLITOS-monto : BOLSA_CARLITOS+monto);
  try{saveFinHist();}catch(e){}
  renderFinanzas();
}
function toggleTransferido(mi,quien){
  var f=calcFinMes(mi);
  if(!FIN_HIST[mi])FIN_HIST[mi]={jesus:f.jesus,carlitos:f.carlitos,jesusTransferido:false,carlitosTransferido:false};
  var antes=FIN_HIST[mi][quien+'Transferido'];
  var monto=quien==='jesus'?f.jesus:f.carlitos;
  var nombreQ=quien==='jesus'?'Jesús':'Carlitos';
  if(antes){
    if(!confirm('¿Desmarcar transferencia de '+nombreQ+'? Esto restará '+fmt(monto)+' de su bolsa.'))return;
  } else {
    if(!confirm('¿Marcar como transferido? Esto sumará '+fmt(monto)+' a la bolsa de '+nombreQ+'.'))return;
  }
  FIN_HIST[mi][quien+'Transferido']=!antes;
  if(quien==='jesus') BOLSA_JESUS=Math.max(0, antes ? BOLSA_JESUS-monto : BOLSA_JESUS+monto);
  else if(quien==='carlitos') BOLSA_CARLITOS=Math.max(0, antes ? BOLSA_CARLITOS-monto : BOLSA_CARLITOS+monto);
  try{saveFinHist();}catch(e){}
  renderFinanzas();
}

function eliminarDeHistorial(idx){
  var d=INQ_HIST[idx];
  if(!d)return;
  if(!confirm('¿Eliminar permanentemente a '+d.nombre+' del historial?'))return;
  INQ_HIST.splice(idx,1);
  saveInqHist();
  renderContratos();
}
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
  // Dropdown de deptos: solo vacíos (no ocupados)
  var depSel=document.getElementById('c-depto');
  if(depSel){
    var current=depSel.value;
    var ocupados=DEPTOS.map(function(d){return d.num;});
    var vacios=[1,2,3,4,5,6,7,8].filter(function(n){return ocupados.indexOf(n)<0;});
    depSel.innerHTML='<option value="">— Selecciona —</option>';
    vacios.forEach(function(n){depSel.innerHTML+='<option value="'+n+'">Depto '+n+'</option>';});
    if(current&&vacios.indexOf(parseInt(current))>-1)depSel.value=current;
  }
  checkAltaBtn();prevContrato();
  cargarFormPinos();
  var elimBox=document.getElementById('elim-contrato-box');if(elimBox)elimBox.style.display='none';
  // Historial inquilinos eliminados
  var hl=document.getElementById('inq-hist-list');if(!hl)return;
  if(!INQ_HIST.length){hl.innerHTML='<div class="text-muted" style="font-size:13px;padding:8px 0">Sin inquilinos eliminados aún</div>';return;}
  var rows='<table class="tbl"><thead><tr><th>Inquilino</th><th>Depto</th><th>Renta</th><th>Eliminado</th><th></th></tr></thead><tbody>';
  INQ_HIST.forEach(function(d,i){
    var depLabel=d._esPinos?'🏠 Los Pinos':'Depto '+d.num;
    rows+='<tr><td style="font-weight:500">'+esc(d.nombre)+'</td><td>'+depLabel+'</td><td>'+fmt(d.renta)+'</td><td class="text-muted">'+esc(d._eliminado)+'</td><td style="display:flex;gap:6px">'+(d._esPinos?'':'<button class="btn btn-xs btn-primary" onclick="restaurarInq('+i+')"><i class="ti ti-refresh"></i> Restaurar</button>')+'<button class="btn btn-xs btn-danger" onclick="eliminarDeHistorial('+i+')"><i class="ti ti-trash"></i> Eliminar</button></td></tr>';
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
  var depSel=document.getElementById('c-depto');
  depSel.innerHTML='<option value="'+d.num+'">Depto '+d.num+'</option>';
  depSel.value=d.num;cPiso();document.getElementById('c-monto').value=d.renta||5000;
  document.getElementById('c-dur').value=d.contrato==='1 año'?'UN AÑO':'SEIS MESES';
  document.getElementById('c-tel').value=d.tel||'';document.getElementById('c-email').value=d.email||'';
  document.getElementById('c-nac').value=d.nacimiento||'';document.getElementById('c-dom').value=d.domicilio||'';
  document.getElementById('c-inmobiliaria').checked=d.viaInmobiliaria||false;
  if(d.inicio){document.getElementById('c-ini').value=d.inicio;cFin();}else{document.getElementById('c-ini').value='';document.getElementById('c-fin').value='';}
  if(elimBox)elimBox.style.display='block';checkAltaBtn();prevContrato();
}
function checkAltaBtn(){var nom=document.getElementById('c-nombre').value.trim(),dep=document.getElementById('c-depto').value,box=document.getElementById('alta-box');if(box)box.style.display=(nom&&dep)?'block':'none';}
var _salidaIdx=null;
function eliminarContrato(){
  var v=document.getElementById('c-sel').value;if(v==='')return;
  var d=DEPTOS[parseInt(v)];
  _salidaIdx=parseInt(v);
  document.getElementById('salida-nombre').textContent=d.nombre+' — Depto '+d.num;
  document.getElementById('salida-deposito').textContent=d.deposito?fmt(d.renta):'Sin depósito registrado';
  document.getElementById('salida-dep-accion').value=d.deposito?'devuelto':'sin-deposito';
  document.getElementById('salida-dano-box').style.display='none';
  document.getElementById('salida-notas').value='';
  if(d.deposito){document.getElementById('salida-dano-devuelto').value=d.renta;}
  openModal('modal-salida');
}
function salidaToggleDano(){
  var accion=document.getElementById('salida-dep-accion').value;
  var box=document.getElementById('salida-dano-box');
  box.style.display=accion==='parcial'?'block':'none';
  if(accion==='parcial'){
    var d=DEPTOS[_salidaIdx];
    document.getElementById('salida-dano-monto').oninput=function(){
      var dam=parseFloat(this.value)||0;
      document.getElementById('salida-dano-devuelto').value=Math.max(0,(d?d.renta:0)-dam);
    };
  }
}
function confirmarSalida(){
  if(_salidaIdx===null)return;
  var d=DEPTOS[_salidaIdx];if(!d)return;
  var accion=document.getElementById('salida-dep-accion').value;
  var notas=document.getElementById('salida-notas').value.trim();
  var depInfo={accion:accion};
  if(accion==='parcial'){
    depInfo.danoMonto=parseFloat(document.getElementById('salida-dano-monto').value)||0;
    depInfo.devuelto=parseFloat(document.getElementById('salida-dano-devuelto').value)||0;
    depInfo.danoDesc=document.getElementById('salida-dano-desc').value.trim();
  }
  var ahora=new Date();
  var entrada=Object.assign({},d,{
    _eliminado:ahora.getDate()+'/'+(ahora.getMonth()+1)+'/'+ahora.getFullYear(),
    _depositoSalida:depInfo,
    _notasSalida:notas
  });
  INQ_HIST.unshift(entrada);saveInqHist();
  delDepto(d.num);DEPTOS.splice(_salidaIdx,1);VACIOS.push(d.num);VACIOS.sort(function(a,b){return a-b;});
  _salidaIdx=null;closeModal('modal-salida');
  document.getElementById('contrato-gen-msg').innerHTML='';renderAll();
}
function darDeAlta(){
  var nom=document.getElementById('c-nombre').value.trim(),dep=parseInt(document.getElementById('c-depto').value);
  if(!nom||!dep){alert('Se necesita al menos nombre y departamento');return;}
  var dur=document.getElementById('c-dur').value,ini=document.getElementById('c-ini').value,renta=parseFloat(document.getElementById('c-monto').value)||5000;
  var mesesMap={'1 MES':1,'2 MESES':2,'3 MESES':3,'4 MESES':4,'5 MESES':5,'SEIS MESES':6,'7 MESES':7,'8 MESES':8,'9 MESES':9,'10 MESES':10,'11 MESES':11,'UN AÑO':12};var mesesN=mesesMap[dur]||6;
  var finDate='',finStr='—',dia=1;
  if(ini){var fd=new Date(ini+'T12:00:00');fd.setMonth(fd.getMonth()+mesesN);finDate=fd.toISOString().split('T')[0];finStr=fd.getDate()+' '+MS[fd.getMonth()]+' '+fd.getFullYear();dia=new Date(ini+'T12:00:00').getDate();}
  var contratoMap={'1 MES':'1 mes','2 MESES':'2 meses','3 MESES':'3 meses','4 MESES':'4 meses','5 MESES':'5 meses','SEIS MESES':'6 meses','7 MESES':'7 meses','8 MESES':'8 meses','9 MESES':'9 meses','10 MESES':'10 meses','11 MESES':'11 meses','UN AÑO':'1 año'};
  var contrato=contratoMap[dur]||dur;
  var isNew=VACIOS.indexOf(dep)>-1;
  var existing=DEPTOS.find(function(d){return d.num===dep;});
  var prevBitacora=(existing&&existing.bitacora)||[];
  // URLs de INE: usa la foto nueva si se seleccionó, o conserva la existente
  var ineInq=_tmpIneInq||(existing?existing.ineInqUrl||'':'');
  var ineAval=_tmpIneAval||(existing?existing.ineAvalUrl||'':'');
  _tmpIneInq='';_tmpIneAval='';
  var viaInmob=document.getElementById('c-inmobiliaria').checked;
  // Guardamos el mesIdx del primer mes para no depender del historial de pagos
  var inmobMesComision=null;
  if(viaInmob){
    var iniRef=ini?new Date(ini+'T12:00:00'):new Date();
    inmobMesComision=mesIdx(iniRef.getFullYear(),iniRef.getMonth());
  }
  var obj={num:dep,nombre:nom,renta:renta,diaPago:dia,contrato:contrato,inicio:ini,finDate:finDate,finStr:finStr,deposito:true,viaInmobiliaria:viaInmob,inmobMesComision:inmobMesComision,tel:document.getElementById('c-tel').value,email:document.getElementById('c-email').value,curp:'',nacimiento:document.getElementById('c-nac').value,ocupacion:'',domicilio:document.getElementById('c-dom').value,notas:'',ineInqUrl:ineInq,ineAvalUrl:ineAval,bitacora:prevBitacora,aval:{nombre:document.getElementById('c-aval').value,parentesco:'',tel:'',email:'',curp:'',calle:'',colonia:'',ciudad:'',estado:'',cp:'',propiedad:'Sí',propDir:'',notas:''}};
  if(existing){DEPTOS[DEPTOS.indexOf(existing)]=obj;}else{DEPTOS.push(obj);DEPTOS.sort(function(a,b){return a.num-b.num;});}
  var vi=VACIOS.indexOf(dep);if(vi>-1)VACIOS.splice(vi,1);if(!PAGOS[dep])PAGOS[dep]={};
  saveDepto(obj);
  // Primer mes + depósito auto-registrado (solo en alta nueva, no renovaciones)
  if(isNew&&ini){
    var iniD=new Date(ini+'T12:00:00');
    var primerIdx=mesIdx(iniD.getFullYear(),iniD.getMonth());
    var primerPago={pagado:true,forma:'Efectivo (1er mes + depósito)',monto:renta,fecha:ini};
    PAGOS[dep][primerIdx]=primerPago;
    savePago(dep,primerIdx,primerPago);
    document.getElementById('contrato-gen-msg').innerHTML='<div class="alert-banner" style="background:#E1F5EE;color:#085041;border:1px solid #b2dfd0"><i class="ti ti-check"></i> Depto '+dep+' — '+nom+' dado de alta. <strong>Primer mes y depósito registrados como pagados.</strong></div>';
  } else {
    document.getElementById('contrato-gen-msg').innerHTML='<div class="alert-banner" style="background:#E1F5EE;color:#085041;border:1px solid #b2dfd0"><i class="ti ti-check"></i> Depto '+dep+' — '+nom+' '+(isNew?'dado de alta':'contrato renovado')+'.</div>';
  }
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
  var nom=document.getElementById('c-nombre').value.trim()||'___________________________',av=document.getElementById('c-aval').value.trim()||'___________________________';
  var num=parseInt(document.getElementById('c-depto').value)||1,dur=document.getElementById('c-dur').value,monto=parseFloat(document.getElementById('c-monto').value)||5000,ini=document.getElementById('c-ini').value||'___/___/______',fin=document.getElementById('c-fin-f').value||'___/___/______';
  if(formato==='pdf'){genPDFNativo(nom,av,num,dur,ini,fin,monto);return;}
  var btn=document.getElementById('btn-gen-docx'),orig=btn.innerHTML;btn.innerHTML='<div class="loading-dots"><span></span><span></span><span></span></div> Generando…';btn.disabled=true;
  try{
    var docxLib=window.docx;
    var Document=docxLib.Document,Packer=docxLib.Packer,Paragraph=docxLib.Paragraph,TextRun=docxLib.TextRun,AlignmentType=docxLib.AlignmentType;
    var MESES_UP=['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
    var MESES_N=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    function fmtF(iso){if(!iso||iso.indexOf('_')>-1)return{dia:'___',mes:'___',mesUp:'___',anio:'____'};var d=new Date(iso+'T12:00:00');return{dia:d.getDate(),mes:MESES_N[d.getMonth()],mesUp:MESES_UP[d.getMonth()],anio:d.getFullYear()};}
    function n2l(n){var m={3000:'TRES MIL',3500:'TRES MIL QUINIENTOS',4000:'CUATRO MIL',4500:'CUATRO MIL QUINIENTOS',5000:'CINCO MIL',5500:'CINCO MIL QUINIENTOS',6000:'SEIS MIL',6500:'SEIS MIL QUINIENTOS',7000:'SIETE MIL',7500:'SIETE MIL QUINIENTOS',8000:'OCHO MIL'};return m[n]||'MONTO';}
    function mTxt(m){return'$'+m.toLocaleString('es-MX',{minimumFractionDigits:2})+' (SON '+n2l(m)+' PESOS 00/100 M. N.)';}
    var piso=num<=4?'PLANTA BAJA':'PLANTA ALTA';
    var pisoNum=num<=4?'PRIMER PISO (PLANTA BAJA)':'SEGUNDO PISO (PLANTA ALTA)';
    var fi=fmtF(ini),ff=fmtF(fin);
    var NI=nom.toUpperCase(),NA=av.toUpperCase();
    var mStr=mTxt(monto);
    var R={font:'Arial',size:22,color:'000000'};
    var RB=Object.assign({},R,{bold:true});
    var sp={line:260,lineRule:'auto'};
    function p(runs,center,kn){return new Paragraph({alignment:center?AlignmentType.CENTER:AlignmentType.BOTH,spacing:sp,keepNext:!!kn,children:runs.map(function(r){return new TextRun(Object.assign({},R,r));})});}
    function gap(kn){return new Paragraph({spacing:{before:60,after:60},keepNext:!!kn,children:[new TextRun(Object.assign({text:''},R))]});}
    function firma(label,nombre){return[
      new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:900,after:0},keepNext:true,keepLines:true,children:[new TextRun(Object.assign({text:'_'.repeat(45)},R))]}),
      new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:60,after:0},keepNext:true,keepLines:true,children:[new TextRun(Object.assign({text:label},RB))]}),
      new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:40,after:0},keepLines:true,children:[new TextRun(Object.assign({text:nombre},R))]})
    ];}
    var children=[
      p([{text:'CONTRATO DE ARRENDAMIENTO QUE EN LA CIUDAD DE LOS MOCHIS, SINALOA, DE LOS ESTADOS UNIDOS MEXICANOS, CELEBRAN HOY '+fi.dia+' DE '+fi.mesUp+' DEL AÑO '+fi.anio+', POR UNA PARTE EL SEÑOR RAMON ADOLFO ARMENTA RODRIGUEZ, A QUIEN EN LO SUCESIVO SE LE DESIGNARÁ EL ARRENDADOR Y POR LA OTRA PARTE EL C. '},{text:NI,bold:true},{text:', A QUIEN EN LO SUCESIVO SE LE DENOMINARA EL ARRENDATARIO, MISMO QUE SUJETAN BAJO LAS SIGUIENTES DECLARACIONES Y CLAUSULAS:'}]),
      gap(),p([{text:'DE C L A R A C I O N E S'}],true),gap(),
      p([{text:'PRIMERA.- Declara EL SEÑOR RAMON ADOLFO ARMENTA RODRIGUEZ en su carácter de arrendador, que es legítimo propietario de una finca urbana compuesta de solar con construcción constituida por 08 DEPARTAMENTOS, de dos plantas, distribuidos en 04 departamentos por piso (planta), ubicados en Avenida 10 de Mayo número 1524 oriente, de esta ciudad de Los Mochis, Sinaloa, cada departamento está identificado con los números del 1 al 8, los cuales se encuentran totalmente equipados y amueblados, es decir, en su interior con baño completo, cama compuesta por base de madera y respaldo, colchón, área tipo cocineta con parilla de inducción eléctrica, área tipo comedor compuesta por una barra y silla de descanso, cuenta con pantalla plana de 32\", área de closet, y cuenta con los servicios de internet inalámbrico, energía eléctrica y agua potable, y de los cuales se da en arrendamiento el departamento numero '},{text:String(num),bold:true},{text:', ubicado en el '},{text:pisoNum,bold:true},{text:' mediante contrato que se celebra al tenor de las siguientes:'}]),
      gap(),p([{text:'C L A U S U L A S:'}],true),gap(),
      p([{text:'PRIMERA.- Por medio del presente instrumento y en este acto EL SEÑOR RAMON ADOLFO ARMENTA RODRIGUEZ, da en arrendamiento a '},{text:NI,bold:true},{text:', y esta toma de aquella en arrendamiento el bien inmueble descrito debidamente en el punto primero de declaraciones.'}]),
      gap(),p([{text:'SEGUNDO.- El término de duración del presente contrato de arrendamiento, se fija por las partes por '},{text:dur,bold:true},{text:', contados a partir de este día '},{text:fi.dia+' DE '+fi.mesUp+' DEL AÑO '+fi.anio,bold:true},{text:', para concluir el mismo día '},{text:ff.dia+' DE '+ff.mesUp+' DEL AÑO '+ff.anio,bold:true},{text:', sin necesidad de desahucio ni de ningún aviso previo, pues el arrendatario renuncia expresamente a la prórroga de que trata el artículo 2367 del Código Civil para el Estado de Sinaloa.'}]),
      gap(),p([{text:'TERCERO.- El C. '},{text:NI,bold:true},{text:', se obliga a pagar y pagará a EL SEÑOR RAMON ADOLFO ARMENTA RODRIGUEZ, en el domicilio particular del Arrendador, sito en Calle Montaña Número 1862 Poniente, del Fraccionamiento Real del Country, de esta ciudad de Los Mochis Sinaloa, domicilio que los contratantes convienen en fijar para el pago y recepción de las pensiones rentísticas, sin necesidad de previo requerimiento judicial o extrajudicial, por el uso y goce temporal del expresado bien inmueble, en especifico del departamento identificado con el numero '},{text:String(num),bold:true},{text:', ubicado en la planta '},{text:piso,bold:true},{text:' a partir de este día '},{text:fi.dia+' DE '+fi.mesUp+' DEL AÑO '+fi.anio,bold:true},{text:' y hasta el día '},{text:ff.dia+' DE '+ff.mesUp+' DEL AÑO '+ff.anio,bold:true},{text:', la cantidad de '+mStr+', por mensualidad adelantada dentro de los primeros cinco días del mes en turno, asimismo, se manifiesta que a la firma del presente instrumento el arrendatario deja en calidad de depósito la cantidad de '+mStr+', mismos, se quedaran en garantía en caso de daños o incumplimiento del contrato, con independencia de los gastos extras que esto pueda generar.'}]),
      gap(),p([{text:'CUARTO.- Ambas partes convienen que el precio de arrendamiento mientras dure la vigencia del presente contrato de arrendamiento, por acuerdo de las partes, será incrementado en un 10% por cada año que se acuerde que se siga ocupando la finca arrendada y así sucesivamente se tendrá un nuevo precio de renta por cada año de vigencia tomando como base el precio vigente inmediato anterior.'}]),
      gap(),p([{text:'QUINTO.- Toda mensualidad será pagada íntegra aun cuando el arrendatario tan solo ocupe la cosa arrendada en todo o en parte de ella o parte del mes correspondiente. En caso que el arrendatario abandone, deje, desocupe el departamento antes de que fenezca el plazo por el cual cobra vigencia el presente contrato, no tendrá derecho a la devolución del depósito entregado por la misma cantidad del costo de la renta mensual.'}]),
      gap(),p([{text:'SEXTO.- La cosa inmueble materia del presente contrato de arrendamiento se destinará por el arrendatario, en todas y cada una de sus partes como departamento-habitacional, quedándole estrictamente prohibido destinarlo para cualquier otro fin, siendo esto una causa especial de rescisión del presente contrato.'}]),
      gap(),p([{text:'SÉPTIMA.- No podrá el arrendatario El C. '},{text:NI,bold:true},{text:', sub-arrendar en todo ni en parte la cosa inmueble que se da en arrendamiento como tampoco ceder en todo o en parte los derechos que adquiera sobre este, sin previo consentimiento otorgado por escrito del arrendador, además, de que dicho departamento es para uso individual, es decir, no podrá ser utilizado por más de una persona, salvo, visitas que reciba el arrendatario dentro de un horario de 08:00 horas a 20:00 horas de lunes a viernes, sin derecho del visitante a pernoctar en el mismo.'}]),
      gap(),p([{text:'OCTAVA.- El arrendatario, '},{text:NI,bold:true},{text:', recibe con esta fecha la cosa inmueble que renta en buen estado de uso y se obliga a cuidar de su conservación, como si se tratase de cosa propia, así como a devolverlo en buen estado a la arrendadora sin más deterioro que el que cause el uso normal o natural de la cosa.'}]),
      gap(),p([{text:'NOVENA.- Los servicios de Energía Eléctrica o cualquier otro servicio que consuma el arrendatario '},{text:NI,bold:true},{text:', en la cosa inmueble objeto de este arrendamiento, serán por cuenta exclusiva de ésta y se obliga a pagarlos puntualmente a las empresas que se los suministren.'}]),
      gap(),p([{text:'DÉCIMA.- El arrendador concede el uso del arrendatario del equipo de centro de lavado marca MABE, consistente en lavadora y secadora de ropa, ubicado en el área de lavadero dentro de las áreas comunes del inmueble, mismo que el arrendatario podrá utilizar de forma única y exclusivamente como uso personal, es decir, no podrá utilizarlo en beneficio de visitas u otras personas, asimismo, dicho centro de lavado podrá ser utilizado por cohabitantes de dicho inmueble, para lo cual deberán tomar las medidas y reglas de orden para su uso común entre los inquilinos, mismo que se encuentra en estado nuevo de uso y el arrendatario se obliga a cuidar de su conservación, como si se tratase de cosa propia.'}]),
      gap(),p([{text:'DECIMA PRIMERA.- El arrendatario se compromete que de ser el caso de hacer un mal uso, negligente o con falta de cuidado, se hará responsable de cubrir los gastos que genere su reparación o bien su restitución.'}]),
      gap(),p([{text:'DECIMA SEGUNDA.- El Arrendatario, será responsable de cualquier problema de carácter legal relacionado con la actividad para la cual fue rentado el inmueble, que pudiera suscitarse, ya sea de carácter civil, penal, laboral, administrativo, etc. Por lo que él en lo personal responderá por el mal uso que llegare a darle al inmueble arrendado en caso de verse involucrado en cualquier situación de la naturaleza arriba asentada.'}]),
      gap(),p([{text:'DECIMA TERCERA.- EL C. '},{text:NA,bold:true},{text:', se constituye como aval de '},{text:NI,bold:true},{text:', respondiendo íntegramente de todas las obligaciones pactadas en el presente acto contractual.'}]),
      gap(),p([{text:'DÉCIMA CUARTA.- Ambas partes contratantes se someten expresamente a la jurisdicción de los Tribunales de la ciudad de Los Mochis, Ahome, Sinaloa, México, para todo lo relativo a las cuestiones que se susciten sobre la interpretación y cumplimiento de este contrato renunciando al privilegio en forma expresa de su domicilio presente o futuro por cuanto esto no fuere la ciudad de Los Mochis, Ahome, Sinaloa, México.'}]),
      gap(),
      p([{text:'LEIDO Y EXPLICADO EL PRESENTE CONTRATO DE ARRENDAMIENTO ENTRE LAS PARTES Y ENTERADOS DE SU ALCANCE Y CONSECUENCIAS LEGALES, SE MANIFIESTAN CONFORMES CON EL, MISMO QUE LO FIRMAN PARA LOS EFECTOS LEGALES QUE CORRESPONDAN.'}],false,true),
      gap(true),
    ].concat(firma('EL ARRENDADOR','RAMON ADOLFO ARMENTA RODRIGUEZ')).concat(firma('EL ARRENDATARIO',nom)).concat(firma('EL AVAL',av));
    var doc=new Document({sections:[{properties:{page:{size:{width:12240,height:15840},margin:{top:1134,right:1134,bottom:1134,left:1134}}},children:children}]});
    Packer.toBlob(doc).then(function(blob){
      var url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='contrato_depto'+num+'_'+nom.split(' ')[0].toUpperCase()+'.docx';a.click();URL.revokeObjectURL(url);
      registrarContrato(nom,num,'DOCX');
      btn.innerHTML=orig;btn.disabled=false;
    }).catch(function(e){
      document.getElementById('contrato-gen-msg').innerHTML='<div class="alert-banner alert-amber"><i class="ti ti-alert-triangle"></i> Error: '+e.message+'</div>';
      btn.innerHTML=orig;btn.disabled=false;
    });
  }catch(e){
    document.getElementById('contrato-gen-msg').innerHTML='<div class="alert-banner alert-amber"><i class="ti ti-alert-triangle"></i> Error: '+e.message+'</div>';
    btn.innerHTML=orig;btn.disabled=false;
  }
}
function genPDFNativo(nom,av,num,dur,ini,fin,monto){
  function fD(iso){
    if(!iso||!iso.match(/^\d{4}-\d{2}-\d{2}$/))return'_______________';
    var d=new Date(iso+'T12:00:00');
    if(isNaN(d.getTime()))return'_______________';
    return d.getDate()+' de '+MS_FULL[d.getMonth()]+' de '+d.getFullYear();
  }
  var piso=num<=4?'Primer Piso (Planta Baja)':'Segundo Piso (Planta Alta)';
  var montoFmt='$'+Number(monto).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2})+' M.N.';
  var css=[
    'body{font-family:Arial,sans-serif;font-size:11pt;line-height:1.65;margin:2.5cm 2.5cm 2cm 2.5cm;color:#000}',
    'h2{text-align:center;font-size:13pt;font-weight:bold;letter-spacing:.5px;margin-bottom:20px;text-transform:uppercase}',
    'p{margin:0 0 10px 0;text-align:justify}',
    '.cl{margin-bottom:12px;text-align:justify}',
    '.ct{font-weight:bold}',
    '.firma-wrap{margin-top:60px;display:flex;justify-content:space-between;gap:20px}',
    '.firma-item{flex:1;text-align:center}',
    '.firma-line{border-top:1px solid #000;padding-top:6px;margin-top:50px;font-size:9.5pt;line-height:1.4}',
    '.firma-rol{font-size:9pt;color:#444}',
    '@media print{body{margin:1.5cm} @page{margin:1.5cm}}'
  ].join('');
  var body=[
    '<h2>CONTRATO DE ARRENDAMIENTO</h2>',
    '<p>En Los Mochis, Sinaloa, el <strong>'+fD(ini)+'</strong>, el C. <strong>RAMÓN ADOLFO ARMENTA RODRÍGUEZ</strong> (arrendador) y el C. <strong>'+nom.toUpperCase()+'</strong> (arrendatario) celebran:</p>',
    '<div class="cl"><span class="ct">PRIMERA.- OBJETO.</span> Departamento No. <strong>'+num+'</strong>, '+piso+', Av. 10 de Mayo 1524 Oriente, Las Memorias, Los Mochis, Sinaloa.</div>',
    '<div class="cl"><span class="ct">SEGUNDA.- VIGENCIA.</span> <strong>'+dur+'</strong>, del <strong>'+fD(ini)+'</strong> al <strong>'+fD(fin)+'</strong>.</div>',
    '<div class="cl"><span class="ct">TERCERA.- RENTA.</span> <strong>'+montoFmt+'</strong> mensuales por adelantado.</div>',
    '<div class="cl"><span class="ct">CUARTA.- SERVICIOS.</span> Agua y luz por cuenta del arrendatario. Internet incluido.</div>',
    '<div class="cl"><span class="ct">QUINTA.- DEPÓSITO.</span> Un mes de renta como garantía.</div>',
    '<div class="cl"><span class="ct">SEXTA.- USO.</span> Exclusivamente habitacional.</div>',
    '<div class="cl"><span class="ct">SÉPTIMA.- CONSERVACIÓN.</span> El arrendatario conservará el inmueble en buen estado.</div>',
    '<div class="cl"><span class="ct">OCTAVA.- PROHIBICIONES.</span> Prohibido subarrendar o modificar estructuralmente el inmueble.</div>',
    '<div class="cl"><span class="ct">NOVENA.- RESCISIÓN.</span> Por incumplimiento de cualquiera de las obligaciones pactadas.</div>',
    '<div class="cl"><span class="ct">DÉCIMA.- AVAL.</span> El C. <strong>'+av.toUpperCase()+'</strong> funge como aval solidario del arrendatario.</div>',
    '<div class="cl"><span class="ct">DÉCIMA PRIMERA.- JURISDICCIÓN.</span> Para la interpretación y cumplimiento del presente contrato, las partes se someten a los Tribunales de Los Mochis, Sinaloa, renunciando a cualquier otro fuero.</div>',
    '<p style="margin-top:16px">Firman el <strong>'+fD(ini)+'</strong>.</p>',
    '<div class="firma-wrap">',
    '  <div class="firma-item"><div class="firma-line">RAMÓN ADOLFO ARMENTA RODRÍGUEZ<br><span class="firma-rol">Arrendador</span></div></div>',
    '  <div class="firma-item"><div class="firma-line">'+nom.toUpperCase()+'<br><span class="firma-rol">Arrendatario</span></div></div>',
    '  <div class="firma-item"><div class="firma-line">'+av.toUpperCase()+'<br><span class="firma-rol">Aval</span></div></div>',
    '</div>'
  ].join('');
  var html='<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Contrato Depto '+num+'</title><style>'+css+'</style></head><body>'+body+'</body></html>';
  var w=window.open('','_blank');
  if(!w){showToast('⚠ Permite ventanas emergentes para generar el PDF','error');return;}
  w.document.write(html);w.document.close();
  setTimeout(function(){w.print();},600);
  registrarContrato(nom,num,'PDF');
}
function registrarContrato(nom,num,formato){
  var ahora=new Date();CONTRATO_HIST.unshift({nombre:nom,depto:num,formato:formato,fecha:ahora.getDate()+'/'+(ahora.getMonth()+1)+'/'+ahora.getFullYear()});
  var ht=document.getElementById('c-hist');if(!ht)return;ht.innerHTML='';
  CONTRATO_HIST.forEach(function(c){ht.innerHTML+='<tr><td style="font-weight:500">'+c.nombre+'</td><td>Depto '+c.depto+'</td><td><span class="badge '+(c.formato==='PDF'?'badge-red':'badge-blue')+'">'+c.formato+'</span></td><td class="text-muted">'+c.fecha+'</td></tr>';});
}

// ── Los Pinos ──────────────────────────────────────────────────────────────
function savePinos(){return safeSave(db.collection('config').doc('pinos').set(PINOS),'pinos');}
function savePinosPagos(){return safeSave(db.collection('config').doc('pinosPagos').set({pagos:PINOS_PAGOS}),'pinosPagos');}

function mostrarBotonesContrato(tab){
  var bd=document.getElementById('btns-depas'),bp=document.getElementById('btns-pinos');
  if(bd)bd.style.display=tab==='depas'?'flex':'none';
  if(bp)bp.style.display=tab==='pinos'?'flex':'none';
}

function checkPinosBtn(){
  var nom=document.getElementById('p-nombre');
  var box=document.getElementById('pinos-alta-box');
  var elim=document.getElementById('pinos-elim-box');
  if(!box)return;
  var tieneInq=!!PINOS.nombre;
  box.style.display=(nom&&nom.value.trim()&&!tieneInq)?'flex':'none';
  if(elim)elim.style.display=tieneInq?'flex':'none';
}

function irAContratosPinos(){
  showPage('contratos',null);
  setTimeout(function(){
    swTab('ctab-pinos','ctabs',document.querySelector('#ctabs-nav .tab:nth-child(2)'));
    mostrarBotonesContrato('pinos');
  },100);
}

function verPinos(){
  if(!PINOS.nombre){showToast('Sin inquilino en Los Pinos','error');return;}
  try{
  var mi=MEX_MES,pp=PINOS_PAGOS[mi]||{};
  var ok=pp.pagado;
  document.getElementById('vp-nom').textContent=PINOS.nombre;
  document.getElementById('vp-sub').textContent='Los Pinos · '+fmt(PINOS.monto||22000)+'/mes';
  var telLink=PINOS.tel?'<a href="tel:'+esc(PINOS.tel)+'" style="color:inherit;text-decoration:none;font-weight:500">'+esc(PINOS.tel)+'</a>':'—';
  var fields=[
    ['Teléfono',telLink],
    ['Correo',esc(PINOS.email||'—')],
    ['Aval',esc(PINOS.aval||'—')],
    ['Duración',esc(PINOS.dur||'—')],
    ['Inicio',PINOS.ini?fmtD(PINOS.ini):'—'],
    ['Vencimiento',PINOS.fin?fmtD(PINOS.fin):'—'],
    ['Depósito',PINOS.deposito?'Sí ✓'+(PINOS.depositoMonto?' ('+fmt(PINOS.depositoMonto)+')':''):'No'],
    ['Pago mes actual',ok?'✓ Pagado':'Pendiente']
  ];
  document.getElementById('vp-info').innerHTML=fields.map(function(f){
    return '<div class="inf-row"><span class="text-muted">'+f[0]+'</span><span style="font-weight:500">'+f[1]+'</span></div>';
  }).join('');
  // INE
  var ineHtml='';
  if(PINOS.ineInqUrl){ineHtml+='<div><div class="text-muted" style="font-size:12px;margin-bottom:4px">INE Inquilino</div><img src="'+PINOS.ineInqUrl+'" style="max-width:100%;border-radius:8px;border:1px solid #eee"></div>';}
  if(PINOS.ineAvalUrl){ineHtml+='<div><div class="text-muted" style="font-size:12px;margin-bottom:4px">INE Aval</div><img src="'+PINOS.ineAvalUrl+'" style="max-width:100%;border-radius:8px;border:1px solid #eee"></div>';}
  document.getElementById('vp-ine').innerHTML=ineHtml||'<div class="text-muted center" style="padding:1rem">Sin fotos de INE</div>';
  // Historial de pagos
  var hh='';
  if(PINOS.ini&&PINOS.fin){
    var s=new Date(PINOS.ini+'T12:00:00'),e=new Date(PINOS.fin+'T12:00:00');
    var months=[];var cur=new Date(s.getFullYear(),s.getMonth(),1);
    while(cur<=e){months.push({y:cur.getFullYear(),m:cur.getMonth()});cur.setMonth(cur.getMonth()+1);}
    hh='<div class="hist-grid" style="grid-template-columns:repeat('+Math.min(months.length,6)+',1fr)">';
    months.forEach(function(cm){
      var key=mesIdx(cm.y,cm.m);var p=PINOS_PAGOS[key];var pok=p&&p.pagado;
      hh+='<div class="hist-cell '+(pok?'hist-pagado':'hist-vacio')+'" style="cursor:pointer" onclick="toggleHistPagoPinos('+key+')" title="Click para marcar/desmarcar"><div style="font-weight:500;font-size:11px">'+(pok?'✓':'—')+'</div><div style="font-size:10px">'+idxLabel(key)+'</div></div>';
    });
    hh+='</div>';
  } else {hh='<div class="text-muted" style="padding:8px 0">Sin fechas de contrato.</div>';}
  document.getElementById('vp-hist').innerHTML=hh;
  resetTabsG('vp-tabs');openModal('modal-ver-pinos');
  }catch(e){console.error('verPinos error:',e);showToast('Error al abrir Los Pinos: '+e.message,'error');}
}

function toggleHistPagoPinos(key){
  var p=PINOS_PAGOS[key];
  if(p&&p.pagado){PINOS_PAGOS[key]={pagado:false,fecha:''};}
  else{PINOS_PAGOS[key]={pagado:true,fecha:new Date().toISOString().split('T')[0]};}
  savePinosPagos();
  renderDashboard();renderDeptos();
}

function leerINEPinos(e,tipo){
  var file=e.target.files[0];if(!file)return;
  comprimirImagen(file,function(b64){
    if(tipo==='inq'){PINOS.ineInqUrl=b64;document.getElementById('p-ine-inq-prev').innerHTML='<img src="'+b64+'" class="ine-preview" style="margin-top:6px">';}
    else{PINOS.ineAvalUrl=b64;document.getElementById('p-ine-aval-prev').innerHTML='<img src="'+b64+'" class="ine-preview" style="margin-top:6px">';}
  });
}

function darDeAltaPinos(){
  var nom=document.getElementById('p-nombre').value.trim();
  if(!nom){showToast('Ingresa el nombre del inquilino','error');return;}
  PINOS={
    nombre:nom,
    aval:document.getElementById('p-aval').value.trim(),
    monto:parseFloat(document.getElementById('p-monto').value)||22000,
    dur:document.getElementById('p-dur').value,
    ini:document.getElementById('p-ini').value,
    fin:document.getElementById('p-fin').value,
    tel:document.getElementById('p-tel').value,
    email:document.getElementById('p-email').value,
    deposito:document.getElementById('p-deposito').value==='si',
    depositoMonto:parseFloat(document.getElementById('p-deposito-monto').value)||0,
    viaInmobiliaria:document.getElementById('p-inmobiliaria').checked,
    inmobMesComision:(function(){
      if(!document.getElementById('p-inmobiliaria').checked)return null;
      var iniVal=document.getElementById('p-ini').value;
      var ref=iniVal?new Date(iniVal+'T12:00:00'):new Date();
      return mesIdx(ref.getFullYear(),ref.getMonth());
    })(),
    ineInqUrl:PINOS.ineInqUrl||'',
    ineAvalUrl:PINOS.ineAvalUrl||''
  };
  savePinos();
  showToast('Los Pinos guardado','ok');
  checkPinosBtn();
  renderDeptos();renderDashboard();
}

function _archivarPinos(){
  if(!PINOS.nombre)return;
  var ahora=new Date();
  INQ_HIST.unshift(Object.assign({},PINOS,{
    num:'🏠',
    renta:PINOS.monto||22000,
    _eliminado:ahora.getDate()+'/'+(ahora.getMonth()+1)+'/'+ahora.getFullYear(),
    _esPinos:true
  }));
  saveInqHist();
}
function eliminarPinos(){
  if(!confirm('¿Dar de baja al inquilino de Los Pinos?'))return;
  _archivarPinos();
  PINOS={};PINOS_PAGOS={};
  savePinos();savePinosPagos();
  showToast('Inquilino de Los Pinos dado de baja','ok');
  checkPinosBtn();
  renderDeptos();renderDashboard();
}

function editarPinos(){
  if(!PINOS.nombre){showToast('Sin inquilino en Los Pinos','error');return;}
  document.getElementById('ep-nombre').value=PINOS.nombre||'';
  document.getElementById('ep-aval').value=PINOS.aval||'';
  document.getElementById('ep-monto').value=PINOS.monto||22000;
  document.getElementById('ep-dur').value=PINOS.dur||'UN AÑO';
  document.getElementById('ep-ini').value=PINOS.ini||'';
  document.getElementById('ep-fin').value=PINOS.fin||'';
  document.getElementById('ep-tel').value=PINOS.tel||'';
  document.getElementById('ep-email').value=PINOS.email||'';
  document.getElementById('ep-deposito').value=PINOS.deposito?'si':'no';
  document.getElementById('ep-deposito-monto').value=PINOS.depositoMonto||'';
  document.getElementById('ep-inmobiliaria').checked=!!PINOS.viaInmobiliaria;
  openModal('modal-editar-pinos');
}

function pFinEdit(){
  var ini=document.getElementById('ep-ini').value,dur=document.getElementById('ep-dur').value;
  if(!ini)return;
  var d=new Date(ini+'T12:00:00');
  var meses={'UN AÑO':12,'SEIS MESES':6,'DOS AÑOS':24};
  d.setMonth(d.getMonth()+(meses[dur]||12));
  document.getElementById('ep-fin').value=d.toISOString().split('T')[0];
}

function guardarEdicionPinos(){
  var nom=document.getElementById('ep-nombre').value.trim();
  if(!nom){showToast('Ingresa el nombre del inquilino','error');return;}
  PINOS.nombre=nom;
  PINOS.aval=document.getElementById('ep-aval').value.trim();
  PINOS.monto=parseFloat(document.getElementById('ep-monto').value)||22000;
  PINOS.dur=document.getElementById('ep-dur').value;
  PINOS.ini=document.getElementById('ep-ini').value;
  PINOS.fin=document.getElementById('ep-fin').value;
  PINOS.tel=document.getElementById('ep-tel').value;
  PINOS.email=document.getElementById('ep-email').value;
  PINOS.deposito=document.getElementById('ep-deposito').value==='si';
  PINOS.depositoMonto=parseFloat(document.getElementById('ep-deposito-monto').value)||0;
  PINOS.viaInmobiliaria=document.getElementById('ep-inmobiliaria').checked;
  savePinos();
  closeModal('modal-editar-pinos');
  showToast('Los Pinos actualizado','ok');
  renderDeptos();renderDashboard();
}

function eliminarPinosDesdeModal(){
  if(!confirm('¿Dar de baja al inquilino de Los Pinos?'))return;
  _archivarPinos();
  closeModal('modal-editar-pinos');
  PINOS={};PINOS_PAGOS={};
  savePinos();savePinosPagos();
  showToast('Inquilino de Los Pinos dado de baja','ok');
  checkPinosBtn();
  renderDeptos();renderDashboard();
}

function cargarFormPinos(){
  if(!PINOS.nombre)return;
  document.getElementById('p-nombre').value=PINOS.nombre||'';
  document.getElementById('p-aval').value=PINOS.aval||'';
  document.getElementById('p-monto').value=PINOS.monto||22000;
  document.getElementById('p-dur').value=PINOS.dur||'UN AÑO';
  document.getElementById('p-ini').value=PINOS.ini||'';
  document.getElementById('p-fin').value=PINOS.fin||'';
  document.getElementById('p-tel').value=PINOS.tel||'';
  document.getElementById('p-email').value=PINOS.email||'';
  document.getElementById('p-deposito').value=PINOS.deposito?'si':'no';
  document.getElementById('p-deposito-monto').value=PINOS.depositoMonto||'';
  document.getElementById('p-inmobiliaria').checked=!!PINOS.viaInmobiliaria;
  if(PINOS.ineInqUrl)document.getElementById('p-ine-inq-prev').innerHTML='<img src="'+PINOS.ineInqUrl+'" class="ine-preview" style="margin-top:6px">';
  if(PINOS.ineAvalUrl)document.getElementById('p-ine-aval-prev').innerHTML='<img src="'+PINOS.ineAvalUrl+'" class="ine-preview" style="margin-top:6px">';
  checkPinosBtn();
}

function pFin(){
  var ini=document.getElementById('p-ini').value,dur=document.getElementById('p-dur').value;
  if(!ini)return;
  var d=new Date(ini+'T12:00:00');
  var meses={'UN AÑO':12,'SEIS MESES':6,'DOS AÑOS':24};
  d.setMonth(d.getMonth()+(meses[dur]||12));
  document.getElementById('p-fin').value=d.toISOString().split('T')[0];
}

function guardarPinos(){
  var nom=document.getElementById('p-nombre').value.trim();
  var av=document.getElementById('p-aval').value.trim();
  var monto=parseFloat(document.getElementById('p-monto').value)||22000;
  var dur=document.getElementById('p-dur').value;
  var ini=document.getElementById('p-ini').value;
  var fin=document.getElementById('p-fin').value;
  if(!nom){showToast('Ingresa el nombre del inquilino','error');return;}
  PINOS={nombre:nom,aval:av,monto:monto,dur:dur,ini:ini,fin:fin};
  savePinos();
  showToast('Los Pinos guardado','ok');
  renderPinos();
}

function marcarPagoPinos(mi){
  PINOS_PAGOS[mi]={pagado:true,fecha:new Date().toISOString().split('T')[0]};
  savePinosPagos();renderDashboard();renderDeptos();
}
function desmarcarPagoPinos(mi){
  PINOS_PAGOS[mi]={pagado:false,fecha:''};
  savePinosPagos();renderDashboard();renderDeptos();
}

function renderPinos(){
  // Llenar form con datos guardados
  if(PINOS.nombre){
    document.getElementById('p-nombre').value=PINOS.nombre||'';
    document.getElementById('p-aval').value=PINOS.aval||'';
    document.getElementById('p-monto').value=PINOS.monto||22000;
    document.getElementById('p-dur').value=PINOS.dur||'UN AÑO';
    document.getElementById('p-ini').value=PINOS.ini||'';
    document.getElementById('p-fin').value=PINOS.fin||'';
  }
  // Tabla de pagos
  var list=document.getElementById('pinos-pagos-list');if(!list)return;
  if(!PINOS.nombre||!PINOS.ini){list.innerHTML='<div class="text-muted" style="font-size:13px">Guarda un inquilino para ver los pagos.</div>';return;}
  var ini=new Date(PINOS.ini+'T12:00:00');
  var fin=PINOS.fin?new Date(PINOS.fin+'T12:00:00'):new Date(ini.getFullYear()+1,ini.getMonth(),ini.getDate());
  var hoy=new Date();
  var rows='<table class="tbl"><thead><tr><th>Mes</th><th>Renta</th><th>Estado</th><th></th></tr></thead><tbody>';
  var cur=new Date(ini.getFullYear(),ini.getMonth(),1);
  var limit=new Date(fin.getFullYear(),fin.getMonth(),1);
  while(cur<=limit){
    var mi=mesIdx(cur.getFullYear(),cur.getMonth());
    var label=MS_FULL[cur.getMonth()]+' '+cur.getFullYear();
    var p=PINOS_PAGOS[mi]||{};
    var esFuturo=cur>new Date(hoy.getFullYear(),hoy.getMonth(),1);
    var badge,accion;
    if(p.pagado){
      badge='<span class="badge badge-green">✓ Pagado'+(p.fecha?' · '+fmtD(p.fecha):'')+'</span>';
      accion='<button class="btn btn-xs btn-danger" onclick="desmarcarPagoPinos('+mi+')"><i class="ti ti-rotate-left"></i> Deshacer</button>';
    } else if(esFuturo){
      badge='<span class="badge badge-gray">Próximo</span>';
      accion='';
    } else {
      badge='<span class="badge badge-amber">Pendiente</span>';
      accion='<button class="btn btn-xs btn-primary" onclick="marcarPagoPinos('+mi+')">Marcar pagado</button>';
    }
    rows+='<tr><td>'+label+'</td><td>'+fmt(PINOS.monto||22000)+'</td><td>'+badge+'</td><td>'+accion+'</td></tr>';
    cur.setMonth(cur.getMonth()+1);
  }
  rows+='</tbody></table>';
  list.innerHTML=rows;
}

function genContratoPinos(){
  var nom=document.getElementById('p-nombre').value.trim()||'___________________________';
  var av=document.getElementById('p-aval').value.trim()||'___________________________';
  var monto=parseFloat(document.getElementById('p-monto').value)||22000;
  var dur=document.getElementById('p-dur').value||'UN AÑO';
  var ini=document.getElementById('p-ini').value||'';
  var fin=document.getElementById('p-fin').value||'';
  var btn=document.getElementById('btn-pinos-docx'),orig=btn.innerHTML;
  btn.innerHTML='<div class="loading-dots"><span></span><span></span><span></span></div> Generando…';btn.disabled=true;
  try{
    var docxLib=window.docx;
    var Document=docxLib.Document,Packer=docxLib.Packer,Paragraph=docxLib.Paragraph,TextRun=docxLib.TextRun,AlignmentType=docxLib.AlignmentType;
    var MESES_UP=['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
    var MESES_N=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    function fmtF(iso){if(!iso)return{dia:'___',mes:'___',mesUp:'___',anio:'____'};var d=new Date(iso+'T12:00:00');return{dia:d.getDate(),mes:MESES_N[d.getMonth()],mesUp:MESES_UP[d.getMonth()],anio:d.getFullYear()};}
    function n2l(n){var m={15000:'QUINCE MIL',16000:'DIECISÉIS MIL',17000:'DIECISIETE MIL',18000:'DIECIOCHO MIL',19000:'DIECINUEVE MIL',20000:'VEINTE MIL',21000:'VEINTIÚN MIL',22000:'VEINTIDÓS MIL',23000:'VEINTITRÉS MIL',24000:'VEINTICUATRO MIL',25000:'VEINTICINCO MIL',26000:'VEINTISÉIS MIL',27000:'VEINTISIETE MIL',28000:'VEINTIOCHO MIL',29000:'VEINTINUEVE MIL',30000:'TREINTA MIL'};return m[n]||String(n);}
    function mTxt(n){return'$'+n.toLocaleString('es-MX',{minimumFractionDigits:2})+' (SON '+n2l(n)+' PESOS 00/100 M. N.)';}
    var fi=fmtF(ini),ff=fmtF(fin);
    var NI=nom.toUpperCase(),NA=av.toUpperCase();
    var mStr=mTxt(monto);
    var R={font:'Arial',size:22,color:'000000'};
    var RB=Object.assign({},R,{bold:true});
    var sp={line:260,lineRule:'auto'};
    function p(runs,center,kn){return new Paragraph({alignment:center?AlignmentType.CENTER:AlignmentType.BOTH,spacing:sp,keepNext:!!kn,children:runs.map(function(r){return new TextRun(Object.assign({},R,r));})});}
    function gap(kn){return new Paragraph({spacing:{before:60,after:60},keepNext:!!kn,children:[new TextRun(Object.assign({text:''},R))]});}
    function firma(label,nombre){return[
      new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:900,after:0},keepNext:true,keepLines:true,children:[new TextRun(Object.assign({text:'_'.repeat(45)},R))]}),
      new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:60,after:0},keepNext:true,keepLines:true,children:[new TextRun(Object.assign({text:label},RB))]}),
      new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:40,after:0},keepLines:true,children:[new TextRun(Object.assign({text:nombre},R))]})
    ];}
    var children=[
      p([{text:'CONTRATO DE ARRENDAMIENTO QUE EN LA CIUDAD DE LOS MOCHIS, SINALOA, DE LOS ESTADOS UNIDOS MEXICANOS, CELEBRAN HOY '+fi.dia+' DE '+fi.mesUp+' DEL AÑO '+fi.anio+', POR UNA PARTE, EL SEÑOR RAMON ADOLFO ARMENTA RODRIGUEZ, A QUIEN EN LO SUCESIVO SE LE DESIGNARÁ EL ARRENDADOR Y POR LA OTRA PARTE LA C. '},{text:NI,bold:true},{text:', A QUIEN EN LO SUCESIVO SE LE DENOMINARA EL ARRENDATARIO, MISMO QUE SUJETAN BAJO LAS SIGUIENTES DECLARACIONES Y CLAUSULAS:'}]),
      gap(),p([{text:'DE C L A R A C I O N E S'}],true),gap(),
      p([{text:'PRIMERA.- Declara EL SEÑOR RAMON ADOLFO ARMENTA RODRIGUEZ en su carácter de arrendador, que es legítimo propietario de una finca urbana compuesta de solar con una construcción tipo casa habitación, de dos pisos, ubicado en calle Rodolfo T. Loaiza número 1693 poniente, fraccionamiento Los Pinos, de esta ciudad de Los Mochis, Sinaloa, la cual cuenta con cochera techada con acceso de portón eléctrico, asimismo, en el primer piso cuenta con áreas de sala, comedor, cocina, un área tipo bodega, un cuarto tipo habitación, así como un baño completo, y en la parte trasera cuenta con un área tipo patio.'}]),
      gap(),
      p([{text:'Se precisa que el área de sala cuenta con un aire acondicionado tipo minisplit de dos toneladas marca mirage, el área de cocina esta equipada con todos los muebles necesarios que la componen, incluyendo estufa con campana, horno, microondas, refrigerador; el cuarto tipo habitación cuenta con closet y con un aire acondicionado tipo minisplit de una tonelada marca mirage; en la parte trasera cuenta con área tipo patio cuenta con lavadero, un centro de lavado electrónico (lavadora y secadora) marca mabe, así como un boiler eléctrico.'}]),
      gap(),
      p([{text:'En el segundo piso cuenta con dos habitaciones equipadas cada una de ellas con closet de madera, así como con un aire acondicionado tipo minisplit de una tonelada marca mirage, precisando que uno de ellos cuenta en su interior con un baño completo, mientras que al exterior de ambos cuartos tipo habitación, también se cuenta con un baño completo.'}]),
      gap(),
      p([{text:'El exterior en su parte frontal cuenta con cámaras de videovigilancia, y en el área de techo cuenta con tanque para gas estacionario de 100 litros.'}]),
      gap(),
      p([{text:'El inmueble cuenta con los servicios de internet inalámbrico, energía eléctrica y agua potable, de los cuales se da en arrendamiento mediante contrato que se celebra al tenor de las siguientes:'}]),
      gap(),p([{text:'C L A U S U L A S:'}],true),gap(),
      p([{text:'PRIMERA.- Por medio del presente instrumento y en este acto EL SEÑOR RAMON ADOLFO ARMENTA RODRIGUEZ, da en arrendamiento a '},{text:NI,bold:true},{text:', y esta toma de aquella en arrendamiento el bien inmueble descrito debidamente en el punto primero de declaraciones.'}]),
      gap(),p([{text:'SEGUNDO.- El término de duración del presente contrato de arrendamiento, se fija por las partes por '},{text:dur,bold:true},{text:', contados a partir de este día '},{text:fi.dia+' DE '+fi.mesUp+' DEL AÑO '+fi.anio,bold:true},{text:', para concluir el mismo día '},{text:ff.dia+' DE '+ff.mesUp+' DEL AÑO '+ff.anio,bold:true},{text:', sin necesidad de desahucio ni de ningún aviso previo, pues el arrendatario renuncia expresamente a la prórroga de que trata el artículo 2367 del Código Civil para el Estado de Sinaloa.'}]),
      gap(),p([{text:'TERCERO.- La C. '},{text:NI,bold:true},{text:', se obliga a pagar y pagará a EL SEÑOR RAMON ADOLFO ARMENTA RODRIGUEZ, en el domicilio particular del Arrendador, sito en Calle Montaña Número 1862 Poniente, del Fraccionamiento Real del Country, de esta ciudad de Los Mochis Sinaloa, domicilio que los contratantes convienen en fijar para el pago y recepción de las pensiones rentísticas, sin necesidad de previo requerimiento judicial o extrajudicial, por el uso y goce temporal del bien inmueble precisado anteriormente, a partir de este día '},{text:fi.dia+' DE '+fi.mesUp+' DEL AÑO '+fi.anio,bold:true},{text:' y hasta el día '},{text:ff.dia+' DE '+ff.mesUp+' DEL AÑO '+ff.anio,bold:true},{text:', la cantidad de '+mStr+', por mensualidad adelantada dentro de los primeros cinco días del mes en turno, asimismo, se manifiesta que a la firma del presente instrumento el arrendatario deja en calidad de depósito la cantidad de '+mStr+', mismos, se quedaran en garantía en caso de daños o incumplimiento del contrato, con independencia de los gastos extras que esto pueda generar.'}]),
      gap(),p([{text:'CUARTO.- Ambas partes convienen que el precio de arrendamiento mientras dure la vigencia del presente contrato de arrendamiento, por acuerdo de las partes, será incrementado en un 10% por cada año que se acuerde que se siga ocupando la finca arrendada y así sucesivamente se tendrá un nuevo precio de renta por cada año de vigencia tomando como base el precio vigente inmediato anterior.'}]),
      gap(),p([{text:'QUINTO.- Toda mensualidad será pagada íntegra aun cuando el arrendatario tan solo ocupe la cosa arrendada en todo o en parte de ella o parte del mes correspondiente, precisándose que en caso que el arrendatario abandone o desocupe el inmueble incumpliendo con la temporalidad del año por el cual se pactó el presente contrato, o cualquier otra forma de incumplimiento al mismo, no tendrá derecho a la devolución de la cantidad de '+mStr+', mismos que quedan en garantía en caso de daños o incumplimiento del contrato.'}]),
      gap(),p([{text:'SEXTO.- La cosa inmueble materia del presente contrato de arrendamiento se destinará por el arrendatario, en todas y cada una de sus partes como casa-habitación, quedándole estrictamente prohibido destinarlo para cualquier otro fin, siendo esto una causa especial de rescisión del presente contrato.'}]),
      gap(),p([{text:'SÉPTIMA.- No podrá el arrendatario La C.'},{text:NI,bold:true},{text:', sub-arrendar en todo ni en parte la cosa inmueble que se da en arrendamiento como tampoco ceder en todo o en parte los derechos que adquiera sobre este, sin previo consentimiento otorgado por escrito del arrendador.'}]),
      gap(),p([{text:'OCTAVA.- El arrendatario, '},{text:NI,bold:true},{text:', recibe con esta fecha la cosa inmueble que renta en buen estado de uso y se obliga a cuidar de su conservación, como si se tratase de cosa propia, así como a devolverlo en buen estado a la arrendadora sin más deterioro que el que cause el uso normal o natural de la cosa.'}]),
      gap(),p([{text:'NOVENA.- Los servicios de energía eléctrica, agua potable o cualquier otro servicio que consuma el arrendatario '},{text:NI,bold:true},{text:', en la cosa inmueble objeto de este arrendamiento, serán por cuenta exclusiva de ésta y se obliga a pagarlos puntualmente a las empresas que se los suministren, con excepción del pago del servicio de internet que este queda a cargo del arrendador, en la empresa que estime conveniente y de acuerdo a sus intereses.'}]),
      gap(),p([{text:'DÉCIMA.- El arrendador concede el uso del arrendatario de todo el equipamiento con el que cuenta la casa habitación, entre ellos el centro de lavado marca mabe, consistente en lavadora y secadora de ropa, refrigerador, estufa con campana, microondas, horno, cuatro aires acondicionados, cámaras de videovigilancia, boiler, tanque de gas, dos controles de cierre y apertura eléctrica del portón electrónico de acceso a inmueble, mismos que se encuentran en estado nuevo de uso y el arrendatario se obliga a cuidar de su conservación, como si se tratase de cosa propia.'}]),
      gap(),p([{text:'DÉCIMA PRIMERA.- El arrendatario se compromete que de ser el caso de hacer un mal uso, negligente o con falta de cuidado, se hará responsable de cubrir los gastos que genere su reparación o bien su restitución. Precisándose que el arrendatario tiene un mes a partir del inicio del presente contrato para señalar al arrendador vicios ocultos en el inmueble así como en los objetos que lo equipan descritos en las declaraciones del presente contrato, y en caso de no hacerlo, o bien transcurrido el primer mes de vigencia de este contrato, todo arreglo o desperfecto quedara a cargo del arrendatario quien se obliga a cubrir los gastos que genere su reparación o restitución.'}]),
      gap(),p([{text:'DÉCIMA SEGUNDA.- El Arrendatario, será responsable de cualquier problema de carácter legal relacionado con la actividad para la cual fue rentado el inmueble, que pudiera suscitarse, ya sea de carácter civil, penal, laboral, administrativo, etc. Por lo que él en lo personal responderá por el mal uso que llegare a darle al inmueble arrendado en caso de verse involucrado en cualquier situación de la naturaleza arriba asentada.'}]),
      gap(),p([{text:'DÉCIMA TERCERA.- La C. '},{text:NA,bold:true},{text:', se constituye como aval de '},{text:NI,bold:true},{text:', respondiendo íntegramente de todas las obligaciones pactadas en el presente acto contractual.'}]),
      gap(),p([{text:'DÉCIMA CUARTA.- Ambas partes contratantes se someten expresamente a la jurisdicción de los Tribunales de la ciudad de Los Mochis, Ahome, Sinaloa, México, para todo lo relativo a las cuestiones que se susciten sobre la interpretación y cumplimiento de este contrato renunciando al privilegio en forma expresa de su domicilio presente o futuro por cuanto esto no fuere la ciudad de Los Mochis, Ahome, Sinaloa, México.'}]),
      gap(),
      p([{text:'LEIDO Y EXPLICADO EL PRESENTE CONTRATO DE ARRENDAMIENTO ENTRE LAS PARTES Y ENTERADOS DE SU ALCANCE Y CONSECUENCIAS LEGALES, SE MANIFIESTAN CONFORMES CON EL, MISMO QUE LO FIRMAN PARA LOS EFECTOS LEGALES QUE CORRESPONDAN.'}],false,true),
      gap(true),
    ].concat(firma('EL ARRENDADOR','RAMON ADOLFO ARMENTA RODRIGUEZ')).concat(firma('EL ARRENDATARIO',nom)).concat(firma('EL AVAL',av));
    var doc=new Document({sections:[{properties:{page:{size:{width:12240,height:15840},margin:{top:1134,right:1134,bottom:1134,left:1134}}},children:children}]});
    Packer.toBlob(doc).then(function(blob){
      var url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='contrato_pinos_'+nom.split(' ')[0].toUpperCase()+'.docx';a.click();URL.revokeObjectURL(url);
      btn.innerHTML=orig;btn.disabled=false;
      showToast('Contrato Los Pinos generado','ok');
    }).catch(function(e){
      document.getElementById('pinos-msg').innerHTML='<div class="alert-banner alert-amber">Error: '+e.message+'</div>';
      btn.innerHTML=orig;btn.disabled=false;
    });
  }catch(e){
    document.getElementById('pinos-msg').innerHTML='<div class="alert-banner alert-amber">Error: '+e.message+'</div>';
    btn.innerHTML=orig;btn.disabled=false;
  }
}

// ── Mantenimiento ──────────────────────────────────────────────────────────
function mantKey(type,id){return type+'_'+id;}
function getMantYears(key){if(!MANT_STATE[key])MANT_STATE[key]={};return MANT_STATE[key];}
function toggleMant(key,year){
  if(!MANT_STATE[key])MANT_STATE[key]={};
  if(MANT_STATE[key][year]){delete MANT_STATE[key][year];delete MANT_STATE[key][year+'_fecha'];}
  else{var hoy=new Date();MANT_STATE[key][year]=true;MANT_STATE[key][year+'_fecha']=MS_FULL[hoy.getMonth()]+' '+hoy.getFullYear();}
  saveMant();renderMantenimiento();
}
function mkChipBtn(key,year,label,small){
  var done=getMantYears(key)[year]||false,fecha=getMantYears(key)[year+'_fecha']||'';
  var bg=done?'#1D9E75':'#f0f0ee',col=done?'#fff':'#6b6b6b',brd=done?'#1D9E75':'#ddd';
  var p=small?'3px 10px':'5px 14px',fs=small?'11px':'12px';
  var txt=done?(small?'✓ '+label:'✓ '+label+(fecha?' · <span style="font-size:10px;opacity:.85">'+fecha+'</span>':'')):label;
  return '<button onclick="toggleMant(\''+key+'\','+year+')" style="background:'+bg+';color:'+col+';border:1px solid '+brd+';border-radius:20px;padding:'+p+';cursor:pointer;font-size:'+fs+';font-family:inherit;font-weight:500">'+txt+'</button>';
}
function renderMantenimiento(){
  var CUR=2026,YEARS=[2025,2026,2027];
  // Aires — chips actuales
  var airesC=document.getElementById('aires-chips');if(!airesC)return;
  airesC.innerHTML='';
  for(var i=1;i<=8;i++){airesC.innerHTML+=mkChipBtn(mantKey('aire',i),CUR,'Depto '+i,false);}
  // Aires — historial colapsable
  var airesH=document.getElementById('aires-hist-inner');if(airesH){
    airesH.innerHTML='';
    YEARS.forEach(function(y){
      var g='<div style="margin-bottom:10px"><div style="font-size:11px;color:#999;margin-bottom:6px;font-weight:600">'+y+'</div><div style="display:flex;flex-wrap:wrap;gap:6px">';
      for(var j=1;j<=8;j++)g+=mkChipBtn(mantKey('aire',j),y,'D'+j,true);
      airesH.innerHTML+=g+'</div></div>';
    });
  }
  // Lavadoras — lista actual
  var lavL=document.getElementById('lavadoras-list');if(!lavL)return;lavL.innerHTML='';
  MANT_LAVADORAS.forEach(function(loc,idx){
    var key=mantKey('lavadora',loc.replace(/ /g,'_'));
    var border=idx<MANT_LAVADORAS.length-1?'border-bottom:1px solid #f0f0ee':'';
    lavL.innerHTML+='<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 0;'+border+'"><span style="font-size:13px">'+loc+'</span>'+mkChipBtn(key,CUR,loc,false)+'</div>';
  });
  // Lavadoras — historial
  var lavH=document.getElementById('lav-hist-inner');if(lavH){
    lavH.innerHTML='';
    YEARS.forEach(function(y){
      var g='<div style="margin-bottom:8px"><div style="font-size:11px;color:#999;font-weight:600;margin-bottom:4px">'+y+'</div>';
      MANT_LAVADORAS.forEach(function(loc){
        var key=mantKey('lavadora',loc.replace(/ /g,'_'));
        g+='<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f5f5f3"><span style="font-size:12px">'+loc+'</span>'+mkChipBtn(key,y,loc,true)+'</div>';
      });
      lavH.innerHTML+=g+'</div>';
    });
  }
  // Infraestructura — lista actual
  var infraL=document.getElementById('infra-list');if(!infraL)return;infraL.innerHTML='';
  MANT_INFRA.forEach(function(item,idx){
    var key=mantKey('infra',item.key);
    var border=idx<MANT_INFRA.length-1?'border-bottom:1px solid #f0f0ee':'';
    infraL.innerHTML+='<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 0;'+border+'"><div><span style="font-size:13px;font-weight:500">'+item.label+'</span><span style="font-size:11px;color:#999;margin-left:8px">'+item.freq+'</span></div>'+mkChipBtn(key,CUR,item.label,false)+'</div>';
  });
  // Infraestructura — historial
  var infraH=document.getElementById('infra-hist-inner');if(infraH){
    infraH.innerHTML='';
    YEARS.forEach(function(y){
      var g='<div style="margin-bottom:8px"><div style="font-size:11px;color:#999;font-weight:600;margin-bottom:4px">'+y+'</div>';
      MANT_INFRA.forEach(function(item){
        var key=mantKey('infra',item.key);
        g+='<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f5f5f3"><span style="font-size:12px">'+item.label+'</span>'+mkChipBtn(key,y,item.label,true)+'</div>';
      });
      infraH.innerHTML+=g+'</div>';
    });
  }
  // Notas
  renderMantNotas();
}

function renderMantNotas(){
  var el=document.getElementById('mant-notas-list');if(!el)return;
  if(!MANT_NOTAS.length){el.innerHTML='<div style="font-size:13px;color:#999;padding:4px 0">Sin notas aún</div>';return;}
  el.innerHTML=MANT_NOTAS.map(function(n,i){
    return '<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:8px 0;border-bottom:1px solid #f0f0ee;gap:8px">'+
      '<div><div style="font-size:13px">'+esc(n.texto)+'</div><div style="font-size:11px;color:#999;margin-top:2px">'+esc(n.fecha)+'</div></div>'+
      '<button style="background:none;border:none;cursor:pointer;color:#ccc;font-size:14px;padding:0 4px;flex-shrink:0" onclick="eliminarNotaMant('+i+')" title="Eliminar">✕</button>'+
    '</div>';
  }).join('');
}
function agregarNotaMant(){
  var inp=document.getElementById('mant-nota-inp');
  var texto=inp?inp.value.trim():'';
  if(!texto)return;
  var fecha=new Date().toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'});
  MANT_NOTAS.unshift({texto:texto,fecha:fecha});
  inp.value='';
  try{saveMantNotas();}catch(e){}
  renderMantNotas();
}
function eliminarNotaMant(i){
  if(!confirm('¿Eliminar esta nota?'))return;
  MANT_NOTAS.splice(i,1);
  try{saveMantNotas();}catch(e){}
  renderMantNotas();
}

// Días reales en un mes
function diasEnMes(y, m) { return new Date(y, m + 1, 0).getDate(); }
// Día efectivo de pago: si diaPago > días del mes, usa el último día
function diaEfectivo(diaPago, y, m) { return Math.min(diaPago, diasEnMes(y, m)); }
// Siempre paga en el mes actual — mesDePago es siempre MEX_MES
function mesDePago() { return MEX_MES; }

// ── Pago actions ───────────────────────────────────────────────────────────
function marcarPagado(num){
  var d=DEPTOS.find(function(x){return x.num===num;});if(!d)return;
  var mi=mesDePago(d.diaPago);
  if(!PAGOS[num])PAGOS[num]={};
  var hoy=new Date().toISOString().split('T')[0];
  var pago={pagado:true,forma:'Transferencia SPEI',monto:d.renta,fecha:hoy};
  PAGOS[num][mi]=pago;savePago(num,mi,pago);renderAll();
}
function desmarcarPago(num){
  var d=DEPTOS.find(function(x){return x.num===num;});if(!d)return;
  var mi=mesDePago(d.diaPago);
  if(PAGOS[num])delete PAGOS[num][mi];deletePago(num,mi);renderAll();
}

// ── Inquilino CRUD ─────────────────────────────────────────────────────────
function editarInq(idx){
  editIdx=idx; var d=DEPTOS[idx];
  document.getElementById('mi-title').textContent='Editar — Depto '+d.num;
  var sel=document.getElementById('f-depto');
  sel.innerHTML='<option value="'+d.num+'">Depto '+d.num+' (actual)</option>';
  VACIOS.forEach(function(n){sel.innerHTML+='<option value="'+n+'">Depto '+n+'</option>';});
  sel.value=d.num;
  document.getElementById('f-nombre').value=d.nombre||'';document.getElementById('f-tel').value=d.tel||'';document.getElementById('f-email').value=d.email||'';
  document.getElementById('f-curp').value=d.curp||'';document.getElementById('f-nac').value=d.nacimiento||'';document.getElementById('f-contrato').value=d.contrato||'6 meses';
  document.getElementById('f-inicio').value=d.inicio||'';
  document.getElementById('f-renta').value=d.renta||5000;document.getElementById('f-dia').value=d.diaPago||1;document.getElementById('f-ocup').value=d.ocupacion||'';
  document.getElementById('f-dom').value=d.domicilio||'';document.getElementById('f-dep').value=d.deposito?'Sí, pagado':'No';document.getElementById('f-notas').value=d.notas||'';
  document.getElementById('f-inmobiliaria').checked=!!d.viaInmobiliaria;
  var a=d.aval||{};
  document.getElementById('a-nombre').value=a.nombre||'';document.getElementById('a-par').value=a.parentesco||'';document.getElementById('a-tel').value=a.tel||'';
  document.getElementById('a-email').value=a.email||'';document.getElementById('a-curp').value=a.curp||'';document.getElementById('a-calle').value=a.calle||'';
  document.getElementById('a-col').value=a.colonia||'';document.getElementById('a-ciudad').value=a.ciudad||'';document.getElementById('a-estado').value=a.estado||'';
  document.getElementById('a-cp').value=a.cp||'';document.getElementById('a-prop').value=a.propiedad||'Sí';document.getElementById('a-prop-dir').value=a.propDir||'';
  document.getElementById('a-notas').value=a.notas||'';
  _inePanelEditArea('inq');_inePanelEditArea('aval');
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
  var mesesMapModal={'1 mes':1,'2 meses':2,'3 meses':3,'4 meses':4,'5 meses':5,'6 meses':6,'7 meses':7,'8 meses':8,'9 meses':9,'10 meses':10,'11 meses':11,'1 año':12,'Mensual':1};
  var mesesN=mesesMapModal[contrato]||6;
  var prevD=DEPTOS[editIdx];
  var finDate=prevD.finDate||'',finStr=prevD.finStr||'—';
  if(inicio){var fd=new Date(inicio+'T12:00:00');fd.setMonth(fd.getMonth()+mesesN);finDate=fd.toISOString().split('T')[0];finStr=fd.getDate()+' '+MS[fd.getMonth()]+' '+fd.getFullYear();}
  var aval={nombre:document.getElementById('a-nombre').value,parentesco:document.getElementById('a-par').value,tel:document.getElementById('a-tel').value,email:document.getElementById('a-email').value,curp:document.getElementById('a-curp').value,calle:document.getElementById('a-calle').value,colonia:document.getElementById('a-col').value,ciudad:document.getElementById('a-ciudad').value,estado:document.getElementById('a-estado').value,cp:document.getElementById('a-cp').value,propiedad:document.getElementById('a-prop').value,propDir:document.getElementById('a-prop-dir').value,notas:document.getElementById('a-notas').value};
  var oldNum=DEPTOS[editIdx].num;
  var newNum=parseInt(document.getElementById('f-depto').value)||oldNum;
  var viaInmob=document.getElementById('f-inmobiliaria').checked;
  var obj={num:newNum,nombre:nombre,renta:renta,diaPago:dia,contrato:contrato,inicio:inicio||prevD.inicio||'',finDate:finDate,finStr:finStr,deposito:document.getElementById('f-dep').value==='Sí, pagado',viaInmobiliaria:viaInmob,inmobMesComision:viaInmob?(prevD.inmobMesComision!=null?prevD.inmobMesComision:null):null,tel:document.getElementById('f-tel').value,email:document.getElementById('f-email').value,curp:document.getElementById('f-curp').value,nacimiento:document.getElementById('f-nac').value,ocupacion:document.getElementById('f-ocup').value,domicilio:document.getElementById('f-dom').value,notas:document.getElementById('f-notas').value,ineInqUrl:DEPTOS[editIdx].ineInqUrl||'',ineAvalUrl:DEPTOS[editIdx].ineAvalUrl||'',bitacora:DEPTOS[editIdx].bitacora||[],aval:aval};
  if(newNum!==oldNum){delDepto(oldNum);VACIOS=VACIOS.filter(function(v){return v!==newNum;});VACIOS.push(oldNum);VACIOS.sort(function(a,b){return a-b;});}
  DEPTOS[editIdx]=obj;saveDepto(obj);closeModal('modal-inq');renderAll();
}
function _inePanel(tipo,d,idx){
  var label=tipo==='inq'?'INE inquilino':'INE aval';
  var url=tipo==='inq'?d.ineInqUrl:d.ineAvalUrl;
  var html='<div><div class="section-label" style="margin-top:0">'+label+'</div>';
  if(url){
    html+='<img src="'+url+'" class="ine-preview" style="margin-bottom:8px">';
    html+='<div style="display:flex;gap:6px;margin-top:4px">';
    html+='<button class="btn btn-sm" onclick="descargarINE(\''+tipo+'\','+idx+')"><i class="ti ti-download"></i> Descargar</button>';
    html+='<button class="btn btn-sm btn-danger" onclick="borrarINE(\''+tipo+'\','+idx+')"><i class="ti ti-trash"></i> Borrar</button>';
    html+='</div>';
  } else {
    html+='<div style="padding:12px 0">';
    html+='<label class="btn btn-sm" style="cursor:pointer"><i class="ti ti-upload"></i> Subir foto <input type="file" accept="image/*" style="display:none" onchange="subirINEVer(event,\''+tipo+'\','+idx+')"></label>';
    html+='</div>';
  }
  html+='</div>';
  return html;
}
function descargarINE(tipo,idx){
  var d=DEPTOS[idx];if(!d)return;
  var url=tipo==='inq'?d.ineInqUrl:d.ineAvalUrl;if(!url)return;
  var a=document.createElement('a');
  a.href=url;
  a.download='INE_'+d.nombre.replace(/\s+/g,'_')+'_'+(tipo==='inq'?'inquilino':'aval')+'.jpg';
  document.body.appendChild(a);a.click();document.body.removeChild(a);
}
function borrarINE(tipo,idx){
  if(!confirm('¿Borrar foto del INE?'))return;
  var d=DEPTOS[idx];if(!d)return;
  borrarINEDeStorage(d.num,tipo,function(){
    document.getElementById('vi-ine').innerHTML=_inePanel('inq',d,idx)+_inePanel('aval',d,idx);
    showToast('Foto INE eliminada','ok');
  });
}
function subirINEVer(event,tipo,idx){
  var file=event.target.files[0];if(!file)return;
  var d=DEPTOS[idx];if(!d)return;
  var viIne=document.getElementById('vi-ine');
  if(viIne)viIne.innerHTML='<div style="padding:16px;color:#6b6b6b;font-size:13px">Comprimiendo foto…</div>';
  comprimirImagen(file,
    function(b64){
      if(tipo==='inq')d.ineInqUrl=b64;else d.ineAvalUrl=b64;
      saveDepto(d);
      document.getElementById('vi-ine').innerHTML=_inePanel('inq',d,idx)+_inePanel('aval',d,idx);
      showToast('✓ Foto INE guardada','ok');
    },
    function(){
      document.getElementById('vi-ine').innerHTML=_inePanel('inq',d,idx)+_inePanel('aval',d,idx);
      showToast('Error al procesar la imagen','error');
    }
  );
}
function verInq(idx){
  var d=DEPTOS[idx];
  document.getElementById('vi-av').className='avatar-lg '+AVS[idx%5];document.getElementById('vi-av').textContent=avI(d.nombre);
  document.getElementById('vi-nom').textContent=d.nombre;document.getElementById('vi-sub').textContent='Depto '+d.num+' · '+d.contrato+' · '+fmt(d.renta)+'/mes';
  document.getElementById('vi-edit').onclick=function(){editarInq(idx);};
  // Días restantes en modal ver
  var diasLabel='—';
  if(d.finDate){var finV=new Date(d.finDate+'T12:00:00'),diasV=Math.ceil((finV-new Date())/(1000*60*60*24));diasLabel=diasV<0?'⚠ Vencido':diasV+' días restantes';}
  var telLink=d.tel?'<a href="tel:'+esc(d.tel)+'" style="color:inherit;text-decoration:none;font-weight:500">'+esc(d.tel)+'</a>':'—';
  var fields=[['Teléfono',telLink],['Correo',esc(d.email||'—')],['Nacimiento',esc(d.nacimiento||'—')],['Ocupación',esc(d.ocupacion||'—')],['Depósito',d.deposito?'Sí ✓':'No'],['Día de pago','Día '+d.diaPago],['Vence',esc(d.finStr||'—')+(d.finDate?' ('+diasLabel+')':'')],['Domicilio',esc(d.domicilio||'—')],['Notas',esc(d.notas||'—')]];
  document.getElementById('vi-info').innerHTML=fields.map(function(f){return '<div class="inf-row"><span class="text-muted">'+f[0]+'</span><span style="font-weight:500">'+f[1]+'</span></div>';}).join('');
  var a=d.aval||{};
  var avalTelLink=a.tel?'<a href="tel:'+esc(a.tel)+'" style="color:inherit;text-decoration:none;font-weight:500">'+esc(a.tel)+'</a>':'—';
  var avalDom=esc((a.calle||'')+' '+(a.colonia||'')+' '+(a.ciudad||'')+', '+(a.estado||'').trim()||'—');
  document.getElementById('vi-aval').innerHTML=a.nombre?'<div class="flex gap-8 mb-12">'+avEl(a.nombre,idx+1)+'<div><div style="font-weight:500">'+esc(a.nombre)+'</div><div class="text-muted">'+esc(a.parentesco||'—')+'</div></div></div>'+[['Tel',avalTelLink],['Correo',esc(a.email||'—')],['Domicilio',avalDom]].map(function(f){return '<div class="inf-row"><span class="text-muted">'+f[0]+'</span><span style="font-weight:500">'+f[1]+'</span></div>';}).join(''):'<div class="text-muted center" style="padding:1rem">Sin datos de aval</div>';
  var contractMonths=getContractMonths(d),hh='';
  if(!contractMonths.length){hh='<div class="text-muted" style="padding:8px 0">Sin fechas de contrato.</div>';}
  else{hh='<div class="hist-grid" style="grid-template-columns:repeat('+Math.min(contractMonths.length,6)+',1fr)">';contractMonths.forEach(function(cm){var p=PAGOS[d.num]&&PAGOS[d.num][cm.key];hh+='<div class="hist-cell '+(p&&p.pagado?'hist-pagado':'hist-vacio')+'" style="cursor:pointer" onclick="toggleHistPago('+d.num+','+cm.key+')" title="Click para marcar/desmarcar"><div style="font-weight:500;font-size:11px">'+(p&&p.pagado?'✓':'—')+'</div><div style="font-size:10px">'+cm.label+'</div></div>';});hh+='</div>';}
  document.getElementById('vi-hist').innerHTML=hh;
  document.getElementById('vi-ine').innerHTML=_inePanel('inq',d,idx)+_inePanel('aval',d,idx);
  _bitacoraIdx=idx;renderBitacora();
  resetTabsG('vi-tabs');openModal('modal-ver');
}

// ── INE — modal Editar ────────────────────────────────────────────────────
function _inePanelEditArea(tipo){
  var d=DEPTOS[editIdx];if(!d)return;
  var url=tipo==='inq'?d.ineInqUrl:d.ineAvalUrl;
  var el=document.getElementById('ine-'+tipo+'-prev');if(!el)return;
  if(url){
    el.innerHTML='<img src="'+url+'" class="ine-preview" style="margin-bottom:8px"><div style="display:flex;gap:6px;margin-top:4px"><button class="btn btn-sm" onclick="descargarINEEdit(\''+tipo+'\')"><i class="ti ti-download"></i> Descargar</button><button class="btn btn-sm btn-danger" onclick="borrarINEEdit(\''+tipo+'\')"><i class="ti ti-trash"></i> Borrar</button></div>';
  } else {
    el.innerHTML='';
  }
}
function descargarINEEdit(tipo){
  var d=DEPTOS[editIdx];if(!d)return;
  var url=tipo==='inq'?d.ineInqUrl:d.ineAvalUrl;if(!url)return;
  var a=document.createElement('a');
  a.href=url;a.download='INE_'+d.nombre.replace(/\s+/g,'_')+'_'+(tipo==='inq'?'inquilino':'aval')+'.jpg';
  document.body.appendChild(a);a.click();document.body.removeChild(a);
}
function borrarINEEdit(tipo){
  if(!confirm('¿Borrar foto del INE?'))return;
  var d=DEPTOS[editIdx];if(!d)return;
  borrarINEDeStorage(d.num,tipo,function(){_inePanelEditArea(tipo);showToast('Foto INE eliminada','ok');});
}

// ── INE — base64 comprimido con Canvas (sin Firebase Storage) ────────────
// Comprime imagen a máx 900px y calidad 65% → ~60-100KB por foto
function comprimirImagen(file, onOk, onErr){
  var reader=new FileReader();
  reader.onload=function(e){
    var img=new Image();
    img.onload=function(){
      var MAX=900, w=img.width, h=img.height;
      if(w>MAX){h=Math.round(h*MAX/w);w=MAX;}
      if(h>MAX){w=Math.round(w*MAX/h);h=MAX;}
      var canvas=document.createElement('canvas');
      canvas.width=w;canvas.height=h;
      var ctx=canvas.getContext('2d');
      ctx.drawImage(img,0,0,w,h);
      var b64=canvas.toDataURL('image/jpeg',0.65);
      var kb=Math.round(b64.length*0.75/1024);
      console.log('INE comprimida: '+w+'x'+h+' px, ~'+kb+'KB');
      if(onOk)onOk(b64);
    };
    img.onerror=function(){if(onErr)onErr();};
    img.src=e.target.result;
  };
  reader.onerror=function(){if(onErr)onErr();};
  reader.readAsDataURL(file);
}

// Borra URL de Firestore
function borrarINEDeStorage(deptoNum,tipo,onOk){
  var d=DEPTOS.find(function(x){return x.num===deptoNum;});
  if(!d)return;
  if(tipo==='inq')d.ineInqUrl='';else d.ineAvalUrl='';
  saveDepto(d);if(onOk)onOk();
}

// Modal Editar — leer INE
function leerINE(event,tipo){
  var file=event.target.files[0];if(!file)return;
  var stEl=document.getElementById('ine-'+tipo+'-st');
  var d=DEPTOS[editIdx];if(!d)return;
  if(stEl)stEl.innerHTML='<div style="font-size:11px;color:#6b6b6b;padding:4px 0">Comprimiendo…</div>';
  var localUrl=URL.createObjectURL(file);
  var prevEl=document.getElementById('ine-'+tipo+'-prev');
  if(prevEl)prevEl.innerHTML='<img src="'+localUrl+'" class="ine-preview" style="margin-bottom:8px"><div style="font-size:11px;color:#6b6b6b">Guardando…</div>';
  comprimirImagen(file,
    function(b64){
      if(tipo==='inq')d.ineInqUrl=b64;else d.ineAvalUrl=b64;
      saveDepto(d);
      _inePanelEditArea(tipo);
      if(stEl)stEl.innerHTML='<div style="font-size:11px;color:#085041;padding:4px 0">✓ Guardado</div>';
      showToast('✓ Foto INE guardada','ok');
    },
    function(){
      if(stEl)stEl.innerHTML='<div style="font-size:11px;color:#c0392b;padding:4px 0">⚠ Error al procesar imagen</div>';
      showToast('Error al procesar la imagen','error');
    }
  );
}

// Modal Contrato — leer INE (base64 comprimido en temp hasta dar de alta)
var _tmpIneInq='', _tmpIneAval='';
function leerINEContrato(event,tipo){
  var file=event.target.files[0];if(!file)return;
  var prevId=tipo==='inq'?'c-ine-inq-prev':'c-ine-aval-prev';
  var stEl=document.getElementById('c-ine-'+tipo+'-st');
  var localUrl=URL.createObjectURL(file);
  var prevEl=document.getElementById(prevId);
  if(prevEl)prevEl.innerHTML='<img src="'+localUrl+'" class="ine-preview" style="width:100%;max-height:100px;object-fit:cover;border-radius:8px;margin-top:6px">';
  if(stEl)stEl.innerHTML='<div style="font-size:11px;color:#6b6b6b;padding:2px 0">Comprimiendo…</div>';
  comprimirImagen(file,
    function(b64){
      if(tipo==='inq')_tmpIneInq=b64;else _tmpIneAval=b64;
      if(stEl)stEl.innerHTML='<div style="font-size:11px;color:#085041;padding:2px 0">✓ Lista para guardar</div>';
    },
    function(){
      if(stEl)stEl.innerHTML='<div style="font-size:11px;color:#c0392b;padding:2px 0">⚠ Error al leer imagen</div>';
    }
  );
}

// Placeholder para compatibilidad (ya no hay archivos pendientes, todo es base64)
function subirINEContratoPendiente(deptoNum, onDone){
  if(onDone)onDone();
}

function toggleBolsaEdit(quien,show){
  var box=document.getElementById('bolsa-'+quien+'-edit');
  var inp=document.getElementById('bolsa-'+quien+'-inp');
  if(!box)return;
  box.style.display=show?'block':'none';
  if(show&&inp){
    var val=quien==='jesus'?BOLSA_JESUS:quien==='carlitos'?BOLSA_CARLITOS:BOLSA_MANT;
    inp.value=val;inp.focus();inp.select();
  }
}
function agregarMantMes(){
  var mi=MEX_MES;
  var mant=calcFinMes(mi).mant;
  if(mant<=0){alert('No hay 10% acumulado este mes (aún no hay rentas cobradas).');return;}
  if(!confirm('¿Agregar '+fmt(mant)+' al fondo de mantenimiento?'))return;
  BOLSA_MANT+=mant;
  try{saveFinHist();}catch(e){}
  renderFinanzas();
}
function ajustarBolsa(quien){
  var inp=document.getElementById('bolsa-'+quien+'-inp');
  var val=parseFloat(inp?inp.value:0)||0;
  if(quien==='jesus')BOLSA_JESUS=val;
  else if(quien==='carlitos')BOLSA_CARLITOS=val;
  else if(quien==='mant')BOLSA_MANT=val;
  toggleBolsaEdit(quien,false);
  try{saveFinHist();}catch(e){}
  renderFinanzas();
}
function limpiarContrato(){
  var ids=['c-nombre','c-aval','c-ini','c-fin-f','c-monto','c-tel','c-email','c-nac','c-dom'];
  ids.forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});
  var sel=document.getElementById('c-sel');if(sel)sel.value='';
  var depto=document.getElementById('c-depto');if(depto)depto.value='1';
  var dur=document.getElementById('c-dur');if(dur)dur.value='SEIS MESES';
  var piso=document.getElementById('c-piso');if(piso)piso.value='Planta baja';
  var inqPrev=document.getElementById('c-ine-inq-prev');if(inqPrev)inqPrev.innerHTML='';
  var avalPrev=document.getElementById('c-ine-aval-prev');if(avalPrev)avalPrev.innerHTML='';
  var inmob=document.getElementById('c-inmobiliaria');if(inmob)inmob.checked=false;
  var inqSt=document.getElementById('c-ine-inq-st');if(inqSt)inqSt.innerHTML='';
  var avalSt=document.getElementById('c-ine-aval-st');if(avalSt)avalSt.innerHTML='';
  _tmpIneInq='';_tmpIneAval='';
  var msg=document.getElementById('contrato-gen-msg');if(msg)msg.innerHTML='';
  var elimBox=document.getElementById('elim-contrato-box');if(elimBox)elimBox.style.display='none';
  checkAltaBtn();prevContrato();
}

// ── Limpieza INE base64 pesado ─────────────────────────────────────────────
// Llama desde la consola del navegador: limpiarINEPesado()
function limpiarINEPesado(){
  var LIMITE_KB=200; // si pesa más de 200KB se considera "sin comprimir" y se borra
  var borrados=0,revisados=0;
  var promesas=DEPTOS.map(function(d){
    revisados++;
    var cambio=false;
    // base64 largo = data:image/...;base64,XXXX — cada char ~0.75 bytes
    if(d.ineInqUrl&&d.ineInqUrl.startsWith('data:')&&d.ineInqUrl.length*0.75/1024>LIMITE_KB){
      console.log('Depto '+d.num+' INE inquilino: '+(Math.round(d.ineInqUrl.length*0.75/1024))+'KB → borrado');
      d.ineInqUrl='';cambio=true;borrados++;
    }
    if(d.ineAvalUrl&&d.ineAvalUrl.startsWith('data:')&&d.ineAvalUrl.length*0.75/1024>LIMITE_KB){
      console.log('Depto '+d.num+' INE aval: '+(Math.round(d.ineAvalUrl.length*0.75/1024))+'KB → borrado');
      d.ineAvalUrl='';cambio=true;borrados++;
    }
    if(cambio)return db.collection('deptos').doc(String(d.num)).set(d);
    return Promise.resolve();
  });
  Promise.all(promesas).then(function(){
    var msg='Revisados: '+revisados+' deptos. Fotos pesadas borradas: '+borrados+'.';
    if(borrados===0)msg+=' Todo estaba limpio.';
    console.log('✓ '+msg);
    alert('✓ '+msg+(borrados>0?'\nVuelve a subir las fotos INE desde la app (ahora se comprimirán).':''));
    renderAll();
  }).catch(function(e){console.error('Error en limpieza:',e);alert('Error: '+e.message);});
}

// ── Bitácora ───────────────────────────────────────────────────────────────
var _bitacoraIdx=null;
function agregarBitacora(){
  var txt=document.getElementById('bitacora-inp').value.trim();if(!txt)return;
  var d=DEPTOS[_bitacoraIdx];if(!d)return;
  if(!d.bitacora)d.bitacora=[];
  var hoy=new Date();var fecha=hoy.getDate()+'/'+(hoy.getMonth()+1)+'/'+hoy.getFullYear();
  d.bitacora.unshift({texto:txt,fecha:fecha});
  saveDepto(d);document.getElementById('bitacora-inp').value='';renderBitacora();
}
function eliminarBitacora(ni){
  var d=DEPTOS[_bitacoraIdx];if(!d||!d.bitacora)return;
  if(!confirm('¿Eliminar esta nota?'))return;
  d.bitacora.splice(ni,1);saveDepto(d);renderBitacora();
}
function renderBitacora(){
  var d=DEPTOS[_bitacoraIdx];if(!d)return;
  var list=document.getElementById('bitacora-list');if(!list)return;
  var notas=d.bitacora||[];
  list.innerHTML=notas.length?notas.map(function(n,i){return '<div style="display:flex;gap:8px;align-items:flex-start;padding:8px 0;border-bottom:1px solid #f0f0ee"><div style="flex:1"><div style="font-size:13px">'+esc(n.texto)+'</div><div style="font-size:11px;color:#999;margin-top:2px">'+esc(n.fecha)+'</div></div><button onclick="eliminarBitacora('+i+')" style="background:none;border:none;cursor:pointer;color:#ccc;font-size:14px;padding:0;flex-shrink:0" title="Eliminar">✕</button></div>';}).join(''):'<div class="text-muted" style="font-size:13px;padding:8px 0">Sin notas registradas.</div>';
}

// ── Recalcular bolsas ──────────────────────────────────────────────────────
function recalcularBolsas(){
  var j=0,c=0;
  for(var i=0;i<=MEX_MES;i++){
    var ff=calcFinMes(i),ffh=FIN_HIST[i]||{};
    if(ff.cob>0){if(!ffh.jesusTransferido)j+=ff.jesus;if(!ffh.carlitosTransferido)c+=ff.carlitos;}
  }
  BOLSA_JESUS=Math.round(j);BOLSA_CARLITOS=Math.round(c);
  saveFinHist();renderFinanzas();
}

// ── Recargar datos desde Firebase ─────────────────────────────────────────
function recargarDatos(){
  var btn=document.querySelector('[onclick="recargarDatos()"]');
  if(btn){btn.disabled=true;btn.innerHTML='<i class="ti ti-loader-2"></i> Cargando…';}
  var _n=new Date();MEX_MES=mesIdx(_n.getFullYear(),_n.getMonth());
  db.collection('deptos').get().then(function(snap){
    DEPTOS=[];snap.forEach(function(d){DEPTOS.push(d.data());});DEPTOS.sort(function(a,b){return a.num-b.num;});
    VACIOS=[1,2,3,4,5,6,7,8].filter(function(n){return!DEPTOS.find(function(d){return d.num===n;});});
    return loadRest();
  }).then(function(){
    showToast('✓ Datos actualizados','ok');
  }).catch(function(e){
    showToast('Error al actualizar. Revisa tu conexión.','error');
  }).finally(function(){
    if(btn){btn.disabled=false;btn.innerHTML='<i class="ti ti-refresh"></i> Actualizar';}
  });
}

// ── Render all ─────────────────────────────────────────────────────────────
function renderAll(){
  try{syncCFEHistToServicios();}catch(e){console.warn('syncCFE:',e);}
  renderDashboard();renderDeptos();renderPagos();renderServicios();renderFinanzas();renderContratos();renderMantenimiento();
}
