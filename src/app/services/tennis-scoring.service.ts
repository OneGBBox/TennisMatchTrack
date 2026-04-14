import { Injectable, computed, signal } from '@angular/core';
import { PointLogEntry, ShotType, ShotSide, ShotLocation } from '../core/models/point-log.model';
import { ScoringRules, MatchFormat } from '../core/models/scoring-rules.model';
import { MatchStatus } from '../core/models/match.model';

// ── Exported types ────────────────────────────────────────────────────────────

export type RecordPointInput = Omit<
  PointLogEntry,
  'set_number' | 'game_number' | 'point_number' | 'momentum_index'
>;

export interface GamePoints { p1: number; p2: number; }
export interface SetGames   { p1: number; p2: number; winner: string | null; }
export interface SetsWon    { p1: number; p2: number; }

export interface DisplayScore {
  p1: string;   // "0" | "15" | "30" | "40" | "Ad" | tiebreak number string
  p2: string;
  label: string; // "Deuce" | "Advantage" | "" | tiebreak score like "4 - 3"
}

export interface MatchSnapshot {
  /** All sets: completed sets + current in-progress set (last entry). */
  setScores:        SetGames[];
  /** Raw point counts in the current (possibly incomplete) game. */
  currentGamePts:   GamePoints;
  /** Whether the current game is a tiebreak (regular or super). */
  isTiebreakGame:   boolean;
  /** Whether the current tiebreak is a 10-point super tiebreak. */
  isSuperTiebreak:  boolean;
  isMatchComplete:  boolean;
  matchWinner:      string | null;
  setsWon:          SetsWon;
  /** 0-based index of the current set (= number of completed sets). */
  currentSetIdx:    number;
  /** Total games completed in the current set (= 0-based game index). */
  currentGameIdx:   number;
  /** Points played so far in the current game. */
  currentPointIdx:  number;
}

// ══════════════════════════════════════════════════════════════════════════════
// Pure scoring functions (all exported for unit-testing)
// ══════════════════════════════════════════════════════════════════════════════

export function otherPlayer(id: string, p1Id: string, p2Id: string): string {
  return id === p1Id ? p2Id : p1Id;
}

export function setsNeededToWin(format: MatchFormat): number {
  if (format === 'best_of_5') return 3;
  if (format === 'best_of_3' || format === 'super_tiebreak') return 2;
  return 1; // best_of_1, pro_set, fast4
}

export function tiebreakTriggersAt(format: MatchFormat): number {
  if (format === 'pro_set') return 8;
  if (format === 'fast4')   return 3;
  return 6;
}

export function tiebreakTarget(format: MatchFormat, isSuperTb: boolean): number {
  if (isSuperTb) return 10;
  if (format === 'fast4') return 5;
  return 7;
}

export function isSuperTiebreakSet(
  rules: ScoringRules,
  p1SetsWon: number,
  p2SetsWon: number
): boolean {
  return (
    rules.format === 'super_tiebreak' &&
    p1SetsWon === 1 &&
    p2SetsWon === 1
  );
}

/**
 * Returns 'p1' | 'p2' | null depending on whether the game has been won.
 * Scores are raw point counts (0, 1, 2, 3, ...).
 */
export function checkGameWon(
  p1Pts: number,
  p2Pts: number,
  isTb: boolean,
  isSuperTb: boolean,
  rules: ScoringRules
): 'p1' | 'p2' | null {
  if (isTb || isSuperTb) {
    const target = tiebreakTarget(rules.format, isSuperTb);
    if (p1Pts >= target && p1Pts - p2Pts >= 2) return 'p1';
    if (p2Pts >= target && p2Pts - p1Pts >= 2) return 'p2';
    return null;
  }

  if (rules.no_ad) {
    // At 3-3 the next point decides — whoever reaches 4 wins
    if (p1Pts >= 4) return 'p1';
    if (p2Pts >= 4) return 'p2';
    return null;
  }

  // Standard (with advantage)
  if (p1Pts >= 4 && p1Pts - p2Pts >= 2) return 'p1';
  if (p2Pts >= 4 && p2Pts - p1Pts >= 2) return 'p2';
  return null;
}

/**
 * Returns 'p1' | 'p2' | null depending on whether the set has been won.
 * `lastGameWasTb` must be true when the winning game was a tiebreak
 * (because 7-6 / 4-3 etc. would otherwise not pass the lead-by-2 check).
 */
export function checkSetWon(
  p1Games: number,
  p2Games: number,
  rules: ScoringRules,
  lastGameWasTb: boolean
): 'p1' | 'p2' | null {
  // Tiebreak win always wins the set
  if (lastGameWasTb) {
    if (p1Games > p2Games) return 'p1';
    if (p2Games > p1Games) return 'p2';
    return null;
  }

  if (rules.format === 'fast4') {
    if (p1Games >= 4) return 'p1';
    if (p2Games >= 4) return 'p2';
    return null;
  }

  if (rules.format === 'pro_set') {
    if (p1Games >= 8 && p1Games - p2Games >= 2) return 'p1';
    if (p2Games >= 8 && p2Games - p1Games >= 2) return 'p2';
    return null;
  }

  // Standard formats (best_of_1/3/5, super_tiebreak normal sets)
  if (p1Games >= 6 && p1Games - p2Games >= 2) return 'p1';
  if (p2Games >= 6 && p2Games - p1Games >= 2) return 'p2';
  if (p1Games === 7 && p2Games === 5) return 'p1';
  if (p2Games === 7 && p1Games === 5) return 'p2';
  return null;
}

/**
 * Derives the full match snapshot by sequentially replaying every
 * point in the log against the scoring rules.
 */
export function deriveMatchSnapshot(
  log: PointLogEntry[],
  rules: ScoringRules,
  p1Id: string,
  p2Id: string
): MatchSnapshot {
  let p1SetsWon = 0, p2SetsWon = 0;
  let p1SetGames = 0, p2SetGames = 0;
  let p1GamePts = 0, p2GamePts = 0;
  const completedSets: SetGames[] = [];
  let matchDone = false;
  let matchWinner: string | null = null;
  const setsToWin = setsNeededToWin(rules.format);

  for (const entry of log) {
    if (matchDone) break;

    const superTb = isSuperTiebreakSet(rules, p1SetsWon, p2SetsWon);
    const tieAt   = tiebreakTriggersAt(rules.format);
    const isTb    = superTb || (p1SetGames === tieAt && p2SetGames === tieAt);

    // Apply point
    if (entry.winner_id === p1Id) p1GamePts++;
    else p2GamePts++;

    const gameWon = checkGameWon(p1GamePts, p2GamePts, isTb, superTb, rules);
    if (!gameWon) continue;

    // Award game
    if (gameWon === 'p1') p1SetGames++;
    else p2SetGames++;

    // Check set
    const setWon = superTb ? gameWon : checkSetWon(p1SetGames, p2SetGames, rules, isTb);
    if (setWon) {
      completedSets.push({
        p1: p1SetGames,
        p2: p2SetGames,
        winner: setWon === 'p1' ? p1Id : p2Id
      });
      if (setWon === 'p1') p1SetsWon++;
      else p2SetsWon++;
      p1SetGames = 0;
      p2SetGames = 0;

      if (p1SetsWon >= setsToWin || p2SetsWon >= setsToWin) {
        matchDone  = true;
        matchWinner = p1SetsWon >= setsToWin ? p1Id : p2Id;
      }
    }

    // Reset game points
    p1GamePts = 0;
    p2GamePts = 0;
  }

  // Build the current (in-progress) set entry
  const currentSetGames: SetGames = { p1: p1SetGames, p2: p2SetGames, winner: null };
  const allSets = matchDone
    ? completedSets
    : [...completedSets, currentSetGames];

  const currentSetIdx  = completedSets.length;
  const currentGameIdx = p1SetGames + p2SetGames;
  const currentPointIdx = p1GamePts + p2GamePts;

  // Tiebreak status for the CURRENT game
  const superTbNow = !matchDone && isSuperTiebreakSet(rules, p1SetsWon, p2SetsWon);
  const tieAtNow   = tiebreakTriggersAt(rules.format);
  const isTbNow    = !matchDone && (superTbNow || (p1SetGames === tieAtNow && p2SetGames === tieAtNow));

  return {
    setScores:       allSets,
    currentGamePts:  { p1: p1GamePts, p2: p2GamePts },
    isTiebreakGame:  isTbNow,
    isSuperTiebreak: superTbNow,
    isMatchComplete: matchDone,
    matchWinner,
    setsWon:         { p1: p1SetsWon, p2: p2SetsWon },
    currentSetIdx,
    currentGameIdx,
    currentPointIdx
  };
}

/**
 * Derives who should be serving the NEXT point by replaying the match.
 * Server changes:
 *  - Standard game: other player serves the next game.
 *  - Tiebreak: change after point 1, then every 2 points.
 *  - After a tiebreak: receiver of first tiebreak point serves first in new set.
 */
export function deriveCurrentServer(
  log: PointLogEntry[],
  initialServerId: string,
  rules: ScoringRules,
  p1Id: string,
  p2Id: string
): string {
  if (log.length === 0) return initialServerId;

  let server = initialServerId;
  let p1SetsWon = 0, p2SetsWon = 0;
  let p1SetGames = 0, p2SetGames = 0;
  let p1GamePts = 0, p2GamePts = 0;
  let inTb = false;
  let tbFirstServer = '';
  let tbPointCount = 0;
  const setsToWin = setsNeededToWin(rules.format);
  let matchDone = false;

  for (const entry of log) {
    if (matchDone) break;

    const superTb = isSuperTiebreakSet(rules, p1SetsWon, p2SetsWon);
    const tieAt   = tiebreakTriggersAt(rules.format);
    const isTb    = superTb || (p1SetGames === tieAt && p2SetGames === tieAt);

    // Track tiebreak entry
    if (isTb && !inTb) {
      inTb          = true;
      tbFirstServer = server;
      tbPointCount  = 0;
    }

    // Apply point
    if (entry.winner_id === p1Id) p1GamePts++;
    else p2GamePts++;

    // Tiebreak server rotation: change after point 1, then every 2 points
    if (isTb) {
      tbPointCount++;
      if (tbPointCount % 2 === 1) {
        server = otherPlayer(server, p1Id, p2Id);
      }
    }

    const gameWon = checkGameWon(p1GamePts, p2GamePts, isTb, superTb, rules);
    if (!gameWon) continue;

    if (gameWon === 'p1') p1SetGames++;
    else p2SetGames++;

    const setWon = superTb ? gameWon : checkSetWon(p1SetGames, p2SetGames, rules, isTb);
    if (setWon) {
      if (setWon === 'p1') p1SetsWon++;
      else p2SetsWon++;
      p1SetGames = 0;
      p2SetGames = 0;

      if (p1SetsWon >= setsToWin || p2SetsWon >= setsToWin) {
        matchDone = true;
      }
    }

    p1GamePts  = 0;
    p2GamePts  = 0;

    // Server change after game
    if (isTb) {
      // After tiebreak: receiver of first tiebreak point serves first in new set
      server = otherPlayer(tbFirstServer, p1Id, p2Id);
    } else {
      // Standard game: other player serves
      server = otherPlayer(server, p1Id, p2Id);
    }

    inTb         = false;
    tbPointCount = 0;
    tbFirstServer = '';
  }

  return server;
}

/**
 * Returns a human-readable display score for the current game.
 */
export function formatDisplayScore(
  pts: GamePoints,
  isTb: boolean,
  rules: ScoringRules
): DisplayScore {
  const { p1, p2 } = pts;

  if (isTb) {
    return { p1: String(p1), p2: String(p2), label: `${p1} – ${p2}` };
  }

  const LABELS = ['0', '15', '30', '40'];

  // Deuce (3-3 with advantage scoring)
  if (!rules.no_ad && p1 >= 3 && p2 >= 3 && p1 === p2) {
    return { p1: '40', p2: '40', label: 'Deuce' };
  }

  // Advantage
  if (!rules.no_ad && p1 >= 3 && p2 >= 3 && p1 !== p2) {
    if (p1 > p2) return { p1: 'Ad', p2: '40', label: 'Advantage' };
    return { p1: '40', p2: 'Ad', label: 'Advantage' };
  }

  // No-Ad deuce
  if (rules.no_ad && p1 === 3 && p2 === 3) {
    return { p1: '40', p2: '40', label: 'Deciding Point' };
  }

  return {
    p1: LABELS[Math.min(p1, 3)],
    p2: LABELS[Math.min(p2, 3)],
    label: ''
  };
}

/**
 * Computes the momentum delta for a single point.
 * Positive = server/p1 momentum, Negative = receiver/p2 momentum.
 */
export function computeMomentumDelta(
  input: RecordPointInput,
  serverId: string
): number {
  const winnerIsServer = input.winner_id === serverId;

  // Base: +2 if server wins, -2 if server loses
  let delta = winnerIsServer ? 2 : -2;

  // Shot type modifier
  if (input.shot_type === 'Winner') delta += winnerIsServer ? 1 : -1;
  else if (input.shot_type === 'UE') delta += winnerIsServer ? -1 : 1;

  return delta;
}

// ══════════════════════════════════════════════════════════════════════════════
// TennisScoringService — Angular Signal-based scoring engine
// ══════════════════════════════════════════════════════════════════════════════

@Injectable({ providedIn: 'root' })
export class TennisScoringService {

  // ── Private writable signals ──────────────────────────────────────────────

  private readonly _matchId         = signal<string>('');
  private readonly _p1Id            = signal<string>('');
  private readonly _p2Id            = signal<string>('');
  private readonly _rules           = signal<ScoringRules | null>(null);
  private readonly _initialServer   = signal<string>('');
  private readonly _status          = signal<MatchStatus>('setup');
  private readonly _pointsLog       = signal<PointLogEntry[]>([]);
  private readonly _undoStack       = signal<PointLogEntry[][]>([]);
  private readonly _redoStack       = signal<PointLogEntry[][]>([]);

  // ── Public computed signals ───────────────────────────────────────────────

  /** Full derived match state — recalculates whenever the log changes. */
  readonly snapshot = computed<MatchSnapshot>(() => {
    const rules = this._rules();
    if (!rules) return this.emptySnapshot();
    return deriveMatchSnapshot(
      this._pointsLog(), rules, this._p1Id(), this._p2Id()
    );
  });

  /** Who should serve the next point. */
  readonly currentServer = computed<string>(() => {
    const rules = this._rules();
    if (!rules) return this._initialServer();
    return deriveCurrentServer(
      this._pointsLog(), this._initialServer(), rules, this._p1Id(), this._p2Id()
    );
  });

  readonly setScores        = computed(() => this.snapshot().setScores);
  readonly gameScore        = computed(() => this.snapshot().currentGamePts);
  readonly isTiebreak       = computed(() => this.snapshot().isTiebreakGame);
  readonly isSuperTiebreak  = computed(() => this.snapshot().isSuperTiebreak);
  readonly isMatchComplete  = computed(() => this.snapshot().isMatchComplete);
  readonly winner           = computed(() => this.snapshot().matchWinner);
  readonly setsWon          = computed(() => this.snapshot().setsWon);
  readonly matchStatus      = computed(() => this._status());

  /** Human-readable current game score. */
  readonly displayScore = computed<DisplayScore>(() => {
    const rules = this._rules();
    if (!rules) return { p1: '0', p2: '0', label: '' };
    return formatDisplayScore(this.gameScore(), this.isTiebreak(), rules);
  });

  /** Raw momentum index for every recorded point (for Chart.js). */
  readonly momentumData = computed<number[]>(() =>
    this._pointsLog().map(p => p.momentum_index)
  );

  /** Entire points log (read-only). */
  readonly pointsLog = computed<PointLogEntry[]>(() => this._pointsLog());

  readonly canUndo = computed(() => this._undoStack().length > 0);
  readonly canRedo = computed(() => this._redoStack().length > 0);

  // Expose player IDs read-only
  readonly p1Id = computed(() => this._p1Id());
  readonly p2Id = computed(() => this._p2Id());
  readonly matchId = computed(() => this._matchId());

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Initialise service state for a new or existing match.
   * Call this before calling recordPoint().
   */
  startMatch(
    matchId: string,
    p1Id: string,
    p2Id: string,
    rules: ScoringRules,
    initialServerId: string,
    existingLog: PointLogEntry[] = []
  ): void {
    this._matchId.set(matchId);
    this._p1Id.set(p1Id);
    this._p2Id.set(p2Id);
    this._rules.set(rules);
    this._initialServer.set(initialServerId);
    this._pointsLog.set([...existingLog]);
    this._undoStack.set([]);
    this._redoStack.set([]);
    this._status.set(existingLog.length > 0 ? 'in_progress' : 'setup');
  }

  /** Reset all state (e.g. when navigating away from a match). */
  resetMatch(): void {
    this._matchId.set('');
    this._p1Id.set('');
    this._p2Id.set('');
    this._rules.set(null);
    this._initialServer.set('');
    this._pointsLog.set([]);
    this._undoStack.set([]);
    this._redoStack.set([]);
    this._status.set('setup');
  }

  // ── Point recording ───────────────────────────────────────────────────────

  /**
   * Records a point and updates all derived signals atomically.
   * Pushes the previous log state to the undo stack before mutating.
   */
  recordPoint(input: RecordPointInput): void {
    const snap  = this.snapshot();
    const rules = this._rules();

    if (!rules || snap.isMatchComplete) return;

    // Compute position
    const setNumber   = snap.currentSetIdx + 1;
    const gameNumber  = snap.currentGameIdx + 1;
    const pointNumber = snap.currentPointIdx + 1;

    // Compute momentum delta
    const momentumIndex = computeMomentumDelta(input, this.currentServer());

    const entry: PointLogEntry = {
      ...input,
      set_number:     setNumber,
      game_number:    gameNumber,
      point_number:   pointNumber,
      momentum_index: momentumIndex
    };

    // Save undo snapshot, clear redo
    const currentLog = this._pointsLog();
    this._undoStack.update(s => [...s, currentLog]);
    this._redoStack.set([]);

    // Append point
    this._pointsLog.update(log => [...log, entry]);

    // Transition status
    if (this._status() === 'setup') this._status.set('in_progress');

    // Check for match completion and update status
    if (this.isMatchComplete()) {
      this._status.set('complete');
    }
  }

  // ── Undo / Redo ───────────────────────────────────────────────────────────

  undo(): void {
    const stack = this._undoStack();
    if (stack.length === 0) return;

    const prev = stack[stack.length - 1];
    this._redoStack.update(s => [...s, this._pointsLog()]);
    this._undoStack.update(s => s.slice(0, -1));
    this._pointsLog.set(prev);

    // Revert status if we undid back to an empty log
    if (this._pointsLog().length === 0) {
      this._status.set('setup');
    } else if (this._status() === 'complete') {
      this._status.set('in_progress');
    }
  }

  redo(): void {
    const stack = this._redoStack();
    if (stack.length === 0) return;

    const next = stack[stack.length - 1];
    this._undoStack.update(s => [...s, this._pointsLog()]);
    this._redoStack.update(s => s.slice(0, -1));
    this._pointsLog.set(next);

    if (this.isMatchComplete()) this._status.set('complete');
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private emptySnapshot(): MatchSnapshot {
    return {
      setScores:        [{ p1: 0, p2: 0, winner: null }],
      currentGamePts:   { p1: 0, p2: 0 },
      isTiebreakGame:   false,
      isSuperTiebreak:  false,
      isMatchComplete:  false,
      matchWinner:      null,
      setsWon:          { p1: 0, p2: 0 },
      currentSetIdx:    0,
      currentGameIdx:   0,
      currentPointIdx:  0
    };
  }
}
