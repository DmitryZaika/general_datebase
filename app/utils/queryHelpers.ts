import type { RowDataPacket } from 'mysql2'
import type mysql from 'mysql2/promise'

export async function selectMany<T>(
  db: mysql.Pool,
  query: string,
  params: (string | number)[] = [],
): Promise<T[]> {
  try {
    const [rows] = await db.query<T[] & RowDataPacket[]>(query, params)
    return rows
  } catch (error) {
    console.error('Error connecting to the database: ', error)
    return []
  }
}

export async function selectId<T>(
  db: mysql.Pool,
  query: string,
  id: number,
): Promise<T | undefined> {
  try {
    const [rows] = await db.query<T[] & RowDataPacket[]>(query, [id])
    if (rows.length < 1) {
      return undefined
    }
    return rows[0]
  } catch (error) {
    console.error('Error connecting to the database: ', error)
    return undefined
  }
}
