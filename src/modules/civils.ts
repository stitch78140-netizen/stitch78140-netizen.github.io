// src/modules/civils.ts

export type DayType = 'SO' | 'R' | 'RH';

export interface Meal { start?: Date; end?: Date }
export interface Break { start?: Date; end?: Date }

export interface Input {
  start: Date;
  end: Date;
  mealNoon?: Meal;
  mealEvening?: Meal;
  theBreak?: Break;
  dayType: DayType; // utile si tu veux l'indiquer ici, sinon non bloquant pour compute()
}

export interface Output {
  dmjEnd: Date;
  t13: Date;
  Bmin_min: number;   // minutes effectives après DMJ (repas + coupure déduits)
  Amin_min: number;   // minutes effectives DMJ→13h (coupure déduite)
  A_hours: number;    // heures de base retenues (A) selon arbitrage minutes-only
  B_total_h: number;  // dépassement total arrondi (en heures)

  // Ventilation par bacs
  HS: number;   // heures sup "jour" non majorées
  HSN: number;  // heures sup "nuit" non majorées
  HSM: number;  // heures sup "jour" majorées (au-delà de 13h)
  HNM: number;  // heures sup "nuit" majorées (au-delà de 13h)
}

/* ---------- Utils temporels ---------- */

export function minutesBetween(a: Date, b: Date) {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));
}

export function addMin(d: Date, m: number) {
  return new Date(d.getTime() + m * 60000);
}

export function ceilH(m: number) {
  if (m <= 0) return 0;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? h + 1 : h;
}

/* ---------- Intervalles ---------- */

export function normalize(ints: Array<{ start: Date; end: Date }>) {
  if (!ints.length) return [] as Array<{ start: Date; end: Date }>;
  ints.sort((a, b) => a.start.getTime() - b.start.getTime());
  const out = [{ ...ints[0] }];
  for (let i = 1; i < ints.length; i++) {
    const p = out[out.length - 1], c = ints[i];
    if (c.start <= p.end) {
      p.end = new Date(Math.max(p.end.getTime(), c.end.getTime()));
    } else {
      out.push({ ...c });
    }
  }
  return out;
}

export function subtract(
  baseStart: Date,
  baseEnd: Date,
  remove: Array<{ start: Date; end: Date }>
) {
  const clipped = remove
    .map(r => ({
      start: new Date(Math.max(r.start.getTime(), baseStart.getTime())),
      end: new Date(Math.min(r.end.getTime(), baseEnd.getTime()))
    }))
    .filter(r => r.end > baseStart && r.start < baseEnd);

  const rem = normalize(clipped);
  const segs: Array<{ start: Date; end: Date }> = [];
  let cur = new Date(baseStart);

  for (const r of rem) {
    if (r.start > cur) segs.push({ start: cur, end: r.start });
    if (r.end > cur) cur = new Date(r.end);
  }
  if (cur < baseEnd) segs.push({ start: cur, end: baseEnd });
  return segs;
}

/* ---------- DMJ = 7h48 effectif ---------- */

export function computeDMJ(
  start: Date,
  pauses: Array<{ start: Date; end: Date }>,
  targetMin = 468 // 7h48
) {
  const merged = normalize(pauses);
  const endWindow = addMin(start, 2 * 24 * 60); // garde-fou 48h

  const segs: Array<{ start: Date; end: Date }> = [];
  let cur = new Date(start);
  for (const r of merged) {
    if (r.start > cur) segs.push({ start: cur, end: r.start });
    if (r.end > cur) cur = new Date(r.end);
  }
  segs.push({ start: cur, end: endWindow });

  let rest = targetMin;
  for (const s of segs) {
    const d = minutesBetween(s.start, s.end);
    if (d >= rest) return addMin(s.start, rest);
    rest -= d;
  }
  return endWindow;
}

/* ---------- Nuit : heure ENTIEREMENT dans [21:00, 06:00) ---------- */

export function isFullNightHour(s: Date, e: Date) {
  const spans: Array<{ sd: Date; ed: Date }> = [];
  const midnight = new Date(s);
  midnight.setHours(24, 0, 0, 0);
  if (e <= midnight) {
    spans.push({ sd: s, ed: e });
  } else {
    spans.push({ sd: s, ed: midnight });
    spans.push({ sd: midnight, ed: e });
  }

  for (const sp of spans) {
    const d0 = new Date(sp.sd);
    d0.setHours(0, 0, 0, 0);
    const h06 = new Date(d0); h06.setHours(6, 0, 0, 0);
    const h21 = new Date(d0); h21.setHours(21, 0, 0, 0);

    const interStart = new Date(Math.max(sp.sd.getTime(), h06.getTime()));
    const interEnd   = new Date(Math.min(sp.ed.getTime(), h21.getTime()));
    // s'il existe une intersection avec la zone JOUR (06–21), ce n'est pas une heure de nuit complète
    if (interEnd > interStart) return false;
  }
  return true;
}

/* ---------- Calcul principal ---------- */

export function compute(input: Input): Output {
  const start = input.start;
  const end   = input.end;
  const t13   = addMin(start, 13 * 60);

  // Pauses
  const meals: Array<{ start: Date; end: Date }> = [];
  if (input.mealNoon?.start && input.mealNoon?.end)
    meals.push({ start: input.mealNoon.start, end: input.mealNoon.end });
  if (input.mealEvening?.start && input.mealEvening?.end)
    meals.push({ start: input.mealEvening.start, end: input.mealEvening.end });

  const breaks: Array<{ start: Date; end: Date }> =
    input.theBreak?.start && input.theBreak?.end
      ? [{ start: input.theBreak.start, end: input.theBreak.end }]
      : [];

  const allPauses = meals.concat(breaks);

  // DMJ
  const dmjEnd = computeDMJ(start, allPauses);

  // Bmin = travail effectif après DMJ (repas + coupure déduits)
  const Bmin_min = subtract(dmjEnd, end, allPauses)
    .reduce((a, s) => a + minutesBetween(s.start, s.end), 0);

  // Amin = travail effectif entre DMJ et 13h (UNIQUEMENT coupure déduite)
  const Amin_min = subtract(dmjEnd, t13, breaks)
    .reduce((a, s) => a + minutesBetween(s.start, s.end), 0);

  // Arbitrage "minutes-only"
  const A_hours   = (Amin_min % 60) > (Bmin_min % 60)
    ? Math.ceil(Amin_min / 60)
    : Math.floor(Amin_min / 60);

  const B_total_h = ceilH(Bmin_min); // dépassement arrondi à l'heure sup
  const nonMaj    = Math.min(A_hours, B_total_h);           // A
  const maj       = Math.max(0, B_total_h - nonMaj);        // B(arrondi) - A

  // Ventilation
  let HS = 0, HSN = 0, HSM = 0, HNM = 0;

  // Heures non majorées (depuis DMJ)
  let cur = new Date(dmjEnd);
  for (let i = 0; i < nonMaj; i++) {
    const s = new Date(cur), e = addMin(s, 60);
    if (isFullNightHour(s, e)) HSN++; else HS++;
    cur = e;
  }

  // Heures majorées (depuis l'amplitude 13h)
  cur = new Date(t13);
  for (let i = 0; i < maj; i++) {
    const s = new Date(cur), e = addMin(s, 60);
    if (isFullNightHour(s, e)) HNM++; else HSM++;
    cur = e;
  }

  return { dmjEnd, t13, Bmin_min, Amin_min, A_hours, B_total_h, HS, HSN, HSM, HNM };
}
