import { useMemo, useState } from 'react';
import { compute, addMin } from './modules/civils';

type HHMM = string;

function parseHHMM(s: HHMM | undefined) {
  if (!s) return null;
  const m = s.trim().match(/^(\d{1,2}):?(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]), mm = Number(m[2]);
  if (h>47 || mm>59) return null;
  return {h, m:mm};
}
function at(dateBase: Date, h:number, m:number) {
  const d = new Date(dateBase);
  d.setHours(h, m, 0, 0);
  return d;
}
function fmtHM(d?: Date) {
  if (!d) return '';
  const hh = String(d.getHours()).padStart(2,'0');
  const mm = String(d.getMinutes()).padStart(2,'0');
  return `${hh}:${mm}`;
}
function padHM(min: number){
  const h = Math.floor(min/60), m=min%60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

export default function App(){
  // Entrées
  const [dateStr,setDateStr] = useState<string>('');
  const [pds,setPds] = useState<HHMM>('');      // prise (HH:MM)
  const [fds,setFds] = useState<HHMM>('');      // fin (HH:MM)
  const [brk1,setBrk1] = useState<HHMM>('');    // coupure début
  const [brk2,setBrk2] = useState<HHMM>('');    // coupure fin
  const [m1,setM1] = useState<HHMM>('');        // repas méridien début
  const [m1e,setM1e] = useState<HHMM>('');      // repas méridien fin (auto +1h si vide à la saisie)
  const [m2,setM2] = useState<HHMM>('');        // repas vespéral début
  const [m2e,setM2e] = useState<HHMM>('');      // repas vespéral fin (auto +1h si vide)

  // Date de base (obligatoire pour en finir avec les décalages)
  const baseDate = useMemo(()=>{
    if(!dateStr) return null;
    const d = new Date(dateStr);
    if(isNaN(d.getTime())) return null;
    d.setHours(0,0,0,0);
    return d;
  },[dateStr]);

  function mkDate(hhmm: HHMM | undefined){
    if(!baseDate) return null;
    const t = parseHHMM(hhmm);
    if(!t) return null;
    return at(baseDate, t.h, t.m);
  }

  // Auto-fin +1h pour repas si fin vide au blur
  function ensurePlus1h(begin: HHMM, end: HHMM, setEnd:(v:string)=>void){
    if(!end && begin){
      const t = parseHHMM(begin);
      if(t){
        const d = at(baseDate??new Date(), t.h, t.m);
        const e = addMin(d,60);
        setEnd(fmtHM(e));
      }
    }
  }

  // Effacers
  const clearAll = ()=>{
    setPds(''); setFds('');
    setBrk1(''); setBrk2('');
    setM1(''); setM1e('');
    setM2(''); setM2e('');
    // on ne touche pas à la date (c’est voulu)
  };
  const clearBreak = ()=>{ setBrk1(''); setBrk2(''); };
  const clearM1 = ()=>{ setM1(''); setM1e(''); };
  const clearM2 = ()=>{ setM2(''); setM2e(''); };

  // Construction des dates
  const start = mkDate(pds);
  const end   = mkDate(fds);
  const brkS  = mkDate(brk1);
  const brkE  = mkDate(brk2);
  const m1S   = mkDate(m1);
  const m1E   = mkDate(m1e);
  const m2S   = mkDate(m2);
  const m2E   = mkDate(m2e);

  // Calcul
  const out = useMemo(()=>{
    if(!start || !end) return null;
    return compute({
      start,
      end,
      theBreak: (brkS && brkE) ? {start:brkS, end:brkE} : undefined,
      mealNoon: (m1S && m1E) ? {start:m1S, end:m1E} : undefined,
      mealEvening: (m2S && m2E) ? {start:m2S, end:m2E} : undefined,
      dayType: 'R', // l’étiquette visible “TSr” est calculée ailleurs
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[pds,fds,brk1,brk2,m1,m1e,m2,m2e,dateStr]);

  // TSr détecté automatiquement depuis la date
  const tsrLabel = useMemo(()=>{
    if(!baseDate) return '—';
    const w = baseDate.getDay(); // 0=dim ... 6=sam
    if(w===6) return 'R (Samedi)';
    if(w===0) return 'RH (Dimanche)';
    return 'SO (Semaine)';
  },[baseDate]);

  // Frises (cases colorées)
  function Frises(){
    if(!out) return null;
    const { dmjEnd, t13, A_hours, B_total_h, HS,HSN,HSM,HNM } = out;
    const nonMaj = Math.min(A_hours, B_total_h);
    const maj    = Math.max(0, B_total_h - nonMaj);

    const boxes1: JSX.Element[] = [];
    let cur = new Date(dmjEnd);
    for(let i=0;i<nonMaj;i++){
      const s=new Date(cur), e=addMin(s,60);
      const night = isNightFull(s,e);
      boxes1.push(<span key={`n${i}`} className={`box ${night?'b-night':'b-day'}`} />);
      cur=e;
    }

    const boxes2: JSX.Element[] = [];
    cur = new Date(t13);
    for(let i=0;i<maj;i++){
      const s=new Date(cur), e=addMin(s,60);
      const night = isNightFull(s,e);
      boxes2.push(<span key={`m${i}`} className={`box ${night?'b-nightM':'b-dayM'}`} />);
      cur=e;
    }

    return (
      <details style={{marginTop:16}}>
        <summary><b>Explications (frises)</b></summary>
        <div style={{marginTop:12}}>
          <div style={{marginBottom:6}}>HS / HSN</div>
          <div className="row">{boxes1}</div>

          <div style={{marginTop:12, marginBottom:6}}>HSM / HNM</div>
          <div className="row">{boxes2}</div>

          <div style={{marginTop:12, fontSize:14}}>
            <b>Légende :</b>
            <span className="legend"><span className="chip b-day"/> HS</span>
            <span className="legend"><span className="chip b-night"/> HSN</span>
            <span className="legend"><span className="chip b-dayM"/> HSM</span>
            <span className="legend"><span className="chip b-nightM"/> HNM</span>
          </div>
        </div>
      </details>
    );
  }

  function isNightFull(s: Date, e: Date){
    // même logique que modules/civils.isFullNightHour, mais léger ici
    const spans: Array<{sd:Date; ed:Date}> = [];
    const midnight = new Date(s); midnight.setHours(24,0,0,0);
    if(e<=midnight) spans.push({sd:s,ed:e}); else { spans.push({sd:s,ed:midnight}); spans.push({sd:midnight,ed:e}); }
    for(const sp of spans){
      const d0=new Date(sp.sd); d0.setHours(0,0,0,0);
      const h06=new Date(d0); h06.setHours(6,0,0,0);
      const h21=new Date(d0); h21.setHours(21,0,0,0);
      const interStart = new Date(Math.max(sp.sd.getTime(), h06.getTime()));
      const interEnd   = new Date(Math.min(sp.ed.getTime(), h21.getTime()));
      if(interEnd>interStart) return false;
    }
    return true;
  }

  const css = (
    <style>{`
      .card{ background:#fff; border:1px solid #e6e6e6; border-radius:16px; padding:16px; margin:12px 0; }
      .row{ display:flex; gap:8px; flex-wrap:wrap; }
      .box{ width:28px; height:18px; border-radius:4px; border:1px solid #ddd; }
      .b-day{ background:#e9edf8; }       /* HS (jour) */
      .b-night{ background:#dfe4ff; }     /* HSN (nuit) */
      .b-dayM{ background:#ffd9d9; }      /* HSM (maj jour) */
      .b-nightM{ background:#f1d9ff; }    /* HNM (maj nuit) */
      .legend{ margin-left:10px; }
      .chip{ display:inline-block; width:14px; height:12px; border:1px solid #ddd; border-radius:3px; margin:0 4px -2px 8px; }
      .k{ color:#666; }
      .big{ font-weight:700; }
      .overs{ color:#d11; font-weight:700;}
      input[type="time"], input[type="text"]{ text-align:center; }
      footer{ text-align:center; color:#777; margin:28px 0 12px; }
      .grid2{ display:grid; grid-template-columns: 1fr 1fr; gap:12px; }
      @media (max-width:560px){ .grid2{ grid-template-columns: 1fr; } }
    `}</style>
  );

  // Ventilation & répartition
  const Vent = ()=> {
    if(!out) return null;
    const {HS,HSN,HSM,HNM,B_total_h} = out;
    const nonMaj = HS+HSN;
    const maj = HSM+HNM;

    // Crédit RCJ/RL
    let credit = '';
    if(baseDate){
      const d = baseDate.getDay();
      if(d===6 && maj>0) credit = 'Crédit de 1 RCJ au titre du DP sur le R';
      if(d===0 && maj>0) credit = 'Crédit de 1,5 ou 2 RCJ + 1 RL au titre du DP sur le RH';
    }

    return (
      <div className="grid2">
        <div className="card">
          <b>Ventilation des heures</b>
          <div style={{marginTop:8}}>
            {nonMaj>0 && <div>{nonMaj} HS</div>}
            {maj>0 && <div>dont {maj} heure(s) majorée(s)</div>}
          </div>
        </div>
        <div className="card">
          <b>Répartition des heures</b>
          <div style={{marginTop:8}}>
            <div>{HS} HS</div>
            <div>{HSN} HSN</div>
            <div>{HSM} HSM</div>
            <div>{HNM} HNM</div>
            {credit && <div style={{color:'#c00', fontWeight:700, marginTop:8}}>{credit}</div>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{maxWidth:680, margin:'0 auto', padding:'16px'}}>
      {css}

      <div className="card">
        <h2 style={{margin:'4px 0 12px'}}>Calcul heures</h2>

        {/* Date base */}
        <div style={{marginBottom:12}}>
          <div className="k" style={{marginBottom:6}}>Journée (comptable)</div>
          <input type="date" value={dateStr} onChange={e=>setDateStr(e.target.value)} />
        </div>

        {/* Prise */}
        <div style={{marginBottom:12}}>
          <div className="k">Prise de service</div>
          <input placeholder="HH:MM" value={pds} onChange={e=>setPds(e.target.value)} />
        </div>

        {/* Fin */}
        <div style={{marginBottom:12}}>
          <div className="k">Fin de service</div>
          <input placeholder="HH:MM" value={fds} onChange={e=>setFds(e.target.value)} />
        </div>

        {/* Coupure */}
        <div style={{marginBottom:12}}>
          <div className="k">Coupure</div>
          <div className="row" style={{gap:6}}>
            <input placeholder="HH:MM" value={brk1} onChange={e=>setBrk1(e.target.value)} />
            <span>–</span>
            <input placeholder="HH:MM" value={brk2} onChange={e=>setBrk2(e.target.value)} />
            <button onClick={clearBreak}>Effacer</button>
          </div>
        </div>

        {/* Repas méridien */}
        <div style={{marginBottom:12}}>
          <div className="k">Repas méridien (fin auto +1h si fin vide)</div>
          <div className="row" style={{gap:6}}>
            <input placeholder="HH:MM" value={m1}
                   onBlur={()=>ensurePlus1h(m1,m1e,setM1e)}
                   onChange={e=>setM1(e.target.value)} />
            <input placeholder="HH:MM" value={m1e} onChange={e=>setM1e(e.target.value)} />
            <button onClick={clearM1}>Effacer</button>
          </div>
        </div>

        {/* Repas vespéral */}
        <div style={{marginBottom:6}}>
          <div className="k">Repas vespéral (fin auto +1h si fin vide)</div>
          <div className="row" style={{gap:6}}>
            <input placeholder="HH:MM" value={m2}
                   onBlur={()=>ensurePlus1h(m2,m2e,setM2e)}
                   onChange={e=>setM2(e.target.value)} />
            <input placeholder="HH:MM" value={m2e} onChange={e=>setM2e(e.target.value)} />
            <button onClick={clearM2}>Effacer</button>
          </div>
        </div>

        <div style={{textAlign:'right', marginTop:8}}>
          <button onClick={clearAll}>Tout effacer</button>
        </div>
      </div>

      {/* TSr */}
      <div className="card"><b>TSr :</b> <b style={{fontWeight:700}}>{tsrLabel}</b></div>

      {/* Résultats */}
      {out && (
        <>
          <div className="card">
            <div><span className="k">DMJ atteinte à</span> <span className="big">{fmtHM(out.dmjEnd)}</span></div>
            <div style={{marginTop:6}}><span className="k">Amplitude atteinte à</span> <span className="big">{fmtHM(out.t13)}</span></div>
            <div style={{marginTop:6}}>
              <span className="k">Dépassement total</span>{' '}
              <span>{padHM(out.Bmin_min)}</span>{' '}→{' '}
              <span className="overs">{String(out.B_total_h).padStart(2,'0')}:00</span>
            </div>
          </div>

          <div className="card" style={{textAlign:'center'}}>
            <div>Amin <b>{Math.floor(out.Amin_min/60)} h <span className="big">{String(out.Amin_min%60).padStart(2,'0')}</span></b></div>
            <div style={{marginTop:6}}>Bmin <b>{Math.floor(out.Bmin_min/60)} h <span className="big">{String(out.Bmin_min%60).padStart(2,'0')}</span></b></div>
            <div style={{marginTop:10}}>
              { (out.Amin_min%60) === (out.Bmin_min%60) ? 'Amin = Bmin'
                : (out.Amin_min%60) > (out.Bmin_min%60) ? 'Amin > Bmin' : 'Amin < Bmin' }
            </div>
          </div>

          <Vent />
          <div className="card"><Frises/></div>
        </>
      )}

      <footer>© Stitch08</footer>
    </div>
  );
}
