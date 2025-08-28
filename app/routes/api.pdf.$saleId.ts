import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { type ActionFunctionArgs, redirect } from 'react-router'
import { db } from '~/db.server'
import { extrasSchema, type TExtrasSchema } from '~/schemas/sales'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'

interface IQuery {
  customer_name: string | null
  seller_name: string | null
  sale_date: Date | null
  project_address: string | null
  phone: string | null
  email: string | null
  room: string | null
  edge_type: string | null
  backsplash: string | null
  stone_name: string | null
  stone_id: string | null
  total_price: number | null
  square_feet: string | null
  retail_price: string | null
  tear_out: string | null
  stove: string | null
  waterfall: string | null
  corbels: number | null
  seam: string | null
  zip_code: string | null
  extras: TExtrasSchema
  sale_extras: ISaleExtras[]
  company_name: string | null
  billing_address: string | null
  room_uuid: string
}

// legacy template urls removed; building PDF from scratch

const stoveText = {
  'f/s': 'F/S',
  's/i': 'S/I',
  'c/t': 'C/T',
  grill: 'Grill',
}

const seamText = {
  standard: 'STD',
  phantom: 'SPH',
  extended: 'EXT',
  european: 'EU',
  'n/a': 'N/A',
  'none!': 'NONE',
}

interface ICountQuery {
  name: string
  count: number
  room_uuid: string
}

interface ISinkQuery extends ICountQuery {
  type: string
  price: number | null
  retail_price: number | null
}

async function getSinks(saleId: number): Promise<ISinkQuery[]> {
  const query = `
    select
      sink_type.name as name,
      sink_type.type as type,
      count(sinks.id) as count,
      HEX(slab_inventory.room_uuid) as room_uuid,
      sinks.price as price,
      sink_type.retail_price as retail_price
    from sinks
    join slab_inventory on slab_inventory.id = sinks.slab_id
    join sink_type on sink_type.id = sinks.sink_type_id
    where slab_inventory.sale_id = ?
    group by sink_type.name, sink_type.type, slab_inventory.room_uuid, sinks.price, sink_type.retail_price
  `
  return await selectMany<ISinkQuery>(db, query, [saleId])
}

interface IFaucetQuery extends ICountQuery {
  type: string
  price: number | null
  retail_price: number | null
}

async function getFaucets(saleId: number): Promise<IFaucetQuery[]> {
  const query = `
    select
      faucet_type.name as name,
      faucet_type.type as type,
      count(faucets.id) as count,
      HEX(slab_inventory.room_uuid) as room_uuid,
      faucets.price as price,
      faucet_type.retail_price as retail_price
    from faucets
    join slab_inventory on slab_inventory.id = faucets.slab_id
    join faucet_type on faucet_type.id = faucets.faucet_type_id
    where slab_inventory.sale_id = ?
    group by faucet_type.name, faucet_type.type, slab_inventory.room_uuid, faucets.price, faucet_type.retail_price
  `
  return await selectMany<IFaucetQuery>(db, query, [saleId])
}

interface ISaleExtras {
  adjustment: string
  price: number
}

async function getData(saleId: number) {
  const query = `
        select
            sales.sale_date,
            sales.project_address,
            sales.price as total_price,
            sales.extras as sale_extras,
            customers.name as customer_name,
            customers.phone,
            customers.email,
            customers.postal_code as zip_code,
            users.name as seller_name,
            slab_inventory.room,
            slab_inventory.backsplash,
            slab_inventory.square_feet,
            slab_inventory.tear_out,
            slab_inventory.stove,
            slab_inventory.waterfall,
            slab_inventory.corbels,
            slab_inventory.seam,
            slab_inventory.extras,
            stones.name as stone_name,
            stones.id as stone_id,
            slab_inventory.price as retail_price,
            customers.company_name,
            customers.address as billing_address,
            HEX(slab_inventory.room_uuid) as room_uuid
        from sales
        join customers on customers.id = sales.customer_id
        join users on users.id = sales.seller_id
        join slab_inventory on slab_inventory.sale_id = sales.id
        join stones on stones.id = slab_inventory.stone_id
        where sales.id = ?
        order by slab_inventory.id
    `
  const response = await selectMany<IQuery & { sale_extras: ISaleExtras[] }>(
    db,
    query,
    [saleId],
  )
  return response.map(row => ({
    ...row,
    extras: extrasSchema.parse(row.extras || {}),
    sale_extras: row.sale_extras
      ? typeof row.sale_extras === 'string'
        ? JSON.parse(row.sale_extras)
        : row.sale_extras
      : [],
  }))
}

async function buildPdf(
  queryData: IQuery[],
  sinks: ISinkQuery[],
  faucets: IFaucetQuery[],
) {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([612, 792])
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const draw = (
    text: string,
    x: number,
    y: number,
    size = 10,
    isBold = false,
    color = rgb(0, 0, 0),
  ) => {
    page.drawText(text, { x, y, size, font: isBold ? bold : font, color })
  }

  const wrapText = (text: string, size: number, maxWidth: number): string[] => {
    if (!text) return []
    const words = text.split(/\s+/)
    const lines: string[] = []
    let line = ''
    for (const w of words) {
      const test = line ? `${line} ${w}` : w
      const width = font.widthOfTextAtSize(test, size)
      if (width <= maxWidth) {
        line = test
      } else {
        if (line) lines.push(line)
        if (font.widthOfTextAtSize(w, size) > maxWidth) {
          let cur = ''
          for (const ch of w) {
            const t = cur + ch
            if (font.widthOfTextAtSize(t, size) <= maxWidth) cur = t
            else {
              if (cur) lines.push(cur)
              cur = ch
            }
          }
          line = cur
        } else {
          line = w
        }
      }
    }
    if (line) lines.push(line)
    return lines
  }

  page.drawRectangle({
    x: 0,
    y: 742,
    width: 612,
    height: 50,
    color: rgb(0.1, 0.2, 0.35),
  })

  // Add logo on the left - simplified approach

  // Center "Granite Depot" text
  const companyText = 'Granite Depot'
  const textWidth = bold.widthOfTextAtSize(companyText, 20)
  const centerX = (612 - textWidth) / 2
  draw(companyText, centerX, 760, 20, true, rgb(1, 1, 1))

  const headerY = 720
  draw('Date', 24, headerY, 10, true)
  draw(
    queryData[0].sale_date ? queryData[0].sale_date.toLocaleDateString('en-US') : 'N/A',
    120,
    headerY,
  )
  draw('Sales Rep', 24, headerY - 16, 10, true)
  draw(queryData[0].seller_name || 'N/A', 120, headerY - 16)
  draw('Customer', 24, headerY - 32, 10, true)
  draw(queryData[0].customer_name || 'N/A', 120, headerY - 32)
  draw('Project Address', 24, headerY - 48, 10, true)
  const addr = queryData[0].project_address || 'N/A'
  const wrappedAddr = wrapText(addr, 10, 440)
  let addrConsumed = 0
  if (wrappedAddr.length > 0) {
    const lh = 12
    for (let i = 0; i < wrappedAddr.length; i++) {
      draw(wrappedAddr[i], 120, headerY - 48 - i * lh)
    }
    addrConsumed = (wrappedAddr.length - 1) * 12
  }
  draw('Phone', 320, headerY, 10, true)
  draw(queryData[0].phone || 'N/A', 380, headerY)
  draw('Email', 320, headerY - 16, 10, true)
  draw(queryData[0].email || 'N/A', 380, headerY - 16)

  let y = headerY - 78 - addrConsumed

  const rightX = 570
  const money = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

  const drawLineAmount = (text: string, amount: number | null) => {
    const size = 10
    const maxWidth = 520
    const lines = wrapText(text, size, maxWidth)
    const lh = size + 2

    // Draw text lines
    for (let i = 0; i < lines.length; i++) {
      draw(lines[i], 30, y - i * lh)
    }

    // Draw amount if present
    if (amount !== null) {
      draw(
        money(amount),
        rightX - font.widthOfTextAtSize(money(amount), size),
        y,
        size,
        true,
      )
    }

    // Draw dotted line from start of text to end of amount for ALL items with prices (including $0)
    if (amount !== null) {
      const lineY = y - 2 // Higher position to avoid overlapping with text below
      const textStartX = 30 // Start from the beginning of text
      const amountEndX = rightX // End at the right edge where price ends

      // Draw dotted line
      const dotSpacing = 3
      const lineLength = amountEndX - textStartX
      const numDots = Math.floor(lineLength / dotSpacing)

      for (let i = 0; i < numDots; i++) {
        const dotX = textStartX + i * dotSpacing
        page.drawCircle({
          x: dotX,
          y: lineY,
          size: 0.5,
          color: rgb(0.6, 0.6, 0.6),
        })
      }
    }

    y -= lh * lines.length
  }

  const seen = new Set<string>()
  let grandTotal = 0

  for (const row of queryData) {
    if (seen.has(row.room_uuid)) continue
    seen.add(row.room_uuid)

    // Section title
    const roomTitle = row.room
      ? row.room.charAt(0).toUpperCase() + row.room.slice(1).toLowerCase()
      : 'Room'
    draw(roomTitle, 30, y, 12, true)
    y -= 14

    // Stone name and base calculation
    const stoneName = row.stone_name || 'Stone'
    const sqftVal = Number(row.square_feet || '0')
    const pricePer = Number(row.retail_price || '0')
    const baseAmount = Math.round(sqftVal * pricePer * 100) / 100

    // Determine stone type based on name
    let stoneType = 'Stone'
    if (stoneName.toLowerCase().includes('perlatus')) {
      stoneType = 'Dolomite'
    } else if (stoneName.toLowerCase().includes('luna pearl')) {
      stoneType = 'Granite'
    } else if (stoneName.toLowerCase().includes('calacatta')) {
      stoneType = 'Marble'
    } else if (stoneName.toLowerCase().includes('super white')) {
      stoneType = 'Quartz'
    } else if (stoneName.toLowerCase().includes('quartz')) {
      stoneType = 'Quartz'
    } else if (stoneName.toLowerCase().includes('granite')) {
      stoneType = 'Granite'
    } else if (stoneName.toLowerCase().includes('marble')) {
      stoneType = 'Marble'
    } else if (stoneName.toLowerCase().includes('dolomite')) {
      stoneType = 'Dolomite'
    }

    drawLineAmount(
      `${stoneType} ${stoneName} ${sqftVal} sq ft * $${pricePer}`,
      baseAmount,
    )

    // Collect all items with prices for this room
    const roomItems: { label: string; value: number }[] = []
    let roomSubtotal = baseAmount

    // Installation and fabrication (if they have prices)
    const extras = row.extras as Record<string, number | boolean>
    if (typeof extras?.installation_price === 'number' && extras.installation_price) {
      const price = Number(extras.installation_price)
      roomItems.push({ label: `Installation ${sqftVal} sq ft`, value: price })
      roomSubtotal += price
    }
    if (typeof extras?.fabrication_price === 'number' && extras.fabrication_price) {
      const price = Number(extras.fabrication_price)
      roomItems.push({ label: `Fabrication ${sqftVal} sq ft`, value: price })
      roomSubtotal += price
    }

    // Other extras with prices
    if (typeof extras?.tear_out_price === 'number' && extras.tear_out_price) {
      const price = Number(extras.tear_out_price)
      roomItems.push({ label: `Tear-Out: Yes`, value: price })
      roomSubtotal += price
    }
    if (typeof extras?.stove_price === 'number' && extras.stove_price) {
      const price = Number(extras.stove_price)
      const stove = row.stove
        ? stoveText[row.stove as keyof typeof stoveText] || ''
        : ''
      roomItems.push({ label: `Stove: ${stove}`, value: price })
      roomSubtotal += price
    }
    if (typeof extras?.waterfall_price === 'number' && extras.waterfall_price) {
      const price = Number(extras.waterfall_price)
      roomItems.push({ label: `Waterfall: Yes`, value: price })
      roomSubtotal += price
    }
    if (typeof extras?.corbels_price === 'number' && extras.corbels_price) {
      const price = Number(extras.corbels_price)
      roomItems.push({ label: `Corbels: ${row.corbels || 1}`, value: price })
      roomSubtotal += price
    }
    if (typeof extras?.seam_price === 'number' && extras.seam_price) {
      const price = Number(extras.seam_price)
      const seamKey = row.seam
        ? (row.seam.toLowerCase() as keyof typeof seamText)
        : 'standard'
      const label = seamText[seamKey] || row.seam || 'standard'
      roomItems.push({ label: `Seam: ${label}`, value: price })
      roomSubtotal += price
    }
    // Remove this section - we'll handle ten_year_sealer in the extras section below

    // Extra items from the interface - check all possible extras
    if (extras) {
      // Sink Cut Out
      if (extras.sink_cut_out && typeof extras.sink_cut_out === 'object') {
        const sinkCutOut = extras.sink_cut_out as Record<string, number>
        const price = Number(sinkCutOut.price || 250)
        roomItems.push({ label: `Sink Cut Out`, value: price })
        roomSubtotal += price
      }

      // Oversize Piece
      if (extras.oversize_piece && typeof extras.oversize_piece === 'object') {
        const oversize = extras.oversize_piece as Record<string, unknown>
        const price = Number(oversize.price || 0)
        if (price > 0) {
          roomItems.push({ label: `Oversized Piece`, value: price })
          roomSubtotal += price
        }
      }

      // Trip Fee
      if (extras.tripFee && typeof extras.tripFee === 'object') {
        const tripFee = extras.tripFee as Record<string, number>
        const price = Number(tripFee.price || 0)
        if (price > 0) {
          roomItems.push({ label: `Trip Fee`, value: price })
          roomSubtotal += price
        }
      }

      // Mitter Edge Price
      if (extras.mitter_edge_price && typeof extras.mitter_edge_price === 'object') {
        const mitter = extras.mitter_edge_price as Record<string, number>
        const price = Number(mitter.price || 0)
        if (price > 0) {
          roomItems.push({ label: `Mitter Edge`, value: price })
          roomSubtotal += price
        }
      }

      // Adjustment (can be positive or negative for discounts)
      if (extras.adjustment && typeof extras.adjustment === 'object') {
        const adjustment = extras.adjustment as Record<string, unknown>
        const price = Number(adjustment.price || 0)
        const adjustmentText = (adjustment.adjustment as string) || 'Adjustment'
        if (price !== 0) {
          roomItems.push({ label: adjustmentText, value: price })
          roomSubtotal += price
        }
      }

      // Check for other extra items that might be added dynamically
      // Look for any other keys in extras that have price property
      for (const [key, value] of Object.entries(extras)) {
        if (
          key !== 'adjustment' &&
          key !== 'sink_cut_out' &&
          key !== 'oversize_piece' &&
          key !== 'tripFee' &&
          key !== 'mitter_edge_price' &&
          key !== 'ten_year_sealer' &&
          key !== 'edge_price' &&
          key !== 'installation_price' &&
          key !== 'fabrication_price' &&
          key !== 'tear_out_price' &&
          key !== 'stove_price' &&
          key !== 'waterfall_price' &&
          key !== 'corbels_price' &&
          key !== 'seam_price' &&
          key !== 'ten_year_sealer_price'
        ) {
          if (typeof value === 'object' && value !== null) {
            const item = value as Record<string, unknown>
            if (typeof item.price === 'number' && item.price !== 0) {
              const itemName =
                (item.name as string) ||
                (item.label as string) ||
                key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
              roomItems.push({ label: itemName, value: item.price })
              roomSubtotal += item.price
            }
          }
        }
      }

      // Ten Year Sealer (from extras object)
      if (extras.ten_year_sealer && typeof extras.ten_year_sealer === 'object') {
        const sealer = extras.ten_year_sealer as Record<string, unknown>
        const sealerAmount = Number(sealer.amount || 0)
        const sealerPrice = Number(sealer.price || 0)
        const label =
          sealerAmount > 0 ? `10 Year Sealer: ${sealerAmount}` : '10 Year Sealer: Yes'
        roomItems.push({ label, value: sealerPrice })
        roomSubtotal += sealerPrice
      }
    }
    if (extras?.edge_price) {
      const ep = extras.edge_price as unknown as Record<string, unknown>
      const epPrice = Number(
        typeof ep === 'number' ? ep : typeof ep?.price === 'number' ? ep.price : 0,
      )
      const epType =
        typeof ep === 'object' && ep?.edge_type ? ` - ${ep.edge_type as string}` : ''
      if (epPrice > 0) {
        roomItems.push({ label: `Finished Edge${epType}`, value: epPrice })
        roomSubtotal += epPrice
      }
    }

    // Sinks with prices
    const sinksForRoom = sinks.filter(s => s.room_uuid === row.room_uuid)
    for (const sink of sinksForRoom) {
      const sinkPrice = Number(sink.price || sink.retail_price || 0)
      const sinkLabel =
        `Sink ${sink.type} ${sink.name} ${sink.count > 1 ? sink.count : ''}`.trim()
      const totalSinkPrice = sinkPrice * sink.count
      roomItems.push({ label: sinkLabel, value: totalSinkPrice })
      roomSubtotal += totalSinkPrice
    }

    // Faucets with prices
    const faucetsForRoom = faucets.filter(f => f.room_uuid === row.room_uuid)
    for (const faucet of faucetsForRoom) {
      const faucetPrice = Number(faucet.price || faucet.retail_price || 0)
      const faucetLabel =
        `Faucet ${faucet.type} ${faucet.name} ${faucet.count > 1 ? faucet.count : ''}`.trim()
      const totalFaucetPrice = faucetPrice * faucet.count
      roomItems.push({ label: faucetLabel, value: totalFaucetPrice })
      roomSubtotal += totalFaucetPrice
    }

    // Add all non-priced options as well
    const stove = row.stove ? stoveText[row.stove as keyof typeof stoveText] || '' : ''
    if (stove && !roomItems.some(item => item.label.includes('Stove'))) {
      roomItems.push({ label: `Stove: ${stove}`, value: 0 })
    }
    if (
      row.tear_out &&
      row.tear_out !== 'no' &&
      !roomItems.some(item => item.label.includes('Tear-Out'))
    ) {
      roomItems.push({ label: 'Tear-Out: Yes', value: 0 })
    }
    // Only add ten_year_sealer here if it's a boolean and not already added as an object
    if (
      extras &&
      extras.ten_year_sealer === true &&
      !roomItems.some(item => item.label.includes('10 Year Sealer'))
    ) {
      roomItems.push({ label: '10 Year Sealer: Yes', value: 0 })
    }
    if (
      row.waterfall === 'yes' &&
      !roomItems.some(item => item.label.includes('Waterfall'))
    ) {
      roomItems.push({ label: 'Waterfall: Yes', value: 0 })
    }
    if (
      row.corbels &&
      row.corbels > 0 &&
      !roomItems.some(item => item.label.includes('Corbels'))
    ) {
      roomItems.push({ label: `Corbels: ${row.corbels}`, value: 0 })
    }
    if (
      row.seam &&
      row.seam !== 'standard' &&
      !roomItems.some(item => item.label.includes('Seam'))
    ) {
      const seamKey = row.seam.toLowerCase() as keyof typeof seamText
      const label = seamText[seamKey] || row.seam
      roomItems.push({ label: `Seam: ${label}`, value: 0 })
    }

    // Display all room items
    for (const item of roomItems) {
      drawLineAmount(item.label, item.value)
    }

    // Subtotal for this room
    y -= 4
    draw('Sub Total', 30, y, 10, true)

    // Ensure roomSubtotal is a valid number
    const validRoomSubtotal = Number.isNaN(roomSubtotal) ? 0 : roomSubtotal

    draw(
      money(validRoomSubtotal),
      rightX - font.widthOfTextAtSize(money(validRoomSubtotal), 10),
      y,
      10,
      true,
    )

    // Draw dotted line under Sub Total
    const subtotalLineY = y - 2 // Higher position to avoid overlapping with text below
    const subtotalTextStartX = 30 // Start from the beginning of text
    const subtotalAmountEndX = rightX // End at the right edge where price ends

    const dotSpacing = 3
    const lineLength = subtotalAmountEndX - subtotalTextStartX
    const numDots = Math.floor(lineLength / dotSpacing)

    for (let i = 0; i < numDots; i++) {
      const dotX = subtotalTextStartX + i * dotSpacing
      page.drawCircle({
        x: dotX,
        y: subtotalLineY,
        size: 0.5,
        color: rgb(0.6, 0.6, 0.6),
      })
    }

    y -= 30 // Increased spacing between rooms

    grandTotal += validRoomSubtotal
  }

  // Add sale level extras (adjustments, discounts, etc.)
  if (
    queryData.length > 0 &&
    queryData[0].sale_extras &&
    Array.isArray(queryData[0].sale_extras) &&
    queryData[0].sale_extras.length > 0
  ) {
    y -= 20 // Add spacing before sale extras

    // Section title for sale extras
    draw('Sale Adjustments', 30, y, 12, true)
    y -= 14

    for (const saleExtra of queryData[0].sale_extras) {
      if (saleExtra && typeof saleExtra === 'object') {
        const price = Number(saleExtra.price || 0)
        const label = saleExtra.adjustment || 'Adjustment'
        if (price !== 0 || label !== 'Adjustment') {
          // Only show if there's a meaningful value
          drawLineAmount(label, price)
          grandTotal += price
        }
      }
    }

    y -= 10 // Add spacing after sale extras
  }

  y -= 20 // Added padding above

  // Create a more elegant footer with better spacing and alignment
  const footerHeight = 60
  const footerY = y - footerHeight + 10

  // Draw the footer background
  page.drawRectangle({
    x: 24,
    y: footerY,
    width: 564,
    height: footerHeight,
    color: rgb(0.1, 0.2, 0.35),
  })

  // Calculate deposit
  const halfPrice =
    grandTotal > 1000 ? Math.round(grandTotal * 0.5 * 100) / 100 : grandTotal

  // Format currency - ensure numbers are valid
  const validGrandTotal = Number.isNaN(grandTotal) ? 0 : grandTotal
  const validHalfPrice = Number.isNaN(halfPrice) ? 0 : halfPrice
  const totalFormatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(validGrandTotal)
  const depositFormatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(validHalfPrice)

  // Center the content vertically in the footer
  const centerY = footerY + footerHeight / 2 + 5

  // Draw Total on the left
  draw('Total', 40, centerY, 16, true, rgb(1, 1, 1))
  draw(totalFormatted, 120, centerY, 16, true, rgb(1, 1, 1))

  // Draw Deposit on the right
  const depositX = 400
  draw('Deposit', depositX, centerY, 16, true, rgb(1, 1, 1))
  draw(depositFormatted, depositX + 80, centerY, 16, true, rgb(1, 1, 1))

  return pdfDoc
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function loader({ request, params }: ActionFunctionArgs) {
  try {
    await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  if (!params.saleId) {
    return new Response('Bad url', { status: 400 })
  }
  const saleId = parseInt(params.saleId)
  const sinks = await getSinks(saleId)
  const faucets = await getFaucets(saleId)
  const queryData = await getData(saleId)

  if (queryData.length < 1) {
    return new Response('No data found for this sale', { status: 404 })
  }

  const pdfDoc = await buildPdf(queryData, sinks, faucets)
  const pdfBytes = await pdfDoc.save()

  const customerName = queryData[0].customer_name || 'Customer'
  const safeCustomerName = sanitizeFilename(customerName)
  const filename = `${safeCustomerName}.pdf`

  return new Response(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
    },
  })
}
