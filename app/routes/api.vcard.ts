import type { LoaderFunctionArgs } from 'react-router'

type VCardFields = {
  name: string
  phone: string
  email: string
  company: string
  address: string
}

const fieldKeys: Array<keyof VCardFields> = [
  'name',
  'phone',
  'email',
  'company',
  'address',
]

const sanitize = (value: string | null) => {
  const str = (value ?? '').toString().trim()
  if (!str) return ''
  const low = str.toLowerCase()
  if (low === 'null' || low === 'undefined') return ''
  return str
}

const buildVCard = (fields: VCardFields) => {
  const lines: string[] = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${fields.name}`,
    `N:${fields.name};;;;`,
  ]

  if (fields.company) lines.push(`ORG:${fields.company}`)
  if (fields.phone) lines.push(`TEL:${fields.phone}`)
  if (fields.email) lines.push(`EMAIL:${fields.email}`)
  if (fields.address) lines.push(`ADR:;;${fields.address};;;;;`)
  lines.push('END:VCARD')

  return lines.join('\r\n') + '\r\n'
}

const buildFileName = (value: string) => {
  const base = value || 'contact'
  const sanitized = base.replace(/[^\w.-]+/g, '_')
  if (sanitized.toLowerCase().endsWith('.vcf')) return sanitized
  return `${sanitized}.vcf`
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url)
  const fields: VCardFields = {
    name: sanitize(url.searchParams.get('name')),
    phone: sanitize(url.searchParams.get('phone')),
    email: sanitize(url.searchParams.get('email')),
    company: sanitize(url.searchParams.get('company')),
    address: sanitize(url.searchParams.get('address')),
  }

  const hasData = fieldKeys.some(key => fields[key])
  if (!hasData) {
    return new Response('Missing contact data', { status: 400 })
  }

  const fileNameInput = sanitize(url.searchParams.get('filename')) || fields.name
  const fileName = buildFileName(fileNameInput)
  const vcard = buildVCard(fields)

  return new Response(vcard, {
    headers: {
      'Content-Type': 'text/vcard; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  })
}
