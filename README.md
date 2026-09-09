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

- Construir con **27 piezas**: 11 ladrillos, 11 placas y 5 baldosas, con 16 colores.
- Orbitar, acercar, desplazar y cambiar a vistas superior, frontal e isométrica.
- Previsualizar el encaje, girar 90°, apilar y detectar solapamientos.
- Seleccionar, mover, duplicar, pintar o borrar piezas y editar sus coordenadas.
- Deshacer y rehacer hasta 80 cambios, incluyendo cambios de proyecto y de base.
- Cambiar la base entre 16, 32, 48 y 64 tetones por lado.
- Construir a altura automática o fijar una capa; permitir piezas flotantes para bocetar.
- Recuperar la última sesión automáticamente y guardar varias copias en Mis proyectos.
- Importar y exportar proyectos JSON, capturas PNG, modelos GLB y listas de piezas CSV.
- Consultar dimensiones nominales e inventario por pieza y color.

## Controles

| Acción | Ratón / teclado |
| --- | --- |
| Colocar o aplicar herramienta | Clic izquierdo |
| Orbitar cámara | Arrastrar con el botón izquierdo |
| Acercar / alejar | Rueda |
| Desplazar cámara | Arrastrar con el botón derecho |
| Construir / seleccionar | B / V |
| Mover / pintar / borrar | M / P / X |
| Girar 90° | R |
| Duplicar selección | Ctrl/Cmd + D |
| Eliminar selección | Supr o Retroceso |
| Deshacer | Ctrl/Cmd + Z |
| Rehacer | Ctrl/Cmd + Shift + Z o Ctrl/Cmd + Y |
| Guardar una copia | Ctrl/Cmd + S |
| Centrar cámara | F |
| Cancelar movimiento o selección | Esc |

En una pantalla táctil: toca para colocar, arrastra un dedo para orbitar y usa dos dedos para acercar o desplazar. El botón de menú abre el catálogo. Al mover una pieza, el primer clic la recoge y el siguiente confirma; Esc cancela sin modificarla.

## Guardado y portabilidad

El autoguardado y Mis proyectos usan **localStorage**, en el navegador y origen desde el que accedas. No se guardan en el contenedor. Cambiar de navegador, puerto, equipo, `localhost` a una IP o borrar los datos del sitio crea una colección diferente. Detener o reconstruir Docker no borra los datos del navegador.

Usa **Exportar → Proyecto editable** para conservar una copia independiente o pasarla a otro dispositivo; impórtala desde Mis proyectos. El GLB es una exportación de geometría para herramientas externas, no el formato editable de Bricklab. Las exportaciones incluyen solo las piezas; la captura PNG también muestra la base. Los archivos GLB usan metros, con un tetón equivalente a 8 mm.

El JSON tiene formato `bricklab`, versión `1`, nombre, tamaño de base y una lista de piezas con `id`, `part`, `color`, `rotation`, `x`, `y`, `z`. La importación comprueba formato, tipos, límites y colisiones. Los modelos con piezas flotantes se pueden importar y se señalan en el editor.

## Encaje y alcance de esta versión

Las coordenadas X/Z se expresan en tetones; Y en placas. Una placa equivale a 3,2 mm y un ladrillo a tres placas. Las dimensiones mostradas corresponden al cuerpo nominal, sin sumar los tetones superiores.

Una pieza se conecta por sus tetones a la base o a otra pieza conectada. Se permiten voladizos y uniones por debajo de una pieza; el contacto lateral no se considera unión. Las baldosas tienen la cara superior lisa. Si eliminas un apoyo, las piezas restantes no caen: el editor avisa de las que pierden conexión con la base.

Es un **editor geométrico inicial**, no un simulador de resistencia o CAD de fabricación. No evalúa estabilidad, cargas, tolerancias, fricción ni montabilidad de la secuencia. El catálogo todavía no incluye pendientes, bisagras, ejes, ruedas, minifiguras ni el catálogo completo de LEGO/LDraw; tampoco realiza compras o colaboración multiusuario. Las formas y colores son aproximaciones propias y no llevan referencias comerciales oficiales. Los modelos admiten como límite de protección 2.000 piezas; el rendimiento depende de la GPU y de la complejidad. Los GLB grandes pueden tardar en exportarse.

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

`npm run check` comprueba sintaxis, ejecuta las pruebas y compila producción. Las pruebas cubren encaje, rotación, apoyos, baldosas, puentes, movimiento, validación de importación, el ejemplo, historial, inventario, persistencia y exportación GLB real. No sustituyen pruebas de interacción en el navegador.

## Estructura

| Archivo | Responsabilidad |
| --- | --- |
| `src/catalog.js` | Dimensiones y catálogo de piezas y colores |
| `src/model.js` | Colisiones, conexiones, validación, historial e inventario |
| `src/scene.js` | Escena Three.js, geometría, cámara, selección y exportación GLB |
| `src/storage.js` | Autoguardado y copias locales |
| `src/main.js` | Interfaz y acciones del editor |
| `src/style.css` | Diseño adaptable a escritorio y móvil |

La interfaz utiliza [Three.js](https://threejs.org/docs/) y los iconos [Lucide](https://lucide.dev/), empaquetados localmente con Vite. El núcleo de construcción no depende del renderizador.
