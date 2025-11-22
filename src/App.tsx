const VERSION = "stable-1";
/* ===========================================
   CHECKPOINT: Frise OK — 2025-09-20
   Base stable (UI + frise + acronymes) + repas fin éditable + bornage coupure
   + Nettoyage chambre (REM. COND. LOCAUX HEBERG.) – calcul min avant/pendant
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

function addMinutes(d: Date, m: number) {
  return new Date(d.getTime() + m * 60000);
}
function asHM(min: number) {
  const h = Math.floor(min / 60), m = min % 60;
  return `${pad(h)}:${pad(m)}`;
}
function asHMstrict(min: number) {
  const h = Math.floor(min / 60), m = min % 60;
  return `${pad(h)}:${pad(m)}`;
}
// Format mm → "HHhMM" (pour messages)
function fmtHM(min: number) {
  const h = Math.floor(min / 60), m = min % 60;
  return `${String(h).padStart(2, "0")}h${String(m).padStart(2, "0")}`;
}
function formatMinutes(m: number) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${pad(h)}h${pad(mm)}`;
}
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
  else if (d.length === 3) { h = Number(d.slice(0, 2)); m = Number("0" + d.slice(2)); }
  else { h = Number(d.slice(0, 2)); m = Number(d.slice(2, 4)); }
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

/** Libellés DMJ/Amplitude : HH:MM en gras si même jour que PDS/FDS ; sinon JJ/MM/AAAA HH:MM (heure en gras). */
function fmtSmart(d: Date, refStart?: Date, refEnd?: Date) {
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const sd = refStart ? refStart.toDateString() : "";
  const ed = refEnd ? refEnd.toDateString() : "";
  const same = d.toDateString() === sd || d.toDateString() === ed;
  if (same) return <strong>{hm}</strong>;
  return <>
    {pad(d.getDate())}/{pad(d.getMonth() + 1)}/{d.getFullYear()} <strong>{hm}</strong>
  </>;
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

  /* Repas (début + fin éditable ; auto +1h si fin vide au blur) */
  const [noonDate, setNoonDate] = useState<string>("");
  const [noonStart, setNoonStart] = useState<string>("");
  const [noonEnd, setNoonEnd] = useState<string>("");
  const [eveDate, setEveDate] = useState<string>("");
  const [eveStart, setEveStart] = useState<string>("");
  const [eveEnd, setEveEnd] = useState<string>("");

  /* Nettoyage chambre – REM. COND. LOCAUX HEBERG. (forfait 20 min) */
  const [cleanDate, setCleanDate] = useState<string>("");
  const [cleanStart, setCleanStart] = useState<string>("");

  /* Affichage / masquage du bloc nettoyage */
  const [cleanEnabled, setCleanEnabled] = useState<boolean>(false);

  /* Type de jour (TSr) */
  const [dayType, setDayType] = useState<DayType>("SO");

  /* Constructions Date */
  const startDT = useMemo(() => {
    if (!startDate || !isValidHHMM(startTime)) return null;
    const [h, m] = startTime.split(":").map(Number);
    return new Date(`${startDate}T${pad(h)}:${pad(m)}`);
  }, [startDate, startTime]);

  const endDT = useMemo(() => {
    if (!endDate || !isValidHHMM(endTime)) return null;
    const [h, m] = endTime.split(":").map(Number);
    return new Date(`${endDate}T${pad(h)}:${pad(m)}`);
  }, [endDate, endTime]);

  const breakStartDT = useMemo(() => {
    const dISO = breakDate || startDate;
    if (!dISO || !isValidHHMM(breakStartTime)) return null;
    const [h, m] = breakStartTime.split(":").map(Number);
    return new Date(`${dISO}T${pad(h)}:${pad(m)}`);
  }, [breakDate, breakStartTime, startDate]);

  const breakEndDT = useMemo(() => {
    const dISO = breakDate || startDate;
    if (!dISO || !isValidHHMM(breakEndTime)) return null;
    const [h, m] = breakEndTime.split(":").map(Number);
    return new Date(`${dISO}T${pad(h)}:${pad(m)}`);
  }, [breakDate, breakEndTime, startDate]);

  const noonStartDT = useMemo(() => {
    const dISO = noonDate || startDate;
    if (!dISO || !isValidHHMM(noonStart)) return null;
    const [h, m] = noonStart.split(":").map(Number);
    return new Date(`${dISO}T${pad(h)}:${pad(m)}`);
  }, [noonDate, noonStart, startDate]);

  const noonEndDT = useMemo(() => {
    const dISO = noonDate || startDate;
    if (!dISO || !isValidHHMM(noonStart)) return null; // besoin du début
    if (isValidHHMM(noonEnd)) {
      const [h, m] = noonEnd.split(":").map(Number);
      return new Date(`${dISO}T${pad(h)}:${pad(m)}`);
    }
    // Fin non saisie → auto +1h
    return addMinutes(new Date(`${dISO}T${noonStart}`), 60);
  }, [noonDate, noonStart, noonEnd, startDate]);

  const eveEndDT = useMemo(() => {
    const dISO = eveDate || startDate;
    if (!dISO || !isValidHHMM(eveStart)) return null; // besoin du début
    if (isValidHHMM(eveEnd)) {
      const [h, m] = eveEnd.split(":").map(Number);
      return new Date(`${dISO}T${pad(h)}:${pad(m)}`);
    }
    // Fin non saisie → auto +1h
    return addMinutes(new Date(`${dISO}T${eveStart}`), 60);
  }, [eveDate, eveStart, eveEnd, startDate]);

  const eveStartDT = useMemo(() => {
    const dISO = eveDate || startDate;
    if (!dISO || !isValidHHMM(eveStart)) return null;
    const [h, m] = eveStart.split(":").map(Number);
    return new Date(`${dISO}T${pad(h)}:${pad(m)}`);
  }, [eveDate, eveStart, startDate]);

  /* Nettoyage chambre : début (date+heure) → intervalle de 20 min */
  const cleanStartDT = useMemo(() => {
    if (!cleanEnabled) return null;
    const dISO = cleanDate || startDate;
    if (!dISO || !isValidHHMM(cleanStart)) return null;
    const [h, m] = cleanStart.split(":").map(Number);
    return new Date(`${dISO}T${pad(h)}:${pad(m)}`);
  }, [cleanEnabled, cleanDate, cleanStart, startDate]);

  /** Calcul des minutes de nettoyage avant / pendant le service */
  const cleaningInfo = useMemo(() => {
    const TOTAL = cleanEnabled ? 20 : 0;
    if (!cleanEnabled || !cleanStartDT) return { total: TOTAL, beforeMin: 0, insideMin: 0 };

    // Si pas de PDS/FDS, on considère tout "avant"
    if (!startDT || !endDT) {
      return { total: TOTAL, beforeMin: TOTAL, insideMin: 0 };
    }

    const s = cleanStartDT.getTime();
    const e = addMinutes(cleanStartDT, TOTAL).getTime();
    const baseStart = startDT.getTime();
    const baseEnd = endDT.getTime();

    let inside = 0;
    if (e > baseStart && s < baseEnd) {
      const a = Math.max(s, baseStart);
      const b = Math.min(e, baseEnd);
      if (b > a) inside = Math.round((b - a) / 60000);
    }
    const before = Math.max(0, TOTAL - inside);
    return { total: TOTAL, beforeMin: before, insideMin: inside };
  }, [cleanEnabled, cleanStartDT, startDT, endDT]);

  // 25% de l’amplitude (FDS−PDS) atteint-il 2h ?
  const breakApplicable = useMemo(() => {
    if (!startDT || !endDT) return true; // tant que PDS/FDS pas saisies -> ne pas bloquer
    const ampMin = Math.max(0, Math.round((endDT.getTime() - startDT.getTime()) / 60000));
    const pct25  = Math.floor(ampMin * 0.25);
    return pct25 >= 120;
  }, [startDT, endDT]);

  // Libellé "max" à afficher (min(25% amplitude, 3h15))
  const breakMaxLabel = useMemo(() => {
    if (!startDT || !endDT) return "";
    const ampMin = Math.max(0, Math.round((endDT.getTime() - startDT.getTime()) / 60000));
    const max25  = Math.floor(ampMin * 0.25);
    const cap    = Math.min(max25, 195); // 03h15
    return `${pad(Math.floor(cap/60))}h${pad(cap%60)}`;
  }, [startDT, endDT]);

  // Si non applicable -> vider la coupure
  useEffect(() => {
    if (!breakApplicable) {
      setBreakDate("");
      setBreakStartTime("");
      setBreakEndTime("");
    }
  }, [breakApplicable]);

  /* Bornage fort de la coupure : clamp sur [noonEndDT ; eveStartDT] si connus */
  function clampBreakStart(raw: string) {
    try {
      const v = finalizeHHMM(raw);
      if (!v) { setBreakStartTime(v); return; }

      const baseISO = breakDate || startDate || "";
      if (!breakDate && startDate) setBreakDate(startDate);

      if (!baseISO || !noonEndDT || !isValidHHMM(v)) {
        setBreakStartTime(v); return;
      }
      const [h, m] = v.split(":").map(Number);
      const cand = new Date(`${baseISO}T${pad(h)}:${pad(m)}`);
      if (isNaN(cand.getTime())) { setBreakStartTime(v); return; }

      if (cand.getTime() < noonEndDT.getTime()) {
        setBreakStartTime(`${pad(noonEndDT.getHours())}:${pad(noonEndDT.getMinutes())}`);
        return;
      }
      setBreakStartTime(v);
    } catch (e) {
      console.error("clampBreakStart", e);
      setBreakStartTime(finalizeHHMM(raw));
    }
  }
  function clampBreakEnd(raw: string) {
    try {
      const v = finalizeHHMM(raw);
      if (!v) { setBreakEndTime(v); return; }

      const baseISO = breakDate || startDate || "";
      if (!breakDate && startDate) setBreakDate(startDate);

      if (!baseISO || !eveStartDT || !isValidHHMM(v)) {
        setBreakEndTime(v); return;
      }
      const [h, m] = v.split(":").map(Number);
      const cand = new Date(`${baseISO}T${pad(h)}:${pad(m)}`);
      if (isNaN(cand.getTime())) { setBreakEndTime(v); return; }

      if (cand.getTime() > eveStartDT.getTime()) {
        setBreakEndTime(`${pad(eveStartDT.getHours())}:${pad(eveStartDT.getMinutes())}`);
        return;
      }
      setBreakEndTime(v);
    } catch (e) {
      console.error("clampBreakEnd", e);
      setBreakEndTime(finalizeHHMM(raw));
    }
  }

  /* Règles sur la coupure (messages) */
  const breakRuleWarnings = useMemo(() => {
    const msgs: string[] = [];
    if (!startDT || !endDT) return msgs;
    if (!breakStartDT || !breakEndDT) return msgs;

    const s = breakStartDT.getTime();
    const e = breakEndDT.getTime();

    // ordre
    if (e <= s) {
      msgs.push("Coupure : l'heure de fin doit être postérieure à l'heure de début.");
      return msgs;
    }

    // fenêtre coupure : entre fin méridien et début vespéral (si connus)
    if (noonEndDT && eveStartDT) {
      if (s < noonEndDT.getTime() || e > eveStartDT.getTime()) {
        msgs.push("La coupure doit être intégralement comprise entre la fin du repas méridien et le début du repas vespéral.");
      }
    }

    // 2h min et 25% max (plafonné à 3h15)
    const ampMin   = Math.max(0, Math.round((endDT.getTime() - startDT.getTime()) / 60000)); // minutes
    const max25Raw = Math.floor(ampMin * 0.25);
    const max25    = Math.min(max25Raw, 195); // 3h15
    const minReq   = 120;
    const dur      = Math.max(0, Math.round((e - s) / 60000));

    if (dur < minReq) msgs.push("Coupure trop courte : minimum 02h00.");
    if (max25Raw < minReq) {
      msgs.push(`Amplitude trop faible : 25 % (${fmtHM(max25Raw)}) < 02h00 (règle inapplicable).`);
    } else if (dur > max25) {
      if (max25 < 195) msgs.push(`Coupure trop longue : maximum ${fmtHM(max25)} (25 % de l’amplitude).`);
      else msgs.push("Coupure trop longue : maximum 03h15.");
    }
    return msgs;
  }, [startDT, endDT, breakStartDT, breakEndDT, noonEndDT, eveStartDT]);

  /* TSr (journée comptable) */
  useEffect(() => {
    if (!startDT || !endDT) return;
    const meals: Array<{ start: Date; end: Date }> = [];
    if (noonStartDT && noonEndDT && noonEndDT > noonStartDT) meals.push({ start: noonStartDT, end: noonEndDT });
    if (eveStartDT  && eveEndDT  && eveEndDT  > eveStartDT ) meals.push({ start: eveStartDT,  end: eveEndDT  });
    const breaks = (breakStartDT && breakEndDT) ? [{ start: breakStartDT, end: breakEndDT }] : [];
    const acc = computeAccountingDate(startDT, endDT, meals, breaks);
    setDayType(dayTypeFromAccountingDate(acc));
  }, [startDT, endDT, noonStartDT, noonEndDT, eveStartDT, eveEndDT, breakStartDT, breakEndDT]);

  /* Calcul principal (nettoyage non transmis au module de base) */
    const out = useMemo(() => {
    if (!startDT || !endDT) return null;
    return compute({
      date: startDT,
      start: startDT,
      end: endDT,
      theBreak: breakStartDT && breakEndDT
        ? { start: breakStartDT, end: breakEndDT }
        : undefined,
      mealNoon:
        noonStartDT && noonEndDT && noonEndDT > noonStartDT
          ? { start: noonStartDT, end: noonEndDT }
          : undefined,
      mealEvening:
        eveStartDT && eveEndDT && eveEndDT > eveStartDT
          ? { start: eveStartDT, end: eveEndDT }
          : undefined,
      dayType,

      // ✅ on envoie enfin le ménage au moteur
      cleaningMinutesInside: cleaningInfo.insideMin,
    });
  }, [
    startDT, endDT,
    breakStartDT, breakEndDT,
    noonStartDT, noonEndDT,
    eveStartDT, eveEndDT,
    dayType,
    cleaningInfo.insideMin,
  ]);
   
   /* HR générées par le nettoyage (affichage) */
  const cleaningHRMin = useMemo(() => {
    if (!out) return 0;
    const inside = cleaningInfo.insideMin;
    if (!inside) return 0;

    // minutes "offertes" par l'arrondi du dépassement
    const extra = Math.max(0, out.B_total_h * 60 - out.Bmin_min);
    const remaining = inside - extra;

    // HR = ce qui dépasse la marge d'arrondi (mais jamais négatif)
    return remaining > 0 ? remaining : 0;
  }, [out, cleaningInfo]);

     const cleaningExplanation = useMemo(() => {
    if (!cleanStartDT || !out) return null;

    const inside = cleaningInfo.insideMin;
    if (!inside) return null;

    const hrMin = cleaningHRMin;
    const includedMin = Math.max(0, inside - hrMin);

    // 👉 On n'affiche une phrase que si une partie du forfait est
    // réellement incluse dans l’arrondi (sinon ce serait redondant)
    if (includedMin <= 0) return null;

    return { includedMin };
  }, [cleanStartDT, cleaningInfo.insideMin, cleaningHRMin, out]);

  /* --- Temps de travail effectif (en minutes) --- */
  const effectiveMin = useMemo(() => {
    if (!startDT || !endDT) return 0;
    try {
      const baseStart = startDT.getTime();
      const baseEnd   = endDT.getTime();
      const baseMs    = Math.max(0, baseEnd - baseStart);

      const intervals: Array<[Date, Date]> = [];
      if (noonStartDT && noonEndDT && noonEndDT > noonStartDT) intervals.push([noonStartDT, noonEndDT]);
      if (eveStartDT  && eveEndDT  && eveEndDT  > eveStartDT ) intervals.push([eveStartDT,  eveEndDT ]);
      if (breakStartDT && breakEndDT) intervals.push([breakStartDT, breakEndDT]);

      let subtractMs = 0;
      for (const [s, e] of intervals) {
        const a = Math.max(baseStart, s.getTime());
        const b = Math.min(baseEnd,   e.getTime());
        if (b > a) subtractMs += (b - a);
      }
      const workedMs = Math.max(0, baseMs - subtractMs);
      return Math.round(workedMs / 60000);
    } catch {
      return 0;
    }
  }, [startDT, endDT, noonStartDT, noonEndDT, eveStartDT, eveEndDT, breakStartDT, breakEndDT]);

  /* Répartition pour la frise */
  const nonMaj = out ? Math.min(out.A_hours, out.B_total_h) : 0;
  const maj    = out ? Math.max(0, out.B_total_h - nonMaj) : 0;

  /* ============ Styles ============ */
  const box: React.CSSProperties  = { margin: "16px auto", maxWidth: 900, padding: 16, fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,sans-serif" };
  const card: React.CSSProperties = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 };
  const btn: React.CSSProperties  = { padding: "6px 10px", border: "1px solid #e5e7eb", borderRadius: 8, background: "#f8fafc" };
  const labelCol: React.CSSProperties = { fontWeight: 500, marginBottom: 6 };
  const dateRow: React.CSSProperties = { display: "block", width: "100%", marginBottom: 6 };
  const timesRow2: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "minmax(6.2em,1fr) minmax(2em,auto) minmax(6.2em,1fr)",
    gap: 8, alignItems: "center", width: "100%",
  };
  const timesRow1pair: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "minmax(6.2em,1fr) minmax(6.2em,1fr)",
    gap: 8, alignItems: "center", width: "100%",
  };
  const inputBase: React.CSSProperties = { width: "100%", minWidth: 0, boxSizing: "border-box", fontSize: 16, padding: "8px 10px" };
  const sep: React.CSSProperties = { textAlign: "center", opacity: 0.6 };

  /* Effacer tout */
  function clearAll() {
    setStartDate(""); setStartTime("");
    setEndDate(""); setEndTime("");
    setBreakDate(""); setBreakStartTime(""); setBreakEndTime("");
    setNoonDate(""); setNoonStart(""); setNoonEnd("");
    setEveDate(""); setEveStart(""); setEveEnd("");
    setCleanDate(""); setCleanStart(""); setCleanEnabled(false);
    setDayType("SO");
  }

  return (
    <div style={box}>
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}>
        <button style={btn} onClick={clearAll}>Tout effacer</button>
      </div>

      {/* --- Formulaire --- */}
      <div style={{ ...card, display: "grid", gap: 12 }}>

        {/* Nettoyage chambre – toggle + bloc */}
        <div>
          <label style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
            <input
              type="checkbox"
              checked={cleanEnabled}
              onChange={e => {
                const v = e.target.checked;
                setCleanEnabled(v);
                if (!v) { setCleanDate(""); setCleanStart(""); }
              }}
            />
            <span style={{ fontWeight:500 }}>
              REM. COND. LOCAUX HEBERG. (nettoyage chambre)
            </span>
          </label>

          {cleanEnabled && (
            <>
              <div style={dateRow}>
                <input
                  style={inputBase}
                  type="date"
                  value={cleanDate}
                  onChange={e => setCleanDate(e.target.value)}
                />
              </div>
              <div style={timesRow1pair}>
                <input
                  style={inputBase}
                  placeholder="Début nettoyage (HH:MM)"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={5}
                  value={cleanStart}
                  onChange={e => setCleanStart(formatTypingHHMM(e.target.value))}
                  onBlur={e => setCleanStart(finalizeHHMM(e.target.value))}
                />
                <div style={{ fontSize: 12, opacity: 0.7, alignSelf: "center" }}>
                  Forfait <strong>20 min</strong> (ne doit pas engendrer d’HS)
                </div>
              </div>
              {cleanStartDT && (
                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
                  <div>
                    Avant service : <strong>{cleaningInfo.beforeMin} min</strong>
                  </div>
                  {startDT && endDT && (
                    <div>
                      Pendant service : <strong>{cleaningInfo.insideMin} min</strong>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

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

        {/* Repas méridien */}
        <div>
          <div style={{ ...labelCol, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Repas méridien</span>
            <button style={btn} onClick={()=>{ setNoonDate(""); setNoonStart(""); setNoonEnd(""); }}>Effacer</button>
          </div>
          <div style={dateRow}>
            <input style={inputBase} type="date" value={noonDate} onChange={e=>setNoonDate(e.target.value)} />
          </div>
          <div style={timesRow2}>
            <input
              style={inputBase}
              placeholder="Début (HH:MM)"
              inputMode="numeric" pattern="[0-9]*" maxLength={5}
              value={noonStart}
              onChange={e=>setNoonStart(formatTypingHHMM(e.target.value))}
              onBlur={e=>{
                const v = finalizeHHMM(e.target.value);
                setNoonStart(v);
                if (!noonDate && startDate && v) setNoonDate(startDate);
                if (!noonEnd && v) setNoonEnd(plus1hLabel(noonDate, v, startDate)); // auto +1h si fin vide
              }}
            />
            <div style={sep}>–</div>
            <input
              style={inputBase}
              placeholder="Fin (HH:MM)"
              inputMode="numeric" pattern="[0-9]*" maxLength={5}
              value={noonEnd}
              onChange={e=>setNoonEnd(formatTypingHHMM(e.target.value))}
              onBlur={e=>setNoonEnd(finalizeHHMM(e.target.value))}
            />
          </div>
        </div>

        {/* Coupure */}
        <div>
          <div style={{ ...labelCol, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>
              Coupure{" "}
              {breakApplicable && breakMaxLabel && (
                <span style={{ opacity: 0.7, fontWeight: 400 }}>
                  (max {breakMaxLabel})
                </span>
              )}
              {!breakApplicable && (
                <span style={{ opacity: 0.7, fontWeight: 400 }}>
                  (25 % de l’amplitude &lt; 02h00)
                </span>
              )}
            </span>
            <button
              style={btn}
              onClick={() => {
                setBreakDate("");
                setBreakStartTime("");
                setBreakEndTime("");
              }}
              disabled={!breakApplicable}
            >
              Effacer
            </button>
          </div>

          <div style={dateRow}>
            <input
              style={inputBase}
              type="date"
              value={breakDate}
              onChange={(e) => setBreakDate(e.target.value)}
              disabled={!breakApplicable}
            />
          </div>

          <div style={timesRow2}>
            <input
              style={inputBase}
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder={breakApplicable ? "HH:MM" : "Non applicable"}
              maxLength={5}
              value={breakStartTime}
              onChange={(e) =>
                setBreakStartTime(formatTypingHHMM(e.target.value))
              }
              onBlur={(e) => clampBreakStart(e.target.value)}
              disabled={!breakApplicable}
            />
            <div style={sep}>–</div>
            <input
              style={inputBase}
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder={breakApplicable ? "HH:MM" : "Non applicable"}
              maxLength={5}
              value={breakEndTime}
              onChange={(e) =>
                setBreakEndTime(formatTypingHHMM(e.target.value))
              }
              onBlur={(e) => clampBreakEnd(e.target.value)}
              disabled={!breakApplicable}
            />
          </div>

          {breakApplicable && breakRuleWarnings.length > 0 && (
            <div style={{ marginTop: 6, color: "#b91c1c", fontSize: 12 }}>
              {breakRuleWarnings.map((m, i) => (
                <div key={`bw-${i}`}>• {m}</div>
              ))}
            </div>
          )}
        </div>

        {/* Repas vespéral */}
        <div>
          <div style={{ ...labelCol, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Repas vespéral</span>
            <button style={btn} onClick={()=>{ setEveDate(""); setEveStart(""); setEveEnd(""); }}>Effacer</button>
          </div>
          <div style={dateRow}>
            <input style={inputBase} type="date" value={eveDate} onChange={e=>setEveDate(e.target.value)} />
          </div>
          <div style={timesRow2}>
            <input
              style={inputBase}
              placeholder="Début (HH:MM)"
              inputMode="numeric" pattern="[0-9]*" maxLength={5}
              value={eveStart}
              onChange={e=>setEveStart(formatTypingHHMM(e.target.value))}
              onBlur={e=>{
                const v = finalizeHHMM(e.target.value);
                setEveStart(v);
                if (!eveDate && startDate && v) setEveDate(startDate);
                if (!eveEnd && v) setEveEnd(plus1hLabel(eveDate, v, startDate)); // auto +1h si fin vide
              }}
            />
            <div style={sep}>–</div>
            <input
              style={inputBase}
              placeholder="Fin (HH:MM)"
              inputMode="numeric" pattern="[0-9]*" maxLength={5}
              value={eveEnd}
              onChange={e=>setEveEnd(formatTypingHHMM(e.target.value))}
              onBlur={e=>setEveEnd(finalizeHHMM(e.target.value))}
            />
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

      {/* Temps de travail effectif */}
      {startDT && endDT && (
        <div style={{ ...card, marginTop: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>Temps de travail effectif</div>
            <div><strong>{asHMstrict(effectiveMin)}</strong></div>
          </div>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
            Calcul : FDS − PDS − (repas &amp; coupure qui chevauchent la vacation)
          </div>
        </div>
      )}

      {/* Amin / Bmin */}
      {out && (
        <div style={{ ...card, marginTop: 12 }}>
          {endDT!.getTime() < out.t13.getTime() ? (
            <div style={{ textAlign:"center", opacity:0.7, fontSize:16, padding:"8px 0" }}>
              Amplitude non atteinte
            </div>
          ) : (
            <>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                <div>Amin</div>
                <div>{Math.floor(out.Amin_min/60)} h <strong>{pad(out.Amin_min%60)}</strong></div>
                <div>Bmin</div>
                <div>{Math.floor(out.Bmin_min/60)} h <strong>{pad(out.Bmin_min%60)}</strong></div>
              </div>
              {(() => {
                const cmpL =
                  (out.Amin_min % 60) > (out.Bmin_min % 60) ? ">" :
                  (out.Amin_min % 60) < (out.Bmin_min % 60) ? "<" : "=";
                const aHours = out.Amin_min / 60;
                const A = cmpL === "<" ? Math.floor(aHours) : Math.ceil(aHours);
                return (
                  <div style={{ marginTop:8, display:"flex", justifyContent:"center", alignItems:"center", gap:14, fontSize:18, textAlign:"center" }}>
                    <span style={{ whiteSpace:"nowrap" }}>Amin {cmpL} Bmin</span>
                    <span style={{ whiteSpace:"nowrap" }}>soit A = <strong>{A}</strong></span>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}

      {/* Ventilation & Répartition */}
      {out && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          {/* VENTILATION */}
          <div style={{ ...card, marginTop:12 }}>
            <div style={{ fontWeight:600, marginBottom:8 }}>Ventilation des heures</div>
            <div style={{ display:"grid", gridTemplateColumns:"auto 1fr", gap:6 }}>
              {out.HS  > 0 && (<><div>{out.HS} {dayType === "RH" ? "HSD" : "HS"}</div><div /></>)}
              {out.HSN > 0 && (<><div>{out.HSN} HSN</div><div /></>)}
              {(() => {
                const factor = dayType === "SO" ? 1.5 : dayType === "R" ? 2 : 3;
                const pct = `${factor*100}%`;
                const baseLabelDay = dayType === "RH" ? "HSD" : "HS";
                return (
                  <>
                    {out.HSM > 0 && (<><div>{out.HSM} {baseLabelDay} × {pct}</div><div /></>)}
                    {out.HNM > 0 && (<><div>{out.HNM} HSN × {pct}</div><div /></>)}
                  </>
                );
              })()}
            </div>
          </div>

          {/* RÉPARTITION */}
          <div style={{ ...card, marginTop:12 }}>
            <div style={{ fontWeight:600, marginBottom:8 }}>Répartition des heures</div>
            <div style={{ display:"grid", gridTemplateColumns:"auto 1fr", gap:6 }}>
              {out.HS  > 0 && (<><div>{out.HS} {dayType === "RH" ? "HSD" : "HS"}</div><div /></>)}
              {out.HSN > 0 && (<><div>{out.HSN} HSN</div><div /></>)}
              {(() => {
                const factor = dayType === "SO" ? 1.5 : dayType === "R" ? 2 : 3;
                const HSM_label = dayType === "RH" ? "HSDM" : "HSM";
                const fmtHours = (n:number) => {
                  const s = (Math.round(n*2)/2).toString();
                  return s.endsWith(".0") ? s.slice(0,-2) : s;
                };
                const fmtMinutes = (m:number) => {
                  const h = Math.floor(m/60), mm = m%60;
                  return `${pad(h)}h${pad(mm)}`;
                };
                const creditedHSM = out.HSM * factor;
                const creditedHNM = out.HNM * factor;
                return (
                  <>
                    {creditedHSM > 0 && (<><div>{fmtHours(creditedHSM)} {HSM_label}</div><div /></>)}
                    {creditedHNM > 0 && (<><div>{fmtHours(creditedHNM)} HNM</div><div /></>)}
                    {cleaningHRMin > 0 && (
                      <>
                        <div>{fmtMinutes(cleaningHRMin)} HR - Nettoyage</div>
                        <div />
                      </>
                    )}
                  </>
                );
              })()}
            </div>
                        {/* 🔍 Phrase d'explication sur le forfait nettoyage */}
            {cleaningExplanation && (
              <div style={{ marginTop: "8px", opacity: 0.8 }}>
                <strong>🧹 Forfait nettoyage :</strong><br />
                <div>
                  {formatMinutes(cleaningExplanation.includedMin)} inclus
                  dans l’arrondi (ne génère pas d’HS)
                </div>
              </div>
            )}
            <div style={{ marginTop:8, color:"#b91c1c", fontWeight:600 }}>
              {dayType === "R"  && "Crédit de 1 RCJ au titre du DP sur le R"}
              {dayType === "RH" && "Crédit de 1,5 RCJ ou 2 RCJ + 1 RL au titre du DP sur le RH"}
            </div>
          </div>
        </div>
      )}
       

      {/* Frise */}
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

      {/* Footer signature */}
      <div style={{ textAlign: "center", fontSize: 12, marginTop: 16 }}>
        © {new Date().getFullYear()} —{" "}
        <span style={{ fontWeight: 600 }}>
          <span style={{ color: "#2563eb" }}>DRJ</span>
          <span style={{ color: "#6b7280" }}>_</span>
          <span style={{ color: "#ef4444" }}>SG08</span>
        </span>
      </div>
    </div>
  );
} // <-- close App component

/* ============ Frise chronologique (acronymes sur la ligne) ============ */
function FriseTimeline(props: {
  start: Date; dmj: Date; t13: Date; end: Date;
  nonMajHours: number; majHours: number; dayType: DayType;
}) {
  const W = 520, H = 170, PADL = 58, PADR = 16, Y1 = 62, Y2 = 132, hourW = 56;
  const isSunday = props.dayType === "RH";
  const fmt = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

  function isFullNightHour(s: Date, e: Date) {
    const spans: Array<{ sd: Date; ed: Date }> = [];
    const mid = new Date(s); mid.setHours(24,0,0,0);
    if (e <= mid) spans.push({ sd:s, ed:e }); else { spans.push({ sd:s, ed:mid }); spans.push({ sd:mid, ed:e }); }
    for (const sp of spans) {
      const d0 = new Date(sp.sd); d0.setHours(0,0,0,0);
      const h06 = new Date(d0); h06.setHours(6,0,0,0);
      const h21 = new Date(d0); h21.setHours(21,0,0,0);
      const interStart = new Date(Math.max(sp.sd.getTime(), h06.getTime()));
      const interEnd   = new Date(Math.min(sp.ed.getTime(), h21.getTime()));
      if (interEnd > interStart) return false;
    }
    return true;
  }
  function tick(x:number,y:number,label:string){
    return (
      <g>
        <line x1={x} y1={y-12} x2={x} y2={y+12} stroke="#111827" strokeWidth="2" />
        <text x={x} y={y+24} textAnchor="middle" fontSize="12" fill="#111827">{label}</text>
      </g>
    );
  }
  function segAcronym(x1:number,x2:number,y:number,text:string,night=false){
    const cx=(x1+x2)/2;
    return (
      <text x={cx} y={y-6} textAnchor="middle" fontSize="12" fill={night?"#dc2626":"#111827"} fontWeight={600}>
        {text}
      </text>
    );
  }

  const lineLenTop = Math.max(1, props.nonMajHours) * hourW;
  const lineLenBot = Math.max(1, props.majHours) * hourW;
  const viewW = Math.max(W, PADL + PADR + Math.max(lineLenTop, lineLenBot));
  const needLine2 = props.majHours > 0;

  return (
    <svg width="100%" height={needLine2 ? H : H-44} viewBox={`0 0 ${viewW} ${needLine2 ? H : H-44}`}>
      <text x={viewW/2} y={24} textAnchor="middle" fontSize="14" fontWeight={700} fill="#111827">
        RÉPARTITION DES HEURES
      </text>

      {/* Ligne 1 */}
      <text x={PADL-38} y={Y1-22} fontSize="12" fill="#374151">Pds</text>
      <text x={PADL}    y={Y1-22} fontSize="12" fill="#374151" textAnchor="middle">DMJ</text>
      <line x1={PADL} y1={Y1} x2={PADL+lineLenTop} y2={Y1} stroke="#9ca3af" strokeWidth="2" />
      <line x1={PADL-40} y1={Y1} x2={PADL} y2={Y1} stroke="#9ca3af" strokeDasharray="4 4" />
      {tick(PADL-40, Y1, fmt(props.start))}
      {tick(PADL,     Y1, fmt(props.dmj))}
      {Array.from({length: props.nonMajHours}).map((_,i)=>{
        const s=new Date(props.dmj.getTime()+i*3600000);
        const e=new Date(s.getTime()+3600000);
        const x1=PADL+i*hourW, x2=PADL+(i+1)*hourW;
        const night=isFullNightHour(s,e);
        const labelTop= night ? "HSN" : (isSunday ? "HSD" : "HS");
        return (
          <g key={`top-${i}`}>
            {tick(x2,Y1,fmt(e))}
            {segAcronym(x1,x2,Y1,labelTop,night)}
          </g>
        );
      })}

      {/* Ligne 2 */}
      {needLine2 && (
        <>
          <text x={PADL-40} y={Y2-22} fontSize="12" fill="#374151">Amplitude</text>
          <line x1={PADL} y1={Y2} x2={PADL+lineLenBot} y2={Y2} stroke="#9ca3af" strokeWidth="2" />
          {tick(PADL, Y2, fmt(props.t13))}
          {Array.from({length: props.majHours}).map((_,i)=>{
            const s=new Date(props.t13.getTime()+i*3600000);
            const e=new Date(s.getTime()+3600000);
            const x1=PADL+i*hourW, x2=PADL+(i+1)*hourW;
            const night=isFullNightHour(s,e);
            const labelBot= night ? "HSNM" : (isSunday ? "HSDM" : "HSM");
            return (
              <g key={`bot-${i}`}>
                {tick(x2,Y2,fmt(e))}
                {segAcronym(x1,x2,Y2,labelBot,night)}
              </g>
            );
          })}
        </>
      )}
    </svg>
  );
}
