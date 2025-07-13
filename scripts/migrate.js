import dotenv from 'dotenv'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Sequelize } from 'sequelize'
import { SequelizeStorage, Umzug } from 'umzug'

const __dirname = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '')

const umzug = sequelize =>
  new Umzug({
    migrations: {
      glob: ['migrations/*.sql', { cwd: __dirname }],
      resolve: ({ name, path, context: queryInterface }) => {
        const down = () => {
          throw new Error('Down migrations are not supported')
        }
        const up = async () => {
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
    sorter: migrations => {
      const collator = new Intl.Collator(undefined, {
        numeric: true,
        sensitivity: 'base',
      })
      return migrations.sort((a, b) => collator.compare(a.name, b.name))
    },
  })

const runMigrations = async sequelize => {
  try {
    await sequelize.authenticate()
    console.log('Подключение к базе данных успешно.')
    await umzug(sequelize).up()
    console.log('Миграции успешно выполнены.')
  } catch (error) {
    console.error('Ошибка выполнения миграций:', error)
  } finally {
    await sequelize.close()
  }
}

export const testMigrations = async (database, user, password, host) => {
  const sequelize = new Sequelize(database, user, password, {
    host,
    dialect: 'mysql',
    multipleStatements: true,
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
    multipleStatements: true,
  })

  runMigrations(sequelize)
}
