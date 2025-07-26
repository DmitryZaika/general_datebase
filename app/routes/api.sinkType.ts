import { data, type LoaderFunctionArgs, redirect } from 'react-router'
import { db } from '~/db.server'
import type { Sink } from '~/types'
import { selectMany } from '~/utils/queryHelpers'
import type { User } from '~/utils/session.server'
import { getEmployeeUser } from '~/utils/session.server'

export async function loader({ request }: LoaderFunctionArgs) {
  let user: User
  try {
    user = await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  const sink_type = await selectMany<Sink>(
    db,
    `SELECT
          sink_type.id,
          sink_type.name,
          sink_type.retail_price,
          sink_type.type,
          COUNT(sinks.id) AS sink_count
        FROM
          sink_type 
          JOIN sinks
            ON sink_type.id = sinks.sink_type_id
        WHERE
          sink_type.company_id = ?
            AND sinks.is_deleted != 1
            AND sinks.slab_id IS NULL
        GROUP BY
          sink_type.id,
          sink_type.name,
          sink_type.retail_price,
          sink_type.type
        ORDER BY
          sink_type.name ASC;
        `,
    [user.company_id],
  )

  return data(sink_type)
}
