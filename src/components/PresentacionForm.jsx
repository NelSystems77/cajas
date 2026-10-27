import { useEffect, useState } from 'react'
import { FORMAS, UNIDADES, EMPAQUES, plural, cuantas, unidadSugerida, empaqueSugerido, usaCajaPequena, usaCajaGrande, factorEmpaqueTotal, cajasPequenasEnGrande, validate, toDoc, fromDoc } from '../lib.js'
import { getPresentacion, savePresentacion } from '../firebase.js'

const VACIO = { forma: '', unidad: '', empaque: EMPAQUES.pequena, unidadesPorCajaMenor: '', unidadesPorCajaMaster: '' }
const OPCIONES = [
  [EMPAQUES.pequena, '📦', 'Solo caja pequeña', 'Se maneja únicamente en la caja individual.'],
  [EMPAQUES.ambas, '📦📦', 'Caja pequeña y caja grande', 'Varias cajas pequeñas vienen dentro de una caja grande.'],
  [EMPAQUES.grande, '🗃️', 'Solo caja grande', 'Viene directo en caja grande, sin cajas pequeñas (ej. jarabes, frascos).'],
]
const CHIPS_PEQUENA = [10, 14, 15, 20, 28, 30, 50, 100]
const CHIPS_GRANDE = [50, 100, 200, 300, 500, 1000]

function Stepper({ id, value, onChange, error }) {
  const n = Number(value) || 0
  return (
    <div className={`stepper ${error ? 'bad' : ''}`}>
      <button type="button" aria-label="Disminuir" onClick={() => onChange(String(Math.max(1, n - 1)))}>−</button>
      <input id={id} type="number" inputMode="numeric" min="1" step="1" value={value} placeholder="0"
        onChange={(e) => onChange(e.target.value)} onFocus={(e) => e.target.select()} />
      <button type="button" aria-label="Aumentar" onClick={() => onChange(String(n + 1))}>+</button>
    </div>
  )
}

function Chips({ options, value, onChange }) {
  return (
    <div className="chips" role="group" aria-label="Valores frecuentes">
      {options.map((o) => (
        <button type="button" key={o} className={`chip ${Number(value) === o ? 'on' : ''}`} onClick={() => onChange(String(o))}>{o}</button>
      ))}
    </div>
  )
}

function Field({ label, hint, error, children, htmlFor }) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? <small className="err" role="alert">{error}</small> : hint && <small>{hint}</small>}
    </div>
  )
}

export default function PresentacionForm({ producto, existente, onClose, onSaved }) {
  const [f, setF] = useState(() => ({
    ...VACIO,
    // Si ya existe, precargamos para facilitar la edición; si no, partimos del nombre del PDF.
    ...(existente ? fromDoc(existente) : { nombre: producto.nombre }),
  }))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [conflicto, setConflicto] = useState(null) // presentación ya guardada
  const [fail, setFail] = useState('')
  const [empaqueElegido, setEmpaqueElegido] = useState(!!existente)
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }))

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !conflicto && onClose()
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey) }
  }, [conflicto, onClose])

  const unidades = Number(f.unidadesPorCajaMenor) || 0
  const grande = Number(f.unidadesPorCajaMaster) || 0
  const cajas = cajasPequenasEnGrande(f)
  const total = factorEmpaqueTotal(f)
  const u = f.unidad || 'unidad'

  async function guardar(confirmado = false) {
    const e = validate(f)
    setErrors(e)
    if (Object.keys(e).length) {
      document.getElementById(Object.keys(e)[0])?.focus()
      return
    }
    setSaving(true)
    setFail('')
    try {
      if (!confirmado) {
        // Con caché local, getDoc responde aun sin conexión; si falla, usamos lo que ya conocemos.
        const previa = await getPresentacion(producto.codigo).catch(() => existente ?? null)
        if (previa) { setConflicto(previa); return }
      }
      await savePresentacion(producto.codigo, toDoc(producto.codigo, f))
      onSaved(`Guardado ${producto.codigo}`)
    } catch {
      setFail('No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const resumen = (d) =>
    [
      d.unidades_por_caja_menor != null && `Caja pequeña: ${d.unidades_por_caja_menor} ${plural(d.unidades_por_caja_menor, d.unidad_dispensa)}`,
      d.tiene_caja_master ? `Caja grande: ${d.unidades_por_caja_master ?? d.factor_empaque_total}` : 'Sin caja grande',
    ].filter(Boolean).join(' · ')

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="Presentación y empaque">
      <header className="sheet-head">
        <button className="btn ghost" onClick={onClose} aria-label="Volver">←</button>
        <div className="grow">
          <div className="code">{producto.codigo}</div>
          <div className="sub">{producto.nombre || 'Sin nombre'}</div>
        </div>
      </header>

      <form className="sheet-body" onSubmit={(e) => { e.preventDefault(); guardar() }} noValidate>
        {existente && <p className="notice">Este producto ya tiene una presentación guardada. Puedes editarla.</p>}

        <section>
          <h2>Medicamento</h2>
          <Field label="Nombre" htmlFor="nombre" error={errors.nombre}>
            <input id="nombre" value={f.nombre} onChange={(e) => set('nombre')(e.target.value)} placeholder="Ej. Paracetamol 500 mg tabletas" autoComplete="off" />
          </Field>
          <div className="two">
            <Field label="Forma farmacéutica" htmlFor="forma" error={errors.forma}>
              <select id="forma" value={f.forma} onChange={(e) => setF((s) => ({ ...s, forma: e.target.value, unidad: unidadSugerida(e.target.value) || s.unidad, empaque: empaqueElegido ? s.empaque : empaqueSugerido(e.target.value) }))}>
                <option value="">Seleccionar…</option>
                {FORMAS.map((x) => <option key={x}>{x}</option>)}
              </select>
            </Field>
            <Field label="Se cuenta por" htmlFor="unidad" error={errors.unidad}>
              <select id="unidad" value={f.unidad} onChange={(e) => set('unidad')(e.target.value)}>
                <option value="">Seleccionar…</option>
                {UNIDADES.map((x) => <option key={x}>{x}</option>)}
              </select>
            </Field>
          </div>
        </section>

        <section>
          <h2>¿Cómo viene empacado?</h2>
          <div className="opts" role="radiogroup" aria-label="Tipo de empaque">
            {OPCIONES.map(([v, icon, title, desc]) => (
              <label key={v} className={`opt ${f.empaque === v ? 'on' : ''}`}>
                <input type="radio" name="empaque" value={v} checked={f.empaque === v}
                  onChange={() => { setEmpaqueElegido(true); set('empaque')(v) }} />
                <span className="ico" aria-hidden="true">{icon}</span>
                <span><b>{title}</b><small>{desc}</small></span>
              </label>
            ))}
          </div>
        </section>

        {usaCajaPequena(f) && (
          <section className="box small">
            <h2><span aria-hidden="true">📦</span> Caja pequeña</h2>
            <p className="explain">La caja individual del medicamento, la que normalmente recibe el paciente.</p>
            <Field label={`¿${cuantas(f.unidad)} ${plural(2, u)} trae UNA caja pequeña?`} htmlFor="unidadesPorCajaMenor" error={errors.unidadesPorCajaMenor}>
              <Stepper id="unidadesPorCajaMenor" value={f.unidadesPorCajaMenor} onChange={set('unidadesPorCajaMenor')} error={errors.unidadesPorCajaMenor} />
              <Chips options={CHIPS_PEQUENA} value={f.unidadesPorCajaMenor} onChange={set('unidadesPorCajaMenor')} />
            </Field>
          </section>
        )}

        {usaCajaGrande(f) && (
          <section className="box big">
            <h2><span aria-hidden="true">{f.empaque === EMPAQUES.grande ? '🗃️' : '📦📦'}</span> Caja grande</h2>
            <p className="explain">La caja de bodega{f.empaque === EMPAQUES.ambas ? ' que agrupa varias cajas pequeñas' : ' en la que viene el producto'}.</p>
            <Field label={`¿${cuantas(f.unidad)} ${plural(2, u)} trae ${f.empaque === EMPAQUES.ambas ? 'en total ' : ''}UNA caja grande?`} htmlFor="unidadesPorCajaMaster"
              hint={f.empaque === EMPAQUES.ambas ? `Cuenta todas las ${plural(2, u)}, no las cajas pequeñas.` : undefined} error={errors.unidadesPorCajaMaster}>
              <Stepper id="unidadesPorCajaMaster" value={f.unidadesPorCajaMaster} onChange={set('unidadesPorCajaMaster')} error={errors.unidadesPorCajaMaster} />
              <Chips options={CHIPS_GRANDE} value={f.unidadesPorCajaMaster} onChange={set('unidadesPorCajaMaster')} />
            </Field>
          </section>
        )}

        <section className={`summary ${total ? 'live' : ''}`} aria-live="polite">
          <h2>Resumen</h2>
          {total ? (
            <ul>
              {usaCajaPequena(f) && unidades > 0 && (
                <li>📦 1 caja pequeña = <b>{unidades.toLocaleString('es')}</b> {plural(unidades, u)}</li>
              )}
              {usaCajaGrande(f) && grande > 0 && (
                <li>{f.empaque === EMPAQUES.grande ? '🗃️' : '📦📦'} 1 caja grande = <b>{grande.toLocaleString('es')}</b> {plural(grande, u)}
                  {cajas >= 1 && <> ≈ <b>{Number.isInteger(cajas) ? cajas : cajas.toFixed(1)}</b> {cajas === 1 ? 'caja pequeña' : 'cajas pequeñas'}</>}
                </li>
              )}
            </ul>
          ) : (
            <p className="sub">Ingresa las cantidades para ver el resumen.</p>
          )}
          {cajas >= 1 && !Number.isInteger(cajas) && (
            <p className="warn">La caja grande no equivale a un número exacto de cajas pequeñas. Verifica las cantidades.</p>
          )}
        </section>

        {fail && <p className="error" role="alert">{fail}</p>}
        <div className="savebar">
          <button className="btn primary big" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar presentación'}</button>
        </div>
      </form>

      {conflicto && (
        <div className="modal-bg">
          <div className="modal" role="alertdialog" aria-labelledby="ct" aria-describedby="cd">
            <h3 id="ct">Este código ya existe</h3>
            <p id="cd">¿Se trata de una actualización de la presentación?</p>
            <dl>
              <dt>Actual</dt><dd>{resumen(conflicto)}</dd>
              <dt>Nueva</dt><dd>{resumen(toDoc(producto.codigo, f))}</dd>
            </dl>
            <div className="actions">
              <button className="btn ghost" onClick={() => setConflicto(null)}>No, revisar</button>
              <button className="btn primary" onClick={() => { setConflicto(null); guardar(true) }}>Sí, actualizar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
