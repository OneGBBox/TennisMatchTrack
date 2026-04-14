export type HittingArm = 'Left' | 'Right';
export type BackhandType = 'One-hand' | 'Two-hand';

export interface Player {
  id: string;
  name: string;
  image_url?: string;
  ntrp_rating?: number;
  utr_rating?: number;
  hitting_arm?: HittingArm;
  backhand_type?: BackhandType;
  creator_id?: string;
  _modified: string;
  _deleted: boolean;
}
