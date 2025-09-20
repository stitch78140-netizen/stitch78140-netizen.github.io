import { useMemo, useState } from "react";

/* =======================
   Utils & Calculs (inline)
   ======================= */
type DayType = 'SO' | 'R' | 'RH';
interface Meal { start?: Date; end?: Date }
interface Break { start?: Date; end?: Date }
interface Input {
  start: Date; end: Date;
  mealNoon?: Meal; mealEvening?: Meal; theBreak?: Break;
  dayType: DayType;
}
interface Output {
  dmjEnd: Date; t13: Date;
  Bmin_min: number; Amin_min: number;
  A_hours: number; B_total_h: number;
  HS: number; HSN: number; HSM: number; HNM: number;
}

const minutesBetween = (a: Date, b: Date)=> Math.max(0, Math.round((b.getTime()-a.getTime())/60000));
const addMin = (d: Date, m: number)=> new Date(d.getTime()+m*60000);
const ceilH = (m: number)=> m<=0 ? 0 : (m%60? Math.floor(m/60)+1 : Math.floor(m/60));

function normalize(ints: Array<{start:Date; end:Date}>){
  if(!ints.length) return [] as Array<{start:Date; end:Date}>;
  ints.sort((a,b)=> a.start.getTime()-b.start.getTime());
  const out=[{...ints[0]}];
  for(let i=1;i<ints.length;i++){
    const p=out[out.length-1], c=ints[i];
    if(c.start<=p.end) p.end=new Date(Math.max(p.end.getTime(), c.end.getTime()));
    else out.push({...c});
  }
  return out;
}
function subtract(baseStart: Date, baseEnd: Date, remove: Array<{start:Date; end:Date}>){
  const clipped = remove
    .map(r=>({start:new Date(Math.max(r.start.getTime(), baseStart.getTime())),
               end:new Date(Math.min(r.end.getTime(), baseEnd.getTime()))}))
    .filter(r=> r.end>baseStart && r.start<baseEnd);
  const rem = normalize(clipped);
  const segs: Array<{start:Date; end:Date}>=[]; let cur=new Date(baseStart);
  for(const r of rem){ if(r.start>cur) segs.push({start:cur,end:r.start}); if(r.end>cur) cur=new Date(r.end); }
  if(cur<baseEnd) segs.push({start:cur,end:baseEnd});
  return segs;
}

// DMJ = 7h48 effectif (repas + coupure repoussent si elles la chevauchent)
function computeDMJ(start: Date, pauses: Array<{start:Date; end:Date}>, targetMin=468){
  const merged = normalize(pauses);
  const endWindow = addMin(start, 2*24*60);
  const segs: Array<{start:Date; end:Date}>=[]; let cur=new Date(start);
  for(const r of merged){ if(r.start>cur) segs.push({start:cur,end:r.start}); if(r.end>cur) cur=new Date(r.end); }
  segs.push({start:cur,end:endWindow});
  let rest = targetMin;
  for(const s of segs){ const d=minutesBetween(s.start,s.end);
    if(d>=rest) return addMin(s.start, rest);
    rest-=d;
  }
  return endWindow;
}

// Nuit = heure ENTIEREMENT dans [21:00,06:00)
function isFullNightHour(s: Date, e: Date){
  const spans: Array<{sd:Date; ed:Date}>=[]; const midnight = new Date(s); midnight.setHours(24,0,0,0);
  if(e<=midnight) spans.push({sd:s,ed:e}); else { spans.push({sd:s,ed:midnight}); spans.push({sd:midnight,ed:e}); }
  for(const sp of spans){
    const d0 = new Date(sp.sd); d0.setHours(0,0,0,0);
    const h06=new Date(d0); h06.setHours(6,0,0,0);
    const h21=new Date(d0); h21.setHours(21,0,0,0);
    const interStart = new Date(Math.max(sp.sd.getTime(), h06.getTime()));
    const interEnd   = new Date(Math.min(sp.ed.getTime(), h21.getTime()));
    if(interEnd>interStart) return false;
  }
  return true;
}

// Calcul principal
function compute(input: Input): Output {
  const start=input.start, end=input.end;
  const t13 = addMin(start, 13*60);

  const meals: Array<{start:Date; end:Date}>=[];
  if(input.mealNoon?.start && input.mealNoon?.end) meals.push({start:input.mealNoon.start, end:input.mealNoon.end});
  if(input.mealEvening?.start && input.mealEvening?.end) meals.push({start:input.mealEvening.start, end:input.mealEvening.end});
  const breaks: Array<{start:Date; end:Date}> = input.theBreak?.start && input.theBreak?.end ? [{start:input.theBreak.start, end:input.theBreak.end}] : [];
  const allPauses = meals.concat(breaks);

  const dmjEnd = computeDMJ(start, allPauses);

  // Bmin = effectif après DMJ (repas + coupure déduits)
  const Bmin_min = subtract(dmjEnd, end, allPauses).reduce((a,s)=> a+minutesBetween(s.start,s.end), 0);
  // Amin = effectif entre DMJ et 13h (déduit UNIQUEMENT la coupure)
  const Amin_min = subtract(dmjEnd, t13, breaks).reduce((a,s)=> a+minutesBetween(s.start,s.end), 0);

  // Arbitrage minutes-only
  const A_hours = (Amin_min%60) > (Bmin_min%60) ? Math.ceil(Amin_min/60) : Math.floor(Amin_min/60);
  const B_total_h = ceilH(Bmin_min);

  // Répartition
  const nonMaj = Math.min(A_hours, B_total_h);
  const maj    = Math.max(0, B_total_h - nonMaj);

  let HS=0, HSN=0, HSM=0, HNM=0;

  // Non majorées (depuis DMJ)
  let cur = new Date(dmjEnd);
  for (let i = 0; i < nonMaj; i++) {
    const s = new Date(cur), e = addMin(s, 60);
    if (isFullNightHour(s, e)) { HSN++; } else { HS++; }
    cur = e;
  }

  // Majorées (depuis t13)
  cur = new Date(t13);
  for (let i = 0; i < maj; i++) {
    const s = new Date(cur), e = addMin(s, 60);
    if (isFullNightHour(s, e)) { HNM++; } else { HSM++; }
    cur = e;
  }

  return { dmjEnd, t13, Bmin_min, Amin_min, A_hours, B_total_h, HS, HSN, HSM, HNM };
}

/* =======================
   UI helpers/styles
   ======================= */
const fmtHM = (d?: Date) => d ? `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}` : "";
const fmtHhmm = (m: number) => `${String(Math.floor(Math.max(0,m)/60)).padStart(2,"0")}:${String(Math.max(0,m)%60).padStart(2,"0")}`;
const bold = (s: React.ReactNode)=> <span style={{fontWeight:700}}>{s}</span>;
const card: React.CSSProperties = { background:"#fff", border:"1px solid #e5e7eb", borderRadius:12, padding:12 };
const row3: React.CSSProperties = { display:"grid", gridTemplateColumns:"auto 6px 1fr", rowGap:6 };

type TimePair = { date?: Date; time?: string };
type Range = { date?: Date; start?: string; end?: string };

/* =======================
   Component
   ======================= */
export default function App(){
  // PDS/FDS
  const [pds, setPds] = useState<TimePair>({});
  const [fds, setFds] = useState<TimePair>({});
  // coupure & repas
  const [cut, setCut]   = useState<Range>({});
  const [noon, setNoon] = useState<Range>({});
  const [eve , setEve ] = useState<Range>({});

  const autoDate = (d?: Date) => d ?? pds.date ?? fds.date;
  const resetAll = () => { setPds({}); setFds({}); setCut({}); setNoon({}); setEve({}); };

  // build Date from date + "HH:MM"
  const withTime = (date?: Date, hhmm?: string) => {
    if(!date || !hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return undefined;
    const d = new Date(date); const [h,m] = hhmm.split(":").map(Number); d.setHours(h,m,0,0); return d;
  };

  // Inputs
  const draftStart = withTime(pds.date, pds.time);
  const draftEnd   = withTime(fds.date, fds.time);

  // pauses (fin auto +1h si fin vide)
  const mealNoon = (noon.start && !noon.end) ? {start: withTime(autoDate(noon.date), noon.start), end: addMin(withTime(autoDate(noon.date), noon.start)!, 60)} :
                    (noon.start && noon.end) ? {start: withTime(autoDate(noon.date), noon.start), end: withTime(autoDate(noon.date), noon.end)} : undefined;
  const mealEve  = (eve.start && !eve.end) ? {start: withTime(autoDate(eve.date), eve.start), end: addMin(withTime(autoDate(eve.date), eve.start)!, 60)} :
                    (eve.start && eve.end) ? {start: withTime(autoDate(eve.date), eve.start), end: withTime(autoDate(eve.date), eve.end)} : undefined;
  const theBreak = (cut.start && cut.end) ? { start: withTime(autoDate(cut.date), cut.start), end: withTime(autoDate(cut.date), cut.end) } : undefined;

  // Calculs + TSR auto depuis le jour de DMJ
  const out = useMemo(() => {
    if(!draftStart || !draftEnd) return null;
    const tmp = compute({ start: draftStart, end: draftEnd, mealNoon, mealEvening: mealEve, theBreak, dayType: "SO" });
    const wd = new Date(tmp.dmjEnd).getDay();
    const dayType: DayType = wd===6 ? "R" : wd===0 ? "RH" : "SO";
    return compute({ start: draftStart, end: draftEnd, mealNoon, mealEvening: mealEve, theBreak, dayType });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(pds), JSON.stringify(fds), JSON.stringify(cut), JSON.stringify(noon), JSON.stringify(eve)]);

  const dayType: DayType = useMemo(()=>{
    if(!out) return "SO";
    const wd = new Date(out.dmjEnd).getDay();
    return wd===6 ? "R" : wd===0 ? "RH" : "SO";
  }, [out]);

  const nonMaj = out ? Math.min(out.A_hours, out.B_total_h) : 0; // A
  const reste  = out ? Math.max(0, out.B_total_h - nonMaj) : 0;  // B arrondi - A
  const factor = (t: DayType) => t==="SO" ? 1.5 : t==="R" ? 2 : 3;

  return (
    <div style={{maxWidth:740, margin:"0 auto", padding:"12px 12px 64px"}}>
      {/* ENTREE */}
      <div style={{...card}}>
        <div style={{fontSize:20, fontWeight:700, marginBottom:8}}>Calcul heures</div>

        {/* PDS */}
        <div style={{marginTop:8}}>Prise de service</div>
        <div style={{display:"grid", gridTemplateColumns:"1fr 120px", gap:8}}>
          <input type="date" value={pds.date? pds.date.toISOString().slice(0,10): ""} onChange={e=>setPds(s=>({...s, date:e.target.value? new Date(e.target.value+"T00:00:00"):undefined}))}/>
          <input inputMode="numeric" placeholder="HH:MM" value={pds.time??""}
                 onChange={e=>setPds(s=>({...s, time: sanitizeHM(e.target.value)}))}/>
        </div>

        {/* FDS */}
        <div style={{marginTop:12}}>Fin de service</div>
        <div style={{display:"grid", gridTemplateColumns:"1fr 120px", gap:8}}>
          <input type="date" value={fds.date? fds.date.toISOString().slice(0,10): ""} onChange={e=>setFds(s=>({...s, date:e.target.value? new Date(e.target.value+"T00:00:00"):undefined}))}/>
          <input inputMode="numeric" placeholder="HH:MM" value={fds.time??""}
                 onChange={e=>setFds(s=>({...s, time: sanitizeHM(e.target.value)}))}/>
        </div>

        {/* Coupure */}
        <div style={{marginTop:12, display:"grid", gridTemplateColumns:"1fr 120px 16px 120px", gap:8, alignItems:"center"}}>
          <div>Coupure</div>
          <input inputMode="numeric" placeholder="HH:MM" value={cut.start??""} onChange={e=>setCut(s=>({...s, date: autoDate(s.date), start: sanitizeHM(e.target.value)}))}/>
          <div style={{textAlign:"center"}}>–</div>
          <input inputMode="numeric" placeholder="HH:MM" value={cut.end??""} onChange={e=>setCut(s=>({...s, date: autoDate(s.date), end: sanitizeHM(e.target.value)}))}/>
        </div>
        <div style={{marginTop:6}}><button onClick={()=>setCut({})}>Effacer</button></div>

        {/* Repas midi */}
        <div style={{marginTop:12}}>Repas méridien (fin auto +1h si fin vide)</div>
        <div style={{display:"grid", gridTemplateColumns:"1fr 120px 120px", gap:8}}>
          <div/>
          <input inputMode="numeric" placeholder="HH:MM" value={noon.start??""} onChange={e=>setNoon(s=>({...s, date:autoDate(s.date), start:sanitizeHM(e.target.value)}))}/>
          <input inputMode="numeric" placeholder="HH:MM" value={noon.end??""}   onChange={e=>setNoon(s=>({...s, date:autoDate(s.date), end  :sanitizeHM(e.target.value)}))}/>
        </div>
        <div style={{marginTop:6}}><button onClick={()=>setNoon({})}>Effacer</button></div>

        {/* Repas soir */}
        <div style={{marginTop:12}}>Repas vespéral (fin auto +1h si fin vide)</div>
        <div style={{display:"grid", gridTemplateColumns:"1fr 120px 120px", gap:8}}>
          <div/>
          <input inputMode="numeric" placeholder="HH:MM" value={eve.start??""} onChange={e=>setEve(s=>({...s, date:autoDate(s.date), start:sanitizeHM(e.target.value)}))}/>
          <input inputMode="numeric" placeholder="HH:MM" value={eve.end??""}   onChange={e=>setEve(s=>({...s, date:autoDate(s.date), end  :sanitizeHM(e.target.value)}))}/>
        </div>
        <div style={{marginTop:6}}><button onClick={()=>setEve({})}>Effacer</button></div>

        <div style={{textAlign:"right", marginTop:12}}>
          <button onClick={resetAll}>Tout effacer</button>
        </div>
      </div>

      {/* RESULTATS */}
      {out && (
        <>
          <div style={{...card, marginTop:12}}>
            <div style={row3}>
              <div>DMJ atteinte à</div><div/>
              <div>{bold(fmtHM(out.dmjEnd))}</div>

              <div>Amplitude atteinte à</div><div/>
              <div>{bold(fmtHM(out.t13))}</div>

              <div>Dépassement total</div><div/>
              <div>{fmtHhmm(out.Bmin_min)} → <span style={{color:"#b91c1c", fontWeight:700}}>{fmtHhmm(out.B_total_h*60)}</span></div>
            </div>
          </div>

          <div style={{...card, marginTop:12}}>
            <div style={row3}>
              <div>Amin</div><div/>
              <div>{Math.floor(out.Amin_min/60)} h {bold(String(out.Amin_min%60).padStart(2,"0"))}</div>

              <div>Bmin</div><div/>
              <div>{Math.floor(out.Bmin_min/60)} h {bold(String(out.Bmin_min%60).padStart(2,"0"))}</div>

              <div style={{gridColumn:"1 / span 3", textAlign:"center", marginTop:6}}>
                {out.Amin_min%60 === out.Bmin_min%60 ? "Amin = Bmin" : (out.Amin_min%60 > out.Bmin_min%60 ? "Amin > Bmin" : "Amin < Bmin")}
              </div>
            </div>
          </div>

          {/* Ventilation / Répartition (heures créditées) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ ...card, marginTop: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Ventilation des heures</div>
              <ul style={{margin:0,paddingLeft:16,lineHeight:"1.7em"}}>
                {out.HS  >0 && <li>{out.HS} HS</li>}
                {out.HSN >0 && <li>{out.HSN} HSN</li>}
                {(out.HSM>0 || out.HNM>0) && <li style={{listStyle:"none",margin:"6px 0",borderTop:"1px dashed #e5e7eb"}}/>}
                {out.HSM>0 && (
                  <li>
                    {out.HSM} HS × {(dayType==="SO"?150:dayType==="R"?200:300)}% → {(out.HSM*factor(dayType)).toLocaleString("fr-FR")} {(dayType==="RH" ? "HDM" : "HSM")}
                  </li>
                )}
                {out.HNM>0 && (
                  <li>
                    {out.HNM} HSN × {(dayType==="SO"?150:dayType==="R"?200:300)}% → {(out.HNM*factor(dayType)).toLocaleString("fr-FR")} HNM
                  </li>
                )}
              </ul>
            </div>

            <div style={{ ...card, marginTop: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Répartition des heures</div>
              <ul style={{margin:0,paddingLeft:16,lineHeight:"1.7em"}}>
                <li>{out.HS + out.HSN} {(dayType==="RH"?"HSD":"HS")}{out.HSN>0?" (dont nuit)":""}</li>
                {(out.HSM+out.HNM)>0 && (
                  <li>
                    {((out.HSM+out.HNM)*factor(dayType)).toLocaleString("fr-FR")} {(dayType==="RH"?"HDM":"HSM")} au total
                    {out.HSM>0 && <> — {(out.HSM*factor(dayType)).toLocaleString("fr-FR")} jour</>}
                    {out.HNM>0 && <> — {(out.HNM*factor(dayType)).toLocaleString("fr-FR")} nuit</>}
                  </li>
                )}
              </ul>
              <div style={{ marginTop: 8, color: "#b91c1c", fontWeight: 600 }}>
                {dayType === "R"  && "Crédit de 1 RCJ au titre du DP sur le R"}
                {dayType === "RH" && "Crédit de 1,5 RCJ ou 2 RCJ + 1 RL au titre du DP sur le RH"}
              </div>
            </div>
          </div>

          {/* Frises */}
          <details style={{...card, marginTop:12}}>
            <summary style={{cursor:"pointer"}}>Explications (frises)</summary>
            <div style={{marginTop:12}}>
              <Frises dmj={out.dmjEnd} t13={out.t13} nonMajHours={nonMaj} majHours={reste}/>
              <div style={{marginTop:8, fontSize:12, color:"#6b7280"}}>
                Lignes : haut = depuis la DMJ (heures de base) • bas = heures majorées (depuis l’amplitude 13h).  
                Couleurs : gris/saumon = jour, bleu/rouge = nuit.
              </div>
            </div>
          </details>
        </>
      )}

      <div style={{textAlign:"center", color:"#9ca3af", marginTop:16}}>© Stitch08</div>
    </div>
  );
}

/* =======================
   Frises SVG
   ======================= */
function Frises(props: { dmj: Date; t13: Date; nonMajHours: number; majHours: number; }) {
  const cellW = 44, cellH = 18, padTop = 22;
  const HH = (d: Date) => `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;

  const mkBlocks = (start: Date, n: number, nightColor: string, dayColor: string, borderNight: string, borderDay: string) =>
    Array.from({length:n}).map((_, i) => {
      const s = new Date(start.getTime() + i*60*60000);
      const e = new Date(s.getTime() + 60*60000);
      const night = isFullNightHour(s,e);
      return { s, x:i*cellW, night, fill: night? nightColor: dayColor, stroke: night? borderNight: borderDay };
    });

  const hs = mkBlocks(props.dmj, props.nonMajHours, "#c7d2fe", "#e5e7eb", "#93c5fd", "#d1d5db");
  const mj = mkBlocks(props.t13, props.majHours,    "#ef4444", "#fecaca", "#dc2626", "#fca5a5");

  const blocksW = Math.max(hs.length, mj.length) * cellW;
  const totalW = Math.max(blocksW + 70, 6*cellW + 70);
  const totalH = padTop + cellH + 28 + cellH + 10;

  return (
    <svg width="100%" height={totalH} viewBox={`0 0 ${totalW} ${totalH}`} style={{background:"transparent"}}>
      <text x="0" y={14} fontSize="12" fill="#374151">Depuis la DMJ (heures de base)</text>
      <text x="0" y={padTop + cellH + 26} fontSize="12" fill="#374151">Heures majorées (depuis l’amplitude 13h)</text>

      <line x1={60} y1={padTop-6} x2={60+blocksW} y2={padTop-6} stroke="#9ca3af" strokeWidth="1"/>
      <g transform={`translate(60,${padTop})`}>
        {hs.map((b,i)=>(
          <g key={`hs-${i}`}>
            <rect x={b.x+1} y={0} width={cellW-2} height={cellH} rx={4} ry={4} fill={b.fill} stroke={b.stroke}/>
            <line x1={b.x} y1={cellH+1} x2={b.x} y2={cellH+6} stroke="#9ca3af" strokeWidth="1"/>
            <text x={b.x} y={cellH+16} fontSize="10" fill="#4b5563">{HH(b.s)}</text>
          </g>
        ))}
        <line x1={hs.length*cellW} y1={cellH+1} x2={hs.length*cellW} y2={cellH+6} stroke="#9ca3af" strokeWidth="1"/>
      </g>

      <line x1={60} y1={padTop + cellH + 20} x2={60+blocksW} y2={padTop + cellH + 20} stroke="#9ca3af" strokeWidth="1"/>
      <g transform={`translate(60,${padTop + cellH + 26})`}>
        {mj.map((b,i)=>(
          <g key={`mj-${i}`}>
            <rect x={b.x+1} y={0} width={cellW-2} height={cellH} rx={4} ry={4} fill={b.fill} stroke={b.stroke}/>
            <line x1={b.x} y1={cellH+1} x2={b.x} y2={cellH+6} stroke="#9ca3af" strokeWidth="1"/>
            <text x={b.x} y={cellH+16} fontSize="10" fill="#4b5563">{HH(b.s)}</text>
          </g>
        ))}
        <line x1={mj.length*cellW} y1={cellH+1} x2={mj.length*cellW} y2={cellH+6} stroke="#9ca3af" strokeWidth="1"/>
      </g>
    </svg>
  );
}

/* =======================
   Saisie "1725" -> "17:25"
   ======================= */
function sanitizeHM(raw: string){
  const s = raw.replace(/[^\d:]/g,"");
  if(s.includes(":")){
    const [h,m] = s.split(":");
    return `${h.padStart(2,"0").slice(0,2)}:${(m??"").padStart(2,"0").slice(0,2)}`;
  }
  if(s.length<=2) return s.padStart(2,"0");
  const h = s.slice(0, s.length-2), m = s.slice(-2);
  return `${h.padStart(2,"0").slice(0,2)}:${m.padStart(2,"0").slice(0,2)}`;
}
