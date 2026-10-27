# Fragola Postres · Desafío Práctico II

Aplicación web de pedidos en línea para **Fragola Postres**, construida sobre el sitio del Desafío Práctico I.
Desarrollo Web I · Ingeniería de Software y Negocios Digitales · ESEN 2026.

**Integrantes**

- Josué Gabriel Méndez Benítez — 20255610
- Fernando Alonso Calvo Recinos — 20255526
- Carlos Andrés Amaya Rengifo — 20255158

**Versión publicada:** https://camayarengifo5158.github.io/Desafio-Practico-2/

---

## Problema

Fragola recibe sus encargos por WhatsApp e Instagram. No hay un catálogo que se pueda actualizar sin tocar el código, ni un registro ordenado de las ventas: los precios cambian a mano, los pedidos se pierden entre mensajes y no hay un comprobante para el cliente.

La aplicación resuelve esto con dos procesos relacionados:

1. **Gestión del catálogo** — la administración crea, modifica, oculta y elimina postres; el catálogo público se genera a partir de esos datos.
2. **Compra y registro de transacciones** — el cliente arma un carrito con los postres del catálogo, simula el pago, recibe un comprobante y puede modificar o cancelar su pedido; la administración da seguimiento a cada venta y consulta indicadores.

## Roles

| Rol | Qué puede hacer |
|---|---|
| **Visitante** | Ver y filtrar el catálogo, armar el carrito. Para pagar debe registrarse o ingresar. |
| **Cliente** | Comprar, ver **solo sus** pedidos y comprobantes, modificar entrega/notas/cantidades y cancelar mientras el pedido esté *Pendiente*. |
| **Administrador** | CRUD de postres, consultar todas las transacciones, cambiar estados, registrar pagos, editar y eliminar transacciones, ver indicadores y asignar roles. |

Toda cuenta nueva se registra como **cliente**. Solo un administrador puede otorgar el rol de administrador, y no puede cambiar su propio rol.

## Funcionalidades

**Catálogo (`catalogo.html`)**
- Tarjetas generadas con JavaScript a partir de los datos guardados.
- Búsqueda sin distinguir tildes, filtro por categoría y disponibilidad, orden por nombre o precio, agrupación por categoría.
- Carrito lateral: agregar, cambiar cantidad, quitar y vaciar.
- Regla de negocio: cantidades mínimas por producto (p. ej. Key Lime Pie mínimo 12 unidades).

**Compra simulada y comprobante**
- Entrega en sucursal o a domicilio (+$3.50), con fecha mínima de 48 h de anticipación.
- Pago simulado: tarjeta, transferencia o efectivo contra entrega. No se piden ni se guardan datos de tarjetas.
- Los precios se vuelven a leer del catálogo al confirmar; el total no depende de lo que haya en el carrito del navegador.
- Comprobante (`comprobante.html?folio=FRG-00010`) con folio, detalle, envío, total, IVA incluido e impresión o PDF.

**Mis pedidos (`pedidos.html`)**
- Historial del usuario con filtro por estado y orden.
- Modificar o cancelar pedidos pendientes.

**Panel de administración (`admin.html`)**
- *Resumen:* ventas, ticket promedio, pedidos activos, monto por cobrar, ventas por categoría, postres más vendidos, pedidos por estado y próximas entregas.
- *Postres:* CRUD completo con presentaciones y precios dinámicos, imagen con vista previa y switch de disponibilidad.
- *Transacciones:* búsqueda por folio, cliente o correo; filtro por estado y rango de fechas; cambio rápido de estado; edición; eliminación; acceso al comprobante.
- *Usuarios:* listado con pedidos y monto comprado; cambio de rol.
- *Restablecer datos de prueba.*

Estados de un pedido: `Pendiente → En preparación → Lista para entrega → Entregada`. Cualquier estado no final puede pasar a `Cancelada`.

## Tecnología

- HTML5, CSS3 propio (sin frameworks) y JavaScript nativo con **módulos ES**.
- **Persistencia en `localStorage`** detrás de una capa de datos asíncrona (`async/await`) con latencia simulada, siguiendo la recomendación del profesor.
- Contraseñas guardadas como hash **SHA-256 con sal** (Web Crypto API).
- Publicado en **GitHub Pages**.

## Estructura

```
├── index.html, sobreNosotros.html, contacto.html   Páginas del Desafío I
├── catalogo.html        Catálogo dinámico, carrito y compra
├── ingresar.html        Inicio de sesión y registro
├── pedidos.html         Historial del cliente
├── comprobante.html     Comprobante de compra
├── admin.html           Panel de administración
├── css/
│   ├── style.css        Estilos del Desafío I
│   └── app.css          Componentes nuevos (carrito, diálogos, tablas, panel…)
├── img/                 Imágenes optimizadas (JPG ~100 KB)
└── js/
    ├── config/
    │   └── app-config.js          Claves de almacenamiento, roles, estados y reglas del negocio
    ├── data/                      Gestión de datos (lo único que toca localStorage)
    │   ├── almacenamiento.js      Lectura/escritura asíncrona y latencia simulada
    │   ├── semilla.js             Datos iniciales
    │   ├── auth.js                Registro, sesión, hash y guardias de rol
    │   ├── postres-repo.js        CRUD de postres
    │   ├── transacciones-repo.js  Compra, consulta, modificación, cancelación y eliminación
    │   └── usuarios-repo.js       Usuarios y roles
    ├── logica/                    Funciones puras, sin DOM
    │   ├── procesamiento.js       Búsqueda, filtros, orden, agrupación e indicadores
    │   ├── validaciones.js        Reglas de formularios y del negocio
    │   ├── carrito.js             Carrito del navegador
    │   └── formato.js             Dinero, fechas y escape de HTML
    └── ui/                        Comportamiento de la interfaz
        ├── comun.js               Control de acceso, cabecera, toasts, carga, confirmaciones
        ├── plantillas.js          Fragmentos HTML reutilizables
        ├── dialogo-transaccion.js Formulario para modificar un pedido
        ├── pagina-*.js            Un módulo por página
        └── admin-*.js             Una sección del panel por módulo
```

La dependencia va en un solo sentido: `ui → logica / data → config`. Las páginas nunca leen `localStorage` directamente.

## Seguridad y autorización

- Las operaciones protegidas verifican el rol **en la capa de datos** (`requerirSesion()` / `requerirRol()`), no solo ocultando botones. Por ejemplo, si un cliente llama `eliminarPostre()` desde la consola, recibe `ErrorAutorizacion`.
- Un cliente solo obtiene sus propias transacciones; pedir el folio de otra persona devuelve un error de permiso.
- El registro siempre asigna el rol `cliente`.
- Las contraseñas no se guardan en texto plano ni aparecen en el repositorio.
- Todo texto ingresado por usuarios se escapa antes de insertarse en el DOM.

**Limitación conocida:** `localStorage` vive en el navegador de cada usuario, así que los datos no se comparten entre dispositivos y alguien con conocimientos técnicos podría editarlos desde las herramientas del navegador. Los controles anteriores demuestran la lógica de autorización; la protección real exige reglas en un servidor (Firebase Security Rules o RLS de Supabase). Como la capa `data/` ya es asíncrona, migrar implica reemplazar `almacenamiento.js` y los repositorios sin cambiar las páginas.

## Cómo probar

**En línea:** abrir la URL publicada.

**Localmente:** los módulos ES no funcionan abriendo el archivo con doble clic (`file://`). Hay que usar un servidor local:

- VS Code → extensión *Live Server* → clic derecho en `index.html` → *Open with Live Server*, o
- En la carpeta del proyecto: `python -m http.server 8000` y abrir `http://localhost:8000`.

**Credenciales de prueba:** se entregan por Moodle (un administrador y dos clientes). También se puede crear una cuenta de cliente nueva desde *Ingresar → Crear cuenta*.

**Recorrido sugerido**

1. Como visitante, filtrar el catálogo y agregar postres al carrito (probar Key Lime Pie con menos de 12 unidades).
2. *Finalizar compra* → crear cuenta → elegir entrega a domicilio y pagar → revisar el comprobante.
3. En *Mis pedidos*, modificar cantidades y luego cancelar el pedido.
4. Cerrar sesión, ingresar como administrador y revisar el *Resumen*.
5. En *Postres*, crear uno nuevo, editarlo, desactivarlo y verificar el cambio en el catálogo.
6. En *Transacciones*, avanzar estados, registrar un pago, editar y eliminar.
7. Si los datos quedan desordenados: *Resumen → Restablecer datos*.

## Datos iniciales

22 postres del catálogo original en 4 categorías (uno marcado como no disponible), 3 usuarios (1 administrador, 2 clientes) y 9 transacciones en distintos estados, métodos de pago y tipos de entrega, suficientes para ver todos los indicadores y filtros.
