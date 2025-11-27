import { data, type LoaderFunctionArgs } from "react-router"
import z from "zod"
import { db } from "~/db.server"
import { selectId } from "~/utils/queryHelpers"


const companyIdSchema = z.coerce.number().min(1)

export async function loader({ params }: LoaderFunctionArgs) {
    const parsed = companyIdSchema.parse(params.companyId)
    const companyLogo = await selectId<{ logo_url: string }>(db, 'SELECT logo_url FROM company WHERE id = ?', parsed)
    return data({ companyLogo: companyLogo?.logo_url })
  }