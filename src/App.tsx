import React, { useMemo, useState, useEffect } from "react";
import {
  compute,
  DayType,
  computeAccountingDate,
  dayTypeFromAccountingDate,
} from "./modules/civils";

/* ========= Helpers ========= */
const pad = (n: number) => String(n).padStart(2, "0");
const addMinutes = (d: Date, m: number) => new Date(d.getTime() + m * 60000);

function formatTypingHHMM(raw: string) {
  const d = raw.replace(/[^\d]/g, "").slice(0, 4);
  if (d.length <= 2) return d;
  return d.slice(0, 2) + ":" + d.slice(2);
}
function finalizeHHMM(raw: string) {
  const d = raw.replace(/[^\d]/g, "");
  if (!d) return "";
  let h = 0, m = 0;
  if (d.length <= 2) { h = Number(d); }
  else if (d.length === 3) { h = Number(d.slice(0,2)); m = Number("0"+d.slice(2)); }
  else { h = Number(d.slice(0,2)); m = Number(d.slice(2,4)); }
  if (h > 23) h = 23;
  if (m > 59) m = 59;
  return `${pad(h)}:${pad(m)}`;
}
function isValidHHMM(v: string) {
  const m = /^(\d{2}):(\d{2})$/.exec(v);
  if (!m) return false;
  const h = +m[1], mm = +m[2];
  return h>=0 && h<=23 && mm>=0 && mm<=59;
}
const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const asHM  = (min: number) => `${pad(Math.floor(min/60))}:${pad(min%60)}`;
const asHMstrict = asHM;

/* Night test = on classe l’heure par le **début** du créneau */
function isNightSlotStart(d: Date) {
  const h = d.getHours();
  return h >= 21 || h < 6;
}

function fmtSmart(d: Date, refStart?: Date, refEnd?: Date) {
  const s = hm(d);
  const same = (refStart && d.toDateString() === refStart.toDateString())
            || (refEnd && d.toDateString() === refEnd.toDateString());
  return same ? <strong>{s}</strong>
              : <>{pad(d.getDate())}/{pad(d.getMonth()+1)}/{d.getFullYear()} <strong>{s}</strong></>;
}

/* ========= App ========= */
export default function App() {
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate,   setEndDate]   = useState("");
  const [endTime,   setEndTime]   = useState("");

  const [breakDate, setBreakDate] = useState("");
  const [breakStartTime, setBreakStartTime] = useState("");
  const [breakEndTime,   setBreakEndTime]   = useState("");

  const [noonDate, setNoonDate] = useState("");
  const [noonStart, setNoonStart] = useState("");
  const [eveDate,  setEveDate]  = useState("");
  const [eveStart, setEveStart] = useState("");

  const [dayType, setDayType] = useState<DayType>("SO");

  /* Dates */
  const startDT = useMemo(() => {
    if (!startDate || !isValidHHMM(startTime)) return null;
    const [h,m] = startTime.split(":").map(Number);
    return new Date(`${startDate}T${pad(h)}:${pad(m)}`);
  }, [startDate, startTime]);

  const endDT = useMemo(() => {
    if (!endDate || !isValidHHMM(endTime)) return null;
    const [h,m] = endTime.split(":").map(Number);
    return new Date(`${endDate}T${pad(h)}:${pad(m)}`);
  }, [endDate, endTime]);

  const breakStartDT = useMemo(() => {
    const dISO = breakDate || startDate;
    if (!dISO || !isValidHHMM(breakStartTime)) return null;
    const [h,m] = breakStartTime.split(":").map(Number);
    return new Date(`${dISO}T${pad(h)}:${pad(m)}`);
  }, [breakDate, breakStartTime, startDate]);

  const breakEndDT = useMemo(() => {
    const dISO = breakDate || startDate;
    if (!dISO || !isValidHHMM(breakEndTime)) return null;
    const [h,m] = breakEndTime.split(":").map(Number);
    return new Date(`${dISO}T${pad(h)}:${pad(m)}`);
  }, [breakDate, breakEndTime, startDate]);

  const noonStartDT = useMemo(() => {
    const dISO = noonDate || startDate;
    if (!dISO || !isValidHHMM(noonStart)) return null;
    const [h,m] = noonStart.split(":").map(Number);
    return new Date(`${dISO}T${pad(h)}:${pad(m)}`);
  }, [noonDate, noonStart, startDate]);

  const eveStartDT = useMemo(() => {
    const dISO = eveDate || startDate;
    if (!dISO || !isValidHHMM(eveStart)) return null;
    const [h,m] = eveStart.split(":").map(Number);
    return new Date(`${dISO}T${pad(h)}:${pad(m)}`);
  }, [eveDate, eveStart, startDate]);

  /* TSr auto */
  useEffect(() => {
    if (!startDT || !endDT) return;
    const meals: Array<{start:Date; end:Date}> = [];
    if (noonStartDT) meals.push({ start: noonStartDT, end: addMinutes(noonStartDT, 60) });
    if (eveStartDT)  meals.push({ start: eveStartDT,  end: addMinutes(eveStartDT,  60) });
    const breaks = (breakStartDT && breakEndDT) ? [{ start: breakStartDT, end: breakEndDT }] : [];
    const acc = computeAccountingDate(startDT, endDT, meals, breaks);
    setDayType(dayTypeFromAccountingDate(acc));
  }, [startDT, endDT, noonStartDT, eveStartDT, breakStartDT, breakEndDT]);

  /* Calcul principal */
  const out = useMemo(() => {
    if (!startDT || !endDT) return null;
    return compute({
      date: startDT,
      start: startDT,
      end: endDT,
      theBreak: breakStartDT && breakEndDT ? { start: breakStartDT, end: breakEndDT } : undefined,
      mealNoon:    noonStartDT ? { start: noonStartDT, end: addMinutes(noonStartDT,60) } : undefined,
      mealEvening:   eveStartDT ? { start: eveStartDT,  end: addMinutes(eveStartDT, 60) } : undefined,
      dayType,
    });
  }, [startDT, endDT, breakStartDT, breakEndDT, noonStartDT, eveStartDT, dayType]);

  /* Découpage heures (nonMaj / maj) + HS/HSN par **début** de créneau */
  const factor = dayType === "SO" ? 1.5 : dayType === "R" ? 2 : 3;
  const HSM_label = dayType === "RH" ? "HDM" : "HSM";

  const buckets = useMemo(() => {
    if (!out) return null;

    const nonMajCount = Math.min(out.A_hours, out.B_total_h);      // heures dans A
    const majCount    = Math.max(0, out.B_total_h - nonMajCount);  // reste à majorer

    let nonMajHS = 0, nonMajHSN = 0;
    for (let i=0;i<nonMajCount;i++){
      const s = new Date(out.dmjEnd.getTime() + i*3600000);
      if (isNightSlotStart(s)) nonMajHSN++; else nonMajHS++;
    }

    let majHS = 0, majHSN = 0;
    for (let i=0;i<majCount;i++){
      const s = new Date(out.t13.getTime() + i*3600000);
      if (isNightSlotStart(s)) majHSN++; else majHS++;
    }

    return { nonMajHS, nonMajHSN, majHS, majHSN, nonMajCount, majCount };
  }, [out]);

  if (!out) {
    /* UI vide (form en haut seulement) */
  }

  /* ===== Styles ===== */
  const box:  React.CSSProperties = { margin:"16px auto", maxWidth:900, padding:16, fontFamily:"system-ui,-apple-system,Segoe UI,Roboto,sans-serif" };
  const card: React.CSSProperties = { background:"#fff", border:"1px solid #e5e7eb", borderRadius:12, padding:12 };
  const btn:  React.CSSProperties = { padding:"6px 10px", border:"1px solid #e5e7eb", borderRadius:8, background:"#f8fafc" };
  const labelCol: React.CSSProperties = { fontWeight:500, marginBottom:6 };
  const dateRow: React.CSSProperties  = { display:"block", width:"100%", marginBottom:6 };
  const timesRow2: React.CSSProperties = { display:"grid", gridTemplateColumns:"minmax(6.2em,1fr) minmax(2em,auto) minmax(6.2em,1fr)", gap:8, alignItems:"center", width:"100%" };
  const timesRow1: React.CSSProperties = { display:"grid", gridTemplateColumns:"minmax(6.2em,1fr) minmax(6.2em,1fr)", gap:8, alignItems:"center", width:"100%" };
  const inputBase: React.CSSProperties = { width:"100%", minWidth:0, boxSizing:"border-box", fontSize:16, padding:"8px 10px", textAlign:"center" };
  const sep: React.CSSProperties = { textAlign:"center", opacity:0.6 };

  function clearAll(){
    setStartDate(""); setStartTime("");
    setEndDate(""); setEndTime("");
    setBreakDate(""); setBreakStartTime(""); setBreakEndTime("");
    setNoonDate(""); setNoonStart("");
    setEveDate(""); setEveStart("");
    setDayType("SO");
  }

  return (
    <div style={box}>
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}>
        <button style={btn} onClick={clearAll}>Tout effacer</button>
      </div>

      {/* Formulaire */}
      <div style={{...card, display:"grid", gap:12}}>
        <div>
          <div style={labelCol}>Prise de service</div>
          <div style={dateRow}><input style={inputBase} type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} /></div>
          <div style={timesRow1}>
            <input style={inputBase} inputMode="numeric" pattern="[0-9]*" placeholder="HH:MM" maxLength={5}
              value={startTime} onChange={e=>setStartTime(formatTypingHHMM(e.target.value))}
              onBlur={e=>setStartTime(finalizeHHMM(e.target.value))} />
            <div/>
          </div>
        </div>

        <div>
          <div style={labelCol}>Fin de service</div>
          <div style={dateRow}><input style={inputBase} type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} /></div>
          <div style={timesRow1}>
            <input style={inputBase} inputMode="numeric" pattern="[0-9]*" placeholder="HH:MM" maxLength={5}
              value={endTime} onChange={e=>setEndTime(formatTypingHHMM(e.target.value))}
              onBlur={e=>setEndTime(finalizeHHMM(e.target.value))} />
            <div/>
          </div>
        </div>

        <div>
          <div style={{...labelCol, display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span>Coupure</span>
            <button style={btn} onClick={()=>{ setBreakDate(""); setBreakStartTime(""); setBreakEndTime(""); }}>Effacer</button>
          </div>
          <div style={dateRow}><input style={inputBase} type="date" value={breakDate} onChange={e=>setBreakDate(e.target.value)} /></div>
          <div style={timesRow2}>
            <input style={inputBase} inputMode="numeric" pattern="[0-9]*" placeholder="HH:MM" maxLength={5}
              value={breakStartTime} onChange={e=>setBreakStartTime(formatTypingHHMM(e.target.value))}
              onBlur={e=>{ const v = finalizeHHMM(e.target.value); setBreakStartTime(v); if(!breakDate && startDate && v) setBreakDate(startDate); }} />
            <div style={sep}>–</div>
            <input style={inputBase} inputMode="numeric" pattern="[0-9]*" placeholder="HH:MM" maxLength={5}
              value={breakEndTime} onChange={e=>setBreakEndTime(formatTypingHHMM(e.target.value))}
              onBlur={e=>{ const v = finalizeHHMM(e.target.value); setBreakEndTime(v); if(!breakDate && startDate && v) setBreakDate(startDate); }} />
          </div>
        </div>

        <div>
          <div style={{...labelCol, display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span>Repas méridien</span>
            <button style={btn} onClick={()=>{ setNoonDate(""); setNoonStart(""); }}>Effacer</button>
          </div>
          <div style={dateRow}><input style={inputBase} type="date" value={noonDate} onChange={e=>setNoonDate(e.target.value)} /></div>
          <div style={timesRow1}>
            <input style={inputBase} inputMode="numeric" pattern="[0-9]*" placeholder="HH:MM" maxLength={5}
              value={noonStart} onChange={e=>setNoonStart(formatTypingHHMM(e.target.value))}
              onBlur={e=>{ const v = finalizeHHMM(e.target.value); setNoonStart(v); if(!noonDate && startDate && v) setNoonDate(startDate); }} />
            <input style={inputBase} value={noonStart && (()=>{
              if(!noonDate && !startDate) return "";
              const dISO = noonDate || startDate!;
              const [h,m] = noonStart.split(":").map(Number);
              return hm(addMinutes(new Date(`${dISO}T${pad(h)}:${pad(m)}`),60));
            })()} readOnly />
          </div>
        </div>

        <div>
          <div style={{...labelCol, display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span>Repas vespéral</span>
            <button style={btn} onClick={()=>{ setEveDate(""); setEveStart(""); }}>Effacer</button>
          </div>
          <div style={dateRow}><input style={inputBase} type="date" value={eveDate} onChange={e=>setEveDate(e.target.value)} /></div>
          <div style={timesRow1}>
            <input style={inputBase} inputMode="numeric" pattern="[0-9]*" placeholder="HH:MM" maxLength={5}
              value={eveStart} onChange={e=>setEveStart(formatTypingHHMM(e.target.value))}
              onBlur={e=>{ const v = finalizeHHMM(e.target.value); setEveStart(v); if(!eveDate && startDate && v) setEveDate(startDate); }} />
            <input style={inputBase} value={eveStart && (()=>{
              if(!eveDate && !startDate) return "";
              const dISO = eveDate || startDate!;
              const [h,m] = eveStart.split(":").map(Number);
              return hm(addMinutes(new Date(`${dISO}T${pad(h)}:${pad(m)}`),60));
            })()} readOnly />
          </div>
        </div>
      </div>

      {/* TSr */}
      {out && (
        <div style={{...card, marginTop:12}}>
          Tsr : <strong>{dayType}</strong> {dayType==="SO"?"(Lun–Ven)":dayType==="R"?"(Samedi)":"(Dimanche)"}
        </div>
      )}

      {/* Repères */}
      {out && (
        <div style={{...card, marginTop:12}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div>DMJ atteinte à</div><div>{fmtSmart(out.dmjEnd, startDT!, endDT!)}</div>
            <div>Amplitude atteinte à</div><div>{fmtSmart(out.t13, startDT!, endDT!)}</div>
            <div>Dépassement total</div>
            <div>{asHM(out.Bmin_min)} → <strong style={{color:"#b91c1c"}}>{asHMstrict(out.B_total_h*60)}</strong></div>
          </div>
        </div>
      )}

      {/* Amin / Bmin */}
      {out && (
        <div style={{...card, marginTop:12}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div>Amin</div><div>{Math.floor(out.Amin_min/60)} h <strong>{pad(out.Amin_min%60)}</strong></div>
            <div>Bmin</div><div>{Math.floor(out.Bmin_min/60)} h <strong>{pad(out.Bmin_min%60)}</strong></div>
          </div>
          <div style={{marginTop:8, textAlign:"center", fontSize:18}}>
            Amin { (out.Amin_min%60)>(out.Bmin_min%60) ? ">" : (out.Amin_min%60)<(out.Bmin_min%60) ? "<" : "=" } Bmin
          </div>
        </div>
      )}

      {/* VENTILATION */}
      {out && buckets && (
        <div style={{...card, marginTop:12}}>
          <div style={{fontWeight:600, marginBottom:8}}>Ventilation des heures</div>
          <div style={{display:"grid", gridTemplateColumns:"auto 1fr", gap:6}}>
            {/* HS non majorées */}
            {buckets.nonMajHS > 0 && (<><div>{buckets.nonMajHS} HS</div><div/></>)}

            {/* HSN (regroupées) */}
            { (buckets.nonMajHSN + buckets.majHSN) > 0 && (
              <>
                <div>{(buckets.nonMajHSN + buckets.majHSN)} HSN × {factor*100}%</div>
                <div/>
              </>
            )}
          </div>
        </div>
      )}

      {/* RÉPARTITION (créditée) */}
      {out && buckets && (
        <div style={{...card, marginTop:12}}>
          <div style={{fontWeight:600, marginBottom:8}}>Répartition des heures</div>
          <div style={{display:"grid", gridTemplateColumns:"auto 1fr", gap:6}}>
            {/* HS (non maj) */}
            {buckets.nonMajHS > 0 && (<><div>{buckets.nonMajHS} HS</div><div/></>)}

            {/* HSM et HNM crédités */}
            { buckets.majHS > 0 && (
              <>
                <div>{(buckets.majHS * factor).toString().replace(/\.0$/,"")} {HSM_label}</div>
                <div/>
              </>
            )}
            { (buckets.nonMajHSN + buckets.majHSN) > 0 && (
              <>
                <div>{(((buckets.nonMajHSN + buckets.majHSN) * factor)).toString().replace(/\.0$/,"")} HNM</div>
                <div/>
              </>
            )}
          </div>

          <div style={{marginTop:8, color:"#b91c1c", fontWeight:600}}>
            {dayType==="R"  && "Crédit de 1 RCJ au titre du DP sur le R"}
            {dayType==="RH" && "Crédit de 1,5 RCJ ou 2 RCJ + 1 RL au titre du DP sur le RH"}
          </div>
        </div>
      )}

      {/* FRISE */}
      {out && startDT && endDT && buckets && (
        <div style={{...card, marginTop:12}}>
          <FriseTimeline
            start={startDT}
            dmj={out.dmjEnd}
            t13={out.t13}
            nonMajHours={buckets.nonMajCount}
            majHours={buckets.majCount}
          />
        </div>
      )}

      <div style={{opacity:0.6, fontSize:12, textAlign:"center", marginTop:16}}>© Stitch08</div>
    </div>
  );
}

/* ========= Frise chronologique ========= */
function FriseTimeline(props: {
  start: Date; dmj: Date; t13: Date;
  nonMajHours: number; majHours: number;
}) {
  const W = 560;                  // largeur mini
  const PADL = 48, PADR = 16;
  const Y1 = 48, Y2 = 112;        // lignes
  const hourW = 64;

  const lineLenTop = Math.max(1, props.nonMajHours) * hourW;
  const lineLenBot = Math.max(1, props.majHours) * hourW;
  const svgW = Math.max(W, PADL + PADR + Math.max(lineLenTop, lineLenBot));
  const svgH = 150;

  const tick = (x:number, y:number, label:string, red=false) => (
    <g>
      <line x1={x} y1={y-14} x2={x} y2={y+14} stroke={red?"#dc2626":"#111827"} strokeWidth={2}/>
      <text x={x} y={y+26} textAnchor="middle" fontSize="12" fill={red?"#dc2626":"#111827"}>{label}</text>
    </g>
  );

  return (
    <svg width="100%" height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
      <text x={svgW/2} y={22} textAnchor="middle" fontWeight={700} fill="#111827">RÉPARTITION DES HEURES</text>

      {/* Ligne 1 : HS / HSN depuis DMJ */}
      <text x={PADL-36} y={Y1-22} fontSize="12" fill="#6b7280">Pds</text>
      <line x1={PADL-36} y1={Y1} x2={PADL} y2={Y1} stroke="#9ca3af" strokeDasharray="4 4"/>
      <text x={PADL-8} y={Y1-22} fontSize="12" fill="#6b7280">DMJ</text>
      <line x1={PADL} y1={Y1} x2={PADL+lineLenTop} y2={Y1} stroke="#111827" strokeWidth={2}/>
      {/* repères */}
      {tick(PADL-36, Y1, "", false)}
      {tick(PADL,     Y1, hm(props.dmj), isNightSlotStart(props.dmj))}
      {/* heures nonMaj */}
      {Array.from({length: props.nonMajHours}).map((_,i)=>{
        const s = new Date(props.dmj.getTime() + i*3600000);
        const x = PADL + (i+1)*hourW;
        const night = isNightSlotStart(s);
        return (
          <g key={`n-${i}`}>
            {tick(x, Y1, hm(addMinutes(props.dmj,(i+1)*60)), night)}
            <text x={x-hourW/2} y={Y1-6} textAnchor="middle" fontSize="12" fill={night?"#dc2626":"#111827"}>
              {night?"HSN":"HS"}
            </text>
          </g>
        );
      })}
      <text x={PADL-36} y={Y1+32} fontSize="12" fill="#111827">{hm(props.start)}</text>

      {/* Ligne 2 : HSM / HNM depuis amplitude */}
      <text x={PADL-26} y={Y2-22} fontSize="12" fill="#6b7280">Amplitude</text>
      <line x1={PADL} y1={Y2} x2={PADL+lineLenBot} y2={Y2} stroke="#111827" strokeWidth={2}/>
      {tick(PADL, Y2, hm(props.t13), isNightSlotStart(props.t13))}
      {Array.from({length: props.majHours}).map((_,i)=>{
        const s = new Date(props.t13.getTime() + i*3600000);
        const x = PADL + (i+1)*hourW;
        const night = isNightSlotStart(s);
        return (
          <g key={`m-${i}`}>
            {tick(x, Y2, hm(addMinutes(props.t13,(i+1)*60)), night)}
            <text x={x-hourW/2} y={Y2-6} textAnchor="middle" fontSize="12" fill={night?"#dc2626":"#111827"}>
              {night?"HNM":"HSM"}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
