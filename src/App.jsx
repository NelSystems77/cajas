import { useEffect, useMemo, useState } from 'react'
import { get, set, del } from 'idb-keyval'
import { extractProducts } from './pdf.js'
import { searchProducts } from './lib.js'
import { watchPresentaciones } from './firebase.js'
import Home from './components/Home.jsx'
import Upload from './components/Upload.jsx'
import PresentacionForm from './components/PresentacionForm.jsx'

const KEY = 'catalogo'

export default function App() {
  const [catalogo, setCatalogo] = useState(null) // { archivo, productos, fecha }
  const [cargando, setCargando] = useState(true)
  const [progreso, setProgreso] = useState(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [seleccion, setSeleccion] = useState(null)
  const [presentaciones, setPresentaciones] = useState(new Map())
  const [toast, setToast] = useState('')

  useEffect(() => {
    get(KEY).then((c) => setCatalogo(c ?? null)).catch(() => {}).finally(() => setCargando(false))
    return watchPresentaciones(setPresentaciones, () => {})
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 3200)
    return () => clearTimeout(t)
  }, [toast])

  const resultados = useMemo(
    () => (catalogo ? searchProducts(catalogo.productos, query) : []),
    [catalogo, query],
  )

  async function onFile(file) {
    setError('')
    setProgreso({ n: 0, total: 0 })
    try {
      const productos = await extractProducts(file, (n, total) => setProgreso({ n, total }))
      if (!productos.length) {
        setError('No encontramos códigos con formato X-XX-XX-XXXX o XXX-XX-XXXX en este PDF.')
        return
      }
      const c = { archivo: file.name, productos, fecha: Date.now() }
      setCatalogo(c)
      setQuery('')
      set(KEY, c).catch(() => {})
    } catch {
      setError('No se pudo leer el PDF. Verifica que no esté dañado ni protegido con contraseña.')
    } finally {
      setProgreso(null)
    }
  }

  function quitarCatalogo() {
    setCatalogo(null)
    setQuery('')
    del(KEY).catch(() => {})
  }

  if (cargando) return <div className="splash" aria-busy="true">Cargando…</div>

  return (
    <>
      {!catalogo ? (
        <Upload onFile={onFile} progreso={progreso} error={error} />
      ) : (
        <Home
          catalogo={catalogo}
          resultados={resultados}
          query={query}
          setQuery={setQuery}
          presentaciones={presentaciones}
          onSelect={setSeleccion}
          onFile={onFile}
          onQuitar={quitarCatalogo}
          progreso={progreso}
          error={error}
        />
      )}
      {seleccion && (
        <PresentacionForm
          producto={seleccion}
          existente={presentaciones.get(seleccion.codigo)}
          onClose={() => setSeleccion(null)}
          onSaved={(msg) => {
            setSeleccion(null)
            setToast(msg)
          }}
        />
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  )
}
