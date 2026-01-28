import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2 } from 'lucide-react'
import type { RowDataPacket } from 'mysql2'
import { useEffect, useRef } from 'react'
import {
  type ActionFunctionArgs,
  data,
  Form,
  type LoaderFunctionArgs,
  redirect,
  useFetcher,
  useLoaderData,
  useLocation,
  useNavigate,
  useNavigation,
  useSubmit,
} from 'react-router'
import { getValidatedFormData } from 'remix-hook-form'
import { z } from 'zod'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { Button } from '~/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { Dialog, DialogContent } from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Switch } from '~/components/ui/switch'
import { db } from '~/db.server'
import { commitSession, getSession } from '~/sessions.server'
import { posthogClient } from '~/utils/posthog.server'
import { selectMany } from '~/utils/queryHelpers'
import { getAdminUser, type User } from '~/utils/session.server'
import { toastData } from '~/utils/toastHelpers.server'

// ============================================================================
// TYPES & SCHEMAS
// ============================================================================

const createGroupSchema = z.object({
  intent: z.literal('create_group'),
  name: z.string().min(1, 'Name is required'),
})

const deleteGroupSchema = z.object({
  intent: z.literal('delete_group'),
  groupId: z.coerce.number(),
})

const toggleGroupSchema = z.object({
  intent: z.literal('toggle_group'),
  groupId: z.coerce.number(),
  isDisplay: z.coerce.boolean(), // or string "on" if standard form
})

const createListSchema = z.object({
  intent: z.literal('create_list'),
  groupId: z.coerce.number(),
  name: z.string().min(1, 'Name is required'),
})

const deleteListSchema = z.object({
  intent: z.literal('delete_list'),
  listId: z.coerce.number(),
})

const actionSchema = z.discriminatedUnion('intent', [
  createGroupSchema,
  deleteGroupSchema,
  toggleGroupSchema,
  createListSchema,
  deleteListSchema,
])

type DealList = {
  id: number
  name: string
  position: number
  group_id: number
}

type DealGroup = {
  id: number
  name: string
  is_display: boolean
  lists: DealList[]
}

// ============================================================================
// LOADER
// ============================================================================

export const loader = async ({ request }: LoaderFunctionArgs) => {
  let user: User
  try {
    user = await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  const allGroups = await selectMany<Omit<DealGroup, 'lists'>>(
    db,
    'SELECT id, name, is_displayed as is_display FROM groups_list WHERE deleted_at IS NULL AND (company_id = ? OR id = 1) ORDER BY created_at',
    [user.company_id],
  )

  const allLists = await selectMany<DealList>(
    db,
    'SELECT id, name, position, group_id FROM deals_list WHERE deleted_at IS NULL ORDER BY position',
  )

  const groups: DealGroup[] = allGroups.map(g => ({
    ...g,
    is_display: Boolean(g.is_display),
    lists: allLists.filter(l => l.group_id === g.id),
  }))

  return { groups }
}

// ============================================================================
// ACTION
// ============================================================================

export const action = async ({ request }: ActionFunctionArgs) => {
  let user: User
  try {
    user = await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  const session = await getSession(request.headers.get('Cookie'))
  const formData = await request.clone().formData()
  const intent = formData.get('intent')

  if (intent === 'toggle_group') {
    const groupId = Number(formData.get('groupId'))
    const isDisplay = formData.get('isDisplay') === 'on'
    await db.execute('UPDATE groups_list SET is_displayed = ? WHERE id = ?', [
      isDisplay,
      groupId,
    ])
    return data({ success: true })
  }

  const resolver = zodResolver(actionSchema)
  const {
    errors,
    data: validData,
    receivedValues,
  } = await getValidatedFormData(request, resolver)

  if (errors) {
    posthogClient.captureException(errors, user.id.toString())
    return data({ errors, receivedValues }, { status: 400 })
  }

  const values = validData

  switch (values.intent) {
    case 'create_group': {
      await db.execute(
        'INSERT INTO groups_list (name, created_at, company_id) VALUES (?, ?, ?)',
        [values.name, new Date(), user.company_id],
      )
      session.flash('message', toastData('Success', 'Group created successfully'))
      break
    }
    case 'delete_group': {
      if (values.groupId === 1) {
        return data({ error: 'Cannot delete Default group' }, { status: 400 })
      }

      await db.execute('UPDATE groups_list SET deleted_at = NOW() WHERE id = ?', [
        values.groupId,
      ])
      await db.execute('UPDATE deals_list SET deleted_at = NOW() WHERE group_id = ?', [
        values.groupId,
      ])
      session.flash(
        'message',
        toastData('Success', 'Group and its lists deleted successfully'),
      )
      break
    }
    case 'create_list': {
      if (values.groupId === 1) {
        return data({ error: 'Cannot add lists to Default group' }, { status: 400 })
      }

      const [posRows] = await db.execute<RowDataPacket[]>(
        'SELECT MAX(position) as maxPos FROM deals_list WHERE group_id = ? AND deleted_at IS NULL',
        [values.groupId],
      )
      const nextPos = (posRows[0]?.maxPos ?? -1) + 1

      await db.execute(
        'INSERT INTO deals_list (name, group_id, position) VALUES (?, ?, ?)',
        [values.name, values.groupId, nextPos],
      )
      session.flash('message', toastData('Success', 'List created successfully'))
      break
    }
    case 'delete_list': {
      const [listRows] = await db.execute<RowDataPacket[]>(
        `SELECT group_id FROM deals_list WHERE id = ?`,
        [values.listId],
      )
      const groupId = listRows[0]?.group_id

      if (groupId === 1) {
        return data({ error: 'Cannot delete lists in Default group' }, { status: 400 })
      }

      await db.execute('UPDATE deals_list SET deleted_at = NOW() WHERE id = ?', [
        values.listId,
      ])
      session.flash('message', toastData('Success', 'List deleted successfully'))
      break
    }
  }

  return data(
    { success: true },
    {
      headers: { 'Set-Cookie': await commitSession(session) },
    },
  )
}

// ============================================================================
// COMPONENT
// ============================================================================

function CreateListForm({ groupId }: { groupId: number }) {
  const fetcher = useFetcher<{ success?: boolean; error?: string }>()
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data?.success) {
      formRef.current?.reset()
    }
  }, [fetcher.state, fetcher.data])

  return (
    <fetcher.Form
      method='post'
      ref={formRef}
      className='flex gap-2 w-full max-w-sm items-center'
    >
      <input type='hidden' name='intent' value='create_list' />
      <input type='hidden' name='groupId' value={groupId} />
      <Input
        name='name'
        placeholder='New list name...'
        className='bg-background h-8 text-sm'
        required
      />
      <Button
        type='submit'
        variant='outline'
        size='sm'
        className='h-8'
        disabled={fetcher.state !== 'idle'}
      >
        <Plus className='h-3 w-3 mr-1' /> Add List
      </Button>
    </fetcher.Form>
  )
}

export default function ManageLists() {
  const { groups } = useLoaderData<typeof loader>()
  const submit = useSubmit()
  const navigate = useNavigate()
  const isSubmitting = useNavigation().state !== 'idle'
  const location = useLocation()
  return (
    <Dialog
      open={true}
      onOpenChange={open => {
        if (!open) navigate(`..${location.search}`)
      }}
    >
      <DialogContent className='max-w-5xl overflow-auto max-h-[95vh]'>
        <div className='p-6 space-y-8'>
          <div className='flex justify-between items-center'>
            <h1 className='text-3xl font-bold'>Manage Deal Lists</h1>

            {/* Create New Group Form */}
            <Form method='post' className='flex gap-2 items-end'>
              <input type='hidden' name='intent' value='create_group' />
              <div className='grid w-full max-w-sm items-center gap-1.5'>
                <Label htmlFor='groupName'>New Group Name</Label>
                <Input
                  type='text'
                  id='groupName'
                  name='name'
                  placeholder='e.g. Homeowners'
                  required
                />
              </div>
              <LoadingButton loading={isSubmitting} type='submit'>
                <Plus className='w-4 h-4 mr-2' /> Add Group
              </LoadingButton>
            </Form>
          </div>

          <div className='grid gap-4'>
            {groups.map(group => (
              <Card key={group.id} className='w-full shadow-sm'>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 p-3'>
                  <div className='flex items-center gap-4'>
                    <CardTitle className='text-lg font-semibold'>
                      {group.name} {group.id === 1 && '(Default)'}
                    </CardTitle>

                    {/* Toggle Visibility */}
                    <Form method='post' className='flex items-center gap-2'>
                      <input type='hidden' name='intent' value='toggle_group' />
                      <input type='hidden' name='groupId' value={group.id} />
                      <Switch
                        name='isDisplay'
                        checked={group.is_display}
                        // disabled={group.id === 1} // Re-enabled for id=1 as per request
                        onCheckedChange={checked => {
                          const formData = new FormData()
                          formData.append('intent', 'toggle_group')
                          formData.append('groupId', String(group.id))
                          if (checked) formData.append('isDisplay', 'on')
                          submit(formData, { method: 'post' })
                        }}
                      />
                      <Label className='text-xs text-muted-foreground'>
                        {group.is_display ? 'Visible' : 'Hidden'}
                      </Label>
                    </Form>
                  </div>

                  {group.id !== 1 && (
                    <Form
                      method='post'
                      onSubmit={e => {
                        if (
                          !confirm(
                            'Are you sure? This will delete the group and its lists.',
                          )
                        ) {
                          e.preventDefault()
                        }
                      }}
                    >
                      <input type='hidden' name='intent' value='delete_group' />
                      <input type='hidden' name='groupId' value={group.id} />
                      <Button
                        variant='ghost'
                        size='icon'
                        className='h-8 w-8 text-destructive hover:bg-destructive/10'
                      >
                        <Trash2 className='h-4 w-4' />
                      </Button>
                    </Form>
                  )}
                </CardHeader>
                <CardContent className='p-3 pt-0'>
                  <div className='space-y-2'>
                    <div className='grid gap-2 grid-cols-1 md:grid-cols-2 lg:grid-cols-3'>
                      {group.lists.map(list => (
                        <div
                          key={list.id}
                          className='flex items-center justify-between p-2 bg-secondary/50 rounded-md border border-border/50 text-sm'
                        >
                          <span className='font-medium truncate'>{list.name}</span>

                          {group.id !== 1 && (
                            <Form
                              method='post'
                              onSubmit={e => {
                                if (
                                  !confirm('Are you sure you want to delete this list?')
                                ) {
                                  e.preventDefault()
                                }
                              }}
                            >
                              <input type='hidden' name='intent' value='delete_list' />
                              <input type='hidden' name='listId' value={list.id} />
                              <Button
                                variant='ghost'
                                size='icon'
                                className='h-6 w-6 hover:bg-destructive/10 hover:text-destructive ml-2'
                              >
                                <Trash2 className='h-3 w-3' />
                              </Button>
                            </Form>
                          )}
                        </div>
                      ))}

                      {group.lists.length === 0 && (
                        <div className='text-xs text-muted-foreground italic p-2'>
                          No lists yet
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
                {group.id !== 1 && (
                  <CardFooter className='bg-muted/10 p-2'>
                    <CreateListForm groupId={group.id} />
                  </CardFooter>
                )}
              </Card>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
