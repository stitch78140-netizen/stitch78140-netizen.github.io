import React, { useMemo, useState } from "react";
import { compute, DayType } from "./modules/civils";

// mini helpers pour inputs
function toLocal(d: Date){ const p=(n:number)=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}` }
function asHM(min: number){ const h=Math.floor(min/60), m=min%60; return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}` }

export default function App(){
  // valeurs par défaut simples
  const today = new Date(); today.setHours(7,0,0,0);
  const [dayType, setDayType] = useState<DayType>('SO');
  const [start, setStart] = useState<Date>(new Date(today));
  const [end, setEnd] = useState<Date>(new Date(today.getTime()+13.5*3600*1000));
  const [breakStart, setBreakStart] = useState<string>('');
  const [breakEnd, setBreakEnd] = useState<string>('');
  const [noonS, setNoonS] = useState<string>('');
  const [noonE, setNoonE] = useState<string>('');
  const [eveS, setEveS] = useState<string>('');
  const [eveE, setEveE] = useState<string>('');

  const out = useMemo(()=> compute({
    date: new Date(start.getFullYear(), start.getMonth(), start.getDate()),
    start, end,
    theBreak: breakStart && breakEnd ? { start:new Date(breakStart), end:new Date(breakEnd)}: undefined,
    mealNoon: noonS && noonE ? { start:new Date(noonS), end:new Date(noonE)}: undefined,
    mealEvening: eveS && eveE ? { start:new Date(eveS), end:new Date(eveE)}: undefined,
    dayType
  }), [start,end,breakStart,breakEnd,noonS,noonE,eveS,eveE,dayType]);

  const factor = dayType==='SO'?1.5: dayType==='R'?2: 3;
  const HS_label  = dayType==='RH' ? 'HSD' : 'HS';
  const HSM_label = dayType==='RH' ? 'HDM' : 'HSM';
  const nonMaj = Math.min(out.A_hours, out.B_total_h);
  const maj    = Math.max(0, out.B_total_h - nonMaj);

  const box: React.CSSProperties = { margin:'16px auto', maxWidth:900, padding:16, fontFamily:'system-ui,-apple-system,Segoe UI,Roboto,sans-serif' };
  const card: React.CSSProperties = { background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, padding:12 };

  return (
    <div style={box}>
      <h1 style={{fontSize:24, margin:'0 0 12px'}}>Civils Déplacés v6</h1>

      {/* Formulaire */}
      <div style={{display:'grid', gap:12, gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', ...card}}>
        <label>Jour
          <select value={dayType} onChange={e=> setDayType(e.target.value as DayType)} style={{display:'block', width:'100%'}}>
            <option value="SO">SO (Lun–Ven)</option>
            <option value="R">R (Samedi)</option>
            <option value="RH">RH (Dimanche)</option>
          </select>
        </label>
        <label>Prise de service
          <input type="datetime-local" value={toLocal(start)} onChange={e=> setStart(new Date(e.target.value))} style={{display:'block', width:'100%'}}/>
        </label>
        <label>Fin de service
          <input type="datetime-local" value={toLocal(end)} onChange={e=> setEnd(new Date(e.target.value))} style={{display:'block', width:'100%'}}/>
        </label>
        <label>Coupure début
          <input type="datetime-local" value={breakStart} onChange={e=> setBreakStart(e.target.value)} style={{display:'block', width:'100%'}}/>
        </label>
        <label>Coupure fin
          <input type="datetime-local" value={breakEnd} onChange={e=> setBreakEnd(e.target.value)} style={{display:'block', width:'100%'}}/>
        </label>
        <label>Repas méridien début
          <input type="datetime-local" value={noonS} onChange={e=> setNoonS(e.target.value)} style={{display:'block', width:'100%'}}/>
        </label>
        <label>Repas méridien fin
          <input type="datetime-local" value={noonE} onChange={e=> setNoonE(e.target.value)} style={{display:'block', width:'100%'}}/>
        </label>
        <label>Repas vespéral début
          <input type="datetime-local" value={eveS} onChange={e=> setEveS(e.target.value)} style={{display:'block', width:'100%'}}/>
        </label>
        <label>Repas vespéral fin
          <input type="datetime-local" value={eveE} onChange={e=> setEveE(e.target.value)} style={{display:'block', width:'100%'}}/>
        </label>
      </div>

      {/* Repères */}
      <div style={{...card, marginTop:12}}>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
          <div>DMJ atteinte à</div><div>{out.dmjEnd.toLocaleString()}</div>
          <div>Amplitude atteinte à</div><div>{out.t13.toLocaleString()}</div>
          <div>Dépassement total</div>
          <div>{asHM(out.Bmin_min)} → arrondi à {out.B_total_h}:00</div>
        </div>
      </div>

      {/* Amin / Bmin */}
      <div style={{...card, marginTop:12}}>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
          <div>Amin</div><div>{Math.floor(out.Amin_min/60)} h {String(out.Amin_min%60).padStart(2,'0')}</div>
          <div>Bmin</div><div>{Math.floor(out.Bmin_min/60)} h {String(out.Bmin_min%60).padStart(2,'0')}</div>
        </div>
        <div style={{marginTop:8, textAlign:'center'}}>Amin { (out.Amin_min%60) > (out.Bmin_min%60) ? '>' : '<=' } Bmin</div>
      </div>

      {/* Cadres Ventilation / Répartition */}
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
        <div style={{...card, marginTop:12}}>
          <div style={{fontWeight:600, marginBottom:8}}>Ventilation des heures</div>
          <div style={{display:'grid', gridTemplateColumns:'auto 1fr', gap:6}}>
            <div>{nonMaj} {HS_label}</div><div/>
            {maj>0 && (<><div>1 HS × {factor*100}% soit</div><div>{maj} {HSM_label} ({dayType})</div></>)}
          </div>
          <div style={{marginTop:8, color:'#b91c1c', fontWeight:600}}>
            {dayType==='R' && 'Crédit de 1 RCJ au titre du DP sur le R'}
            {dayType==='RH' && 'Crédit de 1,5 RCJ ou 2 RCJ + 1 RL au titre du DP sur le RH'}
          </div>
        </div>
        <div style={{...card, marginTop:12}}>
          <div style={{fontWeight:600, marginBottom:8}}>Répartition des heures</div>
          <div style={{display:'grid', gridTemplateColumns:'auto 1fr', gap:6}}>
            <div>{nonMaj} {HS_label}</div><div/>
            {maj>0 && (<><div>{maj} {HSM_label}</div><div/></>)}
          </div>
        </div>
      </div>

      {/* Totaux par acronymes (HS/HSN/HSM/HNM) */}
      <div style={{...card, marginTop:12}}>
        <div style={{fontWeight:600, marginBottom:8}}>Totaux</div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6}}>
          <div>{dayType==='RH'?'HSD':'HS'}: {out.HS}</div>
          <div>HSN: {out.HSN}</div>
          <div>{dayType==='RH'?'HDM':'HSM'}: {out.HSM}</div>
          <div>HNM: {out.HNM}</div>
        </div>
      </div>
    </div>
  );
}
