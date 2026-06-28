import {
  closestCenter,
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
import DOMPurify from 'isomorphic-dompurify'
import { GripVertical, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import type { FC, HTMLAttributes, ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Link,
  type LoaderFunctionArgs,
  Outlet,
  redirect,
  useLoaderData,
  useLocation,
  useNavigate,
  useRevalidator,
  useSearchParams,
} from 'react-router'
import { PageLayout } from '~/components/PageLayout'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '~/components/ui/accordion'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { db } from '~/db.server'
import { cn } from '~/lib/utils'
import '~/styles/instructions.css'
import {
  applySiblingReorder,
  buildInstructionTree,
  type InstructionNode,
  type InstructionRow,
} from '~/utils/instructionTree'
import { selectMany } from '~/utils/queryHelpers'
import { getAdminUser } from '~/utils/session.server'
import { isEmptyRichText, stripHtmlTags } from '~/utils/stringHelpers'

interface SearchResult extends InstructionNode {
  matchType: 'title' | 'content'
}

interface InstructionItemProps {
  instruction: InstructionNode
  onEdit: (id: number) => void
  onDelete: (id: number) => void
  onReorder: (parentId: number | null, orderedIds: number[]) => void
  sortDisabled?: boolean
  dragHandle?: ReactNode
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  const user = await getAdminUser(request)
  const url = new URL(request.url)
  const allowGeneral = !!user.is_superuser
  const requestedMode =
    url.searchParams.get('type') === 'general' ? 'general' : 'company'
  const mode: 'company' | 'general' =
    allowGeneral && requestedMode === 'general' ? 'general' : 'company'
  const companyId = mode === 'general' ? 0 : user.company_id
  const instructions = await selectMany<InstructionRow>(
    db,
    'SELECT id, title, parent_id, after_id, rich_text FROM instructions WHERE company_id = ?',
    [companyId],
  )
  return { instructions, allowGeneral, mode }
}

async function persistInstructionOrder(
  parentId: number | null,
  orderedIds: number[],
  mode: 'company' | 'general',
) {
  const response = await fetch('/api/instructions/reorder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parentId, orderedIds, mode }),
  })
  if (!response.ok) {
    throw new Error('Failed to reorder instructions')
  }
}

interface InstructionHeaderProps {
  title: string
  onEdit: (e: React.MouseEvent) => void
  onDelete: (e: React.MouseEvent) => void
  textAlign?: 'left' | 'center'
  dragHandle?: ReactNode
}

const InstructionHeader: FC<InstructionHeaderProps> = ({
  title,
  onEdit,
  onDelete,
  textAlign,
  dragHandle,
}) => (
  <div className='flex items-center justify-between flex-1 gap-3'>
    <div className='flex min-w-0 items-center gap-2'>
      {dragHandle}
      <h3
        className={cn(
          'font-bold text-2xl text-gray-900',
          textAlign && `text-${textAlign}`,
        )}
      >
        {title}
      </h3>
    </div>
    <div className='flex items-center gap-2 shrink-0'>
      <button
        type='button'
        onClick={onEdit}
        className='p-2 rounded-md transition-colors'
        aria-label='Edit instruction'
        title='Edit instruction'
      >
        <Pencil className='w-4 h-4 text-gray-600 hover:text-blue-600 transition-colors' />
      </button>
      <button
        type='button'
        onClick={onDelete}
        className='p-2 rounded-md transition-colors'
        aria-label='Delete instruction'
        title='Delete instruction'
      >
        <Trash2 className='w-4 h-4 text-gray-600 hover:text-red-600 transition-colors' />
      </button>
    </div>
  </div>
)

function InstructionDragHandle(props: HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type='button'
      className='touch-none rounded p-1 text-gray-400 hover:text-gray-700'
      aria-label='Drag to reorder'
      onClick={event => event.stopPropagation()}
      {...props}
    >
      <GripVertical className='h-4 w-4' />
    </button>
  )
}

interface InstructionSortableListProps {
  items: InstructionNode[]
  parentId: number | null
  sortDisabled?: boolean
  onReorder: (parentId: number | null, orderedIds: number[]) => void
  onEdit: (id: number) => void
  onDelete: (id: number) => void
  accordion?: boolean
}

function SortableInstructionRow({
  instruction,
  sortDisabled,
  children,
}: {
  instruction: InstructionNode
  sortDisabled?: boolean
  children: (dragHandle: ReactNode | undefined) => ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: instruction.id, disabled: sortDisabled })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const dragHandle = sortDisabled ? undefined : (
    <InstructionDragHandle {...attributes} {...listeners} />
  )

  return (
    <div ref={setNodeRef} style={style}>
      {children(dragHandle)}
    </div>
  )
}

function InstructionSortableList({
  items,
  parentId,
  sortDisabled,
  onReorder,
  onEdit,
  onDelete,
  accordion = true,
}: InstructionSortableListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    if (sortDisabled) return
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex(item => item.id === Number(active.id))
    const newIndex = items.findIndex(item => item.id === Number(over.id))
    if (oldIndex === -1 || newIndex === -1) return
    onReorder(
      parentId,
      arrayMove(items, oldIndex, newIndex).map(item => item.id),
    )
  }

  const listContent = items.map(item => (
    <SortableInstructionRow
      key={item.id}
      instruction={item}
      sortDisabled={sortDisabled}
    >
      {dragHandle => (
        <InstructionItem
          instruction={item}
          onEdit={onEdit}
          onDelete={onDelete}
          onReorder={onReorder}
          sortDisabled={sortDisabled}
          dragHandle={dragHandle}
        />
      )}
    </SortableInstructionRow>
  ))

  if (sortDisabled) {
    if (accordion) {
      return (
        <Accordion type='multiple' className='w-full'>
          {listContent}
        </Accordion>
      )
    }
    return <div className='space-y-3'>{listContent}</div>
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map(item => item.id)}
        strategy={verticalListSortingStrategy}
      >
        {accordion ? (
          <Accordion type='multiple' className='w-full'>
            {listContent}
          </Accordion>
        ) : (
          <div className='space-y-3'>{listContent}</div>
        )}
      </SortableContext>
    </DndContext>
  )
}

const InstructionItem: FC<InstructionItemProps> = ({
  instruction,
  onEdit,
  onDelete,
  onReorder,
  sortDisabled,
  dragHandle,
}) => {
  const hasChildren = instruction.children.length > 0
  const hasContent = !isEmptyRichText(instruction.rich_text)
  const hasExpandableContent = hasContent || hasChildren

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    onEdit(instruction.id)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete(instruction.id)
  }

  if (instruction.title) {
    if (!hasExpandableContent) {
      return (
        <div className='border-b border-gray-200 last:border-b-0 py-5 px-6'>
          <InstructionHeader
            title={instruction.title}
            onEdit={handleEdit}
            onDelete={handleDelete}
            dragHandle={dragHandle}
          />
        </div>
      )
    }

    return (
      <AccordionItem
        value={instruction.id.toString()}
        className='border-b border-gray-200 last:border-b-0'
      >
        <AccordionTrigger className='py-5 px-6 [&[data-state=open]_h3]:underline [&[data-state=open]_h3]:underline-offset-4'>
          <InstructionHeader
            title={instruction.title}
            onEdit={handleEdit}
            onDelete={handleDelete}
            textAlign='left'
            dragHandle={dragHandle}
          />
        </AccordionTrigger>
        <AccordionContent>
          <div
            className={cn('ml-6 mb-4 border-l-1 pl-4', {
              'border-blue-200': hasChildren,
              '!border-transparent': !hasChildren,
            })}
          >
            {hasContent && (
              <article
                className='prose prose-base max-w-none instructions px-6 py-5 bg-gray-50 rounded-lg shadow-md'
                // biome-ignore lint/security/noDangerouslySetInnerHtml: Its safe
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(instruction.rich_text),
                }}
              />
            )}
            {hasChildren && (
              <section className='mt-6'>
                <InstructionSortableList
                  items={instruction.children}
                  parentId={instruction.id}
                  sortDisabled={sortDisabled}
                  onReorder={onReorder}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              </section>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    )
  }

  return (
    <div className='ml-6 border-l-1 border-blue-200 pl-4'>
      <article className='py-5 px-6 bg-gray-50 rounded-lg shadow-md'>
        <div className='flex items-start justify-between gap-6'>
          <div className='flex min-w-0 flex-1 items-start gap-2'>
            {dragHandle}
            <div
              className='prose prose-base max-w-none instructions flex-1'
              // biome-ignore lint/security/noDangerouslySetInnerHtml: Its safe
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(instruction.rich_text),
              }}
            />
          </div>
          <div className='flex items-center gap-3 shrink-0'>
            <button
              type='button'
              onClick={handleEdit}
              className='p-2 rounded-md transition-colors'
              aria-label='Edit instruction'
              title='Edit instruction'
            >
              <Pencil
                size={16}
                className='w-5 h-5 text-gray-600 hover:text-blue-600 transition-colors'
              />
            </button>
            <button
              type='button'
              onClick={handleDelete}
              className='p-2 rounded-md transition-colors'
              aria-label='Delete instruction'
              title='Delete instruction'
            >
              <Trash2
                size={16}
                className='w-5 h-5 text-gray-600 hover:text-red-600 transition-colors'
              />
            </button>
          </div>
        </div>
        {hasChildren && (
          <section className='mt-6 space-y-3'>
            <InstructionSortableList
              items={instruction.children}
              parentId={instruction.id}
              sortDisabled={sortDisabled}
              onReorder={onReorder}
              onEdit={onEdit}
              onDelete={onDelete}
              accordion={false}
            />
          </section>
        )}
      </article>
    </div>
  )
}

const findInstructionById = (
  id: number,
  nodes: InstructionNode[],
  visited = new Set<number>(),
): InstructionNode | null => {
  for (const node of nodes) {
    if (visited.has(node.id)) continue
    visited.add(node.id)

    if (node.id === id) return node

    if (node.children.length > 0) {
      const found = findInstructionById(id, node.children, visited)
      if (found) return found
    }
  }
  return null
}

const searchAllInstructions = (
  term: string,
  nodes: InstructionNode[],
  visited = new Set<number>(),
): SearchResult[] => {
  const results: SearchResult[] = []
  const search = term.toLowerCase()

  for (const node of nodes) {
    if (visited.has(node.id)) continue
    visited.add(node.id)

    const titleMatch = (node.title ?? '').toLowerCase().includes(search)
    const contentMatch = stripHtmlTags(node.rich_text).toLowerCase().includes(search)

    if (titleMatch) {
      results.push({ ...node, matchType: 'title' })
    } else if (contentMatch) {
      results.push({ ...node, matchType: 'content' })
    }

    if (node.children.length > 0) {
      results.push(...searchAllInstructions(term, node.children, visited))
    }
  }

  return results
}

export default function AdminInstructions() {
  const { instructions, allowGeneral, mode } = useLoaderData<typeof loader>()
  const navigate = useNavigate()
  const revalidator = useRevalidator()
  const [searchParams, setSearchParams] = useSearchParams()
  const instructionIdParam = searchParams.get('instructionId')
  const location = useLocation()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [instructionRows, setInstructionRows] = useState(instructions)

  useEffect(() => {
    setInstructionRows(instructions)
  }, [instructions])

  const instructionTree = useMemo(
    () => buildInstructionTree(instructionRows),
    [instructionRows],
  )

  const handleReorder = useCallback(
    async (parentId: number | null, orderedIds: number[]) => {
      setInstructionRows(current => applySiblingReorder(current, parentId, orderedIds))
      try {
        await persistInstructionOrder(parentId, orderedIds, mode)
      } catch {
        revalidator.revalidate()
      }
    },
    [mode, revalidator],
  )

  const searchResults = useMemo(
    () =>
      searchTerm.trim()
        ? searchAllInstructions(searchTerm.trim(), instructionTree)
        : [],
    [searchTerm, instructionTree],
  )

  const displayTree = useMemo(() => {
    if (!selectedId) return instructionTree
    const selected = findInstructionById(selectedId, instructionTree)
    return selected ? [selected] : instructionTree
  }, [selectedId, instructionTree])

  useEffect(() => {
    if (!instructionIdParam) return
    const id = Number.parseInt(instructionIdParam, 10)
    if (!Number.isFinite(id)) return
    const selected = findInstructionById(id, instructionTree)
    if (!selected) return
    setSelectedId(id)
    setSearchTerm(selected.title ?? '')
    setShowDropdown(false)
  }, [instructionIdParam, instructionTree])

  const handleEdit = (id: number) => navigate(`edit/${id}${location.search}`)
  const handleDelete = (id: number) => navigate(`delete/${id}${location.search}`)

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchTerm(value)
    setShowDropdown(value.trim().length > 0)
    if (!value.trim()) {
      setSelectedId(null)
    }
  }

  const handleSelectInstruction = (instruction: SearchResult) => {
    setSelectedId(instruction.id)
    setSearchTerm(instruction.title ?? '')
    setShowDropdown(false)
  }

  const handleReset = () => {
    setSearchTerm('')
    setSelectedId(null)
    setShowDropdown(false)
  }

  const handleTabChange = (value: string) => {
    if (!allowGeneral) return
    if (value === 'general') {
      setSearchParams({ type: 'general' })
    } else {
      setSearchParams({ type: 'company' })
    }
  }

  return (
    <PageLayout title='Instructions'>
      {allowGeneral && (
        <div className='mb-4'>
          <Tabs value={mode} onValueChange={handleTabChange}>
            <TabsList>
              <TabsTrigger value='company'>Company instructions</TabsTrigger>
              <TabsTrigger value='general'>General instructions</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}
      <header className='flex gap-4 justify-between mb-6'>
        <Link to={`add${location.search || ''}`} relative='path'>
          <Button
            size='lg'
            className='gap-2 shadow-sm hover:shadow-md transition-shadow'
          >
            <Plus className='w-5 h-5' />
            Add Instruction
          </Button>
        </Link>
        <div className='relative flex-1 max-w-sm'>
          <Search className='absolute left-2 top-2.5 h-4 w-4 text-muted-foreground' />
          <Input
            placeholder='Search instructions...'
            value={searchTerm}
            onChange={handleSearchChange}
            className='pl-8 pr-8'
          />
          {searchTerm && (
            <button
              onClick={handleReset}
              className='absolute right-2 top-2 p-0.5 hover:bg-gray-100 rounded transition-colors'
              aria-label='Clear search'
            >
              <X className='h-4 w-4 text-muted-foreground' />
            </button>
          )}
          {showDropdown && (
            <div className='absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-80 overflow-y-auto z-50'>
              {searchResults.length > 0 ? (
                searchResults.map(instruction => (
                  <button
                    key={instruction.id}
                    onClick={() => handleSelectInstruction(instruction)}
                    className='w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors'
                  >
                    <div className='flex items-center justify-between gap-2'>
                      <p className='font-medium text-sm text-gray-900'>
                        {instruction.title}
                      </p>
                      <span className='text-xs text-gray-500 shrink-0'>
                        {instruction.matchType === 'title'
                          ? 'Found in title'
                          : 'Found in content'}
                      </span>
                    </div>
                  </button>
                ))
              ) : (
                <div className='px-3 py-4 text-sm text-gray-500 text-center'>
                  No instructions found
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {displayTree.length === 0 ? (
        <section className='flex flex-col items-center justify-center py-16 px-4'>
          <div className='w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4'>
            <Search className='w-8 h-8 text-gray-400' />
          </div>
          <h2 className='text-lg font-medium text-gray-700 mb-2'>
            No instructions yet
          </h2>
          <p className='text-sm text-gray-500 text-center max-w-md'>
            Get started by creating your first instruction to help guide your team.
          </p>
          <Link to='add' relative='path' className='mt-6'>
            <Button size='lg' className='gap-2'>
              <Plus className='w-5 h-5' />
              Create First Instruction
            </Button>
          </Link>
        </section>
      ) : (
        <section>
          <InstructionSortableList
            items={displayTree}
            parentId={null}
            sortDisabled={!!selectedId}
            onReorder={handleReorder}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </section>
      )}
      <Outlet />
    </PageLayout>
  )
}
