import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css' // Tailwind CSS burada dahil ediliyor

// Koha'dan indirilen CSV dosyalari bazi ortamlarda Windows-1254 (Turkce)
// kodlamasiyla gelebiliyor. App.jsx dosyasi bu dosyalari UTF-8 olarak okudugu icin
// gecersiz baytlar "�" karakterine donusuyordu. UTF-8 gecerliyse aynen kullan,
// degilse Windows-1254'e geri dus. Streaming decode islemlerine dokunmuyoruz.
const NativeTextDecoder = globalThis.TextDecoder

if (NativeTextDecoder) {
  class TurkishAwareTextDecoder extends NativeTextDecoder {
    constructor(label = 'utf-8', options = {}) {
      super(label, options)
      this.requestedLabel = String(label).toLowerCase()
      this.decoderOptions = options || {}
    }

    decode(input, options = {}) {
      const isUtf8 = ['utf-8', 'utf8', 'unicode-1-1-utf-8'].includes(this.requestedLabel)

      if (!isUtf8 || options?.stream === true || input == null) {
        return super.decode(input, options)
      }

      try {
        return new NativeTextDecoder('utf-8', {
          ...this.decoderOptions,
          fatal: true,
        }).decode(input, options)
      } catch {
        return new NativeTextDecoder('windows-1254', {
          ignoreBOM: this.decoderOptions.ignoreBOM,
        }).decode(input, options)
      }
    }
  }

  globalThis.TextDecoder = TurkishAwareTextDecoder
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
