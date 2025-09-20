import React, { useMemo, useState, useEffect } from "react";
import {
  compute,
  DayType,
  computeAccountingDate,
  dayTypeFromAccountingDate,
} from "./modules/civils";

/* ============ Helpers ============ */
const pad = (n: number) => String(n).padStart(2, "0");

function addMinutes(d: Date, m: number) { return new Date(d.getTime() + m * 60000); }
function toISODate(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function asHM(min: number) { const h = Math.floor(min/60), m = min%60; return `${pad(h)}:${pad(m)}`; }
function asHMstrict(min: number) { const h = Math.floor(min/60), m = min%60; return `${pad(h)}:${pad(m)}`; }

/** Pendant la frappe : garde 0-4 chiffres, insère ":" seulement à partir de 3 chiffres. */
function formatTypingHHMM(raw: string): string {
  const d = raw.replace(/[^\d]/g, "").slice(0, 4);
  if (d.length <= 2) return d;
  return d.slice(0, 2) + ":" + d.slice(2);
}
/** Au blur : finalise en HH:MM avec padding + bornage (0–23, 0–59). */
function finalizeHHMM(raw: string): string {
  const d = raw.replace(/[^\d]/g, "");
  if (d.length === 0) return "";
  let h = 0, m = 0;
  if (d.length === 1) { h = Number(d); m = 0; }
  else if (d.length === 2) { h = Number(d); m = 0; }
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
  return h >= 0 && h <= 23 && mm >= 0 && mm <= 59;
}
/** HH:MM -> Date ISO (+1h) puis renvoie "HH:MM" lisible (pas un datetime-local) */
function plus1hLabel(dateISO: string, hhmm: string) {
  if (!dateISO || !isValidHHMM(hhmm)) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(`${dateISO}T${pad(h)}:${pad(m)}`);
  const e = addMinutes(d, 60);
  return `${pad(e.getHours())}:${pad(e.getMinutes())}`;
}

/** DMJ/Amplitude : HH:MM en gras si même jour que PDS/FDS, sinon JJ/MM/AAAA HH:MM (heure en gras) */
function fmtSmart(d: Date, refStart?: Date, refEnd?: Date) {
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const sd = refStart ? refStart.toDateString() : "";
  const ed = refEnd ? refEnd.toDateString() : "";
  const same = d.toDateString() === sd || d.toDateString() === ed;
  if (same) return <strong>{hm}</strong>;
  return <>{pad(d.getDate())}/{pad(d.getMonth()+1)}/{d.getFullYear()} <strong>{hm}</strong></>;
}

/* ============ App ============ */
export default function App() {
  /* Prise / Fin : date + heure séparées */
  const [startDate, setStartDate] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");

  /* Coupure */
  const [breakDate, setBreakDate] = useState<string>("");
  const [breakStartTime, setBreakStartTime] = useState<string>("");
  const [breakEndTime, setBreakEndTime] = useState<string>("");

  /* Repas (début seulement, fin = +1h) */
  const [noonDate, setNoonDate] = useState<string>("");
  const [noonStart, setNoonStart] = useState<string>("");
  const [eveDate, setEveDate] = useState<string>("");
  const [eveStart, setEveStart] = useState<string>("");

  /* Type de jour (TSr) */
  const [dayType, setDayType] = useState<DayType>("SO");

  /* Constructions Date */
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
    if (!breakDate || !isValidHHMM(breakStartTime)) return null;
    const [h,m] = breakStartTime.split(":").map(Number);
    return new Date(`${breakDate}T${pad(h)}:${pad(m)}`);
  }, [breakDate, breakStartTime]);

  const breakEndDT = useMemo(() => {
    if (!breakDate || !isValidHHMM(breakEndTime)) return null;
    const [h,m] = breakEndTime.split(":").map(Number);
    return new Date(`${breakDate}T${pad(h)}:${pad(m)}`);
  }, [breakDate, breakEndTime]);

  const noonStartDT = useMemo(() => {
    if (!noonDate || !isValidHHMM(noonStart)) return null;
    const [h,m] = noonStart.split(":").map(Number);
    return new Date(`${noonDate}T${pad(h)}:${pad(m)}`);
  }, [noonDate, noonStart]);

  const eveStartDT = useMemo(() => {
    if (!eveDate || !isValidHHMM(eveStart)) return null;
    const [h,m] = eveStart.split(":").map(Number);
    return new Date(`${eveDate}T${pad(h)}:${pad(m)}`);
  }, [eveDate, eveStart]);

  /* TSr (journée comptable) */
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
      mealNoon:   noonStartDT ? { start: noonStartDT, end: addMinutes(noonStartDT,60) } : undefined,
      mealEvening: eveStartDT ? { start: eveStartDT,  end: addMinutes(eveStartDT, 60) } : undefined,
      dayType,
    });
  }, [startDT, endDT, breakStartDT, breakEndDT, noonStartDT, eveStartDT, dayType]);

  /* Libellés & répartition */
  const HS_label  = dayType === "RH" ? "HSD" : "HS";
  const HSM_label = dayType === "RH" ? "HDM" : "HSM";
  const factor    = dayType === "SO" ? 1.5 : dayType === "R" ? 2 : 3;

  const nonMaj = out ? Math.min(out.A_hours, out.B_total_h) : 0;
  const maj    = out ? Math.max(0, out.B_total_h - nonMaj) : 0;

  const cmp = out
    ? (out.Amin_min % 60) > (out.Bmin_min % 60) ? ">" :
      (out.Amin_min % 60) < (out.Bmin_min % 60) ? "<" : "="
    : "=";

  /* Styles (anti débordement) */
  const box: React.CSSProperties  = { margin: "16px auto", maxWidth: 900, padding: 16, fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,sans-serif" };
  const card: React.CSSProperties = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 };
  const row2: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, alignItems: "center" };
  const row3: React.CSSProperties = { display: "grid", gridTemplateColumns: "auto 1fr", gap: 6 };
  const btn: React.CSSProperties  = { padding: "6px 10px", border: "1px solid #e5e7eb", borderRadius: 8, background: "#f8fafc" };
  const inputStyle: React.CSSProperties = { width: "100%", minWidth: 0 };

  /* Effacer tout */
  function clearAll() {
    setStartDate(""); setStartTime("");
    setEndDate(""); setEndTime("");
    setBreakDate(""); setBreakStartTime(""); setBreakEndTime("");
    setNoonDate(""); setNoonStart("");
    setEveDate(""); setEveStart("");
    setDayType("SO");
  }

  /* Rendus */
  return (
    <div style={box}>
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}>
        <button style={btn} onClick={clearAll}>Tout effacer</button>
      </div>

      {/* --- Formulaire --- */}
      <div style={{ ...card, display: "grid", gap: 12 }}>
        {/* Prise de service */}
        <div>
          <label>Prise de service</label>
          <div style={row2}>
            <input style={inputStyle} type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} />
            <input
              style={inputStyle}
              inputMode="numeric" pattern="[0-9]*" placeholder="HH:MM" maxLength={5}
              value={startTime}
              onChange={e=>setStartTime(formatTypingHHMM(e.target.value))}
              onBlur={e=>setStartTime(finalizeHHMM(e.target.value))}
            />
          </div>
        </div>

        {/* Fin de service */}
        <div>
          <label>Fin de service</label>
          <div style={row2}>
            <input style={inputStyle} type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} />
            <input
              style={inputStyle}
              inputMode="numeric" pattern="[0-9]*" placeholder="HH:MM" maxLength={5}
              value={endTime}
              onChange={e=>setEndTime(formatTypingHHMM(e.target.value))}
              onBlur={e=>setEndTime(finalizeHHMM(e.target.value))}
            />
          </div>
        </div>

        {/* Coupure */}
        <div>
          <div style={{ marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
            <span>Coupure</span>
            <button style={btn} onClick={()=>{ setBreakDate(""); setBreakStartTime(""); setBreakEndTime(""); }}>Effacer</button>
          </div>
          <div style={row2}>
            <input style={inputStyle} type="date" value={breakDate} onChange={e=>setBreakDate(e.target.value)} />
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8}}>
              <input
                style={inputStyle}
                inputMode="numeric" pattern="[0-9]*" placeholder="HH:MM" maxLength={5}
                value={breakStartTime}
                onChange={e=>setBreakStartTime(formatTypingHHMM(e.target.value))}
                onBlur={e=>setBreakStartTime(finalizeHHMM(e.target.value))}
              />
              <input
                style={inputStyle}
                inputMode="numeric" pattern="[0-9]*" placeholder="HH:MM" maxLength={5}
                value={breakEndTime}
                onChange={e=>setBreakEndTime(formatTypingHHMM(e.target.value))}
                onBlur={e=>setBreakEndTime(finalizeHHMM(e.target.value))}
              />
            </div>
          </div>
        </div>

        {/* Repas méridien */}
        <div>
          <div style={{ marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
            <span>Repas méridien</span>
            <button style={btn} onClick={()=>{ setNoonDate(""); setNoonStart(""); }}>Effacer</button>
          </div>
          <div style={row2}>
            <input style={inputStyle} type="date" value={noonDate} onChange={e=>setNoonDate(e.target.value)} />
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8}}>
              <input
                style={inputStyle}
                inputMode="numeric" pattern="[0-9]*" placeholder="HH:MM" maxLength={5}
                value={noonStart}
                onChange={e=>setNoonStart(formatTypingHHMM(e.target.value))}
                onBlur={e=>setNoonStart(finalizeHHMM(e.target.value))}
              />
              <input style={inputStyle} value={plus1hLabel(noonDate, noonStart)} readOnly />
            </div>
          </div>
        </div>

        {/* Repas vespéral */}
        <div>
          <div style={{ marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
            <span>Repas vespéral</span>
            <button style={btn} onClick={()=>{ setEveDate(""); setEveStart(""); }}>Effacer</button>
          </div>
          <div style={row2}>
            <input style={inputStyle} type="date" value={eveDate} onChange={e=>setEveDate(e.target.value)} />
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8}}>
              <input
                style={inputStyle}
                inputMode="numeric" pattern="[0-9]*" placeholder="HH:MM" maxLength={5}
                value={eveStart}
                onChange={e=>setEveStart(formatTypingHHMM(e.target.value))}
                onBlur={e=>setEveStart(finalizeHHMM(e.target.value))}
              />
              <input style={inputStyle} value={plus1hLabel(eveDate, eveStart)} readOnly />
            </div>
          </div>
        </div>
      </div>

      {/* TSr */}
      {out && (
        <div style={{ ...card, marginTop: 12 }}>
          Tsr : <strong>{dayType}</strong> {dayType === "SO" ? "(Lun–Ven)" : dayType === "R" ? "(Samedi)" : "(Dimanche)"}
        </div>
      )}

      {/* Repères */}
      {out && (
        <div style={{ ...card, marginTop: 12 }}>
          <div style={row2}>
            <div>DMJ atteinte à</div>
            <div>{fmtSmart(out.dmjEnd, startDT!, endDT!)}</div>

            <div>Amplitude atteinte à</div>
            <div>{fmtSmart(out.t13, startDT!, endDT!)}</div>

            <div>Dépassement total</div>
            <div>
              {asHM(out.Bmin_min)} → <strong style={{color:"#b91c1c"}}>{asHMstrict(out.B_total_h*60)}</strong>
            </div>
          </div>
        </div>
      )}

      {/* Amin / Bmin */}
      {out && (
        <div style={{ ...card, marginTop: 12 }}>
          <div style={row2}>
            <div>Amin</div>
            <div>{Math.floor(out.Amin_min/60)} h <strong>{pad(out.Amin_min%60)}</strong></div>
            <div>Bmin</div>
            <div>{Math.floor(out.Bmin_min/60)} h <strong>{pad(out.Bmin_min%60)}</strong></div>
          </div>
          <div style={{ marginTop: 8, textAlign: "center", fontSize: 18 }}>
            Amin {cmp} Bmin
          </div>
        </div>
      )}

      {/* Ventilation / Répartition */}
      {out && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ ...card, marginTop: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Ventilation des heures</div>
            <div style={row3}>
              <div>{nonMaj} {HS_label}</div><div />
              {maj>0 && (<><div>1 HS × {factor*100}% soit</div><div>{maj} {HSM_label} ({dayType})</div></>)}
            </div>
          </div>

          <div style={{ ...card, marginTop: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Répartition des heures</div>
            <div style={row3}>
              <div>{nonMaj} {HS_label}</div><div />
              {maj>0 && (<><div>{maj} {HSM_label}</div><div /></>)}
            </div>
            <div style={{ marginTop: 8, color: "#b91c1c", fontWeight: 600 }}>
              {dayType === "R"  && "Crédit de 1 RCJ au titre du DP sur le R"}
              {dayType === "RH" && "Crédit de 1,5 RCJ ou 2 RCJ + 1 RL au titre du DP sur le RH"}
            </div>
          </div>
        </div>
      )}

      {/* footer */}
      <div style={{opacity:0.6, fontSize:12, textAlign:"center", marginTop:16}}>
        © Stitch08
      </div>
    </div>
  );
}
