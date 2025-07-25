// admin.supports.tsx

import { Plus } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { FaPencilAlt, FaTimes } from 'react-icons/fa'
import {
  Link,
  type LoaderFunctionArgs,
  Outlet,
  redirect,
  useLoaderData,
  useNavigation,
} from 'react-router'
import { Image } from '~/components/molecules/Image'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { Button } from '~/components/ui/button'
import { db } from '~/db.server'
import { useArrowToggle } from '~/hooks/useArrowToggle'
import { selectMany } from '~/utils/queryHelpers'
import { getAdminUser } from '~/utils/session.server'

interface Support {
  id: number
  name: string
  url: string | null
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${encodeURIComponent(String(error))}`)
  }

  const user = await getAdminUser(request)
  const supports = await selectMany<Support>(
    db,
    'SELECT id, name, url FROM supports WHERE company_id = ?',
    [user.company_id],
  )

  return { supports }
}

export default function AdminSupports() {
  const { supports } = useLoaderData<typeof loader>()
  const navigation = useNavigation()
  const [isAddingSupport, setIsAddingSupport] = useState(false)

  useEffect(() => {
    if (navigation.state === 'idle') {
      if (isAddingSupport) setIsAddingSupport(false)
    }
  }, [navigation.state])

  const handleAddSupportClick = () => {
    setIsAddingSupport(true)
  }

  const { currentId, setCurrentId } = useArrowToggle((value: number | undefined) =>
    value ? [value] : [],
  )

  return (
    <>
      <Link to={`add`} className='mb-6 inline-block' onClick={handleAddSupportClick}>
        <LoadingButton loading={isAddingSupport}>
          <Plus className='w-4 h-4 mr-1' />
          Add Support
        </LoadingButton>
      </Link>
      <div>
        <div className='grid grid-cols-2 sm:grid-cols-2 md:grid-cols-5 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3'>
          {supports
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(support => (
              <div key={support.id} className='relative group'>
                <Image
                  id={support.id}
                  src={support.url}
                  alt={support.name}
                  className='w-full h-48 object-cover rounded'
                  isOpen={currentId === support.id}
                  setImage={setCurrentId}
                />

                <div className='absolute inset-0 flex justify-between items-start p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300'>
                  <Link
                    to={`edit/${support.id}`}
                    className='text-white bg-gray-800 bg-opacity-60 rounded-full p-2 hover:bg-opacity-80 transition'
                    title='Edit Support'
                    aria-label={`Edit ${support.name}`}
                  >
                    <FaPencilAlt />
                  </Link>

                  <Link
                    to={`delete/${support.id}`}
                    className='text-white bg-gray-800 bg-opacity-60 rounded-full p-2 hover:bg-opacity-80 transition'
                    title='Delete Support'
                    aria-label={`Delete ${support.name}`}
                  >
                    <FaTimes />
                  </Link>
                </div>

                <div className='mt-2 text-center'>
                  <h3 className='text-lg font-semibold'>{support.name}</h3>
                </div>
              </div>
            ))}
        </div>

        <Outlet />
      </div>
    </>
  )
}
