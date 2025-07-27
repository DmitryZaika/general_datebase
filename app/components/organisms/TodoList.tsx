import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { zodResolver } from '@hookform/resolvers/zod'
import { clsx } from 'clsx'
import { CheckIcon, GripVerticalIcon, PencilIcon, TrashIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Form, FormProvider, useForm } from 'react-hook-form'
import { Checkbox } from '~/components/ui/checkbox'
import { Dialog, DialogContent, DialogTrigger } from '~/components/ui/dialog'
import { useFullFetcher } from '~/hooks/useFullFetcher'
import { type TTodoListSchema, todoListSchema } from '~/schemas/general'
import type { Todo } from '~/types'
import { DialogFullHeader } from '../molecules/DialogFullHeader'
import { InputItem } from '../molecules/InputItem'
import { LoadingButton } from '../molecules/LoadingButton'
import { Button } from '../ui/button'
import { FormField } from '../ui/form'

type EmptyFunction = () => void
type CallbackFunction = (callback: () => void) => void

interface EditFormProps<T> {
  todo: Todo
  refresh: T
}

function AddForm({ refresh }: { refresh: () => void }) {
  const form = useForm<TTodoListSchema>({
    resolver: zodResolver(todoListSchema),
    defaultValues: { rich_text: '' },
  })
  const { fullSubmit, fetcher } = useFullFetcher(form, '/api/todoList')

  useEffect(() => {
    if (fetcher.state === 'idle') {
      refresh()
      form.reset()
    }
  }, [fetcher.state])

  return (
    <FormProvider {...form}>
      <Form onSubmit={fullSubmit} className='flex items-center space-x-2 '>
        <FormField
          control={form.control}
          name='rich_text'
          render={({ field }) => (
            <InputItem
              placeholder='Add new task'
              className='resize-none min-h-9 h-9 p-[4px]'
              formClassName='mb-0 w-full p-[2px] flex justify-center'
              field={field}
            />
          )}
        />
        <Button type='submit' variant={'blue'}>
          Add
        </Button>
      </Form>
    </FormProvider>
  )
}

function EditForm({ refresh, todo }: EditFormProps<CallbackFunction>) {
  const form = useForm<TTodoListSchema>({
    resolver: zodResolver(todoListSchema),
    defaultValues: { rich_text: todo.rich_text },
  })
  const { fullSubmit, fetcher } = useFullFetcher(form, `/api/todoList/${todo.id}`)
  const [isEditing, setEditing] = useState<boolean>(false)

  useEffect(() => {
    if (fetcher.state === 'idle') {
      refresh(() => setEditing(false))
    }
  }, [fetcher.state])

  return (
    <FormProvider {...form}>
      <Form onSubmit={fullSubmit} className='flex items-center space-x-2  grow'>
        <div className='grow w-full'>
          {isEditing ? (
            <FormField
              control={form.control}
              name='rich_text'
              render={({ field }) => (
                <InputItem
                  className='resize-none min-h-9 h-9 w-full border-none focus:ring-0 p-[0px]'
                  formClassName='mb-0 w-full p-[2px] flex justify-center'
                  field={field}
                  inputAutoFocus={true}
                />
              )}
            />
          ) : (
            <p
              className={clsx('break-words max-w-[260px]', {
                'line-through': todo.is_done,
              })}
            >
              {todo.rich_text}
            </p>
          )}
        </div>
        {isEditing ? (
          <LoadingButton loading={fetcher.state !== 'idle'}>
            <CheckIcon />
          </LoadingButton>
        ) : (
          <Button variant='ghost' className='ml-auto' onClick={() => setEditing(true)}>
            <PencilIcon />
          </Button>
        )}
      </Form>
    </FormProvider>
  )
}

function DeleteForm({ refresh, todo }: EditFormProps<EmptyFunction>) {
  const form = useForm()
  const { fullSubmit, fetcher } = useFullFetcher(
    form,
    `/api/todoList/${todo.id}`,
    'DELETE',
  )
  useEffect(() => {
    if (fetcher.state === 'idle') {
      refresh()
    }
  }, [fetcher.state])

  return (
    <FormProvider {...form}>
      <Form onSubmit={fullSubmit}>
        <Button variant='ghost'>
          <TrashIcon />
        </Button>
      </Form>
    </FormProvider>
  )
}

function FinishForm({ refresh, todo }: EditFormProps<EmptyFunction>) {
  const [checked, setChecked] = useState<boolean>(Boolean(todo.is_done))

  async function handleCheckboxChange(isDone: boolean) {
    const formData = new FormData()
    formData.append('isDone', String(isDone))

    await fetch(`/api/todoList/${todo.id}`, {
      method: 'PATCH',
      body: formData,
    })
    refresh()
  }

  async function handleToggle(value: boolean) {
    setChecked(Boolean(value))
    await handleCheckboxChange(value)
  }

  return (
    <Checkbox
      checked={checked}
      onCheckedChange={handleToggle}
      className='size-5 mr-2'
    />
  )
}

interface SortableTodoItemProps {
  todo: Todo
  refresh: () => void
}

function SortableTodoItem({ todo, refresh }: SortableTodoItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: todo.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        'flex items-center py-2 border-b border-gray-200 hover:bg-gray-100 transition-colors rounded-lg',
        isDragging && 'opacity-50',
      )}
    >
      <button
        className='touch-none p-1 opacity-40 hover:opacity-100 cursor-pointer'
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon className='h-4 w-4' />
      </button>
      <FinishForm todo={todo} refresh={refresh} />
      <EditForm todo={todo} refresh={refresh} />
      <DeleteForm todo={todo} refresh={refresh} />
      <p className='text-sm text-gray-500'>
        {new Date(todo.created_date).toLocaleDateString(undefined, {
          month: 'numeric',
          day: 'numeric',
        })}
      </p>
    </div>
  )
}

export function TodoList() {
  const [data, setData] = useState<{ todos: Todo[] } | undefined>()
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const getTodos = (callback: undefined | (() => void) = undefined) => {
    fetch('/api/todoList')
      .then(async res => await res.json())
      .then(newData => {
        const sortedTodos = [...newData.todos].sort((a, b) => {
          if (a.is_done && !b.is_done) return 1
          if (!a.is_done && b.is_done) return -1
          return a.position - b.position
        })

        if (JSON.stringify(sortedTodos) !== JSON.stringify(newData.todos)) {
          const formData = new FormData()
          formData.append(
            'positions',
            JSON.stringify(
              sortedTodos.map((todo, index) => ({
                id: todo.id,
                position: index,
              })),
            ),
          )

          fetch('/api/todoList/reorder', {
            method: 'POST',
            body: formData,
          }).then(() => {
            setData({ todos: sortedTodos })
            if (callback) callback()
          })
        } else {
          setData({ todos: sortedTodos })
          if (callback) callback()
        }
      })
  }

  useEffect(() => {
    getTodos()
  }, [])

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id || !data) {
      return
    }

    const oldIndex = data.todos.findIndex(todo => todo.id === active.id)
    const newIndex = data.todos.findIndex(todo => todo.id === over.id)

    const newTodos = arrayMove(data.todos, oldIndex, newIndex)
    setData({ todos: newTodos })

    const formData = new FormData()
    formData.append(
      'positions',
      JSON.stringify(
        newTodos.map((todo, index) => ({
          id: todo.id,
          position: index,
        })),
      ),
    )

    await fetch('/api/todoList/reorder', {
      method: 'POST',
      body: formData,
    })
  }

  return (
    <Dialog modal={false}>
      <DialogTrigger
        className='relative top-[10px] right-[10px] md:top-0 md:right-5 lg:top-0 lg:right-15'
        asChild
      >
        <Button>Todo List</Button>
      </DialogTrigger>
      <DialogContent
        hideClose
        className='h-full p-0 gap-0'
        position='br'
        onInteractOutside={e => {
          e.preventDefault()
        }}
      >
        <div className='h-full w-full bg-white border-l border-gray-300 shadow-lg flex flex-col overflow-y-auto'>
          <DialogFullHeader>
            <span className='text-lg font-bold'>Todo List</span>
          </DialogFullHeader>

          <div className='px-2 flex flex-col'>
            <AddForm refresh={getTodos} />

            <div className='overflow-hidden md:max-h-full'>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={data?.todos?.map(todo => todo.id) || []}
                  strategy={verticalListSortingStrategy}
                >
                  {data?.todos?.map(todo => (
                    <SortableTodoItem key={todo.id} todo={todo} refresh={getTodos} />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
