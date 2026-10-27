import { useRef } from 'react'

export default function Upload({ onFile, progreso, error }) {
  const input = useRef()
  const pick = (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f) onFile(f)
  }
  return (
    <main className="upload">
      <div className="logo" aria-hidden="true">📦</div>
      <h1>Cajas</h1>
      <p className="lead">Sube el PDF con tus productos y registra el empaque de cada uno en segundos.</p>
      <button className="btn primary big" onClick={() => input.current.click()} disabled={!!progreso}>
        {progreso ? `Leyendo página ${progreso.n} de ${progreso.total || '…'}` : 'Seleccionar PDF'}
      </button>
      <input ref={input} type="file" accept="application/pdf,.pdf" hidden onChange={pick} />
      {progreso && <div className="bar"><span style={{ width: `${progreso.total ? (progreso.n / progreso.total) * 100 : 5}%` }} /></div>}
      {error && <p className="error" role="alert">{error}</p>}
      <p className="hint">Detectamos códigos <b>X-XX-XX-XXXX</b> y <b>XXX-XX-XXXX</b>. El PDF se procesa en tu dispositivo.</p>
    </main>
  )
}
