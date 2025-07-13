import { PDFDocument, type PDFForm } from 'pdf-lib'
import { type ActionFunctionArgs, redirect } from 'react-router'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { downloadPDFAsBuffer } from '~/utils/s3.server'
import { getEmployeeUser } from '~/utils/session.server'

interface IQuery {
  customer_name: string | null;
  seller_name: string | null;
  sale_date: Date | null;
  project_address: string | null;
  phone: string | null;
  email: string | null;
  room: string | null;
  edge: string | null;
  backsplash: string | null;
  stone_name: string | null;
  total_price: number | null;
  square_feet: string | null;
  retail_price: string | null;
  sink_name: string | null;
  faucet_name: string | null;
  tear_out: string | null;
  stove: string | null;
  ten_year_sealer: number | null;
  waterfall: string | null;
  corbels: number | null;
  seam: string | null;
  zip_code: string | null;
  company_name: string | null;
  billing_address: string | null;
}

const urls = {
  homeownerGDIndy:
    'https://granite-database.s3.us-east-2.amazonaws.com/base-contracts/Contract.pdf',
  commercialGDIndy:
    'https://granite-database.s3.us-east-2.amazonaws.com/base-contracts/Contract_commercial.pdf',
}

const stoveText = {
  'F/S': 'F/S',
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

function homeownerGdIndyText(pdfForm: PDFForm, queryData: IQuery[]) {
  pdfForm
    .getTextField('Text1')
    .setText(queryData[0].sale_date?.toLocaleDateString('en-US') || undefined)
  pdfForm.getTextField('Text2').setText(queryData[0].seller_name || undefined)
  pdfForm.getTextField('Text3').setText(queryData[0].customer_name || undefined)
  pdfForm
    .getTextField('Text4')
    .setText(
      queryData[0].project_address?.replace('USA', queryData[0].zip_code || '') ||
        undefined,
    )
  pdfForm.getTextField('Text5').setText(queryData[0].phone || undefined)
  pdfForm.getTextField('Text6').setText(queryData[0].email || undefined)

  for (let i = 0; i < queryData.length && i < 3; i++) {
    const row = queryData[i]

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
    pdfForm.getTextField(colorField).setText(row.stone_name || 'N/A')
    pdfForm.getTextField(sinkField).setText(row.sink_name || 'N/A')
    pdfForm.getTextField(faucetField).setText(row.faucet_name || 'N/A')
    pdfForm
      .getTextField(edgeField)
      .setText(
        row.edge
          ? row.edge.charAt(0).toUpperCase() + row.edge.slice(1).toLowerCase()
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
  }

  const totalCorbels = queryData.reduce((sum, row) => {
    return sum + (row.corbels || 0)
  }, 0)

  const hasLaminateTearOut = queryData.some(
    row => row.tear_out === 'laminate_t/o' || row.tear_out === 'vanity_t/o',
  )
  const hasStoneTearOut = queryData.some(row => row.tear_out === 'stone_t/o')
  const hasTenYearSealer = queryData.some(row => row.ten_year_sealer === 1)
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

function commercialGdIndyText(pdfForm: PDFForm, queryData: IQuery[]) {
  // Header fields
  pdfForm
    .getTextField('Text123')
    .setText(queryData[0].sale_date?.toLocaleDateString('en-US') || undefined)
  pdfForm.getTextField('Text124').setText(queryData[0].seller_name || undefined)

  // Customer / company
  pdfForm.getTextField('Text125').setText(queryData[0].customer_name || undefined)
  pdfForm.getTextField('Text126').setText(queryData[0].company_name || null)

  pdfForm.getTextField("Text127").setText(queryData[0].project_address || undefined);
  pdfForm.getTextField("Text128").setText(queryData[0].billing_address || undefined); // Billing address – оставляем то же или пусто

  pdfForm.getTextField('Text129').setText(queryData[0].phone || undefined)
  pdfForm.getTextField('Text130').setText(queryData[0].email || undefined)

  // Up to three rooms
  const roomBase = [
    {
      room: 'Text131',
      color: 'Text132',
      sink: 'Text133',
      edge: 'Text134',
      back: 'Text135',
      sqft: 'Text146',
      price: 'Text147',
    },
    {
      room: 'Text136',
      color: 'Text137',
      sink: 'Text138',
      edge: 'Text139',
      back: 'Text140',
      sqft: 'Text148',
      price: 'Text149',
    },
    {
      room: 'Text141',
      color: 'Text142',
      sink: 'Text143',
      edge: 'Text144',
      back: 'Text145',
      sqft: 'Text150',
      price: 'Text151',
    },
  ]

  for (let i = 0; i < queryData.length && i < 3; i++) {
    const row = queryData[i]
    const map = roomBase[i]

    pdfForm
      .getTextField(map.room)
      .setText(
        row.room
          ? row.room.charAt(0).toUpperCase() + row.room.slice(1).toLowerCase()
          : undefined,
      )
    pdfForm.getTextField(map.color).setText(row.stone_name || 'N/A')
    pdfForm.getTextField(map.sink).setText(row.sink_name || 'N/A')
    pdfForm
      .getTextField(map.edge)
      .setText(
        row.edge
          ? row.edge.charAt(0).toUpperCase() + row.edge.slice(1).toLowerCase()
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
  }

  const totalCorbels = queryData.reduce((sum, row) => sum + (row.corbels || 0), 0)
  const hasLaminateTearOut = queryData.some(r => r.tear_out === 'laminate')
  const hasStoneTearOut = queryData.some(r => r.tear_out === 'stone')
  const hasTenYearSealer = queryData.some(r => r.ten_year_sealer === 1)
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

async function getData(saleId: number) {
  const query = `
        SELECT
            sales.sale_date,
            sales.project_address,
            sales.price AS total_price,
            customers.name AS customer_name,
            customers.phone,
            customers.email,
            customers.postal_code AS zip_code,
            users.name AS seller_name,
            slab_inventory.room,
            slab_inventory.edge,
            slab_inventory.backsplash,
            slab_inventory.square_feet,
            slab_inventory.tear_out,
            slab_inventory.stove,
            slab_inventory.ten_year_sealer,
            slab_inventory.waterfall,
            slab_inventory.corbels,
            slab_inventory.seam,
            stones.name AS stone_name,
            stones.retail_price,
            sink_agg.sink_name,
            faucet_agg.faucet_name,
            customers.company_name,
            customers.address AS billing_address
        FROM main.sales AS sales
        JOIN main.customers AS customers ON customers.id = sales.customer_id
        JOIN main.users AS users ON users.id = sales.seller_id
        JOIN main.slab_inventory AS slab_inventory ON slab_inventory.sale_id = sales.id
        JOIN main.stones AS stones ON stones.id = slab_inventory.stone_id
        /* Aggregate sinks per slab */
        LEFT JOIN (
            SELECT
                sinks.slab_id,
                GROUP_CONCAT(
                    CASE
                        WHEN cnt > 1 THEN name || ' X ' || cnt
                        ELSE name
                    END,
                    ', '
                ) AS sink_name
            FROM (
                SELECT
                    sinks.slab_id,
                    sink_type.name AS name,
                    COUNT(*) AS cnt
                FROM main.sinks AS sinks
                JOIN main.sink_type AS sink_type ON sink_type.id = sinks.sink_type_id
                GROUP BY sinks.slab_id, sink_type.name
            ) grouped_sinks
            GROUP BY slab_id
        ) AS sink_agg ON sink_agg.slab_id = slab_inventory.id
        /* Aggregate faucets per slab */
        LEFT JOIN (
            SELECT
                faucets.slab_id,
                GROUP_CONCAT(
                    CASE
                        WHEN cnt > 1 THEN name || ' X ' || cnt
                        ELSE name
                    END,
                    ', '
                ) AS faucet_name
            FROM (
                SELECT
                    faucets.slab_id,
                    faucet_type.name AS name,
                    COUNT(*) AS cnt
                FROM main.faucets AS faucets
                JOIN main.faucet_type AS faucet_type ON faucet_type.id = faucets.faucet_type_id
                GROUP BY faucets.slab_id, faucet_type.name
            ) grouped_faucets
            GROUP BY slab_id
        ) AS faucet_agg ON faucet_agg.slab_id = slab_inventory.id
        WHERE sales.id = ?
        ORDER BY slab_inventory.id
    `
  return await selectMany<IQuery>(db, query, [saleId])
}

function groupSinksAndFaucets(queryData: IQuery[]): IQuery[] {
  const roomGroups: { [key: string]: IQuery[] } = {}

  queryData.forEach(row => {
    const roomKey = `${row.room}-${row.edge}-${row.backsplash}-${row.square_feet}-${row.stone_name}`

    if (!roomGroups[roomKey]) {
      roomGroups[roomKey] = []
    }
    roomGroups[roomKey].push(row)
  })

  const result: IQuery[] = []

  Object.entries(roomGroups).forEach(([roomKey, roomRows]) => {
    const sinkCounts: { [key: string]: number } = {}
    const faucetCounts: { [key: string]: number } = {}

    roomRows.forEach(row => {
      if (row.sink_name) {
        sinkCounts[row.sink_name] = (sinkCounts[row.sink_name] || 0) + 1
      }
      if (row.faucet_name) {
        faucetCounts[row.faucet_name] = (faucetCounts[row.faucet_name] || 0) + 1
      }
    })

    const sinkNames = Object.entries(sinkCounts)
      .map(([name, count]) => (count > 1 ? `${name} X ${count}` : name))
      .join(', ')

    const faucetNames = Object.entries(faucetCounts)
      .map(([name, count]) => (count > 1 ? `${name} X ${count}` : name))
      .join(', ')

    const baseRow = { ...roomRows[0] }
    baseRow.sink_name = sinkNames || null
    baseRow.faucet_name = faucetNames || null

    result.push(baseRow)
  })

  return result
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
   await getEmployeeUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  if (!params.saleId) {
    return new Response('Bad url', { status: 400 })
  }
  const saleId = parseInt(params.saleId)
  if (isNaN(saleId)) {
    return new Response('Bad url', { status: 400 })
  }
  const rawData = await getData(saleId)
  const queryData = groupSinksAndFaucets(rawData)

  const contractType = queryData[0].company_name
    ? 'commercialGDIndy'
    : 'homeownerGDIndy'
  const { pdfDoc, pdfData, pdfForm } = await getPdf(contractType)

  if (queryData.length < 1) {
    return new Response('No data found for this sale', { status: 404 })
  }
  if (queryData.length > 3) {
    return new Response('Current limit is three items', { status: 400 })
  }

  texts[contractType as keyof typeof texts](pdfForm, queryData)
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
