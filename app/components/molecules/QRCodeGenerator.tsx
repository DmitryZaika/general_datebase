import { useRef } from 'react'
import QRCode from 'react-qr-code'
import { Button } from '~/components/ui/button'
import { PrinterIcon } from 'lucide-react'

interface QRCodeGeneratorProps {
  url: string
  title?: string
  size?: number
}

export function QRCodeGenerator({ url, title, size = 200 }: QRCodeGeneratorProps) {
  const qrRef = useRef<HTMLDivElement>(null)

  // Функция для печати QR-кода
  const printQRCode = () => {
    if (!qrRef.current) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('Пожалуйста, разрешите всплывающие окна для печати QR-кода.')
      return
    }

    const titleText = title || 'QR Code'

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${titleText}</title>
          <style>
            body {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              padding: 20px;
              box-sizing: border-box;
              font-family: Arial, sans-serif;
            }
            .qr-container {
              text-align: center;
            }
            .qr-title {
              margin-bottom: 15px;
              font-size: 18px;
              font-weight: bold;
            }
            .qr-url {
              margin-top: 15px;
              font-size: 12px;
              word-break: break-all;
              max-width: 300px;
              text-align: center;
            }
            @media print {
              body {
                height: auto;
              }
            }
          </style>
        </head>
        <body>
          <div class="qr-container">
            ${title ? `<div class="qr-title">${title}</div>` : ''}
            ${qrRef.current.innerHTML}
            <div class="qr-url">${url}</div>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.close();
              }, 200);
            };
          </script>
        </body>
      </html>
    `)

    printWindow.document.close()
  }

  return (
    <div className='flex flex-col items-center'>
      <div ref={qrRef} className='bg-white p-4 rounded-md'>
        <QRCode value={url} size={size} />
      </div>

      <div className='mt-2 text-sm text-gray-500 text-center max-w-[300px] overflow-hidden text-ellipsis'>
        {url}
      </div>

      <Button
        onClick={printQRCode}
        className='mt-4 flex items-center gap-2'
        variant='default'
      >
        <PrinterIcon className='h-4 w-4' />
        <span>Печать</span>
      </Button>
    </div>
  )
}

// Простая утилитарная функция для печати QR-кода
export function simplePrintQRCode(url: string, title?: string) {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    alert('Пожалуйста, разрешите всплывающие окна для печати QR-кода.')
    return
  }

  const titleText = title || 'QR Code'
  const encodedUrl = encodeURIComponent(url)

  const hasCustomLayout = title?.includes('<div')

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${!hasCustomLayout ? titleText : 'QR Code'}</title>
        <style>
          @page {
            size: auto;
            margin: 0mm;
          }
          html, body {
            margin: 0;
            padding: 0;
            font-family: Arial, sans-serif;
          }
          body {
            width: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
          }
          .qr-container {
            margin: 0;
            padding: 0;
            text-align: center;
            font-size: 10pt;
          }
          .qr-title {
            margin-bottom: 5px;
            font-size: 12pt;
            font-weight: bold;
          }
          .qr-url {
            margin-top: 5px;
            font-size: 8pt;
            word-break: break-all;
            max-width: 1in;
            text-align: center;
          }
          .custom-layout {
            width: 1in;
            height: 1in;
            border: 1px solid #ddd;
            overflow: hidden;
            padding: 0;
            margin: 0 auto;
            font-size: 7pt;
            box-sizing: border-box;
          }
          .custom-layout img {
            width: 0.6in;
            height: 0.6in;
            margin: 0;
            padding: 0;
          }
          img.qr-standard {
            width: 1in;
            height: 1in;
          }
          @media print {
            @page {
              size: 1.2in 1.2in;
              margin: 0.1in;
            }
            body {
              width: 1in;
              height: 1in;
            }
            .custom-layout {
              transform-origin: top left;
              transform: scale(1);
            }
          }
        </style>
      </head>
      <body>
        <div class="qr-container">
          ${
            hasCustomLayout
              ? `<div class="custom-layout">
              ${title}
             </div>`
              : `${title ? `<div class="qr-title">${title}</div>` : ''}
             <img class="qr-standard" src="https://api.qrserver.com/v1/create-qr-code/?size=96x96&data=${encodedUrl}" alt="QR Code">
             <div class="qr-url">${url}</div>`
          }
        </div>
        <script>
          window.onload = function() {
            // If custom layout, replace first div with QR code image
            ${
              hasCustomLayout
                ? `const layoutDiv = document.querySelector('.custom-layout > div > div:first-child');
               if (layoutDiv) {
                 layoutDiv.innerHTML = '<img src="https://api.qrserver.com/v1/create-qr-code/?size=96x96&data=${encodedUrl}" alt="QR Code" style="width:0.6in; height:0.6in;">';
               }`
                : ''
            }
            
            setTimeout(function() {
              window.print();
              window.close();
            }, 500);
          };
        </script>
      </body>
    </html>
  `)

  printWindow.document.close()
}
