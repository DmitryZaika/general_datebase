export interface SlabData {
  id: number
  bundle: string
  length: number
  width: number
  stoneName?: string
}

export function printSingleSlabQRCode(slab: SlabData, stoneName?: string) {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    alert('Пожалуйста, разрешите всплывающие окна для печати QR-кода.')
    return
  }

  const url = `${window.location.origin}/redirects/slab/${slab.id}`
  const encodedUrl = encodeURIComponent(url)

  const stoneNameToUse = stoneName || slab.stoneName || ''

  printWindow.document.write(
    getQRCodeHTML(encodedUrl, { ...slab, stoneName: stoneNameToUse }, false),
  )

  printWindow.document.close()
}

export function printAllSlabsQRCodes(slabs: SlabData[], stoneName?: string) {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    alert('Пожалуйста, разрешите всплывающие окна для печати QR-кодов.')
    return
  }

  const allSlabsHtml = slabs
    .map(slab => {
      const url = `${window.location.origin}/redirects/slab/${slab.id}`
      const encodedUrl = encodeURIComponent(url)

      const stoneNameToUse = slab.stoneName || stoneName || ''

      return generateQRCodeLabelHTML(encodedUrl, { ...slab, stoneName: stoneNameToUse })
    })
    .join('')

  printWindow.document.write(getQRCodeHTML('', null, true, allSlabsHtml))

  printWindow.document.close()
}

function generateQRCodeLabelHTML(encodedUrl: string, slab: SlabData) {
  return `
    <div class="label-container">
      <div class="qr-code">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&margin=1&data=${encodedUrl}" alt="QR Code">
      </div>
      <div class="label-content">
        <div class="stone-name">Granite Depot</div>
        <div class="stone-info">${slab.stoneName || ''}</div>
        <div class="bundle-info">Bund:${slab.bundle} / S# ${slab.id}</div>
        <div class="size-info">${slab.length} x ${slab.width} = ${((slab.length * slab.width) / 144).toFixed(3)}</div>
      </div>
    </div>
  `
}

function getQRCodeHTML(
  encodedUrl: string,
  slab: SlabData | null,
  isMultiple: boolean,
  customContent?: string,
) {
  const isCustomLayout = customContent !== undefined

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${isMultiple ? 'All QR Codes' : 'Slab QR Code'}</title>
        <style>
          @page {
            size: auto;
            margin: 0;
          }
          html, body {
            margin: 0;
            padding: 0;
            font-family: Arial, sans-serif;
            box-sizing: border-box;
          }
          *, *:before, *:after {
            box-sizing: inherit;
          }
          body {
            width: 100%;
            display: block;
            padding: 0;
          }
          .qr-container {
            padding: 0;
            margin: 0;
          }
          ${
            isMultiple
              ? `
          .qr-codes-container {
            display: flex;
            flex-wrap: wrap;
            flex-direction: row;
            justify-content: flex-start;
            align-items: flex-start;
            gap: 0.05in;
            padding: 0.05in;
          }
          `
              : ''
          }
          .label-container {
            display: flex;
            width: 3in;
            height: 0.8in;
            ${isMultiple ? '' : ''}
            border: 1px solid #ddd;
            background-color: white;
            overflow: hidden;
          }
          .qr-code {
            width: 0.8in;
            height: 0.8in;
            min-width: 0.8in;
            flex: 0 0 0.8in;
            padding: 0.01in;
            margin: 0;
            overflow: hidden;
          }
          .qr-code img {
            width: 0.78in;
            height: 0.78in;
            display: block;
            object-fit: contain;
            margin: 0;
            padding: 0;
          }
          .label-content {
            flex: 1;
            padding: 0.1in;
            font-size: 9pt;
            line-height: 1.1;
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
          }
          .company-name {
            font-weight: bold;
            margin-bottom: 0.02in;
          }
          .stone-name {
            font-weight: bold;
            margin-bottom: 0.02in;
          }
          .stone-info {
            margin-bottom: 0.02in;
          }
          .bundle-info {
            margin-bottom: 0.02in;
          }
          .size-info {
            margin-bottom: 0.02in;
          }
          @media print {
            @page {
              size: auto;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
            }
            .label-container {
              page-break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        ${isMultiple ? '<div class="qr-codes-container">' : ''}
        ${
          customContent
            ? customContent
            : slab
              ? generateQRCodeLabelHTML(encodedUrl, slab)
              : ''
        }
        ${isMultiple ? '</div>' : ''}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              window.close();
            }, 500);
          };
        </script>
      </body>
    </html>
  `
}
