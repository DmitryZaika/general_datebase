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

interface ItemImage {
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
  const images = await selectMany<ItemImage>(
    db,
    'SELECT id, name, url FROM images WHERE company_id = ?',
    [user.company_id],
  )
  return { images }
}

const IMAGES_SLIDE_UP = {
  initial: { opacity: 0, y: 40 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.42, ease: EMPLOYEE_VIEW_ENTER_EASE },
}

export default function Images() {
  const { images } = useLoaderData<typeof loader>()
  const location = useLocation()
  const ids = images.map(item => item.id)
  const { currentId, setCurrentId } = useArrowToggle(ids)
  return (
    <motion.div
      key={employeeViewMotionKey(location.pathname, location.search)}
      className='w-full min-h-0'
      {...IMAGES_SLIDE_UP}
    >
      <Accordion type='single' defaultValue='images'>
        <AccordionItem value='images'>
          <AccordionContent>
            <Accordion type='multiple'>
              <AccordionContent>
                <ModuleList>
                  {images.map(image => (
                    <Image
                      id={image.id}
                      key={image.id}
                      src={image.url}
                      alt={image.name}
                      name={image.name}
                      setImage={setCurrentId}
                      isOpen={currentId === image.id}
                      carouselLens
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
