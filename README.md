# Cajas — PWA de control de empaques

Sube un PDF, busca productos por código (`X-XX-XX-XXXX` / `XXX-XX-XXXX`) o nombre y registra su presentación y empaque (caja pequeña / caja grande). Los datos se guardan en Firestore (colección `presentaciones`, id = código); si el código ya existe se pregunta si es una actualización.

```
npm install
npm run dev      # desarrollo
npm run build    # producción (genera el service worker)
npm test         # parser de códigos, búsqueda y cálculo de empaque
```

**Reglas de Firestore:** la app no usa autenticación; define reglas acordes (p. ej. restringir a `presentaciones/{id}`) o añade Firebase Auth antes de producción.
