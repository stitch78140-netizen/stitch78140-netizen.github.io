import React, { useMemo, useState, useEffect } from "react";
import {
  compute,
  DayType,
  computeAccountingDate,
  dayTypeFromAccountingDate,
} from "./modules/civils";

// helpers
function toLocal(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(
    d.getHours()
  )}:${p(d.getMinutes())}`;
}
function fmtDateTime(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(
    d.getHours()
  )}:${p(d.getMinutes())}`;
}
function asHM(min: number) {
  const h = Math.floor(min / 60), m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function plus1hISO(dt?: string) {
  if (!dt) return "";
  const d = new Date(dt);
  d.setHours(d.getHours() + 1);
  return toLocal(d);
}

export default function App() {
  // valeurs par défaut (vides au départ)
  const [start, setStart] = useState<string>("");
  const [end, setEnd] = useState<string>("");

  // Coupure
  const [breakStart, setBreakStart] = useState<string>("");
  const [breakEnd, setBreakEnd] = useState<string>("");

  // Repas
  const [noonS, setNoonS] = useState<string>("");
  const noonE = plus1hISO(noonS);
  const [eveS, setEveS] = useState<string>("");
  const eveE = plus1hISO(eveS);

  const [dayType, setDayType] = useState<DayType>("SO");

  // recalcul type de jour
  useEffect(() => {
    if (!start || !end) return;
    const meals: Array<{ start: Date; end: Date }> = [];
    if (noonS) meals.push({ start: new Date(noonS), end: new Date(noonE) });
    if (eveS) meals.push({ start: new Date(eveS), end: new Date(eveE) });
    const breaks =
      breakStart && breakEnd ? [{ start: new Date(breakStart), end: new Date(breakEnd) }] : [];
    const acc = computeAccountingDate(new Date(start), new Date(end), meals, breaks);
    setDayType(dayTypeFromAccountingDate(acc));
  }, [start, end, noonS, noonE, eveS, eveE, breakStart, breakEnd]);

  // calcul principal
  const out = useMemo(() => {
    if (!start || !end) return null;
    return compute({
      date: new Date(start),
      start: new Date(start),
      end: new Date(end),
      theBreak:
        breakStart && breakEnd
          ? { start: new Date(breakStart), end: new Date(breakEnd) }
          : undefined,
      mealNoon: noonS ? { start: new Date(noonS), end: new Date(noonE) } : undefined,
      mealEvening: eveS ? { start: new Date(eveS), end: new Date(eveE) } : undefined,
      dayType,
    });
  }, [start, end, breakStart, breakEnd, noonS, noonE, eveS, eveE, dayType]);

  // libellés & facteur
  const HS_label = dayType === "RH" ? "HSD" : "HS";
  const HSM_label = dayType === "RH" ? "HDM" : "HSM";
  const factor = dayType === "SO" ? 1.5 : dayType === "R" ? 2 : 3;

  const nonMaj = out ? Math.min(out.A_hours, out.B_total_h) : 0;
  const maj = out ? Math.max(0, out.B_total_h - nonMaj) : 0;

  // comparateur
  const cmp =
    out && (out.Amin_min % 60) > (out.Bmin_min % 60)
      ? ">"
      : out && (out.Amin_min % 60) < (out.Bmin_min % 60)
      ? "<"
      : "=";

  // styles
  const box: React.CSSProperties = { margin: "16px auto", maxWidth: 900, padding: 16, fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,sans-serif" };
  const card: React.CSSProperties = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 };
  const row2: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 };
  const row3: React.CSSProperties = { display: "grid", gridTemplateColumns: "auto 1fr", gap: 6 };
  const btn: React.CSSProperties = { padding: "6px 10px", border: "1px solid #e5e7eb", borderRadius: 8, background: "#f8fafc" };

  function clearAll() {
    setStart(""); setEnd("");
    setBreakStart(""); setBreakEnd("");
    setNoonS(""); setEveS("");
    setDayType("SO");
  }

  return (
    <div style={box}>
      {/* Barre supérieure : bouton effacer */}
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}>
        <button style={btn} onClick={clearAll}>Tout effacer</button>
      </div>

      {/* FORMULAIRE */}
      <div style={{ ...card, display: "grid", gap: 12 }}>
        <div>
          <label>Prise de service</label>
          <div style={row2}>
            <input type="datetime-local" value={start} onChange={e => setStart(e.target.value)}/>
            <button style={btn} onClick={() => setStart(toLocal(new Date()))}>Maintenant</button>
          </div>
        </div>

        <div>
          <label>Fin de service</label>
          <div style={row2}>
            <input type="datetime-local" value={end} onChange={e => setEnd(e.target.value)}/>
            <button style={btn} onClick={() => setEnd(toLocal(new Date()))}>Maintenant</button>
          </div>
        </div>

        {/* Coupure */}
        <div>
          <div style={{ marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
            <span>Coupure</span>
            <button style={btn} onClick={() => { setBreakStart(""); setBreakEnd(""); }}>Effacer</button>
          </div>
          <div style={row2}>
            <input type="datetime-local" value={breakStart} onChange={e => setBreakStart(e.target.value)}/>
            <input type="datetime-local" value={breakEnd} onChange={e => setBreakEnd(e.target.value)}/>
          </div>
        </div>

        {/* Repas méridien */}
        <div>
          <div style={{ marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
            <span>Repas méridien</span>
            <button style={btn} onClick={() => setNoonS("")}>Effacer</button>
          </div>
          <div style={row2}>
            <input type="datetime-local" value={noonS} onChange={e => setNoonS(e.target.value)}/>
            <input type="datetime-local" value={noonE} disabled />
          </div>
        </div>

        {/* Repas vespéral */}
        <div>
          <div style={{ marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
            <span>Repas vespéral</span>
            <button style={btn} onClick={() => setEveS("")}>Effacer</button>
          </div>
          <div style={row2}>
            <input type="datetime-local" value={eveS} onChange={e => setEveS(e.target.value)}/>
            <input type="datetime-local" value={eveE} disabled />
          </div>
        </div>
      </div>

      {/* TSr */}
      {out && (
        <div style={{ ...card, marginTop: 12 }}>
          Tsr : <strong>{dayType}</strong> {dayType === "SO" ? "(Lun–Ven)" : dayType === "R" ? "(Samedi)" : "(Dimanche)"}
        </div>
      )}

      {/* REPÈRES */}
      {out && (
        <div style={{ ...card, marginTop: 12 }}>
          <div style={row2}>
            <div>DMJ atteinte à</div>
            <div><strong>{fmtDateTime(out.dmjEnd)}</strong></div>
            <div>Amplitude atteinte à</div>
            <div><strong>{fmtDateTime(out.t13)}</strong></div>
            <div>Dépassement total</div>
            <div>{asHM(out.Bmin_min)} → <strong style={{color:"#b91c1c"}}>{out.B_total_h}:00</strong></div>
          </div>
        </div>
      )}

      {/* AMIN / BMIN */}
      {out && (
        <div style={{ ...card, marginTop: 12 }}>
          <div style={row2}>
            <div>Amin</div>
            <div>{Math.floor(out.Amin_min / 60)} h <strong>{String(out.Amin_min % 60).padStart(2,"0")}</strong></div>
            <div>Bmin</div>
            <div>{Math.floor(out.Bmin_min / 60)} h <strong>{String(out.Bmin_min % 60).padStart(2,"0")}</strong></div>
          </div>
          <div style={{ marginTop: 8, textAlign: "center", fontSize: 18 }}>
            Amin {cmp} Bmin
          </div>
        </div>
      )}

      {/* VENTILATION / RÉPARTITION */}
      {out && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ ...card, marginTop: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Ventilation des heures</div>
            <div style={row3}>
              <div>{nonMaj} {HS_label}</div><div />
              {maj > 0 && (<><div>1 HS × {factor * 100}% soit</div><div>{maj} {HSM_label} ({dayType})</div></>)}
            </div>
          </div>

          <div style={{ ...card, marginTop: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Répartition des heures</div>
            <div style={row3}>
              <div>{nonMaj} {HS_label}</div><div />
              {maj > 0 && (<><div>{maj} {HSM_label}</div><div /></>)}
            </div>
            <div style={{ marginTop: 8, color: "#b91c1c", fontWeight: 600 }}>
              {dayType === "R" && "Crédit de 1 RCJ au titre du DP sur le R"}
              {dayType === "RH" && "Crédit de 1,5 RCJ ou 2 RCJ + 1 RL au titre du DP sur le RH"}
            </div>
          </div>
        </div>
      )}

      {/* footer discret */}
      <div style={{opacity:0.6, fontSize:12, textAlign:"center", marginTop:16}}>
        © Stitch08
      </div>
    </div>
  );
}
