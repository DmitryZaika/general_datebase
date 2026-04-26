import DOMPurify from 'isomorphic-dompurify'
import { Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import type { FC } from 'react'
import { useMemo, useState } from 'react'
import {
  Link,
  type LoaderFunctionArgs,
  Outlet,
  redirect,
  useLoaderData,
  useLocation,
  useNavigate,
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
import { selectMany } from '~/utils/queryHelpers'
import { getAdminUser } from '~/utils/session.server'
import { isEmptyRichText, stripHtmlTags } from '~/utils/stringHelpers'

interface Instructions {
  id: number
  title: string
  parent_id: number | null
  after_id: number | null
  rich_text: string
  public: number
}

interface InstructionNode {
  id: number
  title: string
  parent_id: number | null
  after_id: number | null
  rich_text: string
  public: number
  children: InstructionNode[]
}

interface SearchResult extends InstructionNode {
  matchType: 'title' | 'content'
}

interface InstructionItemProps {
  instruction: InstructionNode
  onEdit: (id: number) => void
  onDelete: (id: number) => void
  readOnly?: boolean
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
  const requestedType = url.searchParams.get('type')

  let mode: 'company' | 'general' | 'customer' = 'company'
  if (requestedType === 'customer') {
    mode = 'customer'
  } else if (allowGeneral && requestedType === 'general') {
    mode = 'general'
  }

  const companyId = mode === 'general' ? 0 : user.company_id
  const isPublic = mode === 'customer' ? 1 : 0

  const instructions = await selectMany<Instructions>(
    db,
    'SELECT id, title, parent_id, after_id, rich_text, public FROM instructions WHERE company_id = ? AND public = ?',
    [companyId, isPublic],
  )
  return { instructions, allowGeneral, mode }
}

function buildInstructionTree(instructions: Instructions[]): InstructionNode[] {
  const nodeMap = new Map<number, InstructionNode>()

  instructions.forEach(item => {
    nodeMap.set(item.id, {
      ...item,
      children: [],
    })
  })

  const rootNodes: InstructionNode[] = []

  const insertNodeInOrder = (nodes: InstructionNode[], node: InstructionNode) => {
    if (node.after_id === null) {
      nodes.unshift(node)
    } else {
      const index = nodes.findIndex(n => n.id === node.after_id)
      if (index !== -1) {
        nodes.splice(index + 1, 0, node)
      } else {
        nodes.push(node)
      }
    }
  }

  instructions.forEach(item => {
    const node = nodeMap.get(item.id)
    if (!node) return

    if (item.parent_id === null) {
      insertNodeInOrder(rootNodes, node)
    } else {
      const parentNode = nodeMap.get(item.parent_id)
      if (parentNode) {
        insertNodeInOrder(parentNode.children, node)
      }
    }
  })

  return rootNodes
}

interface InstructionHeaderProps {
  title: string
  onEdit: (e: React.MouseEvent) => void
  onDelete: (e: React.MouseEvent) => void
  textAlign?: 'left' | 'center'
  readOnly?: boolean
}

const InstructionHeader: FC<InstructionHeaderProps> = ({
  title,
  onEdit,
  onDelete,
  textAlign,
}) => (
  <div className='flex items-center justify-between flex-1 gap-6'>
    <h3
      className={cn(
        'font-bold text-2xl text-gray-900',
        textAlign && `text-${textAlign}`,
      )}
    >
      {title}
    </h3>
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

const InstructionItem: FC<InstructionItemProps> = ({
  instruction,
  onEdit,
  onDelete,
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
                <Accordion type='multiple' className='space-y-3'>
                  {instruction.children.map(child => (
                    <InstructionItem
                      key={child.id}
                      instruction={child}
                      onEdit={onEdit}
                      onDelete={onDelete}
                    />
                  ))}
                </Accordion>
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
          <div
            className='prose prose-base max-w-none instructions flex-1'
            // biome-ignore lint/security/noDangerouslySetInnerHtml: Its safe
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(instruction.rich_text),
            }}
          />
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
            {instruction.children.map(child => (
              <InstructionItem
                key={child.id}
                instruction={child}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
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

    const titleMatch = node.title.toLowerCase().includes(search)
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
  const [_, setSearchParams] = useSearchParams()
  const location = useLocation()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)

  const instructionTree = useMemo(
    () => buildInstructionTree(instructions),
    [instructions],
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
    setSearchTerm(instruction.title)
    setShowDropdown(false)
  }

  const handleReset = () => {
    setSearchTerm('')
    setSelectedId(null)
    setShowDropdown(false)
  }

  const handleTabChange = (value: string) => {
    if (value === 'general' && !allowGeneral) return
    setSearchParams({ type: value })
  }

  return (
    <PageLayout title='Instructions'>
      <div className='mb-4'>
        <Tabs value={mode} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value='company'>Company instructions</TabsTrigger>
            {allowGeneral && (
              <TabsTrigger value='general'>General instructions</TabsTrigger>
            )}
            <TabsTrigger value='customer'>Customer instructions</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
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
          <Accordion type='multiple' className='w-full'>
            {displayTree.map(instruction => (
              <InstructionItem
                key={instruction.id}
                instruction={instruction}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </Accordion>
        </section>
      )}
      <Outlet />
    </PageLayout>
  )
}
