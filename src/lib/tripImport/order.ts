// Ordering stops and cutting them into days from a REAL driving-time matrix.
// Pure: the matrix comes from geo.ts (or a test). If there is no matrix, or a
// pair has no route, the caller does not call this and shows the stops
// unordered, saying so. We never estimate drive times from straight lines.

import type { DurationMatrix } from "./geo";

/** Shortest open path through all stops (any start). Exact up to 8, heuristic above. */
export function orderStops(matrix: DurationMatrix): number[] | null {
  const n = matrix.length;
  if (n === 0) return [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j && matrix[i][j] === null) return null;
  const d = (i: number, j: number) => matrix[i][j] as number;
  const cost = (p: number[]) => p.slice(1).reduce((s, v, k) => s + d(p[k], v), 0);

  let best: number[] = [];
  let bestCost = Infinity;
  const consider = (p: number[]) => {
    const c = cost(p);
    // Ties go to the earlier-mentioned start, so the post's own order wins when drive times are equal.
    if (c < bestCost - 1e-9 || (Math.abs(c - bestCost) <= 1e-9 && p[0] < best[0])) {
      best = [...p];
      bestCost = c;
    }
  };

  if (n <= 8) {
    const perm = (rest: number[], cur: number[]) => {
      if (!rest.length) return consider(cur);
      for (let i = 0; i < rest.length; i++) perm([...rest.slice(0, i), ...rest.slice(i + 1)], [...cur, rest[i]]);
    };
    perm(Array.from({ length: n }, (_, i) => i), []);
  } else {
    for (let s = 0; s < n; s++) {
      const path = [s];
      const left = new Set(Array.from({ length: n }, (_, i) => i).filter((i) => i !== s));
      while (left.size) {
        const last = path[path.length - 1];
        let nxt = -1;
        for (const c of Array.from(left)) if (nxt < 0 || d(last, c) < d(last, nxt)) nxt = c;
        path.push(nxt);
        left.delete(nxt);
      }
      // 2-opt on the open path.
      let improved = true;
      while (improved) {
        improved = false;
        for (let i = 0; i < n - 1; i++) {
          for (let j = i + 1; j < n; j++) {
            const cand = [...path.slice(0, i), ...path.slice(i, j + 1).reverse(), ...path.slice(j + 1)];
            if (cost(cand) < cost(path) - 1e-9) {
              path.splice(0, n, ...cand);
              improved = true;
            }
          }
        }
      }
      consider(path);
    }
  }
  // A path and its reverse cost the same here (symmetric enough); begin with the
  // end that was mentioned earlier in the post.
  if (best.length > 1 && best[best.length - 1] < best[0] && cost([...best].reverse()) <= cost(best) + 1e-9) {
    best.reverse();
  }
  return best;
}

export type DayPlan = {
  /** Indices into the original stop list, in visiting order. */
  stops: number[];
  /** Real driving seconds on this day, including the leg in from the previous day's last stop. */
  driveSeconds: number;
};

export const MAX_DRIVE_SECONDS_PER_DAY = 5 * 3600;
export const MAX_STOPS_PER_DAY = 4;

export function groupIntoDays(order: number[], matrix: DurationMatrix): DayPlan[] {
  const days: DayPlan[] = [];
  let cur: DayPlan | null = null;
  for (let k = 0; k < order.length; k++) {
    const leg = k === 0 ? 0 : (matrix[order[k - 1]][order[k]] as number);
    if (!cur) {
      cur = { stops: [order[k]], driveSeconds: leg };
      days.push(cur);
      continue;
    }
    // Leg within the day: travelling between this day's stops.
    if (cur.stops.length >= MAX_STOPS_PER_DAY || cur.driveSeconds + leg > MAX_DRIVE_SECONDS_PER_DAY) {
      cur = { stops: [order[k]], driveSeconds: leg };
      days.push(cur);
    } else {
      cur.stops.push(order[k]);
      cur.driveSeconds += leg;
    }
  }
  return days;
}

/** "2.5 hrs": nearest half hour, matching how the seeded itineraries write drive time. */
export function formatDrive(seconds: number): string | null {
  if (seconds < 15 * 60) return null;
  const halves = Math.max(1, Math.round(seconds / 1800));
  const hrs = halves / 2;
  if (hrs === 1) return "1 hr";
  return `${Number.isInteger(hrs) ? hrs : hrs.toFixed(1)} hrs`;
}
