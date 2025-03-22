import { Sequelize } from "sequelize";
import { Umzug, SequelizeStorage } from "umzug";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import os from "os";

const __dirname = fileURLToPath(new URL("..", import.meta.url)).replace(
  /\/$/,
  "",
);

dotenv.config();
const { DB_DATABASE, DB_USER, DB_PASSWORD, DB_HOST } = process.env;

if (!DB_DATABASE || !DB_USER || !DB_PASSWORD || !DB_HOST) {
  throw new Error(
    "Не указаны все переменные окружения для подключения к базе данных",
  );
}
const sequelize = new Sequelize(DB_DATABASE, DB_USER, DB_PASSWORD, {
  host: DB_HOST,
  dialect: "mysql",
});

const umzug = new Umzug({
  migrations: {
    glob: ["migrations/*.sql", { cwd: __dirname }],
    params: [sequelize.getQueryInterface(), Sequelize],
    resolve: ({ name, path }) => ({
      name,
      up: async () => {
        try {
          const sql = fs.readFileSync(path, "utf-8");
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
    console.log("Подключение к базе данных успешно.");

    await umzug.up(); // Запуск всех миграций
    console.log("Миграции успешно выполнены.");
  } catch (error) {
    console.error("Ошибка выполнения миграций:", error);
  } finally {
    await sequelize.close();
  }
};

// Запуск миграций
runMigrations();
