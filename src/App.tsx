import { useMemo, useState } from "react";
import { compute, addMin, isFullNightHour, type DayType } from "./modules/civils";

// ------- helpers UI -------
const fmtHM = (d?: Date) => d ? `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}` : "";
const fmtHhmm = (m: number) => {
  const h = Math.floor(Math.max(0,m)/60), mm = Math.max(0,m)%60;
  return `${String(h).padStart(2,"0")}:${String(mm).padStart(2,"0")}`;
};
const bold = (s: React.ReactNode)=> <span style={{fontWeight:700}}>{s}</span>;
const card: React.CSSProperties = { background:"#fff", border:"1px solid #e5e7eb", borderRadius:12, padding:12 };
const row3: React.CSSProperties = { display:"grid", gridTemplateColumns:"auto 6px 1fr", rowGap:6 };

// --------- inputs ----------
type TimePair = { date?: Date; time?: string };
type Range = { date?: Date; start?: string; end?: string };

export default function App(){
  // PDS/FDS
  const [pds, setPds] = useState<TimePair>({});
  const [fds, setFds] = useState<TimePair>({});
  // coupure & repas
  const [cut, setCut] = useState<Range>({});
  const [noon, setNoon] = useState<Range>({});
  const [eve , setEve ] = useState<Range>({});

  // ----- setters & auto-date pour coupure/repas -----
  const autoDate = (d?: Date) => d ?? pds.date ?? fds.date;

  // effacer tout
  const resetAll = () => { setPds({}); setFds({}); setCut({}); setNoon({}); setEve({}); }

  // --------- calculs ----------
  // bâtit un Date à partir (date + "HH:MM")
  const withTime = (date?: Date, hhmm?: string) => {
    if(!date || !hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return undefined;
    const d = new Date(date); const [h,m] = hhmm.split(":").map(Number); d.setHours(h,m,0,0); return d;
  };

  // Jours TSR auto (simple): on prend le jour civil de la DMJ (clairement défini par la règle); puis:
  // Samedi => "R", Dimanche => "RH", sinon "SO".
  const draftStart = withTime(pds.date, pds.time);
  const draftEnd   = withTime(fds.date, fds.time);
  // pauses
  const mealNoon = (noon.start && !noon.end) ? {start: withTime(autoDate(noon.date), noon.start), end: addMin(withTime(autoDate(noon.date), noon.start)!, 60)} :
                    (noon.start && noon.end) ? {start: withTime(autoDate(noon.date), noon.start), end: withTime(autoDate(noon.date), noon.end)} : undefined;
  const mealEve  = (eve.start && !eve.end) ? {start: withTime(autoDate(eve.date), eve.start), end: addMin(withTime(autoDate(eve.date), eve.start)!, 60)} :
                    (eve.start && eve.end) ? {start: withTime(autoDate(eve.date), eve.start), end: withTime(autoDate(eve.date), eve.end)} : undefined;
  const theBreak = (cut.start && cut.end) ? { start: withTime(autoDate(cut.date), cut.start), end: withTime(autoDate(cut.date), cut.end) } : undefined;

  const out = useMemo(() => {
    if(!draftStart || !draftEnd) return null;

    // DMJ provisoire pour déterminer le TSR/jour
    const tmp = compute({
      start: draftStart, end: draftEnd,
      mealNoon, mealEvening: mealEve, theBreak,
      dayType: "SO"
    });
    const dmjDay = new Date(tmp.dmjEnd); const wd = dmjDay.getDay();
    const dayType: DayType = wd===6 ? "R" : wd===0 ? "RH" : "SO";

    return compute({
      start: draftStart, end: draftEnd,
      mealNoon, mealEvening: mealEve, theBreak,
      dayType
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(pds), JSON.stringify(fds), JSON.stringify(cut), JSON.stringify(noon), JSON.stringify(eve)]);

  // infos d'affichage
  const dayType: DayType = useMemo(()=>{
    if(!out) return "SO";
    const wd = new Date(out.dmjEnd).getDay();
    return wd===6 ? "R" : wd===0 ? "RH" : "SO";
  }, [out]);

  const nonMaj = out ? Math.min(out.A_hours, out.B_total_h) : 0; // A
  const reste  = out ? Math.max(0, out.B_total_h - nonMaj) : 0;  // B arrondi - A

  // facteurs de majoration (heures créditées)
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
        <div style={{marginTop:6}}>
          <button onClick={()=>setCut({})}>Effacer</button>
        </div>

        {/* Repas midi */}
        <div style={{marginTop:12}}>Repas méridien (fin auto +1h si fin vide)</div>
        <div style={{display:"grid", gridTemplateColumns:"1fr 120px 120px", gap:8}}>
          <div/>
          <input inputMode="numeric" placeholder="HH:MM" value={noon.start??""} onChange={e=>setNoon(s=>({...s, date:autoDate(s.date), start:sanitizeHM(e.target.value)}))}/>
          <input inputMode="numeric" placeholder="HH:MM" value={noon.end??""}   onChange={e=>setNoon(s=>({...s, date:autoDate(s.date), end  :sanitizeHM(e.target.value)}))}/>
        </div>
        <div style={{marginTop:6}}>
          <button onClick={()=>setNoon({})}>Effacer</button>
        </div>

        {/* Repas soir */}
        <div style={{marginTop:12}}>Repas vespéral (fin auto +1h si fin vide)</div>
        <div style={{display:"grid", gridTemplateColumns:"1fr 120px 120px", gap:8}}>
          <div/>
          <input inputMode="numeric" placeholder="HH:MM" value={eve.start??""} onChange={e=>setEve(s=>({...s, date:autoDate(s.date), start:sanitizeHM(e.target.value)}))}/>
          <input inputMode="numeric" placeholder="HH:MM" value={eve.end??""}   onChange={e=>setEve(s=>({...s, date:autoDate(s.date), end  :sanitizeHM(e.target.value)}))}/>
        </div>
        <div style={{marginTop:6, display:"flex", gap:8, justifyContent:"space-between"}}>
          <div> </div>
          <button onClick={()=>setEve({})}>Effacer</button>
        </div>

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

// -------- frises SVG (sans acronymes dans les titres) --------
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

// --------- saisie HHMM -> HH:MM ---------
function sanitizeHM(raw: string){
  // autorise "750" -> 07:50, "7:5" -> 07:05, etc.
  const s = raw.replace(/[^\d:]/g,"");
  if(s.includes(":")){
    const [h,m] = s.split(":");
    return `${h.padStart(2,"0").slice(0,2)}:${(m??"").padStart(2,"0").slice(0,2)}`;
  }
  if(s.length<=2) return s.padStart(2,"0");
  const h = s.slice(0, s.length-2), m = s.slice(-2);
  return `${h.padStart(2,"0").slice(0,2)}:${m.padStart(2,"0").slice(0,2)}`;
}
