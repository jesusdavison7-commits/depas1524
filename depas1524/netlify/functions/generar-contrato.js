const { Document, Packer, Paragraph, TextRun, AlignmentType } = require('docx');

const MESES_UP=['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
const MESES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
function fmtF(iso){const d=new Date(iso+'T12:00:00');return{dia:d.getDate(),mes:MESES[d.getMonth()],mesUp:MESES_UP[d.getMonth()],anio:d.getFullYear()};}
function n2l(n){const m={3000:'TRES MIL',3500:'TRES MIL QUINIENTOS',4000:'CUATRO MIL',4500:'CUATRO MIL QUINIENTOS',5000:'CINCO MIL',5500:'CINCO MIL QUINIENTOS',6000:'SEIS MIL',6500:'SEIS MIL QUINIENTOS',7000:'SIETE MIL',7500:'SIETE MIL QUINIENTOS',8000:'OCHO MIL'};return m[n]||'MONTO';}
function mTxt(m){return`$${m.toLocaleString('es-MX',{minimumFractionDigits:2})} (SON ${n2l(m)} PESOS 00/100 M. N.)`;}

exports.handler = async (event) => {
  const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST,OPTIONS'};
  if(event.httpMethod==='OPTIONS')return{statusCode:200,headers,body:''};
  try{
    const{nombreInquilino,nombreAval,numDepto,monto,fechaInicio,fechaFin,duracion}=JSON.parse(event.body);
    const piso=numDepto<=4?'PLANTA BAJA':'PLANTA ALTA';
    const pisoNum=numDepto<=4?'PRIMER PISO (PLANTA BAJA)':'SEGUNDO PISO (PLANTA ALTA)';
    const fi=fmtF(fechaInicio),ff=fmtF(fechaFin);
    const NI=nombreInquilino.toUpperCase(),NA=nombreAval.toUpperCase();
    const mStr=mTxt(monto);
    const R={font:'Arial',size:22,color:'000000'};
    const RB={...R,bold:true};
    const sp={line:260,lineRule:'auto'};
    const p=(runs,center=false,kn=false)=>new Paragraph({alignment:center?AlignmentType.CENTER:AlignmentType.BOTH,spacing:sp,keepNext:kn,children:runs.map(r=>new TextRun({...R,...r}))});
    const gap=(kn=false)=>new Paragraph({spacing:{before:60,after:60},keepNext:kn,children:[new TextRun({text:'',...R})]});
    const firma=(label,nombre)=>[
      new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:900,after:0},keepNext:true,keepLines:true,children:[new TextRun({text:'_'.repeat(45),...R})]}),
      new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:60,after:0},keepNext:true,keepLines:true,children:[new TextRun({text:label,...RB})]}),
      new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:40,after:0},keepLines:true,children:[new TextRun({text:nombre,...R})]})
    ];
    const children=[
      p([{text:`CONTRATO DE ARRENDAMIENTO QUE EN LA CIUDAD DE LOS MOCHIS, SINALOA, DE LOS ESTADOS UNIDOS MEXICANOS, CELEBRAN HOY ${fi.dia} DE ${fi.mesUp} DEL AÑO ${fi.anio}, POR UNA PARTE EL SEÑOR RAMON ADOLFO ARMENTA RODRIGUEZ, A QUIEN EN LO SUCESIVO SE LE DESIGNARÁ EL ARRENDADOR Y POR LA OTRA PARTE EL C. `},{text:NI,...RB},{text:', A QUIEN EN LO SUCESIVO SE LE DENOMINARA EL ARRENDATARIO, MISMO QUE SUJETAN BAJO LAS SIGUIENTES DECLARACIONES Y CLAUSULAS:'}]),
      gap(),p([{text:'D E C L A R A C I O N E S'}],true),gap(),
      p([{text:`PRIMERA.- Declara EL SEÑOR RAMON ADOLFO ARMENTA RODRIGUEZ en su carácter de arrendador, que es legítimo propietario de una finca urbana compuesta de solar con construcción constituida por 08 DEPARTAMENTOS, de dos plantas, distribuidos en 04 departamentos por piso (planta), ubicados en Avenida 10 de Mayo número 1524 oriente, de esta ciudad de Los Mochis, Sinaloa, cada departamento está identificado con los números del 1 al 8, los cuales se encuentran totalmente equipados y amueblados, es decir, en su interior con baño completo, cama compuesta por base de madera y respaldo, colchón, área tipo cocineta con parilla de inducción eléctrica, área tipo comedor compuesta por una barra y silla de descanso, cuenta con pantalla plana de 32", área de closet, y cuenta con los servicios de internet inalámbrico, energía eléctrica y agua potable, y de los cuales se da en arrendamiento el departamento numero `},{text:String(numDepto),...RB},{text:', ubicado en el '},{text:pisoNum,...RB},{text:' mediante contrato que se celebra al tenor de las siguientes:'}]),
      gap(),p([{text:'C L A U S U L A S:'}],true),gap(),
      p([{text:'PRIMERA.- Por medio del presente instrumento y en este acto EL SEÑOR RAMON ADOLFO ARMENTA RODRIGUEZ, da en arrendamiento a '},{text:NI,...RB},{text:', y esta toma de aquella en arrendamiento el bien inmueble descrito debidamente en el punto primero de declaraciones.'}]),
      gap(),p([{text:'SEGUNDO.- El término de duración del presente contrato de arrendamiento, se fija por las partes por '},{text:duracion,...RB},{text:`, contados a partir de este día `},{text:`${fi.dia} DE ${fi.mesUp} DEL AÑO ${fi.anio}`,...RB},{text:`, para concluir el mismo día `},{text:`${ff.dia} DE ${ff.mesUp} DEL AÑO ${ff.anio}`,...RB},{text:', sin necesidad de desahucio ni de ningún aviso previo, pues el arrendatario renuncia expresamente a la prórroga de que trata el artículo 2367 del Código Civil para el Estado de Sinaloa.'}]),
      gap(),p([{text:'TERCERO.- El C. '},{text:NI,...RB},{text:', se obliga a pagar y pagará a EL SEÑOR RAMON ADOLFO ARMENTA RODRIGUEZ, en el domicilio particular del Arrendador, sito en Calle Montaña Número 1862 Poniente, del Fraccionamiento Real del Country, de esta ciudad de Los Mochis Sinaloa, domicilio que los contratantes convienen en fijar para el pago y recepción de las pensiones rentísticas, sin necesidad de previo requerimiento judicial o extrajudicial, por el uso y goce temporal del expresado bien inmueble, en específico del departamento identificado con el numero '},{text:String(numDepto),...RB},{text:', ubicado en la '},{text:piso,...RB},{text:' a partir de este día '},{text:`${fi.dia} DE ${fi.mesUp} DEL AÑO ${fi.anio}`,...RB},{text:' y hasta el día '},{text:`${ff.dia} DE ${ff.mesUp} DEL AÑO ${ff.anio}`,...RB},{text:`, la cantidad de ${mStr}, por mensualidad adelantada dentro de los primeros cinco días del mes en turno, asimismo, se manifiesta que a la firma del presente instrumento el arrendatario deja en calidad de depósito la cantidad de ${mStr}, mismos, se quedaran en garantía en caso de daños o incumplimiento del contrato, con independencia de los gastos extras que esto pueda generar.`}]),
      gap(),p([{text:'CUARTO.- Ambas partes convienen que el precio de arrendamiento mientras dure la vigencia del presente contrato de arrendamiento, por acuerdo de las partes, será incrementado en un 10% por cada año que se acuerde que se siga ocupando la finca arrendada y así sucesivamente se tendrá un nuevo precio de renta por cada año de vigencia tomando como base el precio vigente inmediato anterior.'}]),
      gap(),p([{text:'QUINTO.- Toda mensualidad será pagada íntegra aun cuando el arrendatario tan solo ocupe la cosa arrendada en todo o en parte de ella o parte del mes correspondiente. En caso que el arrendatario abandone, deje, desocupe el departamento antes de que fenezca el plazo por el cual cobra vigencia el presente contrato, no tendrá derecho a la devolución del depósito entregado por la misma cantidad del costo de la renta mensual.'}]),
      gap(),p([{text:'SEXTO.- La cosa inmueble materia del presente contrato de arrendamiento se destinará por el arrendatario, en todas y cada una de sus partes como departamento-habitacional, quedándole estrictamente prohibido destinarlo para cualquier otro fin, siendo esto una causa especial de rescisión del presente contrato.'}]),
      gap(),p([{text:'SÉPTIMA.- No podrá el arrendatario El C. '},{text:NI,...RB},{text:', sub-arrendar en todo ni en parte la cosa inmueble que se da en arrendamiento como tampoco ceder en todo o en parte los derechos que adquiera sobre este, sin previo consentimiento otorgado por escrito del arrendador, además, de que dicho departamento es para uso individual, es decir, no podrá ser utilizado por más de una persona, salvo, visitas que reciba el arrendatario dentro de un horario de 08:00 horas a 20:00 horas de lunes a viernes, sin derecho del visitante a pernoctar en el mismo.'}]),
      gap(),p([{text:'OCTAVA.- El arrendatario, '},{text:NI,...RB},{text:', recibe con esta fecha la cosa inmueble que renta en buen estado de uso y se obliga a cuidar de su conservación, como si se tratase de cosa propia, así como a devolverlo en buen estado a la arrendadora sin más deterioro que el que cause el uso normal o natural de la cosa.'}]),
      gap(),p([{text:'NOVENA.- Los servicios de Energía Eléctrica o cualquier otro servicio que consuma el arrendatario '},{text:NI,...RB},{text:', en la cosa inmueble objeto de este arrendamiento, serán por cuenta exclusiva de ésta y se obliga a pagarlos puntualmente a las empresas que se los suministren.'}]),
      gap(),p([{text:'DÉCIMA.- El arrendador concede el uso del arrendatario del equipo de centro de lavado marca MABE, consistente en lavadora y secadora de ropa, ubicado en el área de lavadero dentro de las áreas comunes del inmueble, mismo que el arrendatario podrá utilizar de forma única y exclusivamente como uso personal, es decir, no podrá utilizarlo en beneficio de visitas u otras personas, asimismo, dicho centro de lavado podrá ser utilizado por cohabitantes de dicho inmueble, para lo cual deberán tomar las medidas y reglas de orden para su uso común entre los inquilinos, mismo que se encuentra en estado nuevo de uso y el arrendatario se obliga a cuidar de su conservación, como si se tratase de cosa propia.'}]),
      gap(),p([{text:'DÉCIMA PRIMERA.- El arrendatario se compromete que de ser el caso de hacer un mal uso, negligente o con falta de cuidado, se hará responsable de cubrir los gastos que genere su reparación o bien su restitución.'}]),
      gap(),p([{text:'DÉCIMA SEGUNDA.- El Arrendatario, será responsable de cualquier problema de carácter legal relacionado con la actividad para la cual fue rentado el inmueble, que pudiera suscitarse, ya sea de carácter civil, penal, laboral, administrativo, etc. Por lo que él en lo personal responderá por el mal uso que llegare a darle al inmueble arrendado en caso de verse involucrado en cualquier situación de la naturaleza arriba asentada.'}]),
      gap(),p([{text:'DÉCIMA TERCERA.- EL C. '},{text:NA,...RB},{text:', se constituye como aval de '},{text:NI,...RB},{text:', respondiendo íntegramente de todas las obligaciones pactadas en el presente acto contractual.'}]),
      gap(),p([{text:'DÉCIMA CUARTA.- Ambas partes contratantes se someten expresamente a la jurisdicción de los Tribunales de la ciudad de Los Mochis, Ahome, Sinaloa, México, para todo lo relativo a las cuestiones que se susciten sobre la interpretación y cumplimiento de este contrato renunciando al privilegio en forma expresa de su domicilio presente o futuro por cuanto esto no fuere la ciudad de Los Mochis, Ahome, Sinaloa, México.'}]),
      gap(),
      p([{text:'LEÍDO Y EXPLICADO EL PRESENTE CONTRATO DE ARRENDAMIENTO ENTRE LAS PARTES Y ENTERADOS DE SU ALCANCE Y CONSECUENCIAS LEGALES, SE MANIFIESTAN CONFORMES CON EL, MISMO QUE LO FIRMAN PARA LOS EFECTOS LEGALES QUE CORRESPONDAN.'}],false,true),
      gap(true),
      new Paragraph({alignment:AlignmentType.LEFT,spacing:{before:80,after:80},keepNext:true,children:[new TextRun({text:`Los Mochis, Sinaloa a ${fi.dia} de ${fi.mes} del ${fi.anio}.`,...R})]}),
      ...firma('EL ARRENDADOR','RAMON ADOLFO ARMENTA RODRIGUEZ'),
      ...firma('EL ARRENDATARIO',nombreInquilino),
      ...firma('EL AVAL',nombreAval),
    ];
    const doc=new Document({sections:[{properties:{page:{size:{width:12240,height:15840},margin:{top:1134,right:1134,bottom:1134,left:1134}}},children}]});
    const buf=await Packer.toBuffer(doc);
    return{statusCode:200,headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({docx:buf.toString('base64')})};
  }catch(e){
    return{statusCode:500,headers,body:JSON.stringify({error:e.message})};
  }
};
