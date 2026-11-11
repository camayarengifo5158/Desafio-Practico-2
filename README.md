# Fragola Postres · Desafío Práctico II

Aplicación web de pedidos en línea para **Fragola Postres**, construida sobre el sitio del Desafío Práctico I con persistencia remota, autenticación de usuarios y autorización mediante reglas de seguridad en la nube.

Desarrollo Web I · Ingeniería de Software y Negocios Digitales · ESEN 2026.

**Integrantes**

- Josué Gabriel Méndez Benítez — 20255610
- Fernando Alonso Calvo Recinos — 20255526
- Carlos Andrés Amaya Rengifo — 20255158

**Versión publicada en vivo:** https://camayarengifo5158.github.io/Desafio-Practico-2/

---

## Problema

Fragola gestionaba sus encargos de forma manual a través de WhatsApp e Instagram. No existía un catálogo dinámico administrable en línea, ni un registro centralizado y consistente de las ventas: los precios requerían cambios manuales en el código, los pedidos se extraviaban entre chats y el cliente no recibía un comprobante digital formal.

La aplicación resuelve esta necesidad mediante dos procesos funcionales interconectados:

1. **Gestión del catálogo (Administración)** — La administración crea, actualiza, desactiva y elimina postres; el catálogo público se renderiza dinámicamente en el navegador a partir de los datos almacenados en la base de datos remota.
2. **Compra, seguimiento y registro de transacciones (Clientes y Administración)** — El cliente explora el catálogo, arma su carrito, valida reglas de negocio (anticipación de 48 h, pedidos mínimos), simula el pago, recibe un comprobante imprimible con desglose de IVA y puede consultar, modificar o cancelar sus pedidos pendientes. La administración da seguimiento a cada venta, gestiona estados de entrega y consulta indicadores financieros en tiempo real.

---

## Roles y Permisos

| Rol | Alcance y Permisos |
|---|---|
| **Visitante** | Consulta y filtra el catálogo dinámico, agrega postres al carrito. Para formalizar la compra debe registrarse o iniciar sesión. |
| **Cliente** | Compra en línea, consulta **únicamente sus propias transacciones** y comprobantes, modifica datos de entrega o notas y puede cancelar mientras el pedido esté en estado *Pendiente*. |
| **Administrador** | CRUD completo del catálogo de postres, visualización de todas las transacciones de todos los clientes, cambio de estados operativos, registro de cobros, edición y eliminación de pedidos, panel de indicadores de negocio (KPIs) y administración de roles de usuario. |

*Toda cuenta nueva creada desde la interfaz se registra obligatoriamente con el rol de **cliente**. El rol de administrador únicamente puede ser concedido por otro administrador desde el panel seguro, y las reglas en la nube prohíben la auto-asignación de privilegios.*

---

## Funcionalidades Principales

### Catálogo y Carrito (`catalogo.html`)
- **Renderizado dinámico:** Tarjetas generadas con JavaScript a partir de la colección remota de Firestore.
- **Herramientas de búsqueda y filtrado:** Búsqueda normalizada sin distinguir acentos ni mayúsculas, filtro por categoría y por disponibilidad en inventario, ordenamiento múltiple (nombre, precio ascendente/descendente, actualización reciente) y agrupación visual por categorías.
- **Carrito de compras interactivo:** Panel lateral con controles de cantidad, eliminación de líneas, vaciado completo y validación de reglas de negocio en tiempo real.
- **Reglas del negocio:** Cantidades mínimas de compra por postre (ej. *Key Lime Pie* exige un mínimo de 12 unidades).

### Compra Simulada y Comprobante Digital (`comprobante.html`)
- **Modal de checkout accesible:** Opciones de entrega en sucursal o a domicilio (+$3.50), con validación obligatoria de **48 horas de anticipación**.
- **Pago simulado:** Tarjeta, transferencia bancaria o efectivo contra entrega (no se solicitan ni almacenan datos sensibles de tarjetas).
- **Consistencia de precios:** Los precios unitarios y la disponibilidad se validan directamente con los registros del catálogo al momento de generar la compra.
- **Comprobante imprimible:** Vista con folio único (`FRG-XXXXX`), detalle desglosado de productos, costos de envío, base imponible e IVA (13 %) incluido, preparado para impresión o exportación a PDF vía CSS `@media print`.

### Historial del Cliente (`pedidos.html`)
- Historial personalizado del usuario autenticado con filtros por estado y ordenamiento.
- Acceso directo al comprobante de cada compra.
- Modificación de notas/entrega y cancelación inmediata de pedidos en estado *Pendiente*.

### Panel de Administración (`admin.html`)
- **Resumen e Indicadores (KPIs):** Ventas totales (excluyendo cancelados), ticket promedio, pedidos activos en cocina, saldo por cobrar, distribución de ventas por categoría con barras proporcionales, top 5 de postres más vendidos y listado de entregas próximas.
- **Postres (CRUD):** Creación, edición y eliminación de postres, selector de presentaciones y precios dinámicos, vista previa de imágenes y activación/desactivación instantánea de disponibilidad.
- **Transacciones:** Búsqueda por folio, nombre de cliente o correo; filtro por estado y rangos de fecha; avance controlado de estados; edición y eliminación administrativa.
- **Usuarios:** Listado de usuarios registrados con total de pedidos y monto acumulado; cambio controlado de roles.
- **Restablecer datos de prueba:** Botón seguro que restaura el catálogo de 22 postres y transacciones iniciales en Cloud Firestore.

---

## Tecnología y Arquitectura

- **Frontend:** HTML5 semántico (`<dialog>`, `<nav>`, `<main>`, `<section>`, `<aside>`), CSS3 nativo puro con variables de diseño (sin frameworks de interfaz basados en JS) y JavaScript nativo estructurado mediante **módulos ES**.
- **Autenticación:** **Firebase Authentication** (Email / Contraseña) mediante el SDK Modular Web v10.12.0.
- **Persistencia Remota:** **Google Cloud Firestore** (colecciones `postres`, `transacciones`, `usuarios`).
- **Seguridad y Autorización en Servidor:** Reglas de seguridad declarativas en **`firestore.rules`** desplegadas en Cloud Firestore mediante Firebase CLI.
- **Despliegue y Hosting:** Publicado de forma estática en **GitHub Pages**.

---

## Estructura Modular del Proyecto

```
├── .firebaserc              Enlace al proyecto de Google Cloud (fragola-postres)
├── firebase.json            Configuración de despliegue de Firestore
├── firestore.rules          Reglas de seguridad y control de acceso en la nube
├── index.html               Página de inicio
├── catalogo.html            Catálogo dinámico, carrito y proceso de compra
├── ingresar.html            Inicio de sesión y registro de cuentas
├── pedidos.html             Historial de compras del cliente
├── comprobante.html         Comprobante de compra imprimible
├── admin.html               Panel de control y métricas administrativas
├── sobreNosotros.html       Página institucional
├── contacto.html            Página de contacto
├── css/
│   ├── style.css            Estilos base y tipografías
│   └── app.css              Estilos de componentes, diálogo, tablas responsivas y panel
├── img/                     Recursos gráficos y fotografías de postres optimizadas
└── js/
    ├── config/
    │   ├── app-config.js    Constantes globales, categorías, roles, estados y negocio
    │   └── firebase.js      Inicialización del SDK Modular de Firebase (Auth y Firestore)
    ├── data/                Capa de acceso y mutación de datos remotos
    │   ├── auth.js          Registro, sesión, guardias de rol y estado de autenticación
    │   ├── postres-repo.js  CRUD remoto del catálogo en Firestore
    │   ├── transacciones-repo.js Registro, consulta por cliente/folio y actualización de compras
    │   ├── usuarios-repo.js Consulta y asignación de roles de usuario
    │   └── semilla.js       Catálogo inicial y transacciones representativas de prueba
    ├── logica/              Funciones puras sin dependencia del DOM
    │   ├── procesamiento.js Búsqueda normalizada, filtros, ordenación y cálculo de KPIs
    │   ├── validaciones.js  Reglas de formularios, 48h de anticipación y validaciones
    │   ├── carrito.js       Gestión de estado del carrito en el navegador
    │   └── formato.js       Formateo monetario, fechas y escape preventivo de HTML
    └── ui/                  Controladores de interfaz y manipulación del DOM
        ├── comun.js         Guardias de acceso, cabecera de sesión, toasts, carga y modal
        ├── plantillas.js    Fragmentos HTML reutilizables
        ├── dialogo-transaccion.js Modal para modificación de pedidos
        ├── pagina-*.js      Controladores específicos por página
        └── admin-*.js       Módulos individuales para cada pestaña del panel admin
```

La arquitectura aplica separación estricta de responsabilidades: los controladores de interfaz (`ui/`) delegan la lógica a funciones puras (`logica/`) y las operaciones asíncronas a los repositorios de datos (`data/`), interactuando con Firestore de manera desacoplada.

---

## Seguridad y Control de Autorización

1. **Autorización Perimetral en Cloud Firestore (`firestore.rules`):**
   - **Colección `postres`:** Lectura pública para cualquier visitante; creación, actualización y eliminación restringidas exclusivamente al rol `admin` verificado en su documento de usuario (`esAdmin()`).
   - **Colección `usuarios`:** Creación permitida únicamente con rol `cliente` para evitar auto-promoción administrativa; actualización de roles restringida exclusivamente a administradores.
   - **Colección `transacciones`:** Los clientes únicamente pueden consultar (`read`) y modificar (`update`) transacciones cuyo campo `clienteId` coincida exactamente con su `request.auth.uid`. Las consultas del cliente se acotan estáticamente para cumplir con el principio *rules are not filters*.
   - **Eliminación de transacciones:** Operación exclusiva de administradores.
2. **Protección en el Cliente:**
   - Todo dato ingresado por el usuario se escapa antes de insertarse en el DOM (`escaparHTML`) para prevenir inyecciones XSS.
   - Las sesiones se cierran de forma segura limpiando tanto la sesión de Firebase como el caché local y el carrito del navegador.

---

## Instrucciones para Pruebas y Evaluación

### Despliegue en Línea
Acceder directamente a la URL pública:  
**https://camayarengifo5158.github.io/Desafio-Practico-2/**

### Ejecución Local
Dado que el proyecto utiliza módulos ES nativos (`type="module"`), debe servirse mediante un servidor HTTP local:
- **VS Code:** Clic derecho en `index.html` $\rightarrow$ *Open with Live Server*, o
- **Terminal:** Ejecutar `python3 -m http.server 8000` en la carpeta raíz y abrir `http://localhost:8000`.

### Credenciales de Prueba (Entregadas vía Moodle)
- **Administrador:** `admin@fragola.com`
- **Cliente:** `gabrielmendez@gmail.com`
- *(Opcional)*: Es posible crear una cuenta nueva de cliente en cualquier momento desde **Ingresar $\rightarrow$ Crear cuenta**.

### Recorrido de Evaluación Sugerido

1. **Flujo de Visitante y Catálogo:**
   - Explorar `catalogo.html`, utilizar el buscador en tiempo real, filtrar por categoría y marcar "Solo disponibles".
   - Agregar productos al carrito (probar agregar menos de 12 unidades de *Key Lime Pie* para verificar la regla de negocio).
2. **Flujo de Compra y Comprobante (Cliente):**
   - Abrir el carrito y presionar *Finalizar compra*.
   - Iniciar sesión con la cuenta de cliente de prueba (`gabrielmendez@gmail.com`).
   - Completar el formulario de entrega y pago $\rightarrow$ confirmar el pedido.
   - Verificar la redirección automática a `comprobante.html?folio=FRG-XXXXX`, revisar el desglose y probar la opción de impresión o PDF.
3. **Gestión de Pedidos del Cliente:**
   - Ir a `pedidos.html` desde el menú de usuario.
   - Modificar las notas o dirección de un pedido en estado *Pendiente*.
   - Probar la cancelación de un pedido pendiente con su confirmación modal.
4. **Flujo de Administración (`admin.html`):**
   - Cerrar sesión e ingresar con `admin@fragola.com`.
   - Acceder al menú *Panel de administración*.
   - **Pestaña Resumen:** Verificar los KPIs financieros calculados en tiempo real (ventas totales, ticket promedio, ventas por categoría y postres más vendidos).
   - **Pestaña Postres:** Crear un postre nuevo, editar uno existente, cambiar su disponibilidad con el switch y verificar que los cambios se reflejan inmediatamente en el catálogo público.
   - **Pestaña Transacciones:** Filtrar por folio, estado o fechas; avanzar el estado de un pedido (ej. *En preparación* $\rightarrow$ *Lista para entrega*) y probar la eliminación.
   - **Pestaña Usuarios:** Visualizar la lista de clientes registrados con su historial de compras y probar la asignación de roles.
   - **Restablecer datos:** Presionar el botón en el panel de resumen para restablecer el catálogo de 22 postres y transacciones iniciales en Cloud Firestore.
