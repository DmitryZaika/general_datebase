import type { RowDataPacket } from 'mysql2'
import { useEffect, useRef } from 'react'
import {
  type ActionFunctionArgs,
  Form,
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useLocation,
  useNavigate,
  useNavigation,
} from 'react-router'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { db } from '~/db.server'
import { commitSession, getSession } from '~/sessions'
import { csrf } from '~/utils/csrf.server'
import { selectId, selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'
import { forceRedirectError, toastData } from '~/utils/toastHelpers'

interface SlabDetails {
  id: number
  stone_id: number
  bundle: string
  stone_name: string
  cut_date: string | null
  notes: string | null
  square_feet: number | null
  length: number | null
  width: number | null
  sale_id: number | null
}

interface SlabDetailsWithUrl {
  id: number
  stone_id: number
  bundle: string
  sale_id: number | null
  notes: string | null
  url: string | null
  cut_date: string | null
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  const saleId = params.saleId
  const slabId = params.slab

  if (!slabId || !saleId) {
    return forceRedirectError(request.headers, 'Missing required parameters')
  }

  const slabIdNum = parseInt(slabId, 10)
  const saleIdNum = parseInt(saleId, 10)

  if (isNaN(slabIdNum) || isNaN(saleIdNum)) {
    return forceRedirectError(request.headers, 'Invalid ID format')
  }

  const slabs = await selectMany<SlabDetails>(
    db,
    `SELECT 
      slab_inventory.id, slab_inventory.stone_id, slab_inventory.bundle, 
      stones.name as stone_name, slab_inventory.cut_date, 
      slab_inventory.notes, slab_inventory.square_feet,
      slab_inventory.length, slab_inventory.width, slab_inventory.sale_id
     FROM slab_inventory
     JOIN stones ON slab_inventory.stone_id = stones.id
     WHERE slab_inventory.id = ?`,
    [slabIdNum],
  )

  if (slabs.length === 0) {
    return forceRedirectError(request.headers, 'Slab not found')
  }

  const actualStoneId = slabs[0].stone_id

  return {
    slab: slabs[0],
    stoneId: String(actualStoneId),
    saleId: saleIdNum,
    slabId: slabIdNum,
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  const stoneId = params.stone
  const saleId = params.saleId
  const slabId = params.slab

  if (!stoneId || !saleId || !slabId) {
    return forceRedirectError(request.headers, 'Missing required parameters')
  }

  const url = new URL(request.url)
  const searchParams = url.searchParams.toString()
  const searchString = searchParams ? `?${searchParams}` : ''

  const slabIdNum = parseInt(slabId, 10)
  const saleIdNum = parseInt(saleId, 10)

  if (Number.isNaN(slabIdNum) || Number.isNaN(saleIdNum)) {
    return forceRedirectError(request.headers, 'Invalid ID format')
  }

  try {
    await csrf.validate(request)
  } catch {
    return { error: 'Invalid CSRF token' }
  }

  const formData = await request.formData()
  const length = parseFloat(formData.get('length') as string)
  const width = parseFloat(formData.get('width') as string)
  const addAnother = formData.get('addAnother') === 'true'
  const noLeftovers = formData.get('noLeftovers') === 'true'

  // Set noLeftovers to true if dimensions are missing or invalid
  const hasValidDimensions =
    !Number.isNaN(length) && !Number.isNaN(width) && length > 0 && width > 0
  const effectiveNoLeftovers = !hasValidDimensions || noLeftovers

  try {
    const slabResult = await selectId<SlabDetailsWithUrl>(
      db,
      `SELECT id, stone_id, bundle, sale_id, notes, url, cut_date FROM slab_inventory WHERE id = ?`,
      slabIdNum,
    )

    if (!slabResult) {
      throw new Error('Slab not found')
    }

    const originalSlab = slabResult
    const actualStoneId = originalSlab.stone_id

    if (originalSlab.cut_date === null) {
      await db.execute(
        `UPDATE slab_inventory SET cut_date = CURRENT_TIMESTAMP WHERE id = ?`,
        [slabIdNum],
      )
    }

    let insertId = null
    if (!effectiveNoLeftovers) {
      const [insertResult] = await db.execute<RowDataPacket[] & { insertId: number }>(
        `INSERT INTO slab_inventory 
        (stone_id, bundle, length, width, parent_id, sale_id, url) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          actualStoneId,
          originalSlab.bundle,
          length,
          width,
          slabIdNum,
          null,
          originalSlab.url,
        ],
      )

      insertId = insertResult.insertId

      if (!addAnother) {
        await db.execute(
          `UPDATE slab_inventory 
           SET sale_id = NULL, notes = NULL 
           WHERE parent_id = ? AND id != ? AND sale_id IS NULL`,
          [slabIdNum, insertId],
        )
      }
    }

    const [remainingSlabsResult] = await db.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM slab_inventory 
       WHERE sale_id = ? AND cut_date IS NULL`,
      [saleIdNum],
    )

    const remainingSlabsCount = remainingSlabsResult[0].count

    const cutType = remainingSlabsCount > 0 ? 'partially cut' : 'cut'
    await db.execute(`UPDATE sales SET status = ? WHERE id = ?`, [cutType, saleIdNum])

    const session = await getSession(request.headers.get('Cookie'))
    session.flash(
      'message',
      toastData(
        'Success',
        effectiveNoLeftovers
          ? 'Slab marked as cut with no leftovers'
          : 'Slab cut successfully',
      ),
    )

    if (remainingSlabsCount === 0) {
      return redirect(`/employee/stones${searchString}`, {
        headers: { 'Set-Cookie': await commitSession(session) },
      })
    }

    if (addAnother && !effectiveNoLeftovers) {
      return redirect(
        `/employee/stones/slabs/${stoneId}/edit/${saleIdNum}/cut/${slabIdNum}${searchString}`,
        {
          headers: { 'Set-Cookie': await commitSession(session) },
        },
      )
    }

    return redirect(
      `/employee/stones/slabs/${actualStoneId}/edit/${saleIdNum}${searchString}`,
      {
        headers: { 'Set-Cookie': await commitSession(session) },
      },
    )
  } catch {
    const session = await getSession(request.headers.get('Cookie'))
    session.flash('message', toastData('Error', 'Failed to cut slab'))

    const [slabRecord] = await db.execute<RowDataPacket[]>(
      `SELECT stone_id FROM slab_inventory WHERE id = ?`,
      [slabIdNum],
    )

    let actualStoneIdForError = stoneId
    if (slabRecord && slabRecord.length > 0) {
      actualStoneIdForError = String(slabRecord[0].stone_id)
    }

    return redirect(
      `/employee/stones/slabs/${actualStoneIdForError}/edit/${saleIdNum}/cut/${slabIdNum}${searchString}`,
      {
        headers: { 'Set-Cookie': await commitSession(session) },
      },
    )
  }
}

export default function CutSlab() {
  const { slab, stoneId, saleId } = useLoaderData<typeof loader>()
  const navigate = useNavigate()
  const isSubmitting = useNavigation().state !== 'idle'
  const formRef = useRef<HTMLFormElement>(null)
  const location = useLocation()

  // Auto-submit form when component mounts
  useEffect(() => {
    if (formRef.current && !isSubmitting) {
      // Use a simple form submit approach
      try {
        const form = formRef.current
        // We need to ensure the hidden fields are set before submitting
        const noLeftoversInput = form.querySelector(
          'input[name="noLeftovers"]',
        ) as HTMLInputElement
        const addAnotherInput = form.querySelector(
          'input[name="addAnother"]',
        ) as HTMLInputElement

        if (noLeftoversInput) noLeftoversInput.value = 'true'
        if (addAnotherInput) addAnotherInput.value = 'false'

        // Directly submit the form
        form.submit()
      } catch (error) {
        console.error('Error auto-submitting form:', error)
        // Fallback: redirect back to the edit page
        navigate(`/employee/stones/slabs/${stoneId}/edit/${saleId}${location.search}`)
      }
    }
  }, [stoneId, saleId, location.search, navigate, isSubmitting])

  const handleDialogClose = () => {
    navigate(`/employee/stones/slabs/${stoneId}/edit/${saleId}${location.search}`)
  }

  const isAlreadyCut = slab?.cut_date !== null

  return (
    <>
      <Dialog
        open={false}
        onOpenChange={open => {
          if (!open) handleDialogClose()
        }}
      >
        <DialogContent className='bg-white rounded-lg pt-4 px-4 shadow-lg text-gray-800 max-w-md'>
          <DialogHeader className='mb-3 pb-2 border-b border-gray-200'>
            <DialogTitle className='text-xl font-semibold text-gray-900'>
              Cut Slab: {slab.stone_name} - {slab.bundle}
            </DialogTitle>
            {isAlreadyCut && (
              <div className='text-amber-600 text-sm mt-1'>
                This slab has already been cut. Adding more pieces.
              </div>
            )}
          </DialogHeader>

          <Form method='post' ref={formRef}>
            <AuthenticityTokenInput />

            {/* Hidden inputs for auto cut */}
            <input type='hidden' name='noLeftovers' value='true' />
            <input type='hidden' name='addAnother' value='false' />

            <DialogFooter className='pt-3 border-t border-gray-200 space-x-2'>
              <Button
                type='button'
                variant='outline'
                onClick={handleDialogClose}
                disabled={isSubmitting}
                className='text-sm font-medium'
              >
                Cancel
              </Button>

              <LoadingButton
                loading={isSubmitting}
                type='submit'
                name='addAnother'
                value='false'
              >
                Save
              </LoadingButton>
            </DialogFooter>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  )
}
