export type ShotType = 'Winner' | 'UE' | 'FE';
export type ShotSide = 'FH' | 'BH' | 'Serve' | 'Volley' | 'OH';
export type ShotLocation = 'T' | 'Wide' | 'Body' | 'Net' | 'BL' | 'BR' | 'DTL' | 'CC' | 'ML' | 'MR';

export interface PointLogEntry {
  server_id: string;
  winner_id: string;
  shot_type: ShotType;
  side: ShotSide;
  location: ShotLocation;
  momentum_index: number;
  set_number: number;
  game_number: number;
  point_number: number;
}
