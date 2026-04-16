import { PointLogEntry } from './point-log.model';
import { ScoringRules } from './scoring-rules.model';

export type MatchStatus = 'setup' | 'in_progress' | 'complete' | 'abandoned';

export interface MatchWeather {
  condition: string;
  temp_c: number;
  wind_kph: number;
}

export interface Match {
  id: string;
  date: string;
  time?: string;
  location_city?: string;
  scoring_rules: ScoringRules;
  player1_id: string;
  player2_id: string;
  points_log: PointLogEntry[];
  status: MatchStatus;
  weather?: MatchWeather;
  creator_id?: string;
  _modified: string;
  _deleted: boolean;
}
