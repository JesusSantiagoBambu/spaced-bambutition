# Spaced Bambutition

App web local para controlar repasos adaptativos segun la curva del olvido, registrar rendimiento sobre 10 y usar puntos para recompensas personales.

## Como abrirla en local

Abre `index.html` en el navegador. No necesita servidor ni instalacion.

## Como convertirla en app instalable

La app ya esta preparada como PWA con `app.webmanifest`, `sw.js` e iconos en `icons/`.

Para que los alumnos puedan instalarla en movil o tablet:

1. Sube esta carpeta a un hosting con HTTPS, por ejemplo Netlify, Vercel, GitHub Pages o el servidor de tu academia.
2. Comparte la URL publica con los alumnos.
3. En Android/Chrome veran la opcion de instalar o el boton 📲 cuando el navegador la ofrezca.
4. En iPhone/iPad deben abrir la URL, tocar Compartir y elegir "Anadir a pantalla de inicio".

El modo instalable y el cache offline no funcionan desde `file://`; necesitan HTTPS o `localhost` durante desarrollo.

## Como actualizarla cuando haya mejoras

Si esta publicada en GitHub Pages, el flujo normal es:

1. Cambias los archivos de la app.
2. Haces commit y push al repositorio.
3. GitHub Pages publica automaticamente la nueva version.
4. La app detecta el nuevo `sw.js`, limpia la cache anterior y recarga para usar la version actualizada.

Cuando cambies archivos cacheados, sube tambien la version de `cacheName` en `sw.js` para forzar que los alumnos reciban la nueva app.

## Que incluye

- Plan base a 1, 3, 7, 14, 30, 60 y 120 dias desde la fecha de estudio.
- Reprogramacion adaptativa: notas altas espacian mas los siguientes repasos y notas bajas los acercan.
- Accion de repaso saltado: resta pocos puntos, mueve el repaso a recuperacion y recalcula los siguientes.
- Equilibrado de carga diaria para evitar mas de 3 repasos en el mismo dia.
- Metodo Ivy Lee en la vista de hoy: hasta 6 tareas diarias con pomodoros y puntos al completarlas.
- Dificultad tipo semaforo para cada tarea Ivy Lee: verde, amarillo o rojo.
- Estadisticas visuales de pomodoros de hoy, ultimos 7 dias y dias cumplidos.
- Las tareas Ivy Lee completadas desaparecen automaticamente al cambiar de dia, manteniendo sus puntos y estadisticas.
- Registro de nota por repaso, comentario opcional y media por tema.
- Puntos por completar repasos, bonus por buena nota y bonus por puntualidad.
- Racha diaria y niveles por puntos acumulados.
- Recompensas configurables por el propio estudiante.
- Notificaciones del navegador mientras la app esta abierta y el permiso esta activo.
- PWA instalable en movil/tablet cuando se publica en HTTPS, con icono y cache offline basico.
- Color principal de marca `#09A5BC` y tipografia Poppins con fallback de sistema.
- Ayudas contextuales con botones `?` para explicar cada bloque importante.
- Borrado de temarios desde la vista de progreso cuando se han creado por error.
- Pantalla ordenada con los repasos de hoy como primer bloque util en movil y tablet.
- Asignaturas/oposiciones reutilizables: al crear un temario, se guardan para poder elegirlas despues desde el desplegable.
- Recompensas borrables y canjeables con puntos.

## Nota

Los datos se guardan en el navegador mediante `localStorage`. Para una version multiusuario o para que el profesor pueda ver el avance de varios alumnos, el siguiente paso seria conectar una base de datos y autenticacion.
