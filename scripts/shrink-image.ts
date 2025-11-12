import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

async function main() {
  const [, , inputPath, outputArg] = process.argv
  if (!inputPath) {
    console.error('Использование: tsx resize-to-200.ts <input> [output]')
    process.exit(1)
  }

  // Проверка на существование входного файла
  try {
    await fs.access(inputPath)
  } catch {
    console.error(`Файл не найден: ${inputPath}`)
    process.exit(1)
  }

  // Формируем выходной путь по умолчанию
  const ext = path.extname(inputPath)
  const base = path.basename(inputPath, ext)
  const dir = path.dirname(inputPath)
  const outputPath = outputArg ?? path.join(dir, `${base}.200x200${ext || '.png'}`)

  // Читаем метаданные
  const meta = await sharp(inputPath).metadata()

  const width = meta.width ?? 0
  const height = meta.height ?? 0

  if (width === 0 || height === 0) {
    throw new Error('Не удалось определить размеры изображения.')
  }

  if (width > 240 || height > 160) {
    await sharp(inputPath)
      .rotate() // учитывает EXIF-ориентацию
      .resize(240, 160, {
        fit: 'fill',
      })
      .toFile(outputPath)

    console.log(
      `Готово: ${outputPath} (исходные ${width}x${height} → 200x200, квадрат)`,
    )
  } else {
    // Ничего не делаем — размеры не больше 200
    console.log(
      `Изображение ${width}x${height} не больше 200×200 — оставлено без изменений.`,
    )
  }
}
main()
