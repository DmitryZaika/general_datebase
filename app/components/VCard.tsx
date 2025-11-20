import { useState } from 'react'
import { Button } from './ui/button'

type VCardProps = {
  name: string
  phone: string
  email: string
  company?: string
  address?: string
  className?: string
}

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

export function VCard({ name, phone, email, company, address, className }: VCardProps) {
  const [isDownloading, setIsDownloading] = useState(false)

  const sanitize = (value?: string) => {
    const str = (value ?? '').toString().trim()
    if (!str) return ''
    const low = str.toLowerCase()
    if (low === 'null' || low === 'undefined') return ''
    return str
  }

  const getFields = (): VCardFields => ({
    name: sanitize(name),
    phone: sanitize(phone),
    email: sanitize(email),
    company: sanitize(company),
    address: sanitize(address),
  })

  const generateVCard = (fields: VCardFields) => {
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
    return sanitized.toLowerCase().endsWith('.vcf') ? sanitized : `${sanitized}.vcf`
  }

  const isTelegramBrowser = () => {
    if (typeof navigator === 'undefined') return false
    const ua = navigator.userAgent || ''
    return ua.toLowerCase().includes('telegram')
  }

  const buildServerUrl = (fields: VCardFields, fileName: string) => {
    const params = new URLSearchParams()
    params.set('filename', fileName)
    fieldKeys.forEach(key => {
      const value = fields[key]
      if (value) params.set(key, value)
    })
    return `/api/vcard?${params.toString()}`
  }

  const openServerDownload = (fields: VCardFields, fileName: string) => {
    const url = buildServerUrl(fields, fileName)
    if (typeof document === 'undefined') {
      if (typeof window !== 'undefined') {
        window.location.href = url
      }
      return
    }
    const iframe = document.createElement('iframe')
    iframe.style.display = 'none'
    const remove = () => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe)
      }
    }
    iframe.addEventListener('load', () => {
      setTimeout(remove, 500)
    })
    document.body.appendChild(iframe)
    iframe.src = url
    setTimeout(remove, 15000)
  }

  const downloadVCard = () => {
    setIsDownloading(true)
    const fields = getFields()
    const fileName = buildFileName(fields.name)

    if (isTelegramBrowser()) {
      openServerDownload(fields, fileName)
      setTimeout(() => setIsDownloading(false), 1000)
      return
    }

    const vcardContent = generateVCard(fields)
    const blob = new Blob([vcardContent], { type: 'text/vcard;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)

    setTimeout(() => setIsDownloading(false), 1000)
  }

  return (
    <Button
      variant='ghost'
      className={className}
      onClick={downloadVCard}
      disabled={isDownloading}
    >
      {isDownloading ? 'Downloading...' : 'Add to Contacts'}
    </Button>
  )
}
