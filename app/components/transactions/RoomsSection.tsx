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
  allRooms: string[]
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
}

export function RoomsSection({
  roomEntries,
  slabsCount,
  localRoomsCount,
  allRooms,
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
}: RoomsSectionProps) {
  const isEmpty = slabsCount === 0 && localRoomsCount === 0

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

