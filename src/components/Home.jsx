import { useRef, useState } from 'react'

const PAGE = 100

export default function Home({ catalogo, resultados, query, setQuery, presentaciones, onSelect, onFile, onQuitar, progreso, error }) {
  const input = useRef()
  const [filtro, setFiltro] = useState('pendientes')
  const [limite, setLimite] = useState(PAGE)
  const registrado = (p) => presentaciones.has(p.codigo)
  const pendientes = resultados.filter((p) => !registrado(p))
  const registrados = resultados.length - pendientes.length
  const visibles = filtro === 'pendientes' ? pendientes : filtro === 'registrados' ? resultados.filter(registrado) : resultados
  const shown = visibles.slice(0, limite)
  const tabs = [
    ['pendientes', 'Pendientes', pendientes.length],
    ['registrados', 'Registrados', registrados],
    ['todos', 'Todos', resultados.length],
  ]
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
            onChange={(e) => { setQuery(e.target.value); setLimite(PAGE) }}
            placeholder="Buscar por código o nombre"
            aria-label="Buscar producto por código o nombre"
            autoComplete="off"
            enterKeyHint="search"
          />
        </div>
        <div className="tabs" role="tablist" aria-label="Filtrar productos">
          {tabs.map(([k, label, n]) => (
            <button key={k} role="tab" aria-selected={filtro === k} className={`tab ${filtro === k ? 'on' : ''}`}
              onClick={() => { setFiltro(k); setLimite(PAGE) }}>
              {label} <span>{n}</span>
            </button>
          ))}
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
                  <span className="badge ok">✓ {pres.unidades_por_caja_menor != null
                    ? `${pres.unidades_por_caja_menor}${pres.tiene_caja_master ? ` · ${pres.factor_empaque_total}` : ''}`
                    : `📦📦 ${pres.factor_empaque_total}`}</span>
                ) : (
                  <span className="badge">Pendiente</span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
      {!shown.length && (
        <div className="empty">
          {filtro === 'pendientes' && !query && resultados.length > 0 ? (
            <><p>🎉 ¡No quedan productos pendientes!</p><button className="link" onClick={() => setFiltro('registrados')}>Ver registrados</button></>
          ) : query ? (
            <>
              <p>Sin resultados para “{query}” en esta vista.</p>
              {filtro !== 'todos' && resultados.length > 0 && (
                <button className="link" onClick={() => setFiltro('todos')}>Ver los {resultados.length} de todas las vistas</button>
              )}
            </>
          ) : <p>Nada por mostrar.</p>}
        </div>
      )}
      {visibles.length > shown.length && (
        <div className="empty">
          <button className="btn" onClick={() => setLimite((l) => l + PAGE)}>Mostrar {Math.min(PAGE, visibles.length - shown.length)} más · quedan {visibles.length - shown.length}</button>
        </div>
      )}
      <footer className="foot"><button className="link" onClick={() => confirm('¿Quitar el PDF cargado? Las presentaciones guardadas no se borran.') && onQuitar()}>Quitar PDF</button></footer>
    </div>
  )
}
