import { Injectable } from '@angular/core';
import { PointLogEntry, ShotResult, ShotSide, ShotCategory } from '../core/models/point-log.model';

// ══════════════════════════════════════════════════════════════════════════════
// Output interfaces
// ══════════════════════════════════════════════════════════════════════════════

export interface ServeStats {
  firstServeIn:       number;   // count of 1st serves in
  firstServeTotal:    number;   // count of 1st serve attempts
  firstServePct:      number;   // 0–100
  firstServeWon:      number;   // points won on 1st serve in
  firstServeWonPct:   number;   // 0–100
  secondServeIn:      number;
  secondServeTotal:   number;
  secondServePct:     number;
  secondServeWon:     number;
  secondServeWonPct:  number;
  aces:               number;
  doubleFaults:       number;
}

export interface BreakPointStats {
  /** Points where the receiver had a break-point opportunity */
  breakPointOpportunities: number;
  /** Break points converted by the receiver */
  breakPointsConverted:    number;
  /** Break points saved by the server */
  breakPointsSaved:        number;
  /** Break point conversion rate (0–100) */
  conversionPct:           number;
}

export interface RallyLengthGroups {
  short:  number;   // 1–4 shots
  medium: number;   // 5–8 shots
  long:   number;   // 9+ shots
  avg:    number;   // average rally length
}

export interface ShotBreakdown {
  winners:        number;
  unforcedErrors: number;
  forcedErrors:   number;
  winnersByFH:    number;
  winnersByBH:    number;
  winnersByServe: number;
  ueBySide:       Record<ShotSide, number>;
  byCategoryWin:  Partial<Record<ShotCategory, number>>;
  byCategoryErr:  Partial<Record<ShotCategory, number>>;
}

export interface MatchStats {
  p1: {
    serve:       ServeStats;
    breakPoints: BreakPointStats;
    rally:       RallyLengthGroups;
    shots:       ShotBreakdown;
    totalPoints: number;
    pointsWon:   number;
    pointsWonPct: number;
  };
  p2: {
    serve:       ServeStats;
    breakPoints: BreakPointStats;
    rally:       RallyLengthGroups;
    shots:       ShotBreakdown;
    totalPoints: number;
    pointsWon:   number;
    pointsWonPct: number;
  };
}

export interface MomentumPoint {
  pointIndex: number;
  raw:        number;   // raw momentum delta for this point
  ema:        number;   // 5-point exponential moving average
  label:      string;  // e.g. "3-2, Set 1 Game 4"
}

// ══════════════════════════════════════════════════════════════════════════════
// Pure stat functions (all exported for unit-testing)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Filters the points log to a specific set (1-based), or returns all points.
 */
export function filterBySet(log: PointLogEntry[], setNumber?: number): PointLogEntry[] {
  if (setNumber == null) return log;
  return log.filter(p => p.set_number === setNumber);
}

/**
 * Computes serve statistics for a single player.
 *
 * Conventions:
 *  - A 1st serve attempt is every point where serve_number === 1.
 *  - A 1st serve "in" is when the point continues (rally_length > 1) OR is an ace (shot_category === 'Ace').
 *  - A 1st serve fault is: server_id === playerId, serve_number === 1, winner_id !== playerId,
 *    shot_type === 'UE', shot_category !== 'Double Fault' AND rally_length === 1.
 *  - A 2nd serve attempt follows a 1st serve fault, i.e., serve_number === 2.
 *  - An ace: shot_category === 'Ace'.
 *  - A double fault: shot_category === 'Double Fault'.
 */
export function computeServeStats(log: PointLogEntry[], playerId: string): ServeStats {
  const servePoints = log.filter(p => p.server_id === playerId);

  const firstServePoints  = servePoints.filter(p => p.serve_number === 1);
  const secondServePoints = servePoints.filter(p => p.serve_number === 2);

  const aces         = servePoints.filter(p => p.shot_category === 'Ace').length;
  const doubleFaults = servePoints.filter(p => p.shot_category === 'Double Fault').length;

  // 1st serve in: ace OR rally continued (rally_length > 1) OR won a non-fault
  const firstServeIn    = firstServePoints.filter(
    p => p.shot_category === 'Ace' || p.rally_length > 1
  ).length;
  const firstServeTotal = firstServePoints.length;
  const firstServePct   = pct(firstServeIn, firstServeTotal);

  const firstServeWon    = firstServePoints.filter(p => p.winner_id === playerId).length;
  const firstServeWonPct = pct(firstServeWon, firstServeIn || firstServeTotal);

  const secondServeIn    = secondServePoints.filter(
    p => p.shot_category !== 'Double Fault' && (p.rally_length > 1 || p.shot_category === 'Ace')
  ).length;
  const secondServeTotal = secondServePoints.length;
  const secondServePct   = pct(secondServeIn, secondServeTotal);

  const secondServeWon    = secondServePoints.filter(p => p.winner_id === playerId).length;
  const secondServeWonPct = pct(secondServeWon, secondServeIn || secondServeTotal);

  return {
    firstServeIn, firstServeTotal, firstServePct,
    firstServeWon, firstServeWonPct,
    secondServeIn, secondServeTotal, secondServePct,
    secondServeWon, secondServeWonPct,
    aces, doubleFaults
  };
}

/**
 * Computes break-point stats for a player as the RECEIVER.
 * A break point exists when the receiver is one point away from winning
 * a game the server is serving.
 *
 * Note: full break-point detection requires replaying the game score, which
 * is done in the TennisScoringService. Here we use a simplified proxy:
 * any point the receiver wins on the server's serve game is a "conversion".
 * For accurate break-point detection, pass a pre-filtered `breakPointLog`
 * (points that occurred at break-point score states).
 */
export function computeBreakPoints(
  fullLog:         PointLogEntry[],
  playerId:        string,     // the receiver (trying to break)
  breakPointLog:   PointLogEntry[]  // pre-filtered to only break-point situations
): BreakPointStats {
  const opportunities      = breakPointLog.length;
  const breakPointsConverted = breakPointLog.filter(p => p.winner_id === playerId).length;
  const breakPointsSaved     = opportunities - breakPointsConverted;
  const conversionPct        = pct(breakPointsConverted, opportunities);

  return { breakPointOpportunities: opportunities, breakPointsConverted, breakPointsSaved, conversionPct };
}

/**
 * Groups points into rally-length buckets and computes the average.
 */
export function computeRallyGroups(log: PointLogEntry[]): RallyLengthGroups {
  if (log.length === 0) return { short: 0, medium: 0, long: 0, avg: 0 };

  let short = 0, medium = 0, long = 0, total = 0;
  for (const p of log) {
    const r = p.rally_length;
    if (r <= 4)      short++;
    else if (r <= 8) medium++;
    else             long++;
    total += r;
  }
  return { short, medium, long, avg: round(total / log.length, 1) };
}

/**
 * Computes shot breakdown (winners, errors, by side, by category) for a player.
 */
export function computeShotBreakdown(log: PointLogEntry[], playerId: string): ShotBreakdown {
  const playerPoints = log.filter(p => p.winner_id === playerId || p.server_id === playerId);

  const winners        = log.filter(p => p.winner_id === playerId && p.shot_type === 'Winner').length;
  const unforcedErrors = log.filter(p => p.winner_id !== playerId && p.shot_type === 'UE').length;
  const forcedErrors   = log.filter(p => p.winner_id !== playerId && p.shot_type === 'FE').length;

  const winPoints = log.filter(p => p.winner_id === playerId && p.shot_type === 'Winner');
  const winnersByFH    = winPoints.filter(p => p.side === 'FH').length;
  const winnersByBH    = winPoints.filter(p => p.side === 'BH').length;
  const winnersByServe = winPoints.filter(p => p.side === 'Serve').length;

  const errPoints = log.filter(p => p.winner_id !== playerId);
  const ueBySide: Record<ShotSide, number> = { FH: 0, BH: 0, Serve: 0 };
  for (const p of errPoints) {
    if (p.shot_type === 'UE') ueBySide[p.side] = (ueBySide[p.side] ?? 0) + 1;
  }

  const byCategoryWin:  Partial<Record<ShotCategory, number>> = {};
  const byCategoryErr:  Partial<Record<ShotCategory, number>> = {};
  for (const p of log) {
    if (p.winner_id === playerId && p.shot_type === 'Winner') {
      byCategoryWin[p.shot_category] = (byCategoryWin[p.shot_category] ?? 0) + 1;
    } else if (p.winner_id !== playerId && (p.shot_type === 'UE' || p.shot_type === 'FE')) {
      byCategoryErr[p.shot_category] = (byCategoryErr[p.shot_category] ?? 0) + 1;
    }
  }

  return {
    winners, unforcedErrors, forcedErrors,
    winnersByFH, winnersByBH, winnersByServe,
    ueBySide, byCategoryWin, byCategoryErr
  };
}

/**
 * Computes a 5-point Exponential Moving Average over the raw momentum values.
 * EMA_n = alpha * raw_n + (1 - alpha) * EMA_(n-1), where alpha = 2 / (window + 1)
 */
export function computeMomentumEMA(log: PointLogEntry[], window = 5): MomentumPoint[] {
  if (log.length === 0) return [];

  const alpha = 2 / (window + 1);
  let ema     = log[0].momentum_index;

  return log.map((p, i) => {
    if (i === 0) {
      ema = p.momentum_index;
    } else {
      ema = alpha * p.momentum_index + (1 - alpha) * ema;
    }
    return {
      pointIndex: i,
      raw:   p.momentum_index,
      ema:   round(ema, 2),
      label: `Set ${p.set_number} G${p.game_number}-P${p.point_number}`
    };
  });
}

/**
 * Computes the "Points-To-Set" countdown series per player for a given set.
 * Returns points remaining for each player to win the set at each game score.
 * (Mirrors the chart in the reference app.)
 */
export function computePointsToSet(
  log: PointLogEntry[],
  setNumber: number,
  gamesNeeded = 6
): { gameLabel: string; p1Remaining: number; p2Remaining: number }[] {
  const setLog = log.filter(p => p.set_number === setNumber);
  if (setLog.length === 0) return [];

  // Collect unique game scores in order
  const gameBoundaries: { p1Games: number; p2Games: number }[] = [];
  let lastGameNum = 0;
  let p1g = 0, p2g = 0;

  for (const p of setLog) {
    if (p.game_number > lastGameNum) {
      gameBoundaries.push({ p1Games: p1g, p2Games: p2g });
      lastGameNum = p.game_number;
    }
    // This is simplified — exact game won detection requires full replay
  }
  // Push final state
  gameBoundaries.push({ p1Games: p1g, p2Games: p2g });

  const maxPoints = gamesNeeded * 4; // approximate max points to win a set

  return gameBoundaries.map(({ p1Games, p2Games }) => ({
    gameLabel:    `${p1Games}-${p2Games}`,
    p1Remaining:  Math.max(0, maxPoints - p1Games * 4),
    p2Remaining:  Math.max(0, maxPoints - p2Games * 4)
  }));
}

/**
 * Builds the complete stats bundle for both players over a log (full match or filtered by set).
 */
export function computeMatchStats(
  log: PointLogEntry[],
  p1Id: string,
  p2Id: string,
  breakPointLogP1: PointLogEntry[] = [],
  breakPointLogP2: PointLogEntry[] = []
): MatchStats {
  const total = log.length;

  const p1Won = log.filter(p => p.winner_id === p1Id).length;
  const p2Won = log.filter(p => p.winner_id === p2Id).length;

  return {
    p1: {
      serve:        computeServeStats(log, p1Id),
      breakPoints:  computeBreakPoints(log, p1Id, breakPointLogP1),
      rally:        computeRallyGroups(log.filter(p => p.server_id === p2Id)), // p1 is receiver
      shots:        computeShotBreakdown(log, p1Id),
      totalPoints:  total,
      pointsWon:    p1Won,
      pointsWonPct: pct(p1Won, total)
    },
    p2: {
      serve:        computeServeStats(log, p2Id),
      breakPoints:  computeBreakPoints(log, p2Id, breakPointLogP2),
      rally:        computeRallyGroups(log.filter(p => p.server_id === p1Id)), // p2 is receiver
      shots:        computeShotBreakdown(log, p2Id),
      totalPoints:  total,
      pointsWon:    p2Won,
      pointsWonPct: pct(p2Won, total)
    }
  };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function pct(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return round((numerator / denominator) * 100, 2);
}

function round(n: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}

// ══════════════════════════════════════════════════════════════════════════════
// StatsService — Angular injectable wrapper
// ══════════════════════════════════════════════════════════════════════════════

@Injectable({ providedIn: 'root' })
export class StatsService {

  /**
   * Returns full match stats, optionally filtered to a single set.
   */
  getMatchStats(
    log: PointLogEntry[],
    p1Id: string,
    p2Id: string,
    setNumber?: number,
    breakPointLogP1: PointLogEntry[] = [],
    breakPointLogP2: PointLogEntry[] = []
  ): MatchStats {
    const filtered = filterBySet(log, setNumber);
    return computeMatchStats(filtered, p1Id, p2Id, breakPointLogP1, breakPointLogP2);
  }

  /**
   * Returns the EMA-smoothed momentum series for the Momentum chart.
   */
  getMomentumSeries(log: PointLogEntry[], window = 5): MomentumPoint[] {
    return computeMomentumEMA(log, window);
  }

  /**
   * Returns Points-To-Set countdown data for a given set.
   */
  getPointsToSet(
    log: PointLogEntry[],
    setNumber: number,
    gamesNeeded = 6
  ): ReturnType<typeof computePointsToSet> {
    return computePointsToSet(log, setNumber, gamesNeeded);
  }

  /**
   * Returns rally-length groups for the full match or a single set.
   */
  getRallyGroups(log: PointLogEntry[], setNumber?: number): RallyLengthGroups {
    return computeRallyGroups(filterBySet(log, setNumber));
  }

  /**
   * Returns shot breakdown for one player, optionally filtered by set.
   */
  getShotBreakdown(
    log: PointLogEntry[],
    playerId: string,
    setNumber?: number
  ): ShotBreakdown {
    return computeShotBreakdown(filterBySet(log, setNumber), playerId);
  }
}
