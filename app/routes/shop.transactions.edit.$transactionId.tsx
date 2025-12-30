import { Calendar, MapPin, User, UserCircle } from 'lucide-react'
import { type ChangeEvent, useEffect, useMemo, useState } from 'react'
import {
    type ActionFunctionArgs,
    data,
    type LoaderFunctionArgs,
    Outlet,
    useFetcher,
    useLoaderData,
    useLocation,
    useNavigate,
} from 'react-router'
import {
    AddSlabDialog,
    type RoomOption,
} from '~/components/transactions/AddSlabDialogTransactions'
import { ReplaceDialog } from '~/components/transactions/ReplaceDialog'
import { RoomsSection } from '~/components/transactions/RoomsSection'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { db } from '~/db.server'
import { useToast } from '~/hooks/use-toast'
import { commitSession, getSession } from '~/sessions.server'
import type { SaleDetails, SaleSink, SaleSlab } from '~/types/sales'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'
import { forceRedirectError, toastData } from '~/utils/toastHelpers.server'

function formatDate(dateString: string) {
  if (!dateString) return ''
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

const normalizeRoomName = (value: string | null | undefined) => value?.trim() || 'Room'
const roomKeyFromSlab = (slab: Pick<SaleSlab, 'room' | 'room_uuid'>) =>
  slab.room_uuid ?? `name:${normalizeRoomName(slab.room).toLowerCase()}`
const roomKeyFromSink = (sink: Pick<SaleSink, 'room' | 'room_uuid'>) =>
  sink.room_uuid ?? `name:${normalizeRoomName(sink.room).toLowerCase()}`

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await getEmployeeUser(request)
  if (!params.transactionId) {
    return forceRedirectError(request.headers, 'No transaction ID provided')
  }

  const saleId = parseInt(params.transactionId, 10)
  if (Number.isNaN(saleId)) {
    return forceRedirectError(request.headers, 'Invalid transaction ID format')
  }

  const checkSales = await selectMany<{ id: number; company_id: number }>(
    db,
    `SELECT id, company_id FROM sales WHERE id = ?`,
    [saleId],
  )

  if (checkSales.length === 0) {
    return forceRedirectError(request.headers, 'Transaction does not exist in database')
  }

  if (checkSales[0].company_id !== user.company_id) {
    return forceRedirectError(
      request.headers,
      'Transaction belongs to different company',
    )
  }

  const sales = await selectMany<SaleDetails>(
    db,
    `SELECT
      s.id, s.customer_id, c.name as customer_name,
      s.sale_date, s.seller_id, u.name as seller_name, s.project_address
     FROM sales s
     JOIN customers c ON s.customer_id = c.id
     JOIN users u ON s.seller_id = u.id
     WHERE s.id = ? AND s.company_id = ?`,
    [saleId, user.company_id],
  )

  const sale = sales[0]
  if (!sale) {
    return forceRedirectError(
      request.headers,
      'Transaction details could not be retrieved',
    )
  }

  const slabs = await selectMany<SaleSlab>(
    db,
    `SELECT
      slab_inventory.id,
      slab_inventory.stone_id,
      slab_inventory.bundle,
      stones.name as stone_name,
      slab_inventory.cut_date,
      slab_inventory.notes,
      slab_inventory.square_feet,
      slab_inventory.length,
      slab_inventory.width,
      HEX(slab_inventory.room_uuid) as room_uuid,
      slab_inventory.room,
      slab_inventory.parent_id,
      (SELECT COUNT(*) FROM slab_inventory c WHERE c.parent_id = slab_inventory.id AND c.deleted_at IS NULL) as child_count
     FROM slab_inventory
     JOIN stones ON slab_inventory.stone_id = stones.id
     WHERE slab_inventory.sale_id = ?
     ORDER BY slab_inventory.id`,
    [saleId],
  )

  const sinks = await selectMany<SaleSink>(
    db,
    `SELECT
      sinks.id,
      sinks.sink_type_id,
      sink_type.name,
      sinks.price,
      sinks.is_deleted,
      sinks.slab_id,
      slab_inventory.room,
      HEX(slab_inventory.room_uuid) as room_uuid
     FROM sinks
     JOIN sink_type ON sinks.sink_type_id = sink_type.id
     JOIN slab_inventory ON sinks.slab_id = slab_inventory.id
     WHERE slab_inventory.sale_id = ? AND sinks.is_deleted = 0
     ORDER BY sinks.id`,
    [saleId],
  )

  return {
    sale,
    slabs,
    sinks,
    companyId: user.company_id,
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  await getEmployeeUser(request)
  if (!params.transactionId) {
    return forceRedirectError(request.headers, 'No transaction ID provided')
  }

  const saleId = parseInt(params.transactionId, 10)
  if (Number.isNaN(saleId)) {
    return forceRedirectError(request.headers, 'Invalid transaction ID format')
  }

  const formData = await request.formData()
  const intent = formData.get('intent')
  if (intent === 'cut-slab') {
    const slabIdValue = formData.get('slabId')
    const slabId = typeof slabIdValue === 'string' ? Number(slabIdValue) : 0
    if (!slabId || !Number.isFinite(slabId)) {
      return null
    }

    const slabs = await selectMany<{
      id: number
      sale_id: number
      cut_date: string | null
    }>(
      db,
      `SELECT id, sale_id, cut_date FROM slab_inventory WHERE id = ? AND sale_id = ?`,
      [slabId, saleId],
    )

    if (slabs.length === 0) {
      return null
    }

    if (slabs[0].cut_date === null) {
      await db.execute(
        `UPDATE slab_inventory SET cut_date = CURRENT_TIMESTAMP WHERE id = ?`,
        [slabId],
      )
      const session = await getSession(request.headers.get('Cookie'))
      session.flash('message', toastData('Success', 'Slab marked as cut'))
      return data(
        { success: true },
        {
          headers: { 'Set-Cookie': await commitSession(session) },
        },
      )
    }
  } else if (intent === 'uncut-slab') {
    const slabIdValue = formData.get('slabId')
    const slabId = typeof slabIdValue === 'string' ? Number(slabIdValue) : 0
    if (!slabId || !Number.isFinite(slabId)) {
      return null
    }

    const slabs = await selectMany<{
      id: number
      sale_id: number
      cut_date: string | null
      stone_id: number
      parent_id: number | null
      length: number
      width: number
    }>(
      db,
      `SELECT id, sale_id, cut_date, stone_id, parent_id, length, width FROM slab_inventory WHERE id = ? AND sale_id = ?`,
      [slabId, saleId],
    )

    if (slabs.length === 0) {
      return null
    }

    if (slabs[0].cut_date !== null) {
      await db.execute(`UPDATE slab_inventory SET cut_date = NULL WHERE id = ?`, [slabId])
      
      let targetLength: number
      let targetWidth: number

      if (slabs[0].parent_id) {
        targetLength = slabs[0].length
        targetWidth = slabs[0].width

        await db.execute(
          `UPDATE slab_inventory SET length = ?, width = ? WHERE id = ?`,
          [targetLength, targetWidth, slabs[0].parent_id],
        )
      } else {
        const stoneInfo = await selectMany<{ length: number; width: number }>(
          db,
          `SELECT length, width FROM stones WHERE id = ?`,
          [slabs[0].stone_id],
        )
        if (stoneInfo.length > 0) {
          targetLength = stoneInfo[0].length
          targetWidth = stoneInfo[0].width
        } else {
          targetLength = slabs[0].length
          targetWidth = slabs[0].width
        }
      }

      const children = await selectMany<{ id: number; sale_id: number | null }>(
        db,
        `SELECT id, sale_id FROM slab_inventory WHERE parent_id = ? ORDER BY id ASC`,
        [slabId],
      )

      const soldChildren = children.filter(c => c.sale_id !== null)
      const unsoldChildren = children.filter(c => c.sale_id === null)

      if (soldChildren.length > 0) {
        for (const child of soldChildren) {
          await db.execute(
            `UPDATE slab_inventory SET length = ?, width = ? WHERE id = ?`,
            [targetLength, targetWidth, child.id],
          )
        }
        if (unsoldChildren.length > 0) {
          await db.execute(
            `DELETE FROM slab_inventory WHERE parent_id = ? AND sale_id IS NULL`,
            [slabId],
          )
        }
      } else if (unsoldChildren.length > 0) {
        const firstChildId = unsoldChildren[0].id
        await db.execute(
          `UPDATE slab_inventory SET length = ?, width = ? WHERE id = ?`,
          [targetLength, targetWidth, firstChildId],
        )

        if (unsoldChildren.length > 1) {
          await db.execute(
            `DELETE FROM slab_inventory WHERE parent_id = ? AND sale_id IS NULL AND id != ?`,
            [slabId, firstChildId],
          )
        }
      }

      const session = await getSession(request.headers.get('Cookie'))
      session.flash('message', toastData('Success', 'Slab marked as uncut'))
      return data(
        { success: true },
        {
          headers: { 'Set-Cookie': await commitSession(session) },
        },
      )
    }
  } else if (intent === 'remove-slab') {
    const slabIdValue = formData.get('slabId') ?? formData.get('id')
    const slabId = typeof slabIdValue === 'string' ? Number(slabIdValue) : 0
    if (!slabId || !Number.isFinite(slabId)) {
      return null
    }
    await db.execute(
      `DELETE FROM slab_inventory WHERE parent_id = ? AND sale_id IS NULL`,
      [slabId],
    )
    await db.execute(
      `UPDATE slab_inventory
         SET sale_id = NULL,
             notes = NULL,
             price = NULL,
             square_feet = NULL,
             cut_date = NULL,
             room = NULL,
             waterfall = NULL,
             corbels = NULL,
             seam = NULL,
             stove = NULL,
             extras = NULL,
             room_uuid = NULL,
             edge = NULL,
             backsplash = NULL,
             tear_out = NULL,
             ten_year_sealer = NULL
       WHERE id = ? AND sale_id = ?`,
      [slabId, saleId],
    )
    const session = await getSession(request.headers.get('Cookie'))
    session.flash('message', toastData('Success', 'Slab removed from sale'))
    return data(
      { success: true },
      {
        headers: { 'Set-Cookie': await commitSession(session) },
      },
    )
  } else if (intent === 'remove-room') {
    const room = formData.get('room') as string
    if (!room) return null
    const session = await getSession(request.headers.get('Cookie'))
    await db.execute(
      `UPDATE slab_inventory
         SET room = NULL
       WHERE sale_id = ? AND room = ?`,
      [saleId, room],
    )
    session.flash('message', toastData('Success', `Room "${room}" removed`))
    return data(
      { success: true },
      {
        headers: { 'Set-Cookie': await commitSession(session) },
      },
    )
  } else if (intent === 'replace-slab') {
    const oldSlabId = Number(formData.get('oldSlabId'))
    const newSlabId = Number(formData.get('newSlabId'))
    if (!oldSlabId || !newSlabId) return null

    const oldSlab = await selectMany<{
      notes: string | null
      price: number | null
      square_feet: number | null
      cut_date: string | null
      room: string | null
      room_uuid: string | null
      seam: string | null
      backsplash: string | null
      tear_out: string | null
      stove: string | null
      ten_year_sealer: string | null
      waterfall: string | null
      corbels: string | null
      extras: string | null
      edge: string | null
    }>(
      db,
      `SELECT notes, price, square_feet, cut_date, room, room_uuid, seam, backsplash, tear_out, stove, ten_year_sealer, waterfall, corbels, extras, edge
         FROM slab_inventory
        WHERE id = ? AND sale_id = ?`,
      [oldSlabId, saleId],
    )

    const template = oldSlab[0] ?? {}

    await db.execute(
      `UPDATE slab_inventory
         SET sale_id = ?,
             room = ?,
             room_uuid = ?,
             seam = ?,
             backsplash = ?,
             tear_out = ?,
             square_feet = ?,
             stove = ?,
             ten_year_sealer = ?,
             waterfall = ?,
             corbels = ?,
             price = ?,
             extras = ?,
             edge = ?,
             notes = ?,
             cut_date = ?
       WHERE id = ? AND sale_id IS NULL`,
      [
        saleId,
        template.room ?? null,
        template.room_uuid ?? null,
        template.seam ?? null,
        template.backsplash ?? null,
        template.tear_out ?? null,
        template.square_feet ?? null,
        template.stove ?? null,
        template.ten_year_sealer ?? null,
        template.waterfall ?? null,
        template.corbels ?? null,
        template.price ?? null,
        template.extras ?? null,
        template.edge ?? null,
        template.notes ?? null,
        template.cut_date ?? null,
        newSlabId,
      ],
    )

    await db.execute(
      `DELETE FROM slab_inventory WHERE parent_id = ? AND sale_id IS NULL`,
      [oldSlabId],
    )

    await db.execute(
      `UPDATE slab_inventory
         SET sale_id = NULL,
             notes = NULL,
             price = NULL,
             square_feet = NULL,
             cut_date = NULL,
             room = NULL,
             room_uuid = NULL,
             seam = NULL,
             backsplash = NULL,
             tear_out = NULL,
             stove = NULL,
             ten_year_sealer = NULL,
             waterfall = NULL,
             corbels = NULL,
             extras = NULL,
             edge = NULL
       WHERE id = ? AND sale_id = ?`,
      [oldSlabId, saleId],
    )

    const session = await getSession(request.headers.get('Cookie'))
    session.flash('message', toastData('Success', 'Slab replaced'))
    return data(
      { success: true },
      {
        headers: { 'Set-Cookie': await commitSession(session) },
      },
    )
  } else if (intent === 'partial-cut') {
    const slabIdValue = formData.get('slabId')
    const lengthRaw = formData.get('length')
    const widthRaw = formData.get('width')
    const addAnotherRaw = formData.get('addAnother')
    const replaceFirstRaw = formData.get('replaceFirst')
    const slabId = typeof slabIdValue === 'string' ? Number(slabIdValue) : 0
    const length =
      typeof lengthRaw === 'string' && lengthRaw.trim() !== ''
        ? Number.parseFloat(lengthRaw)
        : null
    const width =
      typeof widthRaw === 'string' && widthRaw.trim() !== ''
        ? Number.parseFloat(widthRaw)
        : null
    const addAnother =
      typeof addAnotherRaw === 'string' ? Number(addAnotherRaw) === 1 : false
    const replaceFirst = typeof replaceFirstRaw === 'string' ? replaceFirstRaw === '1' : false

    if (!slabId || !Number.isFinite(slabId)) {
      return null
    }
    if (
      length === null ||
      width === null ||
      !Number.isFinite(length) ||
      !Number.isFinite(width) ||
      length <= 0 ||
      width <= 0
    ) {
      return null
    }
    const parent = await selectMany<{
      stone_id: number
      bundle: string
      url: string | null
      parent_id: number | null
      sale_id: number | null
      notes: string | null
      price: number | null
      square_feet: number | null
      room: string | null
      room_uuid: Buffer | null
      seam: string | null
      backsplash: string | null
      tear_out: string | null
      stove: string | null
      ten_year_sealer: string | null
      waterfall: string | null
      corbels: string | null
      extras: string | null
      edge: string | null
    }>(
      db,
      `SELECT stone_id, bundle, url, parent_id, sale_id, notes, price, square_feet, room, room_uuid, seam, backsplash, tear_out, stove, ten_year_sealer, waterfall, corbels, extras, edge
         FROM slab_inventory
        WHERE id = ? AND sale_id = ?`,
      [slabId, saleId],
    )
    if (parent.length === 0) return null

    const soldChild = await selectMany<{
      id: number
      stone_id: number
      bundle: string
      url: string | null
      parent_id: number | null
      notes: string | null
      price: number | null
      square_feet: number | null
      room: string | null
      room_uuid: Buffer | null
      seam: string | null
      backsplash: string | null
      tear_out: string | null
      stove: string | null
      ten_year_sealer: string | null
      waterfall: string | null
      corbels: string | null
      extras: string | null
      edge: string | null
      length: number
      width: number
      sale_id: number | null
      is_leftover: number
    }>(
      db,
      `SELECT
          si.id,
          si.stone_id,
          si.bundle,
          si.url,
          si.parent_id,
          si.notes,
          si.price,
          si.square_feet,
          si.room,
          si.room_uuid,
          si.seam,
          si.backsplash,
          si.tear_out,
          si.stove,
          si.ten_year_sealer,
          si.waterfall,
          si.corbels,
          si.extras,
          si.edge,
          si.length,
          si.width,
          si.sale_id,
          si.is_leftover
        FROM slab_inventory si
       WHERE si.parent_id = ?
         AND si.sale_id IS NOT NULL
         AND si.deleted_at IS NULL
         AND (
           SELECT COUNT(*)
             FROM slab_inventory c
            WHERE c.parent_id = si.id
              AND c.deleted_at IS NULL
         ) = 0
       ORDER BY si.id ASC
       LIMIT 1`,
      [slabId],
    )

    let actualParentInSale = null
    if (parent[0].parent_id) {
      const p = await selectMany<{
        id: number
        stone_id: number
        bundle: string
        url: string | null
        parent_id: number | null
        notes: string | null
        price: number | null
        square_feet: number | null
        room: string | null
        room_uuid: Buffer | null
        seam: string | null
        backsplash: string | null
        tear_out: string | null
        stove: string | null
        ten_year_sealer: string | null
        waterfall: string | null
        corbels: string | null
        extras: string | null
        edge: string | null
        length: number
        width: number
        sale_id: number | null
        is_leftover: number
      }>(
        db,
        `SELECT
            si.id,
            si.stone_id,
            si.bundle,
            si.url,
            si.parent_id,
            si.notes,
            si.price,
            si.square_feet,
            si.room,
            si.room_uuid,
            si.seam,
            si.backsplash,
            si.tear_out,
            si.stove,
            si.ten_year_sealer,
            si.waterfall,
            si.corbels,
            si.extras,
            si.edge,
            si.length,
            si.width,
            si.sale_id,
            si.is_leftover
           FROM slab_inventory si
          WHERE si.id = ?
            AND si.deleted_at IS NULL
            AND (
              SELECT COUNT(*)
              FROM slab_inventory c
              WHERE c.parent_id = si.id
                AND c.deleted_at IS NULL
                AND c.id != ?
            ) = 0`,
        [parent[0].parent_id, slabId],
      )
      if (p.length > 0) {
        actualParentInSale = p[0]
      }
    }

    let unsoldRelativesCount = 0
    if (parent[0].parent_id === null) {
      const unsoldChildren = await selectMany<{ count: number }>(
        db,
        `SELECT COUNT(*) as count FROM slab_inventory WHERE parent_id = ? AND sale_id IS NULL AND deleted_at IS NULL`,
        [slabId],
      )
      unsoldRelativesCount = unsoldChildren[0]?.count ?? 0
    } else {
      const unsoldSiblings = await selectMany<{ count: number }>(
        db,
        `SELECT COUNT(*) as count FROM slab_inventory WHERE parent_id = ? AND sale_id IS NULL AND id != ? AND deleted_at IS NULL`,
        [parent[0].parent_id, slabId],
      )
      unsoldRelativesCount += unsoldSiblings[0]?.count ?? 0

      const unsoldParent = await selectMany<{ count: number }>(
        db,
        `SELECT COUNT(*) as count FROM slab_inventory WHERE id = ? AND sale_id IS NULL AND deleted_at IS NULL`,
        [parent[0].parent_id],
      )
      unsoldRelativesCount += unsoldParent[0]?.count ?? 0
    }

    const soldTarget = soldChild[0] ?? actualParentInSale ?? (parent[0].sale_id ? { ...parent[0], id: slabId, sale_id: saleId, length: parent[0].length, width: parent[0].width, is_leftover: 0 } : null)
    const template = soldTarget ?? parent[0]

    const canUpdateSold = soldTarget && soldTarget.sale_id !== null && (soldTarget as { is_leftover: number }).is_leftover === 0 && unsoldRelativesCount === 0

    let handled = false
    if (replaceFirst || soldTarget) {
      if (canUpdateSold) {
        await db.execute(
          `UPDATE slab_inventory SET length = ?, width = ?, is_leftover = 1 WHERE id = ?`,
          [length, width, (soldTarget as { id: number }).id],
        )
        handled = true
      } else if (soldTarget && soldTarget.sale_id === null && !soldTarget.is_leftover) {
        await db.execute(
          `UPDATE slab_inventory SET length = ?, width = ?, is_leftover = 1 WHERE id = ?`,
          [length, width, (soldTarget as { id: number }).id],
        )
        handled = true
      } else if (replaceFirst) {
        const baseDims = await selectMany<{ length: number; width: number }>(
          db,
          `SELECT length, width FROM slab_inventory WHERE id = ?`,
          [slabId],
        )
        if (baseDims.length > 0) {
          const matchChild = await selectMany<{ id: number }>(
            db,
            `SELECT id FROM slab_inventory
             WHERE parent_id = ?
             AND sale_id IS NULL
             AND length = ?
             AND width = ?
             ORDER BY id ASC
             LIMIT 1`,
            [slabId, baseDims[0].length, baseDims[0].width],
          )
          if (matchChild.length > 0) {
            await db.execute(
              `UPDATE slab_inventory SET length = ?, width = ? WHERE id = ?`,
              [length, width, matchChild[0].id],
            )
            handled = true
          }
        }
      }
    }

    if (!handled) {
      const parentForNew = (soldTarget && soldTarget.sale_id === null) ? (soldTarget.parent_id ?? soldTarget.id) : slabId
      await db.execute(
        `INSERT INTO slab_inventory (
           stone_id,
           bundle,
           parent_id,
           sale_id,
           length,
           width,
           url,
           notes,
           price,
           square_feet,
           room,
           room_uuid,
           seam,
           backsplash,
           tear_out,
           stove,
           ten_year_sealer,
           waterfall,
           corbels,
           extras,
           edge,
           is_leftover
         )
         VALUES (
           ?,
           ?,
           ?,
           ?,
           ?,
           ?,
           ?,
           ?,
           ?,
           ?,
           ?,
           ?,
           ?,
           ?,
           ?,
           ?,
           ?,
           ?,
           ?,
           ?,
           ?,
           1
         )`,
        [
          template.stone_id,
          template.bundle,
          parentForNew,
          soldTarget && soldTarget.sale_id !== null ? soldTarget.sale_id : null,
          length,
          width,
          template.url ?? null,
          template.notes ?? null,
          template.price ?? null,
          template.square_feet ?? null,
          template.room ?? null,
          template.room_uuid ?? null,
          template.seam ?? null,
          template.backsplash ?? null,
          template.tear_out ?? null,
          template.stove ?? null,
          template.ten_year_sealer ?? null,
          template.waterfall ?? null,
          template.corbels ?? null,
          template.extras ?? null,
          template.edge ?? null,
        ],
      )
    }

    if (!addAnother) {
      await db.execute(
        `UPDATE slab_inventory SET cut_date = CURRENT_TIMESTAMP WHERE id = ? AND sale_id = ?`,
        [slabId, saleId],
      )
      const remaining = await selectMany<{ count: number }>(
        db,
        `SELECT COUNT(*) as count FROM slab_inventory WHERE sale_id = ? AND cut_date IS NULL AND deleted_at IS NULL`,
        [saleId],
      )
      const remainingCount = remaining[0]?.count ?? 0
      const status = remainingCount > 0 ? 'partially cut' : 'cut'
      await db.execute(`UPDATE sales SET status = ? WHERE id = ?`, [status, saleId])
    }
  } else if (intent === 'update-room-square-feet') {
    const slabIdValue = formData.get('slabId')
    const squareFeetRaw = formData.get('squareFeet')
    const slabId = typeof slabIdValue === 'string' ? Number(slabIdValue) : 0
    const squareFeet =
      typeof squareFeetRaw === 'string' && squareFeetRaw.trim() !== ''
        ? Number.parseFloat(squareFeetRaw)
        : null
    if (!slabId || !Number.isFinite(slabId)) {
      return null
    }
    if (squareFeet !== null && !Number.isFinite(squareFeet)) {
      return null
    }
    await db.execute(
      `UPDATE slab_inventory SET square_feet = ? WHERE id = ? AND sale_id = ?`,
      [squareFeet, slabId, saleId],
    )
  } else if (intent === 'add-slab') {
    const slabId = Number(formData.get('slabId'))
    const room = (formData.get('room') as string) || null
    const roomUuidRaw = formData.get('roomUuid')
    const roomUuid =
      typeof roomUuidRaw === 'string' && roomUuidRaw.trim() !== ''
        ? roomUuidRaw.trim()
        : null
    if (!slabId || !room) return null

    const templateQuery = roomUuid
      ? `SELECT room_uuid, seam, room, backsplash, tear_out, square_feet, stove, ten_year_sealer, waterfall, corbels, price, extras, edge
           FROM slab_inventory
          WHERE sale_id = ? AND HEX(room_uuid) = ?
          ORDER BY id
          LIMIT 1`
      : `SELECT room_uuid, seam, room, backsplash, tear_out, square_feet, stove, ten_year_sealer, waterfall, corbels, price, extras, edge
           FROM slab_inventory
          WHERE sale_id = ? AND (room = ? OR ? IS NULL)
          ORDER BY id
          LIMIT 1`

    const templateParams = roomUuid ? [saleId, roomUuid] : [saleId, room, room]

    type TemplateRow = {
      room_uuid: Buffer | null
      seam: string | null
      room: string | null
      backsplash: string | null
      tear_out: string | null
      square_feet: number | null
      stove: string | null
      ten_year_sealer: string | null
      waterfall: string | null
      corbels: string | null
      price: number | null
      extras: string | null
      edge: string | null
    }
    const templateRows = await selectMany<TemplateRow>(
      db,
      templateQuery,
      templateParams,
    )
    const template = templateRows[0] ?? null
    const roomUuidValue =
      template?.room_uuid ?? (roomUuid ? Buffer.from(roomUuid, 'hex') : null)

    await db.execute(
      `UPDATE slab_inventory
         SET sale_id = ?,
             room = ?,
             room_uuid = ?,
             seam = ?,
             backsplash = ?,
             tear_out = ?,
             square_feet = ?,
             stove = ?,
             ten_year_sealer = ?,
             waterfall = ?,
             corbels = ?,
             price = ?,
             extras = ?,
             edge = ?,
             notes = NULL,
             cut_date = NULL
       WHERE id = ? AND sale_id IS NULL`,
      [
        saleId,
        room,
        roomUuidValue,
        template?.seam ?? null,
        template?.backsplash ?? null,
        template?.tear_out ?? null,
        template?.square_feet ?? null,
        template?.stove ?? null,
        template?.ten_year_sealer ?? null,
        template?.waterfall ?? null,
        template?.corbels ?? null,
        template?.price ?? null,
        template?.extras ?? null,
        template?.edge ?? null,
        slabId,
      ],
    )
    const session = await getSession(request.headers.get('Cookie'))
    session.flash('message', toastData('Success', 'Slab added to sale'))
    return data(
      { success: true },
      {
        headers: { 'Set-Cookie': await commitSession(session) },
      },
    )
  } else {
    return null
  }

  const remaining = await selectMany<{ count: number }>(
    db,
    `SELECT COUNT(*) as count FROM slab_inventory WHERE sale_id = ? AND cut_date IS NULL AND deleted_at IS NULL`,
    [saleId],
  )

  const remainingCount = remaining[0]?.count ?? 0
  const status = remainingCount > 0 ? 'partially cut' : 'cut'
  await db.execute(`UPDATE sales SET status = ? WHERE id = ?`, [status, saleId])

  return null
}

export default function ViewTransaction() {
  const { sale, slabs, sinks, companyId } = useLoaderData<typeof loader>()
  const navigate = useNavigate()
  const location = useLocation()
  const [replaceDialogOpen, setReplaceDialogOpen] = useState(false)
  const [replaceTarget, setReplaceTarget] = useState<SaleSlab | null>(null)
  const [replaceOptions, setReplaceOptions] = useState<
    {
      id: number
      bundle: string
      is_leftover: boolean
      parent_id: number | null
      child_count: number
    }[]
  >([])
  const [replaceLoading, setReplaceLoading] = useState(false)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [addSearch, setAddSearch] = useState('')
  const [addStones, setAddStones] = useState<
    { id: number; name: string; url: string | null }[]
  >([])
  const [addStoneId, setAddStoneId] = useState<number | null>(null)
  const [addSlabs, setAddSlabs] = useState<
    {
      id: number
      bundle: string
      is_leftover: boolean
      parent_id?: number | null
      child_count?: number
    }[]
  >([])
  const [addLoading, setAddLoading] = useState(false)
  const [addSlabsLoading, setAddSlabsLoading] = useState(false)
  const [addRoom, setAddRoom] = useState<RoomOption | null>(null)
  const [newRoomName, setNewRoomName] = useState('')
  const openAddDialog = () => {
    const defaultStone = slabs[0]?.stone_name || ''
    setAddSearch(defaultStone)
    setAddStoneId(null)
    setAddSlabs([])
    setAddRoom(null)
    setAddDialogOpen(true)
  }
  const currentSlabIds = slabs.map(s => s.id)

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      navigate(`/employee/transactions${location.search}`)
    }
  }

  const slabsByRoom = useMemo(
    () =>
      slabs.reduce<
        Record<string, { name: string; slabs: SaleSlab[]; roomUuid: string | null }>
      >((acc, slab) => {
        const roomName = normalizeRoomName(slab.room)
        const key = roomKeyFromSlab(slab)
        if (!acc[key])
          acc[key] = { name: roomName, slabs: [], roomUuid: slab.room_uuid ?? null }
        acc[key].slabs.push(slab)
        return acc
      }, {}),
    [slabs],
  )
  const sinksByRoom = useMemo(
    () =>
      sinks.reduce<
        Record<string, { name: string; items: { name: string; count: number }[] }>
      >((acc, sink) => {
        const roomName = normalizeRoomName(sink.room)
        const key = roomKeyFromSink(sink)
        if (!acc[key]) acc[key] = { name: roomName, items: [] }
        const existing = acc[key].items.find(item => item.name === sink.name)
        if (existing) existing.count += 1
        else acc[key].items.push({ name: sink.name, count: 1 })
        return acc
      }, {}),
    [sinks],
  )
  const submitAction = async (
    payload: Record<string, string | number | null>,
    options?: { skipNavigate?: boolean },
  ) => {
    const formData = new FormData()
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== null && value !== undefined) formData.append(key, String(value))
    })
    await fetch(location.pathname + location.search, {
      method: 'POST',
      body: formData,
    })
    if (!options?.skipNavigate) {
      navigate(location.pathname + location.search, { replace: true })
    }
  }

  const handleCut = (slab: SaleSlab) => {
    submitAction({
      intent: slab.cut_date ? 'uncut-slab' : 'cut-slab',
      slabId: slab.id,
    })
  }

  const { toast } = useToast()
  type LocalRoom = { id: string; name: string }
  const [localRooms, setLocalRooms] = useState<LocalRoom[]>([])
  const [roomOrder, setRoomOrder] = useState<string[]>([])
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<SaleSlab | null>(null)
  const removeFetcher = useFetcher<typeof action>()
  const [savingRoomId, setSavingRoomId] = useState<string | null>(null)
  const [partialDialogOpen, setPartialDialogOpen] = useState(false)
  const [partialTarget, setPartialTarget] = useState<SaleSlab | null>(null)
  const [partialLength, setPartialLength] = useState('')
  const [partialWidth, setPartialWidth] = useState('')
  const [partialSubmitting, setPartialSubmitting] = useState(false)
  const [canReplaceFirst, setCanReplaceFirst] = useState(false)

  useEffect(() => {
    const slabRoomKeys = slabs.map(roomKeyFromSlab)
    const localIds = localRooms.map(r => r.id)
    setRoomOrder(prev => {
      const active = new Set([...slabRoomKeys, ...localIds])
      const next: string[] = []
      prev.forEach(key => {
        if (active.has(key) && !next.includes(key)) next.push(key)
      })
      slabRoomKeys.forEach(key => {
        if (!next.includes(key)) next.push(key)
      })
      localIds.forEach(key => {
        if (!next.includes(key)) next.push(key)
      })
      return next
    })
  }, [slabs, localRooms])

  const roomEntries = useMemo(() => {
    const items: {
      id: string
      name: string
      slabs: SaleSlab[]
      isLocal: boolean
      roomUuid: string | null
    }[] = []
    const addRoomEntry = (key: string) => {
      if (items.some(r => r.id === key)) return
      const slabRoom = slabsByRoom[key]
      if (slabRoom) {
        items.push({
          id: key,
          name: slabRoom.name,
          slabs: slabRoom.slabs,
          isLocal: false,
          roomUuid: slabRoom.roomUuid,
        })
        return
      }
      const local = localRooms.find(r => r.id === key)
      if (local) {
        items.push({
          id: local.id,
          name: local.name,
          slabs: [],
          isLocal: true,
          roomUuid: null,
        })
      }
    }
    roomOrder.forEach(addRoomEntry)
    Object.keys(slabsByRoom).forEach(addRoomEntry)
    localRooms.forEach(r => addRoomEntry(r.id))
    return items
  }, [roomOrder, slabsByRoom, localRooms])

  const allRooms = useMemo<RoomOption[]>(
    () => roomEntries.map(r => ({ id: r.id, name: r.name, roomUuid: r.roomUuid })),
    [roomEntries],
  )

  const handleRemove = (slab: SaleSlab) => {
    if (slabs.length <= 1) {
      toast({ title: 'Cannot remove last slab', variant: 'destructive' })
      return
    }
    setRemoveTarget(slab)
    setRemoveDialogOpen(true)
  }

  const handlePartialOpen = (slab: SaleSlab) => {
    setPartialTarget(slab)
    setPartialLength('')
    setPartialWidth('')
    setCanReplaceFirst((slab.child_count || 0) > 0)
    setPartialDialogOpen(true)
  }

  const handlePartialSubmit = async (addAnother: boolean) => {
    if (!partialTarget) return
    const lengthValue = partialLength.trim()
    const widthValue = partialWidth.trim()
    const lengthParsed = lengthValue === '' ? null : Number.parseFloat(lengthValue)
    const widthParsed = widthValue === '' ? null : Number.parseFloat(widthValue)
    if (
      lengthParsed === null ||
      widthParsed === null ||
      Number.isNaN(lengthParsed) ||
      Number.isNaN(widthParsed) ||
      lengthParsed <= 0 ||
      widthParsed <= 0
    )
      return
    setPartialSubmitting(true)
    try {
      await submitAction(
        {
          intent: 'partial-cut',
          slabId: partialTarget.id,
          length: lengthParsed,
          width: widthParsed,
          addAnother: addAnother ? 1 : 0,
          replaceFirst: canReplaceFirst ? '1' : '0',
        },
        { skipNavigate: addAnother },
      )
      if (addAnother) {
        setPartialLength('')
        setPartialWidth('')
        setCanReplaceFirst(false)
      } else {
        setPartialDialogOpen(false)
        setPartialTarget(null)
      }
    } finally {
      setPartialSubmitting(false)
    }
  }

  const handleUpdateRoomSquareFeet = async (
    roomId: string,
    slabId: number,
    squareFeet: number | null,
  ) => {
    setSavingRoomId(roomId)
    try {
      await submitAction({
        intent: 'update-room-square-feet',
        slabId,
        squareFeet: squareFeet === null ? '' : squareFeet,
      })
    } finally {
      setSavingRoomId(null)
    }
  }

  useEffect(() => {
    if (removeFetcher.state === 'idle' && removeFetcher.data?.success) {
      setRemoveDialogOpen(false)
      setRemoveTarget(null)
    }
  }, [removeFetcher.state, removeFetcher.data])

  const openReplace = async (slab: SaleSlab) => {
    setReplaceTarget(slab)
    setReplaceOptions([])
    setReplaceDialogOpen(true)
    setReplaceLoading(true)
    try {
      const res = await fetch(
        `/api/stones/${slab.stone_id}/slabs?exclude=${encodeURIComponent(
          JSON.stringify(currentSlabIds),
        )}`,
      )
      const json = await res.json()
      setReplaceOptions(json.slabs || [])
    } finally {
      setReplaceLoading(false)
    }
  }

  const handleReplaceChoose = async (newSlabId: number) => {
    if (!replaceTarget) return
    setReplaceDialogOpen(false)
    setReplaceTarget(null)
    await submitAction({
      intent: 'replace-slab',
      oldSlabId: replaceTarget.id,
      newSlabId,
    })
  }

  const searchAddStones = async (term: string) => {
    setAddLoading(true)
    try {
      const res = await fetch(
        `/api/stones/search/${companyId}?name=${encodeURIComponent(term)}&show_sold_out=true`,
      )
      const json = await res.json()
      setAddStones(json.stones || [])
    } finally {
      setAddLoading(false)
    }
  }

  const loadAddSlabs = async (stoneId: number) => {
    setAddSlabsLoading(true)
    try {
      const res = await fetch(
        `/api/stones/${stoneId}/slabs?exclude=${encodeURIComponent(
          JSON.stringify(currentSlabIds),
        )}`,
      )
      const json = await res.json()
      setAddSlabs(json.slabs || [])
    } finally {
      setAddSlabsLoading(false)
    }
  }

  const handleAddStoneSelect = (stoneId: number) => {
    setAddStoneId(stoneId)
    setAddSlabs([])
    loadAddSlabs(stoneId)
  }

  const resetAddDialog = () => {
    setAddDialogOpen(false)
    setAddStoneId(null)
    setAddSlabs([])
    setAddSearch('')
    setAddRoom(null)
  }

  const handleAddSlab = async (slabId: number) => {
    if (!addRoom) return
    await submitAction({
      intent: 'add-slab',
      slabId,
      room: addRoom.name,
      roomUuid: addRoom.roomUuid ?? null,
    })
    setLocalRooms(prev => prev.filter(r => r.id !== addRoom.id))
    resetAddDialog()
  }

  const handleRenameRoom = (id: string, name: string) => {
    setLocalRooms(prev => prev.map(r => (r.id === id ? { ...r, name } : r)))
  }

  const handleRemoveLocalRoom = (id: string) => {
    setLocalRooms(prev => prev.filter(r => r.id !== id))
  }

  const handleAddRoom = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const id = `${Date.now()}-${Math.random()}`
    setLocalRooms(prev => [...prev, { id, name: trimmed }])
    setRoomOrder(prev => (prev.includes(id) ? prev : [...prev, id]))
    setNewRoomName('')
  }

  useEffect(() => {
    if (!addDialogOpen || !addRoom) return
    const term = addSearch.trim()
    if (!term) {
      setAddStones([])
      return
    }
    const timer = setTimeout(() => {
      searchAddStones(term)
    }, 250)
    return () => clearTimeout(timer)
  }, [addSearch, addDialogOpen, addRoom])

  return (
    <Dialog open={true} onOpenChange={handleDialogClose}>
      <DialogContent className='min-w-[500px] max-w-6xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>Transaction Details</DialogTitle>
        </DialogHeader>

        <div className='flex flex-col gap-6 py-4'>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-6 items-start'>
            <Card>
              <CardHeader className='pb-2'>
                <CardTitle className='text-lg font-semibold flex items-center gap-2'>
                  Sale Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='grid gap-4 text-sm'>
                  <div className='flex items-center justify-between border-b pb-2 last:border-0 last:pb-0'>
                    <div className='flex items-center gap-2 text-muted-foreground'>
                      <User className='h-4 w-4' />
                      <span>Customer</span>
                    </div>
                    <span className='font-medium'>{sale.customer_name}</span>
                  </div>
                  <div className='flex items-center justify-between border-b pb-2 last:border-0 last:pb-0'>
                    <div className='flex items-center gap-2 text-muted-foreground'>
                      <Calendar className='h-4 w-4' />
                      <span>Sale Date</span>
                    </div>
                    <span className='font-medium'>{formatDate(sale.sale_date)}</span>
                  </div>
                  <div className='flex items-center justify-between border-b pb-2 last:border-0 last:pb-0'>
                    <div className='flex items-center gap-2 text-muted-foreground'>
                      <UserCircle className='h-4 w-4' />
                      <span>Sold By</span>
                    </div>
                    <span className='font-medium'>{sale.seller_name}</span>
                  </div>
                  <div className='flex items-center justify-between border-b pb-2 last:border-0 last:pb-0'>
                    <div className='flex items-center gap-2 text-muted-foreground'>
                      <MapPin className='h-4 w-4' />
                      <span>Project Address</span>
                    </div>
                    <span className='font-medium text-right'>
                      {sale.project_address || 'No address'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className='pb-2'>
                <CardTitle className='text-lg font-semibold'>Room Sinks</CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(sinksByRoom).length === 0 ? (
                  <p className='text-sm text-muted-foreground py-2'>No sinks</p>
                ) : (
                  <div className='space-y-2'>
                    {Object.entries(sinksByRoom).map(([roomId, room]) => (
                      <div key={roomId} className='flex justify-between items-center'>
                        <span className='font-semibold'>
                          {room.name.charAt(0).toUpperCase() + room.name.slice(1)}
                        </span>
                        <div className='flex flex-wrap gap-2 text-sm text-muted-foreground justify-end'>
                          {room.items.map(item => (
                            <span
                              key={item.name}
                              className='px-2 py-1 rounded bg-muted'
                            >
                              {item.name}
                              {item.count > 1 ? ` x${item.count}` : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-lg font-semibold'>Rooms</CardTitle>
            </CardHeader>
            <CardContent>
              <RoomsSection
                roomEntries={roomEntries}
                slabsCount={slabs.length}
                localRoomsCount={localRooms.length}
                onRenameRoom={handleRenameRoom}
                onRemoveLocalRoom={handleRemoveLocalRoom}
                onAddRoom={handleAddRoom}
                newRoomName={newRoomName}
                onNewRoomNameChange={setNewRoomName}
                handleCut={handleCut}
                openReplace={openReplace}
                handleRemove={handleRemove}
                formatDate={formatDate}
                onReplaceBlocked={() =>
                  toast({
                    title: 'Uncut slab before replace',
                    variant: 'destructive',
                  })
                }
                onUpdateRoomSquareFeet={handleUpdateRoomSquareFeet}
                savingRoomId={savingRoomId}
                openPartial={handlePartialOpen}
              />
            </CardContent>
          </Card>
        </div>

        <div className='flex justify-end mt-4 gap-2'>
          <Button onClick={openAddDialog}>Add Slab</Button>
          <Button
            variant='outline'
            onClick={() => navigate(`/employee/transactions${location.search}`)}
          >
            Close
          </Button>
        </div>
      </DialogContent>
      <ReplaceDialog
        open={replaceDialogOpen}
        onOpenChange={setReplaceDialogOpen}
        target={replaceTarget}
        options={replaceOptions}
        loading={replaceLoading}
        onChoose={handleReplaceChoose}
      />
      {partialDialogOpen && partialTarget && (
        <Dialog
          open={partialDialogOpen}
          onOpenChange={open => {
            setPartialDialogOpen(open)
            if (!open) {
              setPartialTarget(null)
              setPartialLength('')
              setPartialWidth('')
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mark as partially cut</DialogTitle>
              <p className='text-sm text-muted-foreground'>
                What are the leftover dimensions for slab {partialTarget.bundle}?
              </p>
            </DialogHeader>
            <div className='space-y-3'>
              <div className='grid grid-cols-2 gap-2'>
                <Input
                  type='number'
                  min='0'
                  step='0.01'
                  value={partialLength}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setPartialLength(e.target.value)
                  }
                  disabled={partialSubmitting}
                  placeholder='Length'
                />
                <Input
                  type='number'
                  min='0'
                  step='0.01'
                  value={partialWidth}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setPartialWidth(e.target.value)
                  }
                  disabled={partialSubmitting}
                  placeholder='Width'
                />
              </div>
              <div className='flex justify-end gap-2'>
                <Button
                  type='button'
                  variant='outline'
                  disabled={partialSubmitting}
                  onClick={() => handlePartialSubmit(true)}
                >
                  More left overs
                </Button>
                <Button
                  type='button'
                  disabled={partialSubmitting}
                  onClick={() => handlePartialSubmit(false)}
                >
                  Done
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
      <AddSlabDialog
        open={addDialogOpen}
        onOpenChange={open => (open ? setAddDialogOpen(true) : resetAddDialog())}
        addRoom={addRoom}
        allRooms={allRooms}
        addSearch={addSearch}
        setAddSearch={setAddSearch}
        addLoading={addLoading}
        addStones={addStones}
        addStoneId={addStoneId}
        onSelectStone={handleAddStoneSelect}
        addSlabs={addSlabs}
        addSlabsLoading={addSlabsLoading}
        onSelectSlab={handleAddSlab}
        onSelectRoom={setAddRoom}
      />
      {removeDialogOpen && removeTarget && (
        <Dialog
          open={removeDialogOpen}
          onOpenChange={open => {
            setRemoveDialogOpen(open)
            if (!open) setRemoveTarget(null)
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove Slab</DialogTitle>
              <p className='text-sm text-muted-foreground'>
                Are you sure you want to remove slab {removeTarget.bundle} from this
                sale?
              </p>
            </DialogHeader>
            <div className='flex justify-end gap-2'>
              <Button
                variant='outline'
                onClick={() => {
                  setRemoveDialogOpen(false)
                  setRemoveTarget(null)
                }}
              >
                Cancel
              </Button>
              <removeFetcher.Form method='post'>
                <input type='hidden' name='intent' value='remove-slab' />
                <input type='hidden' name='slabId' value={removeTarget.id} />
                <Button type='submit' variant='destructive' autoFocus>
                  Delete
                </Button>
              </removeFetcher.Form>
            </div>
          </DialogContent>
        </Dialog>
      )}
      <Outlet />
    </Dialog>
  )
}
