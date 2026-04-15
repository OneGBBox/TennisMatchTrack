// Migration strategies are keyed by the OLD schema version number.
// When upgrading from version 0 to version 1, add a key "0" here.
// Example:
// export const playerMigrationStrategies = {
//   1: (oldDoc: any) => { oldDoc.newField = 'defaultValue'; return oldDoc; }
// };

export const playerMigrationStrategies: Record<number, (doc: any) => any> = {};
