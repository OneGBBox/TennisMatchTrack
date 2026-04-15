import { RxJsonSchema } from 'rxdb';
import { Player } from '../../core/models/player.model';

export const PLAYER_SCHEMA_VERSION = 0;

export const playerSchema: RxJsonSchema<Player> = {
  version: PLAYER_SCHEMA_VERSION,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 36
    },
    name: {
      type: 'string',
      maxLength: 100
    },
    image_url: {
      type: 'string',
      maxLength: 500
    },
    ntrp_rating: {
      type: 'number',
      minimum: 0.0,
      maximum: 7.0
    },
    utr_rating: {
      type: 'number',
      minimum: 0.0,
      maximum: 16.5
    },
    hitting_arm: {
      type: 'string',
      enum: ['Left', 'Right']
    },
    backhand_type: {
      type: 'string',
      enum: ['One-hand', 'Two-hand']
    },
    creator_id: {
      type: 'string',
      maxLength: 36
    },
    _modified: {
      type: 'string',
      format: 'date-time',
      maxLength: 30
    },
    _deleted: {
      type: 'boolean',
      default: false
    }
  },
  required: ['id', 'name', '_modified', '_deleted'],
  indexes: ['_modified', 'name']
};
