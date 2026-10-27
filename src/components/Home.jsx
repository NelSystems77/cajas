import { useRef } from 'react'

export default function Home({ catalogo, resultados, query, setQuery, presentaciones, onSelect, onFile, onQuitar, progreso, error }) {
  const input = useRef()
  const shown = resultados.slice(0, 100)
  const hechos = catalogo.productos.filter((p) => presentaciones.has(p.codigo)).length
  return (
    <div className="home">
      <header className="top">
        <div className="row">
          <div className="grow">
            <h1>Productos</h1>
            <p className="sub" title={catalogo.archivo}>
              {catalogo.archivo} · {hechos}/{catalogo.productos.length} con presentación
            </p>
          </div>
          <button className="btn ghost" onClick={() => input.current.click()} disabled={!!progreso}>
            {progreso ? `${progreso.n}/${progreso.total || '…'}` : 'Cambiar PDF'}
          </button>
          <input ref={input} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onFile(f) }} />
        </div>
        <div className="search">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por código o nombre"
            aria-label="Buscar producto por código o nombre"
            autoComplete="off"
            enterKeyHint="search"
          />
        </div>
        {error && <p className="error" role="alert">{error}</p>}
      </header>

      <ul className="list">
        {shown.map((p) => {
          const pres = presentaciones.get(p.codigo)
          return (
            <li key={p.codigo}>
              <button className="item" onClick={() => onSelect(p)}>
                <span className="code">{p.codigo}</span>
                <span className="name">{p.nombre || 'Sin nombre'}</span>
                {pres ? (
                  <span className="badge ok">✓ {pres.unidades_por_caja_menor}
                    {pres.tiene_caja_master ? ` · ${pres.factor_empaque_total}` : ''}</span>
                ) : (
                  <span className="badge">Pendiente</span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
      {!shown.length && <p className="empty">Sin resultados para “{query}”.</p>}
      {resultados.length > shown.length && (
        <p className="empty">Mostrando 100 de {resultados.length}. Afina la búsqueda.</p>
      )}
      <footer className="foot"><button className="link" onClick={() => confirm('¿Quitar el PDF cargado? Las presentaciones guardadas no se borran.') && onQuitar()}>Quitar PDF</button></footer>
    </div>
  )
}
