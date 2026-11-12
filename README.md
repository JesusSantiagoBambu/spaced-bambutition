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

- Motor de repasos inspirado en SM-2 (el algoritmo clasico de Anki), adaptado a notas de 0 a 10:
  - Primer repaso a las 24 horas; despues cada intervalo se multiplica por el factor de facilidad del tema.
  - Nota 9-10 (Excelente) alarga mas el intervalo; 7-8,5 (Bien fijado) lo multiplica por el factor; 5-6,5 (Fragil) solo lo alarga x1,2; menos de 5 (Refuerzo) vuelve a repasarse al dia siguiente y el tema reaprende desde un intervalo corto.
  - Si un repaso se hace tarde y sale bien, se tiene en cuenta ese retraso al calcular el siguiente.
  - Los temas nunca se dan por terminados: el ultimo intervalo (120 dias en modo normal) se repite siempre.
- Modo hardcore por tema (se activa y desactiva en cualquier momento): intervalos un 35% mas cortos y como maximo 35 dias.
- Accion de repaso saltado: resta pocos puntos y mueve el repaso a recuperacion al dia siguiente.
- Carga diaria elegible por el alumno (1 a 5 repasos, por defecto 3). El equilibrado solo mueve cada repaso unos dias (alrededor del 10% de su intervalo) para no romper la curva; los repasos de 1-2 dias nunca se mueven.
- Migracion automatica de los datos de la version anterior: el proximo repaso de cada tema conserva su fecha; los temas que antes se daban por completados vuelven al ciclo repartidos segun la carga diaria.
- Metodo Ivy Lee en la vista de hoy: hasta 6 tareas diarias con bloques (pomodoros) y puntos al completarlas.
- Duracion configurable por pomodoro: 25, 30, 35 o 50 minutos.
- Dificultad tipo semaforo para cada tarea Ivy Lee: verde, amarillo o rojo.
- Estadisticas visuales de pomodoros de hoy, ultimos 7 dias y dias cumplidos.
- Las tareas Ivy Lee completadas desaparecen automaticamente al cambiar de dia, manteniendo sus puntos y estadisticas.
- Registro de nota por repaso, comentario opcional y media por tema. Al evaluar se muestran los ultimos comentarios de ese tema.
- Progreso con grafica de nota media semanal y ficha de cada tema con su grafica de notas y todos sus comentarios.
- Calendario agrupado por dia con los repasos programados y los siguientes estimados (suponiendo un 7) dentro de los proximos 30 dias.
- Temas en modo hardcore marcados en rojo con 🔥.
- Puntos por completar repasos, bonus por buena nota y bonus por puntualidad.
- Racha diaria (vuelve a 0 si pasa un dia sin repasar) y niveles cada 250 puntos ganados (el nivel no baja al canjear recompensas).
- Recompensas configurables por el propio estudiante.
- Notificaciones del navegador mientras la app esta abierta y el permiso esta activo.
- Copias de seguridad en JSON para exportar e importar los datos del alumno.
- PWA instalable en movil/tablet cuando se publica en HTTPS, con icono y cache offline basico.
- Look pixel-art inspirado en consolas clasicas, manteniendo el color principal de marca `#09A5BC`. Tipografia pixelada solo en el titulo; el resto en Poppins para que se lea mejor.
- Ayudas contextuales con botones `?` para explicar cada bloque importante.
- Borrado de temarios desde la vista de progreso cuando se han creado por error.
- Pantalla ordenada con los repasos de hoy como primer bloque util en movil y tablet.
- Asignaturas/oposiciones reutilizables: al crear un temario, se guardan para poder elegirlas despues desde el desplegable.
- Recompensas que se pueden canjear tantas veces como se quiera mientras haya puntos (cada canje queda registrado; borrar una recompensa no devuelve los puntos gastados).

## Nota

Los datos se guardan en el navegador mediante `localStorage`. Para una version multiusuario o para que el profesor pueda ver el avance de varios alumnos, el siguiente paso seria conectar una base de datos y autenticacion.
