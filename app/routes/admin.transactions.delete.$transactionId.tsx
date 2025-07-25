import type { RowDataPacket } from 'mysql2'
import {
  type ActionFunctionArgs,
  Form,
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useNavigate,
} from 'react-router'
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
import { selectMany } from '~/utils/queryHelpers'
import { getAdminUser } from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers'

interface Transaction {
  id: number
  customer_name: string
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const user = await getAdminUser(request)
    if (!user || !user.company_id) {
      return redirect('/login')
    }

    if (!params.transactionId) {
      return redirect('/admin/transactions')
    }

    const transactionId = parseInt(params.transactionId, 10)

    if (isNaN(transactionId)) {
      return redirect('/admin/transactions')
    }

    const transaction = await selectMany<Transaction>(
      db,
      `SELECT s.id, c.name as customer_name
       FROM sales s
       JOIN customers c ON s.customer_id = c.id
       WHERE s.id = ? AND s.company_id = ?`,
      [transactionId, user.company_id],
    )

    if (transaction.length === 0) {
      return redirect('/admin/transactions')
    }

    return { transaction: transaction[0] }
  } catch (error) {
    console.error('Error loading transaction:', error)
    return redirect('/admin/transactions')
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const user = await getAdminUser(request)
    if (!user || !user.company_id) {
      return redirect('/login')
    }

    if (!params.transactionId) {
      return redirect('/admin/transactions')
    }

    const transactionId = parseInt(params.transactionId, 10)

    if (Number.isNaN(transactionId)) {
      return redirect('/admin/transactions')
    }

    // Find all slabs in this sale to process parent-child relationships
    const [slabsToUnsell] = await db.execute<RowDataPacket[]>(
      'SELECT id FROM slab_inventory WHERE sale_id = ?',
      [transactionId],
    )

    // Process all slabs that are being unsold
    if (slabsToUnsell && slabsToUnsell.length > 0) {
      for (const slabRow of slabsToUnsell) {
        const parentId = slabRow.id

        // Check if this slab has any sold child slabs
        const [soldChildSlabs] = await db.execute<RowDataPacket[]>(
          'SELECT id FROM slab_inventory WHERE parent_id = ? AND sale_id IS NOT NULL',
          [parentId],
        )

        if (soldChildSlabs && soldChildSlabs.length > 0) {
          // If parent and child are both sold, remove parent_id from children and delete parent
          await db.execute(
            'UPDATE slab_inventory SET parent_id = NULL WHERE parent_id = ?',
            [parentId],
          )

          // Delete the parent slab
          await db.execute('DELETE FROM slab_inventory WHERE id = ?', [parentId])
        } else {
          // Check for unsold child slabs
          const [unsoldChildSlabs] = await db.execute<RowDataPacket[]>(
            "SELECT id FROM slab_inventory WHERE parent_id = ? AND (sale_id IS NULL OR sale_id = 0 OR sale_id = '')",
            [parentId],
          )

          if (unsoldChildSlabs && unsoldChildSlabs.length > 0) {
            // Delete all unsold child slabs of this parent
            await db.execute(
              "DELETE FROM slab_inventory WHERE parent_id = ? AND (sale_id IS NULL OR sale_id = 0 OR sale_id = '')",
              [parentId],
            )
          }
        }
      }
    }

    // Delete all unsold slabs with the same bundle
    const [bundleInfo] = await db.execute<RowDataPacket[]>(
      'SELECT DISTINCT bundle, stone_id FROM slab_inventory WHERE sale_id = ?',
      [transactionId],
    )

    if (bundleInfo && bundleInfo.length > 0) {
      for (const info of bundleInfo) {
        const bundle = info.bundle
        const stoneId = info.stone_id

        // Delete all unsold slabs with the same bundle in the same stone
        await db.execute(
          `DELETE FROM slab_inventory 
           WHERE bundle = ? 
           AND (sale_id IS NULL OR sale_id = 0 OR sale_id = '') 
           AND stone_id = ?`,
          [bundle, stoneId],
        )
      }
    }

    // Unsell remaining slabs
    await db.execute(
      `UPDATE slab_inventory 
       SET sale_id = NULL, notes = NULL, price = NULL, square_feet = NULL 
       WHERE sale_id = ?`,
      [transactionId],
    )

    // Unsell all sinks and faucets from slabs in this sale
    const [slabIdsForItems] = await db.execute<RowDataPacket[]>(
      'SELECT id FROM slab_inventory WHERE sale_id = ?',
      [transactionId],
    )

    if (slabIdsForItems && slabIdsForItems.length > 0) {
      const slabIdList = slabIdsForItems.map(row => row.id)
      for (const slabId of slabIdList) {
        await db.execute(
          `UPDATE sinks 
           SET slab_id = NULL, price = NULL, is_deleted = 0 
           WHERE slab_id = ?`,
          [slabId],
        )
        await db.execute(
          `UPDATE faucets 
           SET slab_id = NULL, price = NULL, is_deleted = 0 
           WHERE slab_id = ?`,
          [slabId],
        )
      }
    }

    // Mark the sale as cancelled
    await db.execute(`UPDATE sales SET status = 'cancelled' WHERE id = ?`, [
      transactionId,
    ])

    const session = await getSession(request.headers.get('Cookie'))
    session.flash(
      'message',
      toastData('Success', 'Transaction cancelled and items processed successfully'),
    )

    return redirect('/admin/transactions', {
      headers: {
        'Set-Cookie': await commitSession(session),
      },
    })
  } catch (error) {
    console.error('Error deleting transaction:', error)
    const session = await getSession(request.headers.get('Cookie'))
    session.flash(
      'message',
      toastData('Error', 'Failed to delete transaction', 'destructive'),
    )

    return redirect('/admin/transactions', {
      headers: {
        'Set-Cookie': await commitSession(session),
      },
    })
  }
}

export default function DeleteTransaction() {
  const { transaction } = useLoaderData<typeof loader>()
  const navigate = useNavigate()

  const handleDialogChange = (open: boolean) => {
    if (!open) {
      navigate('/admin/transactions')
    }
  }

  return (
    <Dialog open={true} onOpenChange={handleDialogChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Delete Transaction</DialogTitle>
        </DialogHeader>

        <div className='py-4'>
          <p className='text-gray-700'>
            Are you sure you want to delete the transaction for{' '}
            <span className='font-semibold'>{transaction.customer_name}</span>?
          </p>
          <p className='mt-2 text-gray-600 text-sm'>
            This will cancel the sale and return all slabs and sinks to inventory.
          </p>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => handleDialogChange(false)}>
            Cancel
          </Button>
          <Form method='post'>
            <Button type='submit' variant='destructive'>
              Delete Transaction
            </Button>
          </Form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
