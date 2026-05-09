import { useEffect, useState } from 'react'
import { type LoaderFunctionArgs, redirect, useLoaderData } from 'react-router'
import ModuleList from '~/components/ModuleList'
import { ImageCard } from '~/components/organisms/ImageCard'
import { SuperCarousel } from '~/components/organisms/SuperCarousel'
import { Accordion, AccordionContent, AccordionItem } from '~/components/ui/accordion'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'

interface ItemImage {
  id: number
  name: string
  url: string | null
}

function itemToCarouselInput(row: ItemImage) {
  return {
    id: row.id,
    url: row.url,
    name: row.name,
    type: 'images',
    available: null,
    retail_price: null,
    cost_per_sqft: 0,
  }
}

function InteractiveImageCard({
  image,
  setCurrentId,
}: {
  image: ItemImage
  setCurrentId: (value: number) => void
}) {
  return (
    <div
      className='relative group w-full module-item overflow-hidden'
      onAuxClick={e => {
        if (e.button === 1 && image.url) {
          e.preventDefault()
          window.open(image.url, '_blank')
        }
      }}
    >
      <ImageCard disabled={true} title={image.name}>
        {image.url ? (
          <img
            src={image.url}
            alt={image.name || 'Image'}
            className='object-cover w-full h-40 border-2 border-gray-300 rounded cursor-pointer transition duration-200 ease-in-out transform hover:scale-[105%] hover:shadow-lg select-none'
            loading='lazy'
            onClick={() => setCurrentId(image.id)}
          />
        ) : (
          <div
            className='w-full h-40 border-2 border-gray-300 rounded cursor-pointer bg-gray-200'
            onClick={() => setCurrentId(image.id)}
            role='button'
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && setCurrentId(image.id)}
          />
        )}
      </ImageCard>
    </div>
  )
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  const user = await getEmployeeUser(request)
  const images = await selectMany<ItemImage>(
    db,
    'SELECT id, name, url FROM images WHERE company_id = ?',
    [user.company_id],
  )
  return { images }
}

export default function Images() {
  const { images } = useLoaderData<typeof loader>()
  const [currentId, setCurrentId] = useState<number | undefined>(undefined)
  const [sortedImages, setSortedImages] = useState<ItemImage[]>(images)

  useEffect(() => {
    setSortedImages([...images].sort((a, b) => a.name.localeCompare(b.name)))
  }, [images])

  const carouselImages = sortedImages.map(itemToCarouselInput)

  return (
    <Accordion type='single' defaultValue='images' className=''>
      <AccordionItem value='images'>
        <AccordionContent>
          <Accordion type='multiple'>
            <AccordionContent>
              <ModuleList>
                <div className='w-full col-span-full'>
                  <SuperCarousel
                    type='images'
                    currentId={currentId}
                    setCurrentId={setCurrentId}
                    images={carouselImages}
                  />
                </div>
                {sortedImages.map(image => (
                  <InteractiveImageCard
                    key={image.id}
                    image={image}
                    setCurrentId={setCurrentId}
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
