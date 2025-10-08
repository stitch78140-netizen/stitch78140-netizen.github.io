const VERSION = "stable-1";
/* ===========================================
   CHECKPOINT: Frise OK — 2025-09-20
   Base stable (UI + frise + acronymes)
   =========================================== */

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
function asHM(min: number) { const h = Math.floor(min/60), m = min%60; return `${pad(h)}:${pad(m)}`; }
function asHMstrict(min: number) { const h = Math.floor(min/60), m = min%60; return `${pad(h)}:${pad(m)}`; }

/** Pendant la frappe : 0–4 chiffres ; ajoute ":" à partir de 3 chiffres. */
function formatTypingHHMM(raw: string): string {
  const d = raw.replace(/[^\d]/g, "").slice(0, 4);
  if (d.length <= 2) return d;
  return d.slice(0, 2) + ":" + d.slice(2);
}
/** Au blur : finalise en HH:MM (padding) + bornage (0–23, 0–59). */
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

/** +1h sous forme HH:MM ; si date vide, fallback sur la PDS. */
function plus1hLabel(dateISO: string, hhmm: string, fallbackDateISO?: string) {
  const useDate = dateISO || fallbackDateISO || "";
  if (!useDate || !isValidHHMM(hhmm)) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(`${useDate}T${pad(h)}:${pad(m)}`);
  const e = addMinutes(d, 60);
  return `${pad(e.getHours())}:${pad(e.getMinutes())}`;
}

/** DMJ/Amplitude : HH:MM en gras si même jour que PDS/FDS ; sinon JJ/MM/AAAA HH:MM (heure en gras). */
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

  /* Constructions Date (fallback sur startDate si date locale absente) */
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
  const HSM_label = dayType === "RH" ? "HSDM" : "HSM";
  const factor    = dayType === "SO" ? 1.5 : dayType === "R" ? 2 : 3;

  const nonMaj = out ? Math.min(out.A_hours, out.B_total_h) : 0;
  const maj    = out ? Math.max(0, out.B_total_h - nonMaj) : 0;

  const cmp = out
    ? (out.Amin_min % 60) > (out.Bmin_min % 60) ? ">" :
      (out.Amin_min % 60) < (out.Bmin_min % 60) ? "<" : "="
    : "=";
   
  /* ============ Styles mobile-first ============ */
  const box: React.CSSProperties  = { margin: "16px auto", maxWidth: 900, padding: 16, fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,sans-serif" };
  const card: React.CSSProperties = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 };
  const row3: React.CSSProperties = { display: "grid", gridTemplateColumns: "auto 1fr", gap: 6 };
  const btn: React.CSSProperties  = { padding: "6px 10px", border: "1px solid #e5e7eb", borderRadius: 8, background: "#f8fafc" };
  const labelCol: React.CSSProperties = { fontWeight: 500, marginBottom: 6 };

  // lignes du formulaire (toujours sur 2 lignes : date puis heures)
  const dateRow: React.CSSProperties = { display: "block", width: "100%", marginBottom: 6 };
  const timesRow2: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "minmax(6.2em,1fr) minmax(2em,auto) minmax(6.2em,1fr)", // HH:MM – HH:MM
    gap: 8,
    alignItems: "center",
    width: "100%",
  };
  const timesRow1pair: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "minmax(6.2em,1fr) minmax(6.2em,1fr)", // HH:MM  +1h
    gap: 8,
    alignItems: "center",
    width: "100%",
  };

  const inputBase: React.CSSProperties   = { width: "100%", minWidth: 0, boxSizing: "border-box", fontSize: 16, padding: "8px 10px" };
  const sep: React.CSSProperties         = { textAlign: "center", opacity: 0.6 };

  /* Effacer tout */
  function clearAll() {
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

      {/* --- Formulaire (mobile-first) --- */}
      <div style={{ ...card, display: "grid", gap: 12 }}>
        {/* Prise de service */}
        <div>
          <div style={labelCol}>Prise de service</div>
          <div style={dateRow}>
            <input style={inputBase} type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} />
          </div>
          <div style={timesRow1pair}>
            <input
              style={inputBase}
              inputMode="numeric" pattern="[0-9]*" placeholder="HH:MM" maxLength={5}
              value={startTime}
              onChange={e=>setStartTime(formatTypingHHMM(e.target.value))}
              onBlur={e=>setStartTime(finalizeHHMM(e.target.value))}
            />
            <div />
          </div>
        </div>

        {/* Fin de service */}
        <div>
          <div style={labelCol}>Fin de service</div>
          <div style={dateRow}>
            <input style={inputBase} type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} />
          </div>
          <div style={timesRow1pair}>
            <input
              style={inputBase}
              inputMode="numeric" pattern="[0-9]*" placeholder="HH:MM" maxLength={5}
              value={endTime}
              onChange={e=>setEndTime(formatTypingHHMM(e.target.value))}
              onBlur={e=>setEndTime(finalizeHHMM(e.target.value))}
            />
            <div />
          </div>
        </div>

        {/* Coupure */}
        <div>
          <div style={{ ...labelCol, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Coupure</span>
            <button style={btn} onClick={()=>{ setBreakDate(""); setBreakStartTime(""); setBreakEndTime(""); }}>Effacer</button>
          </div>
          <div style={dateRow}>
            <input style={inputBase} type="date" value={breakDate} onChange={e=>setBreakDate(e.target.value)} />
          </div>
          <div style={timesRow2}>
            <input
              style={inputBase}
              inputMode="numeric" pattern="[0-9]*" placeholder="HH:MM" maxLength={5}
              value={breakStartTime}
              onChange={e=>setBreakStartTime(formatTypingHHMM(e.target.value))}
              onBlur={e=>{
                const v = finalizeHHMM(e.target.value);
                setBreakStartTime(v);
                if (!breakDate && startDate && v) setBreakDate(startDate); // auto-date
              }}
            />
            <div style={sep}>–</div>
            <input
              style={inputBase}
              inputMode="numeric" pattern="[0-9]*" placeholder="HH:MM" maxLength={5}
              value={breakEndTime}
              onChange={e=>setBreakEndTime(formatTypingHHMM(e.target.value))}
              onBlur={e=>{
                const v = finalizeHHMM(e.target.value);
                setBreakEndTime(v);
                if (!breakDate && startDate && v) setBreakDate(startDate); // auto-date
              }}
            />
          </div>
        </div>

        {/* Repas méridien */}
        <div>
          <div style={{ ...labelCol, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Repas méridien</span>
            <button style={btn} onClick={()=>{ setNoonDate(""); setNoonStart(""); }}>Effacer</button>
          </div>
          <div style={dateRow}>
            <input style={inputBase} type="date" value={noonDate} onChange={e=>setNoonDate(e.target.value)} />
          </div>
          <div style={timesRow1pair}>
            <input
              style={inputBase}
              inputMode="numeric" pattern="[0-9]*" placeholder="HH:MM" maxLength={5}
              value={noonStart}
              onChange={e=>setNoonStart(formatTypingHHMM(e.target.value))}
              onBlur={e=>{
                const v = finalizeHHMM(e.target.value);
                setNoonStart(v);
                if (!noonDate && startDate && v) setNoonDate(startDate); // auto-date
              }}
            />
            <input style={inputBase} value={plus1hLabel(noonDate, noonStart, startDate)} readOnly />
          </div>
        </div>

        {/* Repas vespéral */}
        <div>
          <div style={{ ...labelCol, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Repas vespéral</span>
            <button style={btn} onClick={()=>{ setEveDate(""); setEveStart(""); }}>Effacer</button>
          </div>
          <div style={dateRow}>
            <input style={inputBase} type="date" value={eveDate} onChange={e=>setEveDate(e.target.value)} />
          </div>
          <div style={timesRow1pair}>
            <input
              style={inputBase}
              inputMode="numeric" pattern="[0-9]*" placeholder="HH:MM" maxLength={5}
              value={eveStart}
              onChange={e=>setEveStart(formatTypingHHMM(e.target.value))}
              onBlur={e=>{
                const v = finalizeHHMM(e.target.value);
                setEveStart(v);
                if (!eveDate && startDate && v) setEveDate(startDate); // auto-date
              }}
            />
            <input style={inputBase} value={plus1hLabel(eveDate, eveStart, startDate)} readOnly />
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
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
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      <div>Amin</div>
      <div>{Math.floor(out.Amin_min/60)} h <strong>{pad(out.Amin_min%60)}</strong></div>
      <div>Bmin</div>
      <div>{Math.floor(out.Bmin_min/60)} h <strong>{pad(out.Bmin_min%60)}</strong></div>
    </div>

    {/* Règle d'affichage sous le tableau */}
    <div
      style={{
        marginTop: 8,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: 18,
        width: "100%",
      }}
    >
      {endDT!.getTime() < out.t13.getTime() ? (
        // Amplitude non atteinte
        <div style={{ textAlign: "center", width: "100%", opacity: 0.6 }}>
          Amplitude non atteinte
        </div>
      ) : (
        // Amplitude atteinte : règle + valeur de A
        <>
          <div>Amin {cmp} Bmin</div>
          {(() => {
            const aHours = out.Amin_min / 60;
            // Si A < B → arrondi inférieur ; sinon (A ≥ B) → arrondi supérieur
            const A = cmp === "<" ? Math.floor(aHours) : Math.ceil(aHours);
            return <div>soit A = <strong>{A}</strong></div>;
          })()}
        </>
      )}
    </div>
  </div>
)}
    {/* RÉPARTITION (créditée) */}
    <div style={{ ...card, marginTop: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Répartition des heures</div>
      <div style={{ display:"grid", gridTemplateColumns:"auto 1fr", gap:6 }}>
        {/* Non majorées rendues telles quelles */}
        {out.HS  > 0 && (<><div>{out.HS} {dayType === "RH" ? "HSD" : "HS"}</div><div /></>)}
         {out.HSN > 0 && (<><div>{out.HSN} HSN</div><div /></>)}
        {/* Crédits majorés (après application du facteur) */}
        {(() => {
          const factor = dayType === "SO" ? 1.5 : dayType === "R" ? 2 : 3;
          const HSM_label = dayType === "RH" ? "HDM" : "HSM";
          const fmt = (n:number) => {
            const s = (Math.round(n*2)/2).toString();
            return s.endsWith(".0") ? s.slice(0,-2) : s;
          };
          const creditedHSM = out.HSM * factor;
          const creditedHNM = out.HNM * factor;

          return (
            <>
              {creditedHSM > 0 && (<><div>{fmt(creditedHSM)} {HSM_label}</div><div /></>)}
              {creditedHNM > 0 && (<><div>{fmt(creditedHNM)} HNM</div><div /></>)}
            </>
          );
        })()}
      </div>

      {/* DP crédits */}
      <div style={{ marginTop: 8, color: "#b91c1c", fontWeight: 600 }}>
        {dayType === "R"  && "Crédit de 1 RCJ au titre du DP sur le R"}
        {dayType === "RH" && "Crédit de 1,5 RCJ ou 2 RCJ + 1 RL au titre du DP sur le RH"}
      </div>
    </div>
  </div>
)}

            {/* --- Frise explicative --- */}
      {out && (
        <div style={{ ...card, marginTop: 12 }}>
          <FriseTimeline
            start={startDT!}
            dmj={out.dmjEnd}
            t13={out.t13}
            end={endDT!}
            nonMajHours={nonMaj}
            majHours={maj}
            dayType={dayType}
          />
        </div>
      )}

      {/* footer */}
      <div style={{ opacity:0.6, fontSize:12, textAlign:"center", marginTop:16 }}>
        © Stitch08
      </div>
    </div>
  );
} // <-- close App component here
/* ============ Frise chronologique (acronymes sur la ligne) ============ */
function FriseTimeline(props: {
  start: Date;         // PDS
  dmj: Date;           // fin DMJ
  t13: Date;           // début amplitude
  end: Date;           // FDS (pas indispensable pour la frise)
  nonMajHours: number; // HS/HSN/HSD (non majorées) à partir de DMJ
  majHours: number;    // HSM/HSNM/HSDM à partir de t13 (amplitude)
  dayType: DayType;    // pour les libellés dimanche
}) {
  const W = 520;        // largeur mini
  const H = 170;        // hauteur totale
  const PADL = 58;      // marge gauche
  const PADR = 16;
  const Y1 = 62;        // y de la ligne 1
  const Y2 = 132;       // y de la ligne 2
  const hourW = 56;     // distance entre deux heures
  const isSunday = props.dayType === "RH"; // dimanche
  const fmt = (d: Date) =>
    `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

  // Une heure entière est « nuit » si [s,e] est entièrement dans [21:00,06:00) (en tenant le passage minuit).
  function isFullNightHour(s: Date, e: Date) {
    const spans: Array<{ sd: Date; ed: Date }> = [];
    const mid = new Date(s); mid.setHours(24, 0, 0, 0);
    if (e <= mid) spans.push({ sd: s, ed: e }); else { spans.push({ sd: s, ed: mid }); spans.push({ sd: mid, ed: e }); }
    for (const sp of spans) {
      const d0 = new Date(sp.sd); d0.setHours(0, 0, 0, 0);
      const h06 = new Date(d0); h06.setHours(6, 0, 0, 0);
      const h21 = new Date(d0); h21.setHours(21, 0, 0, 0);
      const interStart = new Date(Math.max(sp.sd.getTime(), h06.getTime()));
      const interEnd   = new Date(Math.min(sp.ed.getTime(), h21.getTime()));
      if (interEnd > interStart) return false; // il y a du jour
    }
    return true;
  }

  // Trait vertical + heure en dessous (toujours noir)
  function tick(x: number, y: number, label: string) {
    return (
      <g>
        <line x1={x} y1={y - 12} x2={x} y2={y + 12}
              stroke="#111827" strokeWidth="2" />
        <text x={x} y={y + 24} textAnchor="middle" fontSize="12"
              fill="#111827">
          {label}
        </text>
      </g>
    );
  }

  // Texte centré sur le segment (entre deux traits)
  function segAcronym(x1: number, x2: number, y: number, text: string, night = false) {
    const cx = (x1 + x2) / 2;
    return (
      <text x={cx} y={y - 6} textAnchor="middle" fontSize="12"
            fill={night ? "#dc2626" : "#111827"} fontWeight={600}>
        {text}
      </text>
    );
  }

  // Longueurs de lignes
  const lineLenTop = Math.max(1, props.nonMajHours) * hourW;
  const lineLenBot = Math.max(1, props.majHours) * hourW;

  const viewW = Math.max(W, PADL + PADR + Math.max(lineLenTop, lineLenBot));
  const needLine2 = props.majHours > 0;
  const isRH = props.dayType === "RH";

  return (
    <svg width="100%" height={needLine2 ? H : H - 44}
         viewBox={`0 0 ${viewW} ${needLine2 ? H : H - 44}`}>

      {/* Titre */}
      <text x={viewW / 2} y={24} textAnchor="middle"
            fontSize="14" fontWeight={700} fill="#111827">
        RÉPARTITION DES HEURES
      </text>

      {/* ===== Ligne 1 : HS / HSN / HSD ===== */}
      <text x={PADL - 38} y={Y1 - 22} fontSize="12" fill="#374151">Pds</text>
      <text x={PADL}       y={Y1 - 22} fontSize="12" fill="#374151" textAnchor="middle">DMJ</text>

      <line x1={PADL} y1={Y1} x2={PADL + lineLenTop} y2={Y1} stroke="#9ca3af" strokeWidth="2" />
      <line x1={PADL - 40} y1={Y1} x2={PADL} y2={Y1} stroke="#9ca3af" strokeDasharray="4 4" />

      {tick(PADL - 40, Y1, fmt(props.start))}
      {tick(PADL, Y1, fmt(props.dmj))}

      {Array.from({ length: props.nonMajHours }).map((_, i) => {
        const s = new Date(props.dmj.getTime() + i * 3600000);
        const e = new Date(s.getTime() + 3600000);
        const x1 = PADL + i * hourW;
        const x2 = PADL + (i + 1) * hourW;
        const night = isFullNightHour(s, e);
        const labelTop = night
         ? "HSN" : (isSunday ? "HSD" : "HS");
        return (
          <g key={`top-${i}`}>
            {tick(x2, Y1, fmt(e))}
            {segAcronym(x1, x2, Y1, labelTop, night)}
          </g>
        );
      })}

      {/* ===== Ligne 2 : HSM / HSNM / HSDM ===== */}
      {needLine2 && (
        <>
          <text x={PADL - 40} y={Y2 - 22} fontSize="12" fill="#374151">Amplitude</text>

          <line x1={PADL} y1={Y2} x2={PADL + lineLenBot} y2={Y2} stroke="#9ca3af" strokeWidth="2" />
          {tick(PADL, Y2, fmt(props.t13))}

          {Array.from({ length: props.majHours }).map((_, i) => {
            const s = new Date(props.t13.getTime() + i * 3600000);
            const e = new Date(s.getTime() + 3600000);
            const x1 = PADL + i * hourW;
            const x2 = PADL + (i + 1) * hourW;
           const night = isFullNightHour(s, e);
           const labelBot = night
           ? "HSNM"
           : (isSunday ? "HSDM" : "HSM");
            return (
              <g key={`bot-${i}`}>
                {tick(x2, Y2, fmt(e))}
                {segAcronym(x1, x2, Y2, labelBot, night)}
              </g>
            );
          })}
        </>
      )}
    </svg>
  );
}
