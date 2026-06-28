declare module 'heic-convert' {
  type HeicConvertFormat = 'JPEG' | 'PNG'

  interface HeicConvertOptions {
    buffer: Buffer | Uint8Array
    format: HeicConvertFormat
    quality?: number
  }

  interface HeicConvertImage {
    convert: () => Promise<ArrayBuffer>
  }

  interface HeicConvert {
    (options: HeicConvertOptions): Promise<ArrayBuffer>
    all(options: HeicConvertOptions): Promise<HeicConvertImage[]>
  }

  const heicConvert: HeicConvert
  export = heicConvert
}
