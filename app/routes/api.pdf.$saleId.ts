import { PDFDocument, type PDFForm } from 'pdf-lib'
import { type ActionFunctionArgs, redirect } from 'react-router'
import { db } from '~/db.server'
import { extrasSchema, type TExtrasSchema } from '~/schemas/sales'
import { selectMany } from '~/utils/queryHelpers'
import { downloadPDFAsBuffer } from '~/utils/s3.server'
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
  company_name: string | null
  billing_address: string | null
  room_uuid: string
}

const urls = {
  homeownerGDIndy:
    'https://granite-database.s3.us-east-2.amazonaws.com/base-contracts/Contract.pdf',
  commercialGDIndy:
    'https://granite-database.s3.us-east-2.amazonaws.com/base-contracts/Contract_commercial.pdf',
}

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

const prettyCount = (item: { name: string; count: number }) => {
  return item.count > 1 ? `${item.name} X ${item.count}` : item.name
}

const prettyCounts = (items: { name: string; count: number }[]) => {
  if (!items || items.length === 0) return 'N/A'
  return items.map(prettyCount).join(', ')
}

function homeownerGdIndyText(
  pdfForm: PDFForm,
  queryData: IQuery[],
  sinks: ICountQuery[],
  faucets: ICountQuery[],
) {
  pdfForm
    .getTextField('Text1')
    .setText(queryData[0].sale_date?.toLocaleDateString('en-US') || undefined)
  pdfForm.getTextField('Text2').setText(queryData[0].seller_name || undefined)
  pdfForm.getTextField('Text3').setText(queryData[0].customer_name || undefined)
  pdfForm.getTextField('Text4').setText(queryData[0].project_address || undefined)
  pdfForm.getTextField('Text5').setText(queryData[0].phone || undefined)
  pdfForm.getTextField('Text6').setText(queryData[0].email || undefined)

  const analyzedRooms: string[] = []
  let i = 0
  for (const queryItem of queryData) {
    if (analyzedRooms.includes(queryItem.room_uuid)) {
      continue
    }

    analyzedRooms.push(queryItem.room_uuid)
    const row = queryItem

    const roomField = `Text${7 + i * 6}`
    const colorField = `Text${8 + i * 6}`
    const sinkField = `Text${9 + i * 6}`
    const faucetField = `Text${10 + i * 6}`
    const edgeField = `Text${11 + i * 6}`
    const backsplashField = `Text${12 + i * 6}`

    pdfForm
      .getTextField(roomField)
      .setText(
        row.room
          ? row.room.charAt(0).toUpperCase() + row.room.slice(1).toLowerCase()
          : undefined,
      )
    const sinksForRoom = sinks.filter(s => s.room_uuid === row.room_uuid)
    const sinkName = prettyCounts(sinksForRoom)
    const faucetsForRoom = faucets.filter(f => f.room_uuid === row.room_uuid)
    const faucetName = prettyCounts(faucetsForRoom)
    pdfForm.getTextField(colorField).setText(row.stone_name || 'N/A')
    pdfForm.getTextField(sinkField).setText(sinkName)
    pdfForm.getTextField(faucetField).setText(faucetName)
    pdfForm
      .getTextField(edgeField)
      .setText(
        typeof row.extras.edge_price === 'object' && row.extras.edge_price?.edge_type
          ? row.extras.edge_price.edge_type.charAt(0).toUpperCase() +
              row.extras.edge_price.edge_type.slice(1).toLowerCase()
          : 'N/A',
      )
    pdfForm
      .getTextField(backsplashField)
      .setText(
        row.backsplash
          ? row.backsplash.charAt(0).toUpperCase() +
              row.backsplash.slice(1).toLowerCase()
          : 'N/A',
      )

    const sqftField = `Text${25 + i * 2}`
    const priceField = `Text${26 + i * 2}`
    pdfForm.getTextField(sqftField).setText(row.square_feet?.toString() || 'N/A')
    pdfForm.getTextField(priceField).setText(row.retail_price?.toString() || 'N/A')
    i++
  }

  const uniqueRooms = queryData.filter(
    (value, index, self) =>
      self.findIndex(v => v.room_uuid === value.room_uuid) === index,
  )
  const totalCorbels = uniqueRooms.reduce((sum, row) => {
    return sum + (row.corbels || 0)
  }, 0)

  const hasLaminateTearOut = queryData.some(
    row => row.tear_out === 'laminate_t/o' || row.tear_out === 'vanity_t/o',
  )

  const hasStoneTearOut = queryData.some(row => row.tear_out === 'stone_t/o')
  const hasTenYearSealer = queryData.some(row => row.extras.ten_year_sealer)
  const hasWaterfall = queryData.some(row => row.waterfall === 'yes')

  pdfForm.getTextField('Text31').setText(hasLaminateTearOut ? 'Yes' : 'No')

  pdfForm.getTextField('Text32').setText(hasStoneTearOut ? 'Yes' : 'No')

  pdfForm
    .getTextField('Text33')
    .setText(stoveText[queryData[0].stove as keyof typeof stoveText] || 'N/A')

  pdfForm.getTextField('Text34').setText(hasTenYearSealer ? 'Yes' : 'No')

  pdfForm.getTextField('Text35').setText(hasWaterfall ? 'Yes' : 'No')

  pdfForm.getTextField('Text36').setText(totalCorbels.toString())

  const seamKeyHome = (queryData[0].seam || '').toLowerCase()
  pdfForm
    .getDropdown('Dropdown42')
    .select(seamText[seamKeyHome as keyof typeof seamText] || 'N/A')
  const fullPrice = queryData[0].total_price || 0
  const halfPrice = fullPrice * 0.5
  pdfForm.getTextField('Text37').setText(fullPrice.toString())
  pdfForm
    .getTextField('Text38')
    .setText(fullPrice > 1000 ? halfPrice.toString() : fullPrice.toString())
}

function commercialGdIndyText(
  pdfForm: PDFForm,
  queryData: IQuery[],
  sinks: ICountQuery[],
  _faucets: ICountQuery[],
) {
  // Header fields
  pdfForm
    .getTextField('Text123')
    .setText(queryData[0].sale_date?.toLocaleDateString('en-US') || undefined)
  pdfForm.getTextField('Text124').setText(queryData[0].seller_name || undefined)

  // Customer / company
  pdfForm.getTextField('Text125').setText(queryData[0].customer_name || undefined)
  pdfForm.getTextField('Text126').setText(queryData[0].company_name || undefined)

  pdfForm.getTextField('Text127').setText(queryData[0].project_address || undefined)
  pdfForm.getTextField('Text128').setText(queryData[0].billing_address || undefined) // Billing address – оставляем то же или пусто

  pdfForm.getTextField('Text129').setText(queryData[0].phone || undefined)
  pdfForm.getTextField('Text130').setText(queryData[0].email || undefined)

  // Up to three rooms
  const roomBase = [
    {
      room: 'Text131',
      color: 'Text132',
      sink: 'Text133',
      edge_type: 'Text134',
      back: 'Text135',
      sqft: 'Text146',
      price: 'Text147',
    },
    {
      room: 'Text136',
      color: 'Text137',
      sink: 'Text138',
      edge_type: 'Text139',
      back: 'Text140',
      sqft: 'Text148',
      price: 'Text149',
    },
    {
      room: 'Text141',
      color: 'Text142',
      sink: 'Text143',
      edge_type: 'Text144',
      back: 'Text145',
      sqft: 'Text150',
      price: 'Text151',
    },
  ]

  const analyzedRooms: string[] = []
  let i = 0
  for (const queryItem of queryData) {
    if (i >= 3) {
      break
    }
    if (analyzedRooms.includes(queryItem.room_uuid)) {
      continue
    }

    analyzedRooms.push(queryItem.room_uuid)
    const row = queryItem
    const map = roomBase[i]

    pdfForm
      .getTextField(map.room)
      .setText(
        row.room
          ? row.room.charAt(0).toUpperCase() + row.room.slice(1).toLowerCase()
          : undefined,
      )
    const sinksForRoom = sinks.filter(s => s.room_uuid === row.room_uuid)
    const sinkName = prettyCounts(sinksForRoom)
    pdfForm.getTextField(map.color).setText(row.stone_name || 'N/A')
    pdfForm.getTextField(map.sink).setText(sinkName || 'N/A')
    pdfForm
      .getTextField(map.edge_type)
      .setText(
        typeof row.extras.edge_price === 'object' && row.extras.edge_price?.edge_type
          ? row.extras.edge_price.edge_type.charAt(0).toUpperCase() +
              row.extras.edge_price.edge_type.slice(1).toLowerCase()
          : 'N/A',
      )
    pdfForm
      .getTextField(map.back)
      .setText(
        row.backsplash
          ? row.backsplash.charAt(0).toUpperCase() +
              row.backsplash.slice(1).toLowerCase()
          : 'N/A',
      )

    pdfForm.getTextField(map.sqft).setText(row.square_feet?.toString() || 'N/A')
    pdfForm.getTextField(map.price).setText(row.retail_price?.toString() || 'N/A')
    i++
  }
  const uniqueRooms = queryData.filter(
    (value, index, self) =>
      self.findIndex(v => v.room_uuid === value.room_uuid) === index,
  )
  const totalCorbels = uniqueRooms.reduce((sum, row) => sum + (row.corbels || 0), 0)
  const hasLaminateTearOut = queryData.some(
    r => r.tear_out === 'laminate_t/o' || r.tear_out === 'vanity_t/o',
  )
  const hasStoneTearOut = queryData.some(r => r.tear_out === 'stone_t/o')
  const hasTenYearSealer = queryData.some(r => r.extras.ten_year_sealer)
  const hasWaterfall = queryData.some(r => r.waterfall === 'yes')

  pdfForm.getTextField('Text152').setText(hasLaminateTearOut ? 'Yes' : 'No')
  pdfForm.getTextField('Text153').setText(hasStoneTearOut ? 'Yes' : 'No')

  pdfForm
    .getTextField('Text154')
    .setText(stoveText[queryData[0].stove as keyof typeof stoveText] || 'N/A')
  pdfForm.getTextField('Text155').setText(hasTenYearSealer ? 'Yes' : 'No')
  pdfForm.getTextField('Text156').setText(hasWaterfall ? 'Yes' : 'No')
  pdfForm.getTextField('Text157').setText(totalCorbels.toString())

  const seamKey = (queryData[0].seam || '').toLowerCase()
  pdfForm
    .getDropdown('Dropdown159')
    .select(seamText[seamKey as keyof typeof seamText] || 'N/A')
  const fullPrice = queryData[0].total_price || 0
  const halfPrice = fullPrice * 0.5
  pdfForm.getTextField('Text160').setText(fullPrice.toString())
  pdfForm
    .getTextField('Text161')
    .setText(fullPrice > 1000 ? halfPrice.toString() : fullPrice.toString())
}

const texts = {
  homeownerGDIndy: homeownerGdIndyText,
  commercialGDIndy: commercialGdIndyText,
}

interface ICountQuery {
  name: string
  count: number
  room_uuid: string
}

async function getSinks(saleId: number): Promise<ICountQuery[]> {
  const query = `
    select
      sink_type.name as name,
      count(sinks.id) as count,
      HEX(slab_inventory.room_uuid) as room_uuid
    from sinks
    join slab_inventory on slab_inventory.id = sinks.slab_id
    join sink_type on sink_type.id = sinks.sink_type_id
    where slab_inventory.sale_id = ?
    group by sink_type.name, slab_inventory.room_uuid
  `
  return await selectMany<ICountQuery>(db, query, [saleId])
}

async function getFaucets(saleId: number): Promise<ICountQuery[]> {
  const query = `
    select
      faucet_type.name as name,
      count(faucets.id) as count,
      HEX(slab_inventory.room_uuid) as room_uuid
    from faucets
    join slab_inventory on slab_inventory.id = faucets.slab_id
    join faucet_type on faucet_type.id = faucets.faucet_type_id
    where slab_inventory.sale_id = ?
    group by faucet_type.name, slab_inventory.room_uuid
  `
  return await selectMany<ICountQuery>(db, query, [saleId])
}

async function getData(saleId: number) {
  const query = `
        select
            sales.sale_date,
            sales.project_address,
            sales.price as total_price,
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
            stones.retail_price,
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
  const response = await selectMany<IQuery>(db, query, [saleId])
  return response.map(row => ({
    ...row,
    extras: extrasSchema.parse(row.extras || {}),
  }))
}

async function getPdf(contractType: string) {
  const pdfData = await downloadPDFAsBuffer(urls[contractType as keyof typeof urls])
  const pdfDoc = await PDFDocument.load(pdfData.buffer)
  const pdfForm = pdfDoc.getForm()
  return { pdfDoc, pdfData, pdfForm }
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

  const roomIds = new Set(queryData.map(q => q.room_uuid))
  const contractType = queryData[0].company_name
    ? 'commercialGDIndy'
    : 'homeownerGDIndy'
  const { pdfDoc, pdfData, pdfForm } = await getPdf(contractType)

  if (queryData.length < 1) {
    return new Response('No data found for this sale', { status: 404 })
  }
  if (roomIds.size > 3) {
    return new Response('Current limit is three items', { status: 400 })
  }

  texts[contractType as keyof typeof texts](pdfForm, queryData, sinks, faucets)
  const pdfBytes = await pdfDoc.save()

  const customerName = queryData[0].customer_name || 'Customer'
  const safeCustomerName = sanitizeFilename(customerName)
  const filename = `${safeCustomerName}.pdf`

  return new Response(pdfBytes, {
    headers: {
      'Content-Type': pdfData.contentType || 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
    },
  })
}
