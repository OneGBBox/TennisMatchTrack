export type ShotResult   = 'Winner' | 'UE' | 'FE';
export type ShotSide     = 'FH' | 'BH' | 'Serve';
export type ShotCategory =
  | 'Regular' | 'Return' | 'Inside-In' | 'Inside-Out'
  | 'Passing'  | 'Approach' | 'Slice' | 'Volley'
  | 'Drop Shot' | 'Lob' | 'Overhead' | 'Ace' | 'Double Fault';
export type ShotLocation = 'CC' | 'ML' | 'DTL' | 'T' | 'Wide' | 'Body' | 'Net';

// Legacy alias kept for backward compat with scoring service
export type ShotType = ShotResult;

export interface PointLogEntry {
  server_id:     string;
  winner_id:     string;
  shot_type:     ShotResult;      // Winner | UE | FE
  side:          ShotSide;        // FH | BH | Serve
  shot_category: ShotCategory;    // Regular, Slice, Volley, Ace…
  location:      ShotLocation;    // CC, DTL, ML…
  serve_number:  1 | 2;          // 1st or 2nd serve
  rally_length:  number;          // shot count in rally (1 = serve winner/ace)
  momentum_index: number;
  set_number:    number;
  game_number:   number;
  point_number:  number;
}
