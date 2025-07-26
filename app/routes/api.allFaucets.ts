import { data, type LoaderFunctionArgs, redirect } from 'react-router'
import { db } from '~/db.server'
import type { Faucet } from '~/types'
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

  const faucet_type = await selectMany<Faucet>(
    db,
    `SELECT
      faucet_type.id,
      faucet_type.name,
      faucet_type.retail_price,
      faucet_type.type,
      COUNT(faucets.id) AS faucet_count
    FROM
      faucet_type 
      JOIN faucets
        ON faucet_type.id = faucets.faucet_type_id
    WHERE
      faucet_type.company_id = ?
        AND faucets.is_deleted != 1
        AND faucets.slab_id IS NULL
    GROUP BY
      faucet_type.id,
      faucet_type.name,
      faucet_type.retail_price,
      faucet_type.type
    ORDER BY
      faucet_type.name ASC;
    `,
    [user.company_id],
  )

  return data(faucet_type)
}
