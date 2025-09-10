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

export function VCard({ name, phone, email, company, address, className }: VCardProps) {
  const [isDownloading, setIsDownloading] = useState(false)

  const generateVCard = () => {
    const sanitize = (value?: string) => {
      const str = (value ?? '').toString().trim()
      if (!str) return ''
      const low = str.toLowerCase()
      if (low === 'null' || low === 'undefined') return ''
      return str
    }

    const sName = sanitize(name)
    const sCompany = sanitize(company)
    const sPhone = sanitize(phone)
    const sEmail = sanitize(email)
    const sAddress = sanitize(address)

    const lines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${sName}`,
      `N:${sName};;;;`,
      sCompany ? `ORG:${sCompany}` : null,
      sPhone ? `TEL:${sPhone}` : null,
      sEmail ? `EMAIL:${sEmail}` : null,
      sAddress ? `ADR:;;${sAddress};;;;;` : null,
      'END:VCARD',
    ].filter(Boolean) as string[]

    return lines.join('\n')
  }

  const downloadVCard = () => {
    setIsDownloading(true)

    const vcardContent = generateVCard()
    const blob = new Blob([vcardContent], { type: 'text/vcard' })
    const url = window.URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = `${name.replace(/\s+/g, '_')}.vcf`
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
