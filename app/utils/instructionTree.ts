export interface InstructionRow {
  id: number
  title: string
  parent_id: number | null
  after_id: number | null
  rich_text: string
}

export interface InstructionNode {
  id: number
  title: string
  parent_id: number | null
  after_id: number | null
  rich_text: string
  children: InstructionNode[]
}

export function orderByAfterId<T extends { id: number; after_id: number | null }>(
  items: T[],
): T[] {
  if (items.length === 0) return []

  const ordered: T[] = []
  const visited = new Set<number>()

  let current: T | null = items.find(item => item.after_id === null) ?? null
  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    ordered.push(current)
    current = items.find(item => item.after_id === current?.id) ?? null
  }

  for (const item of items) {
    if (!visited.has(item.id)) {
      ordered.push(item)
    }
  }

  return ordered
}

export function buildInstructionTree(
  instructions: InstructionRow[],
): InstructionNode[] {
  const nodeMap = new Map<number, InstructionNode>()
  for (const item of instructions) {
    nodeMap.set(item.id, {
      id: item.id,
      title: item.title,
      parent_id: item.parent_id,
      after_id: item.after_id,
      rich_text: item.rich_text,
      children: [],
    })
  }

  const byParent = new Map<number | null, InstructionRow[]>()
  for (const item of instructions) {
    const parentKey = item.parent_id
    const siblings = byParent.get(parentKey) ?? []
    siblings.push(item)
    byParent.set(parentKey, siblings)
  }

  const buildLevel = (parentId: number | null): InstructionNode[] => {
    const siblings = byParent.get(parentId) ?? []
    const ordered = orderByAfterId(siblings)
    const nodes: InstructionNode[] = []

    for (const row of ordered) {
      const node = nodeMap.get(row.id)
      if (!node) continue
      node.children = buildLevel(row.id)
      nodes.push(node)
    }

    return nodes
  }

  return buildLevel(null)
}

export function orderedIdsToAfterIds(
  orderedIds: number[],
): { id: number; after_id: number | null }[] {
  return orderedIds.map((id, index) => ({
    id,
    after_id: index === 0 ? null : orderedIds[index - 1],
  }))
}

export function applySiblingReorder(
  instructions: InstructionRow[],
  parentId: number | null,
  orderedIds: number[],
): InstructionRow[] {
  const updates = orderedIdsToAfterIds(orderedIds)
  const updateMap = new Map(updates.map(update => [update.id, update.after_id]))

  return instructions.map(item => {
    if (item.parent_id === parentId && updateMap.has(item.id)) {
      const afterId = updateMap.get(item.id)
      if (afterId === undefined) return item
      return { ...item, after_id: afterId }
    }
    return item
  })
}
