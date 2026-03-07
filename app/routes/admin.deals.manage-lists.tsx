import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { zodResolver } from '@hookform/resolvers/zod'
import { GripVertical, Plus, Trash2 } from 'lucide-react'
import type { RowDataPacket } from 'mysql2'
import { useEffect, useRef, useState } from 'react'
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
import { cn } from '~/lib/utils'
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
  isDisplay: z.coerce.boolean(),
})

const setDefaultGroupSchema = z.object({
  intent: z.literal('set_default_group'),
  groupId: z.coerce.number(),
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

const reorderListsSchema = z.object({
  intent: z.literal('reorder_lists'),
  updates: z.array(
    z.object({
      id: z.coerce.number(),
      position: z.number(),
    }),
  ),
})

const actionSchema = z.discriminatedUnion('intent', [
  createGroupSchema,
  deleteGroupSchema,
  toggleGroupSchema,
  setDefaultGroupSchema,
  createListSchema,
  deleteListSchema,
  reorderListsSchema,
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
  is_default: boolean
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
    'SELECT id, name, is_displayed as is_display, is_default FROM groups_list WHERE deleted_at IS NULL AND (company_id = ? OR id = 1) ORDER BY created_at',
    [user.company_id],
  )

  const allLists = await selectMany<DealList>(
    db,
    'SELECT id, name, position, group_id FROM deals_list WHERE deleted_at IS NULL ORDER BY position',
  )

  const groups: DealGroup[] = allGroups.map(g => ({
    ...g,
    is_display: Boolean(g.is_display),
    is_default: Boolean(g.is_default),
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
    case 'toggle_group': {
      const groupId = values.groupId
      const isDisplay = values.isDisplay
      await db.execute('UPDATE groups_list SET is_displayed = ? WHERE id = ?', [
        isDisplay,
        groupId,
      ])
      return data({ success: true })
    }
    case 'set_default_group': {
      const groupId = values.groupId
      await db.execute(
        'UPDATE groups_list SET is_default = 0 WHERE company_id = ? OR id = 1',
        [user.company_id],
      )
      await db.execute('UPDATE groups_list SET is_default = 1 WHERE id = ?', [groupId])
      session.flash('message', toastData('Success', 'Default group updated'))
      break
    }
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
    case 'reorder_lists': {
      for (const update of values.updates) {
        await db.execute('UPDATE deals_list SET position = ? WHERE id = ?', [
          update.position,
          update.id,
        ])
      }
      return data({ success: true })
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

function SortableListItem({ list, groupId }: { list: DealList; groupId: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: list.id,
      disabled: groupId === 1,
    })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center justify-between p-2 bg-secondary/50 rounded-md border border-border/50 text-sm',
        isDragging && 'opacity-50 shadow-lg border-primary/50',
      )}
    >
      <div className='flex items-center gap-2 flex-1 min-w-0'>
        {groupId !== 1 && (
          <div
            {...attributes}
            {...listeners}
            className='cursor-grab active:cursor-grabbing p-1 hover:bg-secondary rounded'
          >
            <GripVertical className='h-3 w-3 text-muted-foreground' />
          </div>
        )}
        <span className='font-medium truncate'>{list.name}</span>
      </div>

      {groupId !== 1 && (
        <Form
          method='post'
          onSubmit={e => {
            if (!confirm('Are you sure you want to delete this list?')) {
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
  )
}

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
  const { groups: initialGroups } = useLoaderData<typeof loader>()
  const [groups, setGroups] = useState(initialGroups)
  const submit = useSubmit()
  const navigate = useNavigate()
  const isSubmitting = useNavigation().state !== 'idle'
  const location = useLocation()

  useEffect(() => {
    setGroups(initialGroups)
  }, [initialGroups])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  )

  const handleDragEnd = (event: DragEndEvent, groupId: number) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const group = groups.find(g => g.id === groupId)
    if (!group) return

    const oldIndex = group.lists.findIndex(l => l.id === active.id)
    const newIndex = group.lists.findIndex(l => l.id === over.id)

    const newLists = arrayMove(group.lists, oldIndex, newIndex)

    // Update local state
    setGroups(prev => prev.map(g => (g.id === groupId ? { ...g, lists: newLists } : g)))

    // Submit to server
    const updates = newLists.map((list, index) => ({
      id: list.id,
      position: index,
    }))

    const formData = new FormData()
    formData.append('intent', 'reorder_lists')
    formData.append('updates', JSON.stringify(updates))
    submit(formData, { method: 'post' })
  }

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

                    {/* Default Toggle */}
                    <div className='flex items-center gap-2 border-l pl-4 ml-2'>
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
                            formData.append('isDisplay', String(checked))
                            submit(formData, { method: 'post' })
                          }}
                        />
                        <Label className='text-xs text-muted-foreground'>
                          {group.is_display ? 'Visible' : 'Hidden'}
                        </Label>
                      </Form>
                      <Switch
                        checked={group.is_default}
                        onCheckedChange={checked => {
                          if (!checked) return // Cannot uncheck the default one, must check another
                          const formData = new FormData()
                          formData.append('intent', 'set_default_group')
                          formData.append('groupId', String(group.id))
                          submit(formData, { method: 'post' })
                        }}
                      />
                      <Label className='text-xs font-medium'>
                        {group.is_default ? 'Default' : 'Assign leads here'}
                      </Label>
                    </div>

                    {/* Toggle Visibility */}
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
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCorners}
                      onDragEnd={event => handleDragEnd(event, group.id)}
                    >
                      <SortableContext
                        items={group.lists.map(l => l.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className='grid gap-2 grid-cols-1 md:grid-cols-2 lg:grid-cols-3'>
                          {group.lists.map(list => (
                            <SortableListItem
                              key={list.id}
                              list={list}
                              groupId={group.id}
                            />
                          ))}

                          {group.lists.length === 0 && (
                            <div className='text-xs text-muted-foreground italic p-2'>
                              No lists yet
                            </div>
                          )}
                        </div>
                      </SortableContext>
                    </DndContext>
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
