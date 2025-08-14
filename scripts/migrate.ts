import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { Sequelize } from 'sequelize'
import { SequelizeStorage, Umzug } from 'umzug'

const __dirname = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '')

const umzug = (sequelize: Sequelize) =>
  new Umzug({
    migrations: {
      glob: ['migrations/*.sql', { cwd: __dirname }],
      resolve: ({ name, path, context: queryInterface }) => {
        const down = () => {
          throw new Error('Down migrations are not supported')
        }
        const up = async () => {
          if (!path) {
            throw new Error('Migration file path is required')
          }
          const sql = fs.readFileSync(path, 'utf8')
          const queries = sql.split(';').filter(q => q.trim())
          for (const query of queries) {
            await queryInterface.sequelize.query(query)
          }
        }
        return { name, up, down }
      },
    },
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize }),
    logger: console,
    create: {
      folder: 'migrations',
      template: filepath => [[filepath, '']],
    },
  })

const runMigrations = async (sequelize: Sequelize) => {
  try {
    await sequelize.authenticate()
    // biome-ignore lint/suspicious/noConsole: for tests
    console.log('Подключение к базе данных успешно.')
    await umzug(sequelize).up()
    // biome-ignore lint/suspicious/noConsole: for tests
    console.log('Миграции успешно выполнены.')
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: for tests
    console.error('Ошибка выполнения миграций:', error)
  } finally {
    await sequelize.close()
  }
}

export const testMigrations = async (
  database: string,
  user: string,
  password: string,
  host: string,
) => {
  const sequelize = new Sequelize(database, user, password, {
    host,
    dialect: 'mysql',
  })
  await runMigrations(sequelize)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  dotenv.config()
  const { DB_DATABASE, DB_USER, DB_PASSWORD, DB_HOST } = process.env

  if (!DB_DATABASE || !DB_USER || !DB_PASSWORD || !DB_HOST) {
    throw new Error('Не указаны все переменные окружения для подключения к базе данных')
  }
  const sequelize = new Sequelize(DB_DATABASE, DB_USER, DB_PASSWORD, {
    host: DB_HOST,
    dialect: 'mysql',
  })

  runMigrations(sequelize)
}
