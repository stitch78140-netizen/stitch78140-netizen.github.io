// src/modules/civils.ts

// --- Utils ---
function addMin(d: Date, min: number): Date {
  return new Date(d.getTime() + min * 60000);
}

function diffMin(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 60000);
}

function roundUpHours(min: number): number {
  return Math.ceil(min / 60);
}

// Exemple : heure de nuit = 21h-06h
function isFullNightHour(start: Date, end: Date): boolean {
  const sh = start.getHours(), eh = end.getHours();
  const sm = start.getMinutes(), em = end.getMinutes();
  // Si c’est exactement 1h complète dans [21h-6h]
  if (sm !== 0 || em !== 0) return false;
  const hour = sh;
  return (hour >= 21 || hour < 6);
}

// --- Main calc ---
export function computeService(pds: Date, fds: Date, pauses: { start: Date, end: Date }[] = [], coupure?: { start: Date, end: Date }) {
  // Durée de base
  const dmjEnd = addMin(pds, 7 * 60 + 48); // 7h48 après PDS
  const t13 = addMin(pds, 13 * 60); // amplitude 13h

  // Décompte pauses et coupures dans la DMJ
  let dmjShift = 0;
  for (const p of pauses) {
    if (p.start < dmjEnd) {
      const overlap = Math.min(dmjEnd.getTime(), p.end.getTime()) - p.start.getTime();
      if (overlap > 0) dmjShift += overlap;
    }
  }
  if (coupure && coupure.start < dmjEnd) {
    const overlap = Math.min(dmjEnd.getTime(), coupure.end.getTime()) - coupure.start.getTime();
    if (overlap > 0) dmjShift += overlap;
  }

  const realDmjEnd = new Date(dmjEnd.getTime() + dmjShift);

  // Calcul durées
  const totalWorkMin = diffMin(pds, fds) - pauses.reduce((acc, p) => acc + diffMin(p.start, p.end), 0) - (coupure ? diffMin(coupure.start, coupure.end) : 0);
  const Bmin_min = totalWorkMin % 60;
  const B_total_h = roundUpHours(totalWorkMin);

  const Amin_min = diffMin(realDmjEnd, addMin(pds, 13 * 60)) % 60;
  const A_hours = roundUpHours(diffMin(realDmjEnd, fds));

  let HS = 0, HSN = 0, HSM = 0, HNM = 0;

  // Non maj (depuis DMJ)
  let cur = new Date(realDmjEnd);
  const nonMaj = Math.max(0, B_total_h); // placeholder logique
  for (let i = 0; i < nonMaj; i++) {
    const s = new Date(cur), e = addMin(s, 60);
    if (isFullNightHour(s, e)) {
      HSN += 1;
    } else {
      HS += 1;
    }
    cur = e;
  }

  // Maj (depuis t13)
  const maj = 0; // à calculer selon Amin/Bmin
  cur = new Date(t13);
  for (let i = 0; i < maj; i++) {
    const s = new Date(cur), e = addMin(s, 60);
    if (isFullNightHour(s, e)) {
      HNM += 1;
    } else {
      HSM += 1;
    }
    cur = e;
  }

  // Dimanche : renommage HS→HSD et HSM→HDM sera géré dans l’UI (affichage)
  return { dmjEnd: realDmjEnd, t13, Bmin_min, Amin_min, A_hours, B_total_h, HS, HSN, HSM, HNM };
}
