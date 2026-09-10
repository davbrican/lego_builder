# Bricklab — constructor de ladrillos 3D

Un taller personal para construir modelos de ladrillos en el navegador. Se abre directamente en el editor con un pequeño pabellón que puedes transformar, o puedes comenzar con una base vacía.

## Arranque con Docker en el puerto 8098

Necesitas Git, una clave SSH configurada en GitHub y Docker con Compose (Docker Desktop en macOS/Windows, o Docker Engine con el complemento Compose en Linux).

```bash
git clone git@github.com:davbrican/lego_builder.git
cd lego_builder
docker compose up -d --build
```

Abre **http://localhost:8098**. Si lo ejecutas en otro ordenador de tu red, abre `http://IP_DEL_EQUIPO:8098`.

```bash
# Ver estado y registros
docker compose ps
docker compose logs -f

# Actualizar
git pull --ff-only
docker compose up -d --build

# Detener
docker compose down
```

El contenedor compila la aplicación con Node y sirve los archivos estáticos con Nginx. Compose publica `8098:80` y reinicia el servicio salvo que lo detengas manualmente. El puerto 8098 debe estar libre. La primera compilación necesita Internet para descargar imágenes y dependencias; después, la aplicación no necesita servicios externos, CDN ni cuentas.

## Qué puedes hacer

- Construir con **181 piezas LDraw** en 14 categorías, con 16 colores de libre elección.
- Orbitar, acercar, desplazar y cambiar a vistas superior, frontal e isométrica.
- Previsualizar el encaje en tetones reales, girar 90°, apilar y detectar solapamientos con perfiles de forma.
- Seleccionar, mover, duplicar, pintar o borrar piezas y editar sus coordenadas.
- Seleccionar conjuntos conectados con **G**, moverlos con ejes X/Y/Z y girarlos 90° alrededor de Y, previsualizar el encaje y confirmar o cancelar la operación completa.
- Deshacer y rehacer hasta 80 cambios, incluyendo cambios de proyecto y de base.
- Cambiar la base entre 16, 32, 48 y 64 tetones por lado.
- Construir a altura automática o fijar una capa; permitir piezas flotantes para bocetar.
- Recuperar la última sesión automáticamente y guardar varias copias en Mis proyectos.
- Importar y exportar proyectos JSON, capturas PNG, modelos GLB y listas de piezas CSV.
- Buscar por referencia LDraw, nombre o dimensiones; consultar la ficha y exportar un inventario con referencia, color y cantidad.

## Controles

Abre **Botones y controles**, abajo a la derecha del editor, para consultar la leyenda desplegable de herramientas, ajustes de precisión y cámara. También se puede abrir con Tab y Enter; su contenido se desplaza en pantallas pequeñas.

| Acción | Ratón / teclado |
| --- | --- |
| Colocar o aplicar herramienta | Clic izquierdo |
| Orbitar cámara | Arrastrar con el botón izquierdo |
| Acercar / alejar | Rueda |
| Desplazar cámara | Arrastrar con el botón derecho |
| Construir / seleccionar | B / V |
| Mover / pintar / borrar | M / P / X |
| Conjunto conectado | G |
| Girar 90° | R |
| Mover X/Z con precisión | Flechas (1 tetón); Shift + flechas (0,5) |
| Subir / bajar | RePág / AvPág (1 placa); con Shift (0,5) |
| Cambiar agarre: centro / esquinas | A o selector en Precisión |
| Fijar posición / seguir al ratón | L |
| Colocar la previsualización | Enter |
| Duplicar selección | Ctrl/Cmd + D |
| Eliminar selección | Supr o Retroceso |
| Deshacer | Ctrl/Cmd + Z |
| Rehacer | Ctrl/Cmd + Shift + Z o Ctrl/Cmd + Y |
| Guardar una copia | Ctrl/Cmd + S |
| Centrar cámara | F |
| Cancelar movimiento o selección | Esc |

En una pantalla táctil: toca para colocar, arrastra un dedo para orbitar y usa dos dedos para acercar o desplazar. El botón de menú abre el catálogo. Al mover una pieza, el primer clic la recoge y el siguiente confirma; Esc cancela sin modificarla.

## Colocación precisa y anclajes de esquina

En **Mover (M)** aparecen los controles de precisión automáticamente. Al construir una pieza nueva, ábrelos con **Precisión** junto al botón de giro.

- Elige **Centro** o una de las cuatro **esquinas** como punto de agarre; **A** recorre las opciones. El punto amarillo marca el receptor que se alinea con el tetón que señalas. En piezas irregulares se utiliza el receptor real más cercano a esa esquina.
- **Flechas** desplazan en X/Z un tetón; **RePág/AvPág** suben/bajan una placa. **Shift** reduce el paso a **0,5**. También hay botones X±/Y±/Z± y campos numéricos.
- El primer ajuste por teclado o coordenadas **fija la posición**: ni mover el ratón ni orbitar la cámara sobrescriben el ajuste. **L** o «Volver a seguir el ratón» recupera el seguimiento normal.
- **R** gira 90° manteniendo el punto de agarre cuando la posición está fijada. **Enter**, «Colocar» o un clic en la mesa confirman; **Esc/Cancelar** descartan el movimiento. Siguen comprobándose colisiones, límites y conexiones.
- Los conjuntos también se pueden desplazar con estas teclas. Sus ajustes por teclado no activan el imán y conservan la confirmación antes de aplicar cambios.

**Ejemplo: baldosa 6 × 6 en la esquina de una pared.** Busca `10202`, elige una esquina en Precisión y señala el tetón del extremo de la pared. La esquina de la baldosa se alinea con él, en lugar de centrar la baldosa sobre ese extremo. Ajusta con las flechas si hace falta y pulsa Enter.

## Construir por conjuntos y unirlos

1. Construye dos módulos en zonas distintas de la base.
2. Activa **Conjunto conectado (G)** y pulsa cualquier pieza de un módulo. Se recorre la red de tetones, huecos y uniones de asa y clip en ambas direcciones, incluyendo puentes y piezas colgantes. Compartir la base o tocarse por una cara no une dos módulos.
3. Arrastra los ejes **X/Y/Z**, cambia a **Girar Y** para usar el aro de giro en pasos de 90°, o usa **Colocar con puntero** y pulsa sobre el destino. También puedes introducir coordenadas del extremo mínimo del conjunto y previsualizarlas. X/Z se miden en tetones; Y, en placas.
4. A menos de 0,7 tetones de distancia espacial entre conectores, se busca un encaje cercano válido. La previsualización se ajusta sin alterar el proyecto. Al soltar un eje cerca de un encaje, o pulsar con el puntero, aparece **¿Unir los conjuntos aquí?**. El botón Confirmar también permite revisar la colocación.
5. Acepta **Sí, colocar aquí** para aplicar todo el movimiento de una vez. **Seguir ajustando** conserva la previsualización; **Cancelar / Esc** restaura las posiciones originales. **Deshacer** revierte el conjunto completo.

El conjunto no se guarda como un objeto permanente: al volver a seleccionarlo, se recalculan sus conexiones. Después de unir dos módulos, G selecciona ambos. Los cambios provisionales no llegan al historial ni al autoguardado. Las herramientas individuales mantienen su funcionamiento. Cambiar de herramienta descarta la previsualización pendiente.

Por ahora los giros son alrededor del eje vertical **Y**: no hay inclinaciones X/Z ni escalado. La conexión automática usa tetones y receptores verticales, además de las asas y clips revisados más abajo. Aún no reconoce tetones laterales SNOT, ejes ni bisagras.

## Enganchar asas y clips

Se han revisado las cinco referencias de esta familia presentes en el catálogo: **asas 48336 y 18649**, y **clips 61252, 60470b y 15712**. Sus conectores tienen posición, dirección y longitud útil; el clip doble puede enganchar sus dos mordazas a una misma asa.

1. Coloca un clip y elige un asa, o hazlo en el orden inverso.
2. Usa **R** para orientar la pieza y acerca el puntero a la zona de unión. Cuando encajan, el estado muestra **Asa y clip alineados**. El editor conserva la orientación que hayas elegido.
3. Si el tetón cercano atrae la pieza, abre **Precisión → Tipo de encaje → Asas y clips**. **Solo tetones** desactiva esta atracción y **Automático** compara la proximidad de ambas conexiones.
4. Confirma la colocación. **G** selecciona las piezas enganchadas como un conjunto; también se pueden acercar dos conjuntos por estas uniones y confirmar el ajuste.

Las uniones transmiten conexión a la base y se conservan al guardar, importar, mover y deshacer. Son uniones rígidas con los ejes alineados: todavía no se puede articular una pieza alrededor del asa ni inclinarla en X/Z. Las barras verticales de la valla 30055 necesitan esa inclinación para estos clips y siguen fuera del encaje automático. No se infieren conexiones de las rejillas ni del simple contacto entre superficies.

## Guardado y portabilidad

El autoguardado y Mis proyectos usan **localStorage**, en el navegador y origen desde el que accedas. No se guardan en el contenedor. Cambiar de navegador, puerto, equipo, `localhost` a una IP o borrar los datos del sitio crea una colección diferente. Detener o reconstruir Docker no borra los datos del navegador.

Usa **Exportar → Proyecto editable** para conservar una copia independiente o pasarla a otro dispositivo; impórtala desde Mis proyectos. El GLB es una exportación de geometría para herramientas externas, no el formato editable de Bricklab. El GLB conserva autores, referencias y licencias en sus metadatos `extras`; el PNG los incluye en un bloque estándar `iTXt`. Las exportaciones incluyen solo las piezas; la captura PNG también muestra la base. Los archivos GLB usan metros, con un tetón equivalente a 8 mm.

El JSON tiene formato `bricklab`, versión `2`, nombre, tamaño de base y una lista de piezas con `id`, `part`, `color`, `rotation`, `x`, `y`, `z`. La importación comprueba formato, tipos, límites y colisiones. Los modelos con piezas flotantes se pueden importar y se señalan en el editor.

## Catálogo de piezas reales

Se usa una selección revisada de la **biblioteca comunitaria LDraw, edición 2026-08**. Los modelos representan piezas reales de LEGO; LDraw no es una biblioteca publicada ni avalada por LEGO Group. Se incluyen los archivos originales y sus licencias. El selector muestra la referencia LDraw exacta (incluido el sufijo de molde cuando existe), el nombre traducido y la descripción original en la ficha.

| Categoría | Piezas |
| --- | ---: |
| Ladrillos | 24 |
| Placas | 28 |
| Baldosas | 16 |
| Pendientes | 22 |
| Curvas | 10 |
| Redondas | 18 |
| Arcos | 7 |
| Ventanas y vallas | 8 |
| Technic | 8 |
| Ruedas | 7 |
| Tetones laterales | 11 |
| Soportes angulares | 4 |
| Placas especiales | 10 |
| Alas | 8 |

Las geometrías se descargan desde tu propio contenedor cuando son necesarias. Las miniaturas usan una cola y un único renderizador; no se abren 181 contextos WebGL ni se cargan todas las piezas antes de entrar al taller. Los archivos se almacenan en caché con su hash de contenido.

La familia **Tetones laterales** incluye las referencias **99206** y **4304** (placa 2 × 2 con dos tetones laterales y dos elevados). La captura de unas instrucciones no permite distinguir con certeza esas dos variantes de molde. Las piezas laterales incluyen el volumen de sus tetones salientes en las colisiones; el espacio ocupado puede ser mayor que sus dimensiones nominales.

En la ficha puedes abrir el [archivo original de LDraw](https://library.ldraw.org/) o buscar la referencia en [LEGO Pick a Brick](https://www.lego.com/es-es/pick-and-build/pick-a-brick). La selección de colores es creativa: **no certifica que esa combinación de pieza/color exista o esté a la venta**. Algunas referencias son variantes históricas de molde. El catálogo no consulta precios ni existencias.

## Encaje y alcance de esta versión

Las coordenadas X/Z se expresan en tetones; Y en placas. Se admiten medios tetones y medias placas. Una placa equivale a 3,2 mm y el ladrillo básico a tres placas. La geometría LDraw usa 20 unidades por tetón y 8 por placa. La transformación al editor mantiene las proporciones del archivo fuente.

El encaje al apuntar a una pieza busca el tetón superior más cercano y alinea un hueco receptor de la pieza nueva. Esto permite colocar un ladrillo de 1 × 1 sobre el tetón central de un cono de 2 × 2, desplazándolo medio tetón. Las pendientes solo transmiten conexión por sus tetones; las superficies lisas no inventan conexiones. Las uniones se vuelven a calcular al borrar o mover apoyos.

Las colisiones usan perfiles de columnas de **1/4 de tetón (2 mm)**, obtenidos de la geometría del cuerpo sin los tetones verticales estándar (los laterales sí cuentan como volumen). Se conserva el espacio libre bajo los arcos y en las esquinas. Es una aproximación conservadora al volumen exterior: puede rechazar encajes ajustados, huecos laterales o montajes especiales. Los huecos receptores se infieren de la base de cada pieza y se revisan explícitamente para arcos y piezas con tetones integrados; no son un catálogo oficial de conexiones mecánicas.

Para un asa y un clip con conectores alineados se usan perfiles más finos, de **1/20 de tetón**, derivados de sus geometrías. Solo se admite el solapamiento del perfil dentro de la abertura de la mordaza enganchada. El cuerpo de ambas piezas y cualquier tercera pieza siguen comprobándose; alinear los conectores no autoriza a atravesar los cuerpos.

**Ruedas, neumáticos y llantas** son piezas individuales: se pueden colocar sobre la base o en modo libre. Todavía no se simulan encajes de ejes y pasadores, giro de ruedas, bisagras, conexiones laterales Technic ni estabilidad o resistencia. Tampoco se comprueba la secuencia física de montaje. Las piezas sin conexión se señalan y no caen por gravedad. El límite de protección es de 2.000 piezas; el rendimiento depende de la GPU y de la geometría elegida.

Esta versión usa proyectos y almacenamiento local **v2**. El prototipo v1 se descarta intencionadamente durante esta fase de desarrollo, sin migraciones ni alias de sus 27 piezas procedurales.

## Fuentes, autores y regeneración

- [Biblioteca LDraw](https://library.ldraw.org/) y [descarga oficial de la biblioteca LDraw](https://library.ldraw.org/updates?latest=).
- `public/ldraw/attribution.json`: autores, fuentes y licencias por pieza y dependencias.
- `public/ldraw/CAreadme.txt`, `CAlicense.txt`, `CAlicense4.txt`: condiciones originales CC BY 2.0 y/o CC BY 4.0.
- `scripts/ldraw-sources.json`: copia local de las 576 definiciones necesarias, con sus cabeceras originales. Solo se han normalizado las rutas de subarchivos.
- `scripts/build-ldraw.mjs`: triangula con Three.js, convierte ejes y unidades, indexa la geometría y genera perfiles y metadatos. Las aristas gráficas LDraw se omiten y los colores se sustituyen por el elegido en el editor.
- `scripts/build-mechanical.mjs`: genera los perfiles finos de las cinco asas y clips a partir de sus geometrías locales, conservando su hash para detectar datos desactualizados. `catalog:build` ejecuta ambos generadores; `npm run mechanical:build` regenera solo estos perfiles.

Las geometrías ya vienen generadas: **Docker no necesita acceder a LDraw**. Para regenerarlas a partir de las fuentes incluidas:

```bash
npm ci
npm run catalog:build
npm test
npm run build
```

Para actualizar la fuente, descarga explícitamente `complete.zip` de LDraw, revisa la selección en `scripts/collect-ldraw.py`, ajusta la edición indicada al nuevo archivo y ejecuta:

```bash
python scripts/collect-ldraw.py /ruta/a/complete.zip
npm run catalog:build
npm test
```

La recogida verifica referencias y dependencias; las pruebas comprueban hashes, geometrías, rotaciones, conexiones, atribuciones y exportaciones. Ninguna de estas tareas necesita servicios externos durante la compilación normal.

Proyecto independiente, sin afiliación con LEGO Group. LEGO es una marca de su titular.

## Desarrollo sin Docker

Node.js 22.12 o posterior:

```bash
npm ci
npm run dev
```

El servidor de desarrollo también usa el puerto 8098. La interfaz necesita WebGL 2 y aceleración gráfica. No abras `index.html` directamente como archivo.

```bash
npm test
npm run build
npm run preview
```

`npm run check` comprueba sintaxis, ejecuta las pruebas y compila producción. Las 36 pruebas cubren las 181 geometrías, los movimientos de conjuntos, los anclajes y ajustes de precisión y las seis combinaciones de asa y clip en ambos órdenes y sus cuatro giros, además de conexiones, colisiones, búsqueda, arcos, curvas, medios tetones, importación, historial, persistencia, exportación GLB y atribución en PNG. No sustituyen pruebas de interacción en el navegador.

## Estructura

| Archivo | Responsabilidad |
| --- | --- |
| `src/precision.js` | Previsualización fijada, pasos de teclado y giro sobre el punto de agarre |
| `src/mechanical.js` | Conectores revisados de asas y clips, alineación y abertura de las mordazas |
| `src/generated/mechanical-collisions.json` | Perfiles finos de colisión de asas y clips con hashes de origen |
| `src/assemblies.js` | Selección conectada, transformaciones rígidas, encaje y borradores sin mutación |
| `src/assembly-controls.js` | Ejes de desplazamiento, aro Y y previsualización del conjunto |
| `src/catalog.js` | Catálogo LDraw, búsqueda, colores y transformación de conectores |
| `src/generated/parts.json` | 181 referencias con dimensiones, perfiles y atribución |
| `src/geometry.js` | Carga local de geometrías con caché |
| `src/placement.js` | Colisiones por forma y grafo de conexiones |
| `src/model.js` | Validación, historial e inventario |
| `src/scene.js` | Escena Three.js, geometría, cámara, selección y exportación GLB |
| `src/storage.js` | Autoguardado y copias locales |
| `src/main.js` | Interfaz y acciones del editor |
| `src/style.css` | Diseño adaptable a escritorio y móvil |

La interfaz utiliza [Three.js](https://threejs.org/docs/) y los iconos [Lucide](https://lucide.dev/), empaquetados localmente con Vite. El núcleo de construcción no depende del renderizador.
