import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css' // Tailwind CSS burada dahil ediliyor

// Koha CSV dosyalari ayni dosya icinde hem UTF-8 hem de Windows-1254 baytlari
// barindirabiliyor. Dosyanin tamamini tek bir kodlamayla acmak bu durumda yeterli
// degil: UTF-8 olan kayitlar bozulurken Windows-1254 olan Turkce karakterler de
// "�" karakterine donusebiliyor. Bu decoder, gecerli UTF-8 dizilerini korur ve
// yalnizca gecerli UTF-8 olmayan baytlari Windows-1254 olarak yorumlar.
const NativeTextDecoder = globalThis.TextDecoder

const TURKISH_MOJIBAKE_MAP = new Map([
  ['Ã§', 'ç'],
  ['Ã‡', 'Ç'],
  ['ÄŸ', 'ğ'],
  ['Äž', 'Ğ'],
  ['Ä±', 'ı'],
  ['Ä°', 'İ'],
  ['Ã¶', 'ö'],
  ['Ã–', 'Ö'],
  ['ÅŸ', 'ş'],
  ['Åž', 'Ş'],
  ['Ã¼', 'ü'],
  ['Ãœ', 'Ü'],
])

const repairTurkishMojibake = (text) => {
  let repaired = text
  for (const [broken, correct] of TURKISH_MOJIBAKE_MAP) {
    repaired = repaired.split(broken).join(correct)
  }
  return repaired
}

const getUtf8SequenceLength = (bytes, index) => {
  const first = bytes[index]
  const remaining = bytes.length - index
  const isContinuation = (value) => value >= 0x80 && value <= 0xbf

  if (first <= 0x7f) return 1

  if (first >= 0xc2 && first <= 0xdf) {
    return remaining >= 2 && isContinuation(bytes[index + 1]) ? 2 : 0
  }

  if (first === 0xe0) {
    return remaining >= 3 &&
      bytes[index + 1] >= 0xa0 && bytes[index + 1] <= 0xbf &&
      isContinuation(bytes[index + 2]) ? 3 : 0
  }

  if ((first >= 0xe1 && first <= 0xec) || (first >= 0xee && first <= 0xef)) {
    return remaining >= 3 &&
      isContinuation(bytes[index + 1]) &&
      isContinuation(bytes[index + 2]) ? 3 : 0
  }

  if (first === 0xed) {
    return remaining >= 3 &&
      bytes[index + 1] >= 0x80 && bytes[index + 1] <= 0x9f &&
      isContinuation(bytes[index + 2]) ? 3 : 0
  }

  if (first === 0xf0) {
    return remaining >= 4 &&
      bytes[index + 1] >= 0x90 && bytes[index + 1] <= 0xbf &&
      isContinuation(bytes[index + 2]) &&
      isContinuation(bytes[index + 3]) ? 4 : 0
  }

  if (first >= 0xf1 && first <= 0xf3) {
    return remaining >= 4 &&
      isContinuation(bytes[index + 1]) &&
      isContinuation(bytes[index + 2]) &&
      isContinuation(bytes[index + 3]) ? 4 : 0
  }

  if (first === 0xf4) {
    return remaining >= 4 &&
      bytes[index + 1] >= 0x80 && bytes[index + 1] <= 0x8f &&
      isContinuation(bytes[index + 2]) &&
      isContinuation(bytes[index + 3]) ? 4 : 0
  }

  return 0
}

const asUint8Array = (input) => {
  if (input instanceof ArrayBuffer) return new Uint8Array(input)
  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
  }
  return null
}

if (NativeTextDecoder) {
  const utf8Decoder = new NativeTextDecoder('utf-8', { fatal: true })
  const windows1254Decoder = new NativeTextDecoder('windows-1254')

  const decodeMixedTurkishText = (input) => {
    const bytes = asUint8Array(input)
    if (!bytes) return null

    const parts = []
    let index = 0
    let utf8RunStart = 0

    while (index < bytes.length) {
      const sequenceLength = getUtf8SequenceLength(bytes, index)

      if (sequenceLength > 0) {
        index += sequenceLength
        continue
      }

      if (index > utf8RunStart) {
        parts.push(utf8Decoder.decode(bytes.subarray(utf8RunStart, index)))
      }

      parts.push(windows1254Decoder.decode(bytes.subarray(index, index + 1)))
      index += 1
      utf8RunStart = index
    }

    if (utf8RunStart < bytes.length) {
      parts.push(utf8Decoder.decode(bytes.subarray(utf8RunStart)))
    }

    return repairTurkishMojibake(parts.join(''))
  }

  class TurkishAwareTextDecoder extends NativeTextDecoder {
    constructor(label = 'utf-8', options = {}) {
      super(label, options)
      this.requestedLabel = String(label).toLowerCase()
    }

    decode(input, options = {}) {
      const isUtf8 = ['utf-8', 'utf8', 'unicode-1-1-utf-8'].includes(this.requestedLabel)

      // Streaming decode kullanan kutuphanelerin davranisini degistirmiyoruz.
      if (!isUtf8 || options?.stream === true || input == null) {
        return super.decode(input, options)
      }

      const decoded = decodeMixedTurkishText(input)
      return decoded == null ? super.decode(input, options) : decoded
    }
  }

  globalThis.TextDecoder = TurkishAwareTextDecoder
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
