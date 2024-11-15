import { Sequelize } from 'sequelize';
import { Umzug, SequelizeStorage } from 'umzug';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { DB_DATABASE, DB_USER, DB_PASSWORD, DB_HOST } = process.env;
console.log({ DB_DATABASE, DB_USER, DB_PASSWORD, DB_HOST })
if (!DB_DATABASE || !DB_USER || !DB_PASSWORD || !DB_HOST) {
  throw new Error('Не указаны все переменные окружения для подключения к базе данных');
}
const sequelize = new Sequelize(DB_DATABASE, DB_USER, DB_PASSWORD, {
  host: DB_HOST,
  dialect: 'mysql',
});

const umzug = new Umzug({
  migrations: {
    glob: path.join(__dirname, 'migrations/*.sql'),
    params: [sequelize.getQueryInterface(), Sequelize],
    resolve: ({ name, path }) => ({
      name,
      up: async () => {
        try {
          const sql = fs.readFileSync(path, 'utf-8');
          console.log(`Выполнение миграции: ${name}`);
          console.log(`Содержимое SQL: \n${sql}`);
          await sequelize.query(sql);
        } catch (error) {
          console.error(`Ошибка выполнения SQL миграции ${name}:`, error);
          throw error;
        }
      },
      down: async () => {
        // Опционально: добавьте логику для отката миграции
        console.log(`Откат миграции: ${name}`);
      },
    }),
  },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize }),
  logger: console,
});

// Функция для выполнения миграций
const runMigrations = async () => {
  try {
    await sequelize.authenticate();
    console.log('Подключение к базе данных успешно.');

    await umzug.up(); // Запуск всех миграций
    console.log('Миграции успешно выполнены.');
  } catch (error) {
    console.error('Ошибка выполнения миграций:', error);
  } finally {
    await sequelize.close();
  }
};

// Запуск миграций
runMigrations();

