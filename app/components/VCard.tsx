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
    const vcardContent = `BEGIN:VCARD
VERSION:3.0
FN:${name}
N:${name};;;;
ORG:${company || ''}
TEL:${phone}
EMAIL:${email}
ADR:;;${address || ''};;;;;
END:VCARD`

    return vcardContent
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
      {isDownloading ? 'Downloading...' : 'Download VCard'}
    </Button>
  )
}
