import 'dotenv/config';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const db = require('../db/models');

export async function resetDatabase() {
  await db.sequelize.sync({ force: true });
}

export async function closeDatabase() {
  await db.sequelize.close();
}
