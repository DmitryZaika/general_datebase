import { motion } from 'framer-motion'
import {
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useLocation,
} from 'react-router'
import ModuleList from '~/components/ModuleList'
import { Image } from '~/components/molecules/Image'
import { Accordion, AccordionContent, AccordionItem } from '~/components/ui/accordion'
import { db } from '~/db.server'
import { useArrowToggle } from '~/hooks/useArrowToggle'
import {
  EMPLOYEE_VIEW_ENTER_EASE,
  employeeViewMotionKey,
} from '~/utils/employeeViewEnterMotion'
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

const SUPPORTS_SLIDE_UP = {
  initial: { opacity: 0, y: 40 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.42, ease: EMPLOYEE_VIEW_ENTER_EASE },
}

export default function Supports() {
  const { supports } = useLoaderData<typeof loader>()
  const location = useLocation()
  const ids = supports.map(item => item.id)
  const { currentId, setCurrentId } = useArrowToggle(ids)
  return (
    <motion.div
      key={employeeViewMotionKey(location.pathname, location.search)}
      className='w-full min-h-0'
      {...SUPPORTS_SLIDE_UP}
    >
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
    </motion.div>
  )
}
