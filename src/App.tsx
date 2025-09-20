import React, { useState } from "react";
import { compute, Input, Output } from "./modules/civils";

function fmtHM(d?: Date) {
  if (!d) return "";
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(d?: Date) {
  if (!d) return "";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function App() {
  const [dateStart, setDateStart] = useState<string>("");
  const [timeStart, setTimeStart] = useState<string>("");
  const [dateEnd, setDateEnd] = useState<string>("");
  const [timeEnd, setTimeEnd] = useState<string>("");

  const [breakStart, setBreakStart] = useState<string>("");
  const [breakEnd, setBreakEnd] = useState<string>("");

  const [mealNoon, setMealNoon] = useState<string>("");
  const [mealEvening, setMealEvening] = useState<string>("");

  const clearAll = () => {
    setDateStart(""); setTimeStart("");
    setDateEnd(""); setTimeEnd("");
    setBreakStart(""); setBreakEnd("");
    setMealNoon(""); setMealEvening("");
  };

  const parseDT = (date: string, time: string) => {
    if (!date || !time) return undefined;
    return new Date(date + "T" + time + ":00");
  };

  const input: Input | undefined = (() => {
    const start = parseDT(dateStart, timeStart);
    const end = parseDT(dateEnd, timeEnd);
    if (!start || !end) return undefined;
    return {
      date: start,
      start,
      end,
      theBreak: breakStart && breakEnd ? { start: parseDT(dateStart, breakStart)!, end: parseDT(dateStart, breakEnd)! } : undefined,
      mealNoon: mealNoon ? { start: parseDT(dateStart, mealNoon)!, end: new Date(parseDT(dateStart, mealNoon)!.getTime() + 60 * 60000) } : undefined,
      mealEvening: mealEvening ? { start: parseDT(dateStart, mealEvening)!, end: new Date(parseDT(dateStart, mealEvening)!.getTime() + 60 * 60000) } : undefined,
      dayType: "R",
    };
  })();

  const output: Output | undefined = input ? compute(input) : undefined;

  return (
    <div style={{ fontFamily: "sans-serif", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={clearAll}>Tout effacer</button>
      </div>

      <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginTop: 8 }}>
        <Field
          label="Prise de service"
          date={dateStart} setDate={setDateStart}
          time={timeStart} setTime={setTimeStart}
        />
        <Field
          label="Fin de service"
          date={dateEnd} setDate={setDateEnd}
          time={timeEnd} setTime={setTimeEnd}
        />
        <Field
          label="Coupure"
          date={dateStart}
          time={breakStart} setTime={setBreakStart}
          time2={breakEnd} setTime2={setBreakEnd}
          canClear onClear={() => { setBreakStart(""); setBreakEnd(""); }}
        />
        <Field
          label="Repas méridien"
          date={dateStart}
          time={mealNoon} setTime={setMealNoon}
          canClear onClear={() => setMealNoon("")}
        />
        <Field
          label="Repas vespéral"
          date={dateStart}
          time={mealEvening} setTime={setMealEvening}
          canClear onClear={() => setMealEvening("")}
        />
      </div>

      {output && (
        <div style={{ marginTop: 16 }}>
          <div style={{ padding: 8 }}>
            <b>Tsr :</b> <b>R</b> ({output.dmjEnd.toLocaleDateString("fr-FR", { weekday: "long" })})
          </div>
          <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginTop: 8 }}>
            <div><b>DMJ atteinte à</b> <span style={{ fontWeight: "bold" }}>{fmtHM(output.dmjEnd)}</span></div>
            <div><b>Amplitude atteinte à</b> <span style={{ fontWeight: "bold" }}>{fmtHM(output.t13)}</span></div>
            <div>
              Dépassement total {fmtHM(new Date(0, 0, 0, Math.floor(output.Bmin_min / 60), output.Bmin_min % 60))}
              {" → "}
              <span style={{ color: "red" }}>
                {String(Math.floor(output.B_total_h)).padStart(2, "0")}:
                {String(output.B_total_h % 60).padStart(2, "0")}
              </span>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            Amin <b>{Math.floor(output.Amin_min / 60)} h {String(output.Amin_min % 60).padStart(2, "0")}</b><br />
            Bmin <b>{Math.floor(output.Bmin_min / 60)} h {String(output.Bmin_min % 60).padStart(2, "0")}</b><br />
            {output.Amin_min === output.Bmin_min ? "Amin = Bmin" : (output.Amin_min > output.Bmin_min ? "Amin > Bmin" : "Amin < Bmin")}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <div style={{ flex: 1, border: "1px solid #ddd", borderRadius: 8, padding: 8 }}>
              <b>Ventilation des heures</b><br />
              {output.HS + output.HSN + output.HSM + output.HNM} HS
            </div>
            <div style={{ flex: 1, border: "1px solid #ddd", borderRadius: 8, padding: 8 }}>
              <b>Répartition des heures</b><br />
              {output.HS > 0 && <div>{output.HS} HS</div>}
              {output.HSN > 0 && <div>{output.HSN} HSN</div>}
              {output.HSM > 0 && <div>{output.HSM} HSM</div>}
              {output.HNM > 0 && <div>{output.HNM} HNM</div>}
              <div style={{ color: "red" }}>Crédit de 1 RCJ au titre du DP sur le R</div>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 24, textAlign: "center", fontSize: 12, color: "#666" }}>
        © Stitch08
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  date?: string; setDate?: (v: string) => void;
  time?: string; setTime?: (v: string) => void;
  time2?: string; setTime2?: (v: string) => void;
  canClear?: boolean; onClear?: () => void;
}

function Field({ label, date, setDate, time, setTime, time2, setTime2, canClear, onClear }: FieldProps) {
  return (
    <div style={line}>
      <div style={{ flex: "0 0 8em" }}>{label}</div>
      {setDate && (
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputBase, ...dateNarrow }} />
      )}
      {setTime && (
        <input type="time" value={time} onChange={e => setTime(e.target.value)} style={{ ...inputBase, ...timeNarrow }} />
      )}
      {setTime2 && (
        <>
          <span>-</span>
          <input type="time" value={time2} onChange={e => setTime2(e.target.value)} style={{ ...inputBase, ...timeNarrow }} />
        </>
      )}
      {canClear && <button onClick={onClear}>Effacer</button>}
    </div>
  );
}

// Styles adaptés mobile
const line: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  alignItems: "center",
  width: "100%",
};

const dateNarrow: React.CSSProperties = {
  flex: "1 1 10em",
  maxWidth: "14em",
  minWidth: "9em",
};

const timeNarrow: React.CSSProperties = {
  flex: "0 1 6.2em",
  minWidth: "5.6em",
};

const inputBase: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  fontSize: 16,
  padding: "8px 10px",
};
