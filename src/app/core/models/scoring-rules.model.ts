export type MatchFormat =
  | 'best_of_1'
  | 'best_of_3'
  | 'best_of_5'
  | 'pro_set'
  | 'fast4'
  | 'super_tiebreak';

export interface ScoringRules {
  format: MatchFormat;
  no_ad: boolean;
  final_set_tiebreak: boolean;
  super_tiebreak_points: number;
  /** Simple mode: tap to score one point without the detail modal. */
  simple_scoring?: boolean;
}
