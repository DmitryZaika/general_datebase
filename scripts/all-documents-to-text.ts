import dotenv from 'dotenv'

dotenv.config()

import {
  indexSupplierFileText,
  listSupplierFilesNeedingText,
} from '~/utils/supplierChatContext.server'

async function main() {
  const files = await listSupplierFilesNeedingText()
  process.stdout.write(`Files without text: ${files.length}\n`)

  if (files.length === 0) {
    process.exit(0)
  }

  let saved = 0
  let failed = 0

  for (let i = 0; i < files.length; i += 1) {
    const file = files[i]
    process.stdout.write(
      `[${i + 1}/${files.length}] ${file.supplier_name} — ${file.name} (id=${file.id}): `,
    )

    const ok = await indexSupplierFileText(file, phase => {
      process.stdout.write(phase === 'downloading' ? 'download… ' : 'extract… ')
    })

    if (ok) {
      saved += 1
      process.stdout.write('saved\n')
    } else {
      failed += 1
      process.stdout.write('failed\n')
    }
  }

  process.stdout.write(`Done. saved=${saved} failed=${failed}\n`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(err => {
  process.stderr.write(`${String(err)}\n`)
  process.exit(1)
})
