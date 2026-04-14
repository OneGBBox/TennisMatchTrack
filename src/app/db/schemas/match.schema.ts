import { RxJsonSchema } from 'rxdb';
import { Match } from '../../core/models/match.model';

export const MATCH_SCHEMA_VERSION = 1;

export const matchSchema: RxJsonSchema<Match> = {
  version: MATCH_SCHEMA_VERSION,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 36
    },
    date: {
      type: 'string',
      format: 'date',
      maxLength: 10
    },
    time: {
      type: 'string',
      maxLength: 8
    },
    location_city: {
      type: 'string',
      maxLength: 100
    },
    scoring_rules: {
      type: 'object',
      properties: {
        format: {
          type: 'string',
          enum: ['best_of_1', 'best_of_3', 'best_of_5', 'pro_set', 'fast4', 'super_tiebreak']
        },
        no_ad: { type: 'boolean' },
        final_set_tiebreak: { type: 'boolean' },
        super_tiebreak_points: { type: 'number' }
      },
      required: ['format']
    },
    player1_id: {
      type: 'string',
      maxLength: 36
    },
    player2_id: {
      type: 'string',
      maxLength: 36
    },
    points_log: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          server_id:      { type: 'string' },
          winner_id:      { type: 'string' },
          shot_type:      { type: 'string', enum: ['Winner', 'UE', 'FE'] },
          side:           { type: 'string', enum: ['FH', 'BH', 'Serve'] },
          shot_category:  { type: 'string', enum: ['Regular','Return','Inside-In','Inside-Out','Passing','Approach','Slice','Volley','Drop Shot','Lob','Overhead','Ace','Double Fault'] },
          location:       { type: 'string', enum: ['CC', 'ML', 'DTL', 'T', 'Wide', 'Body', 'Net'] },
          serve_number:   { type: 'integer', enum: [1, 2] },
          rally_length:   { type: 'integer', minimum: 1 },
          momentum_index: { type: 'number' },
          set_number:     { type: 'integer' },
          game_number:    { type: 'integer' },
          point_number:   { type: 'integer' }
        },
        required: ['server_id', 'winner_id', 'shot_type', 'side', 'shot_category', 'location', 'serve_number', 'rally_length', 'set_number', 'game_number', 'point_number']
      },
      default: []
    },
    status: {
      type: 'string',
      enum: ['setup', 'in_progress', 'complete', 'abandoned'],
      default: 'setup'
    },
    weather: {
      type: 'object',
      properties: {
        condition: { type: 'string' },
        temp_c:    { type: 'number' },
        wind_kph:  { type: 'number' }
      }
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
  required: ['id', 'date', 'player1_id', 'player2_id', 'scoring_rules', 'status', '_modified', '_deleted'],
  // creator_id intentionally excluded from indexes — it is optional (not in required)
  // and Dexie throws DXE1 when indexing optional fields without a default value.
  indexes: ['_modified', 'date', 'status']
};
