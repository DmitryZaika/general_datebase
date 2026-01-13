import type { LoaderFunctionArgs } from 'react-router'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'

export async function loader({ params }: LoaderFunctionArgs) {
  const rawId = params.emailId
  if (!rawId) {
    return new Response('Bad url', { status: 400 })
  }
  const emailId = Number(rawId)
  if (!Number.isFinite(emailId)) {
    return new Response('Invalid email id', { status: 400 })
  }

  const images = await selectMany<{ id: number; url: string }>(
    db,
    `SELECT id, url 
       FROM email_attachments 
      WHERE email_id = ? 
        AND LOWER(content_type) = 'image'`,
    [emailId],
  )

  return Response.json({ images })
}
