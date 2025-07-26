import { type LoaderFunctionArgs, redirect, useLoaderData } from 'react-router'
import ModuleList from '~/components/ModuleList'
import { Image } from '~/components/molecules/Image'
import { Accordion, AccordionContent, AccordionItem } from '~/components/ui/accordion'
import { db } from '~/db.server'
import { useArrowToggle } from '~/hooks/useArrowToggle'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser, type User } from '~/utils/session.server'

interface Support {
  id: number
  name: string
  url: string | null
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  let user: User
  try {
    user = await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  const supports = await selectMany<Support>(
    db,
    'select id, name, url from supports WHERE company_id = ?',
    [user.company_id],
  )
  return { supports }
}

export default function Supports() {
  const { supports } = useLoaderData<typeof loader>()
  const ids = supports.map(item => item.id)
  const { currentId, setCurrentId } = useArrowToggle(ids)
  return (
    <Accordion type='single' defaultValue='supports'>
      <AccordionItem value='supports'>
        <AccordionContent>
          <Accordion type='multiple'>
            <AccordionContent>
              <ModuleList>
                {supports.map(support => (
                  <Image
                    id={support.id}
                    key={support.id}
                    src={support.url}
                    alt={support.name}
                    name={support.name}
                    setImage={setCurrentId}
                    isOpen={currentId === support.id}
                  />
                ))}
              </ModuleList>
            </AccordionContent>
          </Accordion>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
