import { useState } from 'react'
import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
} from 'react-router'
import { Dialog, DialogClose, DialogContent, DialogTitle } from '~/components/ui/dialog'
import { db } from '~/db.server'
import { commitSession, getSession } from '~/sessions'
import { selectId, selectMany } from '~/utils/queryHelpers'
import { forceRedirectError, toastData } from '~/utils/toastHelpers'

interface Slab {
  id: number
  bundle: string
  url: string | null
  is_sold: boolean | number
  width: number
  length: number
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  if (!params.stone) {
    return forceRedirectError(request.headers, 'No stone id provided')
  }
  const stoneId = parseInt(params.stone, 10)
  const stone = await selectId<{ id: number; name: string; url: string }>(
    db,
    'SELECT id, name, url FROM stones WHERE id = ?',
    stoneId,
  )
  if (!stone) {
    return forceRedirectError(request.headers, 'No stone found for given ID')
  }
  const slabs = await selectMany<Slab>(
    db,
    'SELECT id, bundle, url, width, length FROM slab_inventory WHERE stone_id = ? AND cut_date IS NULL AND sale_id IS NULL',
    [stoneId],
  )
  return { slabs, stone }
}

export async function action({ request, params }: ActionFunctionArgs) {
  if (!params.stone) {
    return forceRedirectError(request.headers, 'No stone id provided')
  }
  const formData = await request.formData()
  const slabId = formData.get('slabId')
  if (!slabId) {
    return forceRedirectError(request.headers, 'No slabId provided')
  }
  const slab = await selectId<{ is_sold: number }>(
    db,
    'SELECT is_sold FROM slab_inventory WHERE id = ?',
    parseInt(slabId.toString(), 10),
  )
  if (!slab) {
    return forceRedirectError(request.headers, 'No slab found for given ID')
  }
  const newValue = slab.is_sold === 1 ? 0 : 1
  await db.execute('UPDATE slab_inventory SET is_sold = ? WHERE id = ?', [
    newValue,
    slabId,
  ])
  const session = await getSession(request.headers.get('Cookie'))
  session.flash('message', toastData('Success', `Slab ${newValue ? 'Sold' : 'Unsold'}`))
  return redirect(request.url, {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

export default function SlabsModal() {
  const { slabs, stone } = useLoaderData<typeof loader>()
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open) history.back()
      }}
    >
      <DialogContent className='p-5 bg-white rounded-md shadow-lg text-gray-800  overflow-y-auto max-h-[95vh]'>
        <DialogTitle>Slabs for {stone.name}</DialogTitle>

        <div className='flex flex-col gap-4'>
          {slabs.length === 0 ? (
            <p className='text-center text-gray-500'>No Slabs available</p>
          ) : (
            slabs.map(slab => {
              const isSold = !!slab.is_sold
              return (
                <div
                  key={slab.id}
                  className={`transition-colors duration-300 flex items-center gap-4 p-3 rounded-lg border border-gray-200 ${
                    isSold ? 'bg-red-200' : 'bg-white'
                  }`}
                >
                  <img
                    src={
                      slab.url === 'undefined' || slab.url === null
                        ? stone.url
                        : slab.url
                    }
                    alt='Slab'
                    className='w-15 h-15 object-cover cursor-pointer rounded'
                    onClick={() => {
                      if (slab.url) {
                        setSelectedImage(slab.url)
                      }
                    }}
                  />
                  <div className='flex flex-col'>
                    <span
                      className={`font-semibold ${
                        isSold ? 'text-red-900' : 'text-gray-800'
                      }`}
                    >
                      {slab.bundle}
                    </span>
                    <span className='text-gray-500'>
                      {slab.length} x {slab.width}
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <Dialog
          open={!!selectedImage}
          onOpenChange={open => {
            if (!open) {
              setSelectedImage(null)
            }
          }}
        >
          <DialogContent className='max-w-4xl w-full h-auto flex items-center justify-center bg-black bg-opacity-90 p-1'>
            <DialogClose className='absolute top-4 right-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none'>
              <span className='sr-only'>Close</span>
            </DialogClose>

            {selectedImage && (
              <img
                src={selectedImage === 'undefined' ? stone.url : selectedImage}
                alt='Full size'
                className='max-w-full max-h-[80vh] object-contain'
                onClick={e => e.stopPropagation()}
              />
            )}
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  )
}
