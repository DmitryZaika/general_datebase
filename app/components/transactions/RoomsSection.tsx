import { Loader2, Pencil } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ActionDropdown } from '~/components/molecules/DataTable/ActionDropdown'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '~/components/ui/table'
import type { SaleSlab } from '~/types/sales'

type RoomEntry = { id: string; name: string; slabs: SaleSlab[]; isLocal: boolean }

interface RoomsSectionProps {
  roomEntries: RoomEntry[]
  slabsCount: number
  localRoomsCount: number
  onRenameRoom: (id: string, name: string) => void
  onRemoveLocalRoom: (id: string) => void
  onAddRoom: (name: string) => void
  newRoomName: string
  onNewRoomNameChange: (value: string) => void
  handleCut: (slab: SaleSlab) => void
  openReplace: (slab: SaleSlab) => void
  handleRemove: (slab: SaleSlab) => void
  formatDate: (value: string) => string
  onReplaceBlocked: () => void
  onUpdateRoomSquareFeet: (
    roomId: string,
    slabId: number,
    squareFeet: number | null,
  ) => void
  savingRoomId: string | null
  openPartial: (slab: SaleSlab) => void
}

export function RoomsSection({
  roomEntries,
  slabsCount,
  localRoomsCount,
  onRenameRoom,
  onRemoveLocalRoom,
  onAddRoom,
  newRoomName,
  onNewRoomNameChange,
  handleCut,
  openReplace,
  handleRemove,
  formatDate,
  onReplaceBlocked,
  onUpdateRoomSquareFeet,
  savingRoomId,
  openPartial,
}: RoomsSectionProps) {
  const isEmpty = slabsCount === 0 && localRoomsCount === 0
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      if (editingRoomId) inputRef.current?.select()
    }, 0)
    return () => clearTimeout(timer)
  }, [editingRoomId])

  return (
    <>
      {isEmpty ? (
        <p className='text-muted-foreground text-center py-8'>No slabs in this transaction</p>
      ) : (
        <>
          {roomEntries.map((roomEntry, idx) => {
            const roomName = roomEntry.name
            const roomSlabs = roomEntry.slabs
            const isLocalOnly = roomEntry.isLocal && roomSlabs.length === 0
            const roomSquareFeet = roomSlabs[0]?.square_feet ?? null
            const isEditing = editingRoomId === roomEntry.id
            const isSaving = savingRoomId === roomEntry.id
            return (
              <div key={roomEntry.id} className={idx > 0 ? 'mt-6' : ''}>
                <div className='rounded-md border overflow-hidden'>
                  <div className='bg-muted px-4 font-semibold flex items-center justify-between'>
                    {isLocalOnly ? (
                      <input
                        id={`room-input-${roomName}`}
                        value={roomName}
                        onChange={e => {
                          const next = e.target.value
                          onRenameRoom(roomEntry.id, next)
                        }}
                        className='bg-transparent outline-none border-b border-transparent focus:border-foreground text-sm font-semibold flex-1'
                      />
                    ) : (
                      <span>{roomName.charAt(0).toUpperCase() + roomName.slice(1)}</span>
                    )}
                    {isLocalOnly && (
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        className='h-8 w-8 text-muted-foreground hover:text-foreground'
                        onClick={() => onRemoveLocalRoom(roomEntry.id)}
                      >
                        ×
                      </Button>
                    )}
                  </div>
                  <div className='px-4 py-2 text-sm text-muted-foreground flex items-center gap-2'>
                    <span>Total sqft per room:</span>
                    {roomSlabs.length === 0 ? (
                      <span>-</span>
                    ) : isEditing ? (
                      <div className='flex items-center gap-2'>
                        <Input
                          ref={inputRef}
                          value={editingValue}
                          onChange={e => setEditingValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              const value = editingValue.trim()
                              const parsed = value === '' ? null : Number.parseFloat(value)
                              if (parsed !== null && Number.isNaN(parsed)) return
                              onUpdateRoomSquareFeet(roomEntry.id, roomSlabs[0].id, parsed)
                              setEditingRoomId(null)
                            }
                          }}
                          className='h-8 w-13 p-1'
                          autoFocus
                          disabled={isSaving}
                        />
                        <Button
                          type='button'
                          size='sm'
                          onClick={() => {
                            const value = editingValue.trim()
                            const parsed = value === '' ? null : Number.parseFloat(value)
                            if (parsed !== null && Number.isNaN(parsed)) return
                            onUpdateRoomSquareFeet(roomEntry.id, roomSlabs[0].id, parsed)
                            setEditingRoomId(null)
                          }}
                          disabled={isSaving}
                        >
                          Save
                        </Button>
                        <Button
                          type='button'
                          size='icon'
                          variant='ghost'
                          className='h-8 w-8'
                          onClick={() => {
                            setEditingRoomId(null)
                            setEditingValue('')
                          }}
                          disabled={isSaving}
                        >
                          ×
                        </Button>
                        {isSaving && <Loader2 className='h-4 w-4 animate-spin text-foreground' />}
                      </div>
                    ) : (
                      <div className='flex items-center gap-2'>
                        <span className='font-medium text-foreground'>
                          {roomSquareFeet ?? '-'}
                        </span>
                        <Button
                          type='button'
                          size='icon'
                          variant='ghost'
                          className='h-8 w-8'
                          onClick={() => {
                            setEditingRoomId(roomEntry.id)
                            setEditingValue(
                              roomSquareFeet === null ? '' : String(roomSquareFeet),
                            )
                          }}
                          disabled={isSaving}
                        >
                          <Pencil className='h-4 w-4' />
                        </Button>
                        {isSaving && <Loader2 className='h-4 w-4 animate-spin text-foreground' />}
                      </div>
                    )}
                  </div>
                  <Table>
                    <colgroup>
                      <col style={{ width: '14%' }} />
                      <col style={{ width: '26%' }} />
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '20%' }} />
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '16%' }} />
                    </colgroup>
                    <TableHeader>
                      <TableRow>
                        <TableHead className='px-4'>Bundle</TableHead>
                        <TableHead>Stone</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead>Cut Date</TableHead>
                        <TableHead className='text-right'>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {roomSlabs.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className='text-center text-sm text-muted-foreground py-4'>
                            No slabs in this room
                          </TableCell>
                        </TableRow>
                      )}
                      {roomSlabs.map(slab => (
                        <TableRow key={slab.id}>
                          <TableCell className='font-medium px-4'>{slab.bundle}</TableCell>
                          <TableCell>
                            {slab.stone_name}
                            {(slab.parent_id !== null || slab.child_count > 0) && ' (Partial)'}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={slab.cut_date ? 'secondary' : 'outline'}
                              className={
                                slab.cut_date
                                  ? 'bg-blue-100 text-blue-800 hover:bg-blue-100'
                                  : 'bg-green-100 text-green-800 hover:bg-green-100 border-transparent'
                              }
                            >
                              {slab.cut_date ? 'Cut' : 'Uncut'}
                            </Badge>
                          </TableCell>
                          <TableCell className='max-w-[200px] truncate' title={slab.notes || ''}>
                            {slab.notes || '-'}
                          </TableCell>
                          <TableCell>{slab.cut_date ? formatDate(slab.cut_date) : '-'}</TableCell>
                          <TableCell className='text-right'>
                            <ActionDropdown
                            actions={{
                              [slab.cut_date ? 'uncut' : 'cut']: '#',
                              ...(slab.cut_date ? {} : { partial: '#' }),
                              replace: '#',
                              remove: '#',
                            }}
                              onItemClick={(action, _link, e) => {
                                e.preventDefault()
                                if (action === 'cut' || action === 'uncut') handleCut(slab)
                                if (action === 'replace') {
                                  if (slab.cut_date) {
                                    onReplaceBlocked()
                                    return false
                                  }
                                  openReplace(slab)
                                }
                          if (action === 'partial') openPartial(slab)
                                if (action === 'remove') handleRemove(slab)
                                return false
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )
          })}
        </>
      )}
      <div className='mt-4 flex items-center gap-2'>
        <Input
          value={newRoomName}
          onChange={e => onNewRoomNameChange(e.target.value)}
          placeholder='New room name'
          className='max-w-xs'
        />
        <Button
          size='sm'
          variant='outline'
          onClick={() => {
            const name = newRoomName.trim()
            if (!name) return
            onAddRoom(name)
          }}
        >
          Add Room
        </Button>
      </div>
    </>
  )
}

