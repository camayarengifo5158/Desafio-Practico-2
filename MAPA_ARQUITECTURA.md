# 🗺️ Mapa de Arquitectura y Guía Pedagógica · Fragola Postres

Este documento es la **guía maestra de estudio** para los tres integrantes del equipo (**Josué Méndez**, **Fernando Calvo** y **Carlos Amaya**). Su propósito es que cualquiera de los tres pueda explicar con total naturalidad, solvencia y detalle técnico cómo funciona cada rincón del sistema frente al docente evaluador durante la defensa oral y la modificación en vivo (*live coding*).

---

## 🏛️ La Arquitectura en Pocas Palabras: ¿Cómo funciona este proyecto?

El proyecto no utiliza frameworks pesados como React o Angular, ni tampoco un backend propio en Node.js o Python (lo cual estaba prohibido por la rúbrica). En su lugar, implementa una arquitectura moderna de **Backend as a Service (BaaS)** con **JavaScript Nativo (ES Modules)**, dividida en **4 capas estrictas con flujo unidireccional de datos**:

```
┌─────────────────────────────────────────────────────────────┐
│                    VISTAS HTML (Páginas)                    │
│   (index, catalogo, pedidos, comprobante, admin, ingresar)  │
└──────────────────────────────┬──────────────────────────────┘
                               │ Disparan eventos de usuario
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  CAPA DE INTERFAZ (js/ui/)                  │
│       Controla el DOM, modales, toasts, estados de carga    │
└──────────────────────────────┬──────────────────────────────┘
                               │ Llama a funciones puras y repositorios
                               ▼
┌─────────────────────────────────────────────────────────────┐
│               CAPA DE LÓGICA (js/logica/)                   │
│   Filtros, búsquedas, cálculos de dinero, 48h anticipación  │
└──────────────────────────────┬──────────────────────────────┘
                               │ Solicita lectura / mutación
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                CAPA DE DATOS (js/data/)                     │
│    Repositorios asíncronos que hablan con Firebase Auth     │
│             y consultan colecciones en Firestore            │
└──────────────────────────────┬──────────────────────────────┘
                               │ Peticiones protegidas por red
                               ▼
┌─────────────────────────────────────────────────────────────┐
│        INFRAESTRUCTURA CLOUD (Firebase & Firestore)         │
│     firestore.rules evalúa quién eres y si tienes permiso   │
└─────────────────────────────────────────────────────────────┘
```

> **Regla de oro de la dependencia:**  
> La interfaz (`ui/`) depende de la lógica y de los datos. La lógica (`logica/`) no toca el DOM ni la base de datos. Los datos (`data/`) solo tocan Firebase. Y la configuración (`config/`) provee las constantes a todos.

---

## 📊 Tabla Maestra de Archivos del Proyecto

| Ruta del Archivo | Capa Arquitectónica | Responsabilidad Principal en Fragola | Archivos con los que Colabora |
| :--- | :--- | :--- | :--- |
| **`firestore.rules`** | Infraestructura / Seguridad | Es el "guardia de seguridad" en los servidores de Google. Decide qué usuario puede leer, crear, modificar o borrar en Firestore. | Con la consola de Firebase y las peticiones de `js/data/`. |
| **`.firebaserc`** | Infraestructura / Config | Le dice a la terminal de Firebase CLI a qué proyecto en la nube (`fragola-postres`) debe conectarse al desplegar. | Con `firebase.json` y Firebase CLI. |
| **`firebase.json`** | Infraestructura / Config | Define las instrucciones de despliegue para Firebase (indica dónde están las reglas de Firestore). | Con `firestore.rules`. |
| **`js/config/firebase.js`** | Configuración de Plataforma | Inicializa la aplicación de Firebase con las credenciales públicas y exporta las herramientas oficiales del SDK (Auth y Firestore). | Es importado por toda la capa `js/data/`. |
| **`js/config/app-config.js`** | Configuración de Negocio | El "diccionario" del negocio: lista las categorías, los roles (`admin`/`cliente`), los estados de pedidos y los costos de envío. | Usado por prácticamente todos los módulos de lógica, datos y UI. |
| **`js/data/auth.js`** | Persistencia / Autenticación | Administra el registro, inicio y cierre de sesión con Firebase Auth, y sincroniza el perfil del usuario guardado en Firestore. | Con `firebase.js`, `validaciones.js` y `comun.js`. |
| **`js/data/postres-repo.js`** | Persistencia / Catálogo | Realiza el CRUD completo de postres (crear, leer, editar, cambiar disponibilidad y eliminar) en la colección `postres` de Firestore. | Con `firebase.js`, `auth.js` y `validaciones.js`. |
| **`js/data/transacciones-repo.js`** | Persistencia / Ventas | Registra compras simuladas, actualiza pedidos, cancela pedidos y consulta transacciones respetando la seguridad de Firestore. | Con `firebase.js`, `auth.js`, `postres-repo.js` y `validaciones.js`. |
| **`js/data/usuarios-repo.js`** | Persistencia / Usuarios | Permite al administrador ver la lista de todos los usuarios registrados y cambiarles el rol (`admin` o `cliente`). | Con `firebase.js` y `auth.js`. |
| **`js/data/semilla.js`** | Persistencia / Semilla | Contiene los 22 postres del catálogo original y 9 transacciones de prueba; provee la función para restablecer Firestore. | Con `firebase.js` y `pagina-admin.js`. |
| **`js/data/almacenamiento.js`** | Persistencia Local | Módulo auxiliar para operaciones síncronas rápidas de lectura/escritura en el `localStorage` del navegador (para carrito y caché). | Usado por `carrito.js` y `auth.js`. |
| **`js/logica/carrito.js`** | Lógica de Dominio | Administra el carrito de compras en el navegador: agregar, cambiar cantidades, quitar postres y calcular subtotales. | Con `almacenamiento.js` y `validaciones.js`. |
| **`js/logica/procesamiento.js`** | Lógica Pura | Funciones matemáticas y de filtrado: busca postres sin importar tildes, ordena listas, agrupa por categorías y calcula los KPIs de ventas. | Usado por `pagina-catalogo.js`, `admin-resumen.js`, etc. |
| **`js/logica/validaciones.js`** | Lógica de Reglas | El árbitro de las reglas: verifica que los nombres tengan letras válidas, contraseñas seguras, pedidos con 48h de anticipación y mínimos por producto. | Usado por `auth.js`, `postres-repo.js`, `transacciones-repo.js` y la UI. |
| **`js/logica/formato.js`** | Lógica de Presentación | Da formato amigable a los datos: convierte números a dinero (`$12.50`), formatea fechas en español y limpia textos para evitar hackeos XSS (`escaparHTML`). | Usado por toda la capa `ui/`. |
| **`js/ui/comun.js`** | UI Compartida | Componentes visuales que usan todas las páginas: la barra de navegación con sesión, los avisos flotantes (toasts), el modal de confirmación y los spinners de carga. | Usado por todos los controladores de página. |
| **`js/ui/plantillas.js`** | UI / Generador HTML | Fábrica de pedazos de HTML: genera insignias de estado (verde para entregado, amarillo para pendiente), opciones de `<select>` y tarjetas. | Usado por `comun.js`, `pagina-catalogo.js`, `admin-*.js`. |
| **`js/ui/dialogo-transaccion.js`** | UI / Modal de Edición | Controla el formulario emergente que permite al cliente modificar la fecha o notas de su pedido, y al admin editar cantidades y productos. | Con `plantillas.js`, `validaciones.js` y `comun.js`. |
| **`js/ui/pagina-general.js`** | UI / Controlador | Controlador súper ligero para las páginas informativas (`index.html`, `sobreNosotros.html`, `contacto.html`). Solo monta la sesión en la cabecera. | Con `comun.js`. |
| **`js/ui/pagina-catalogo.js`** | UI / Catálogo | El cerebro visual del catálogo: escucha el buscador, los filtros y el orden; dibuja las tarjetas; maneja el carrito lateral y abre el modal de checkout. | Con `postres-repo.js`, `transacciones-repo.js`, `carrito.js`, `procesamiento.js`. |
| **`js/ui/pagina-ingresar.js`** | UI / Login y Registro | Maneja las pestañas de inicio de sesión y registro, valida los campos en vivo, muestra alertas de error y redirige al usuario a donde quería ir. | Con `auth.js`, `comun.js`. |
| **`js/ui/pagina-pedidos.js`** | UI / Historial Cliente | Muestra la lista de compras del cliente conectado, permite filtrar por estado, descargar comprobante y cancelar pedidos pendientes. | Con `transacciones-repo.js`, `dialogo-transaccion.js`, `comun.js`. |
| **`js/ui/pagina-comprobante.js`** | UI / Comprobante | Lee el folio de la URL (`?folio=FRG-XXXXX`), pide la transacción a Firestore, dibuja el recibo desglosando el IVA del 13% y activa el botón de imprimir en PDF. | Con `transacciones-repo.js`, `comun.js`. |
| **`js/ui/pagina-admin.js`** | UI / Panel Admin | Controlador maestro de `admin.html`: gestiona las 4 pestañas del panel y el botón para restablecer los datos de prueba en Firebase. | Con `admin-resumen.js`, `admin-postres.js`, `admin-transacciones.js`, `admin-usuarios.js`. |
| **`js/ui/admin-resumen.js`** | UI / Dashboard | Calcula y dibuja las tarjetas de métricas del negocio (ingresos, ticket promedio, saldo por cobrar, barras de ventas por categoría y postres más vendidos). | Con `transacciones-repo.js`, `postres-repo.js`, `procesamiento.js`. |
| **`js/ui/admin-postres.js`** | UI / CRUD Catálogo | Permite al administrador crear postres con fotos y presentaciones de precio, editarlos, borrarlos y activar o desactivar su venta con un switch. | Con `postres-repo.js`, `validaciones.js`, `comun.js`. |
| **`js/ui/admin-transacciones.js`**| UI / CRUD Ventas | Tabla de todas las ventas del negocio: buscador por cliente o folio, selector para avanzar estados de entrega, botón de cobro y eliminación. | Con `transacciones-repo.js`, `dialogo-transaccion.js`, `comun.js`. |
| **`js/ui/admin-usuarios.js`** | UI / Roles | Muestra todos los clientes registrados, cuántos pedidos han hecho y cuánto han gastado; permite promover un cliente a administrador. | Con `usuarios-repo.js`, `transacciones-repo.js`, `comun.js`. |
| **`index.html`** | Vista | Portada y bienvenida a Fragola: historia, llamada a la acción y accesos directos al catálogo. | Carga `style.css`, `app.css` y `pagina-general.js`. |
| **`catalogo.html`** | Vista | La tienda virtual: menú de postres, buscador dinámico, filtros de categoría, carrito deslizable y modal de checkout. | Carga `pagina-catalogo.js`. |
| **`ingresar.html`** | Vista | Pantalla de acceso: formularios accesibles para iniciar sesión o registrar una nueva cuenta con validaciones visuales. | Carga `pagina-ingresar.js`. |
| **`pedidos.html`** | Vista | Portal del cliente: historial de compras con estados en tiempo real y botones para gestionar pedidos. | Carga `pagina-pedidos.js`. |
| **`comprobante.html`** | Vista | Documento formal de compra preparado con estilos de impresión para exportar en PDF. | Carga `pagina-comprobante.js`. |
| **`admin.html`** | Vista | Panel de control exclusivo para administradores con 4 paneles interactivos. | Carga `pagina-admin.js`. |
| **`sobreNosotros.html`** | Vista | Información de la marca, valores de repostería artesanal y sucursales. | Carga `pagina-general.js`. |
| **`contacto.html`** | Vista | Canales de atención, formulario de cotización personalizada y enlaces a redes. | Carga `pagina-general.js`. |
| **`css/style.css`** | Estilos Base | Tipografías, colores de marca de Fragola (fucsia, crema, chocolate), reset de estilos y maquetación de cabecera y pie. | Utilizado por todas las páginas HTML. |
| **`css/app.css`** | Estilos de Componentes | Estilos avanzados: paneles de administración, carrito flotante, diálogos modulares, tablas responsivas que se vuelven tarjetas en móviles y avisos flotantes. | Utilizado por todas las páginas HTML. |

---

## 🎯 Guía Estratégica: Preguntas Típicas del Evaluador en la Defensa

### Pregunta 1: *"¿Dónde está la base de datos y cómo se conecta el proyecto con ella?"*
> **Respuesta recomendada:**  
> *"Nuestra persistencia remota está en **Google Cloud Firestore**. No usamos un servidor intermedio porque la rúbrica exigía integración directa con Firebase. En `js/config/firebase.js` inicializamos el SDK Web Modular v10. Toda consulta o guardado se hace de forma asíncrona mediante promesas con `async/await` desde los archivos en `js/data/` (`postres-repo.js`, `transacciones-repo.js`, `auth.js` y `usuarios-repo.js`)."*

### Pregunta 2: *"¿Por qué ocultar botones en la interfaz no es seguridad y cómo lo resolvieron ustedes?"*
> **Respuesta recomendada:**  
> *"Ocultar un botón con CSS o JavaScript es solo estética, porque cualquier usuario con conocimientos técnicos puede abrir la consola de desarrollador y ejecutar una función de borrado o una petición HTTP. Nosotros resolvimos la seguridad real en la nube con **`firestore.rules`**: las reglas de Firestore son una barrera perimetral en los servidores de Google. Si un cliente intenta borrar un postre o leer la transacción de otro cliente, Firestore rechaza la petición a nivel de base de datos con `Missing or insufficient permissions`, sin importar lo que haga en el navegador."*

### Pregunta 3: *"¿Qué significa el principio 'Rules are not filters' en Cloud Firestore?"*
> **Respuesta recomendada:**  
> *"Significa que Firestore no recupera todos los documentos para luego filtrar los que el usuario tiene permiso de ver. Al contrario: evalúa la consulta **de manera previa y estática**. La consulta que enviamos desde el cliente debe garantizar mediante sus cláusulas `where` que es matemáticamente imposible recibir un documento prohibido. Por ejemplo, en `transacciones-repo.js`, cuando un cliente busca un pedido por su folio, obligatoriamente incluimos `where('clienteId', '==', usuario.id)`. Si omitiéramos ese filtro, Firestore rechazaría la consulta completa de inmediato."*

### Pregunta 4: *"Si les pido agregar un nuevo campo al formulario de checkout (por ejemplo, 'Teléfono del destinatario'), ¿qué archivos tendrían que modificar?"*
> **Respuesta para Live Coding:**  
> 1. En **`catalogo.html`**: Agrego el `<input type="tel" name="telefono" id="checkout-telefono">` dentro del `<fieldset>` de entrega.
> 2. En **`js/logica/validaciones.js`**: En la función `validarEntrega()`, agrego la regla (ej. verificar que no esté vacío o que tenga 8 dígitos).
> 3. En **`js/data/transacciones-repo.js`**: En `crearTransaccion()`, extraigo `entrega.telefono` y lo incluyo dentro del objeto `entrega` que se guarda con `setDoc` en Firestore.
> 4. En **`js/ui/pagina-comprobante.js`**: Lo pinto en la sección de entrega del comprobante para que aparezca en el PDF.
