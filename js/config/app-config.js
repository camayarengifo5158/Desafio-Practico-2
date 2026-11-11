/* ==============================================================================
   ARCHIVO: js/config/app-config.js
   CAPA: Configuración del Negocio (Parámetros y Reglas Globales)
   ==============================================================================
   ¿Para qué sirve este archivo en la vida real de la aplicación?
   Imagínate este archivo como el "manual de operaciones" o el "reglamento" de Fragola.
   Aquí definimos una sola vez todas las constantes, números y textos que rigen
   cómo funciona el negocio. 

   ¿Por qué es una buena práctica de ingeniería?
   Para evitar los famosos "números mágicos" o textos sueltos en el código.
   Si mañana la dueña de Fragola decide que el envío a domicilio ya no cuesta $3.50
   sino $4.00, o que el tiempo mínimo de anticipación cambia de 48 a 24 horas,
   NO tenemos que ir a buscar en 10 archivos distintos. Simplemente cambiamos
   el valor en este archivo y automáticamente toda la tienda se actualiza.
   ============================================================================== */

// Prefijo único para las claves que guardamos en el navegador (localStorage).
// ¿Por qué lo usamos? Porque si el evaluador o nosotros abrimos otro proyecto en
// http://localhost:8000, los datos de Fragola no van a chocar ni sobreescribir los de otra app.
export const PREFIJO = 'fragola.';

// Nombres exactos de las llaves en localStorage para las cosas que aún guardamos localmente:
// - sesion: guarda en caché el usuario activo para no esperar a que Firebase responda al recargar.
// - carrito: guarda los postres que el cliente está acumulando antes de pagar.
export const CLAVES = {
    version: `${PREFIJO}version`,
    postres: `${PREFIJO}postres`,
    transacciones: `${PREFIJO}transacciones`,
    usuarios: `${PREFIJO}usuarios`,
    sesion: `${PREFIJO}sesion`,
    carrito: `${PREFIJO}carrito`,
    contadorFolio: `${PREFIJO}contadorFolio`
};

// Número de versión de datos locales (usado para control de cambios)
export const VERSION_DATOS = 3;

// Simulación de red en milisegundos (usada en utilidades visuales para que los spinners sean perceptibles)
export const LATENCIA_MS = { min: 250, max: 650 };

// Roles disponibles en el sistema.
// Regla estricta: Toda persona que se registra en la página web entra como 'cliente'.
// El rol 'admin' solo puede otorgarlo otro administrador desde el panel de control.
export const ROLES = {
    ADMIN: 'admin',
    CLIENTE: 'cliente'
};

// Listado oficial de las 4 categorías del menú de postres de Fragola.
// Cada categoría tiene un identificador interno ('id') que coincide con la base de datos,
// un título visible ('nombre') y una pequeña descripción que se dibuja en el catálogo.
export const CATEGORIAS = [
    { 
        id: 'tartas', 
        nombre: 'Tartas y Cheesecakes', 
        descripcion: 'Para compartir en casa, en la oficina o en cualquier celebración.' 
    },
    { 
        id: 'individuales', 
        nombre: 'Postres Individuales y Shots', 
        descripcion: 'Porciones perfectas para antojos y mesas dulces.' 
    },
    { 
        id: 'especialidades', 
        nombre: 'Especialidades de la Casa', 
        descripcion: 'Los favoritos de nuestros clientes y piezas para celebrar.' 
    },
    { 
        id: 'galletas', 
        nombre: 'Galletas y Pasteles Listos', 
        descripcion: 'Horneados a diario, listos para llevar.' 
    }
];

// Máquina de estados finitos para los pedidos de compra.
// ¿Cómo funciona esto en la vida real?
// Un pedido no puede saltar a cualquier estado a lo loco (por ejemplo, de 'Pendiente' no
// puede saltar directamente a 'Entregada' sin pasar por preparación).
// La propiedad 'siguientes' define estrictamente a qué estados tiene permitido avanzar:
// - 'pendiente': Solo puede avanzar a 'en_preparacion' (la cocina lo aceptó) o 'cancelada' (el cliente canceló).
// - 'en_preparacion': Avanza a 'lista' o 'cancelada'.
// - 'lista': Avanza a 'entregada' (el cliente lo recogió o el repartidor lo entregó) o 'cancelada'.
// - 'entregada' y 'cancelada': Son estados finales; ya no pueden cambiar a nada más.
export const ESTADOS = {
    pendiente: { etiqueta: 'Pendiente', siguientes: ['en_preparacion', 'cancelada'] },
    en_preparacion: { etiqueta: 'En preparación', siguientes: ['lista', 'cancelada'] },
    lista: { etiqueta: 'Lista para entrega', siguientes: ['entregada', 'cancelada'] },
    entregada: { etiqueta: 'Entregada', siguientes: [] },
    cancelada: { etiqueta: 'Cancelada', siguientes: [] }
};

// Formas de pago que acepta la pastelería.
// Recuerda: En esta actividad académica las compras son simuladas; no pedimos números de tarjeta reales.
export const METODOS_PAGO = {
    tarjeta: 'Tarjeta (simulado)',
    transferencia: 'Transferencia bancaria',
    efectivo: 'Efectivo contra entrega'
};

// Métodos de entrega disponibles para el comprador
export const TIPOS_ENTREGA = {
    retiro: 'Retiro en sucursal',
    domicilio: 'Entrega a domicilio'
};

// Ubicación física de las dos sucursales reales de Fragola en El Salvador
export const SUCURSALES = ['La Mascota', 'Epic Plaza'];

// Reglas críticas del modelo de negocio de Fragola:
// 1. costoEnvio: Si el cliente pide entrega a domicilio, se le suman $3.50 al total. Si retira en sucursal, es $0.
// 2. horasAnticipacion: Como son postres artesanales hechos a mano, se exigen 48 horas mínimas entre el día de compra y la fecha de entrega.
// 3. tasaIVA: En El Salvador el IVA es del 13%. Los precios de Fragola ya tienen el IVA incluido; en el comprobante usamos esta tasa para desglosar la base imponible.
// 4. maxCantidadPorLinea: Un tope razonable de 200 unidades por postre en una sola orden para evitar errores de dedo.
export const NEGOCIO = {
    costoEnvio: 3.50,          // cargo por entrega a domicilio en dólares
    horasAnticipacion: 48,     // los encargos se hacen con mínimo 48 h de anticipación
    tasaIVA: 0.13,             // los precios del catálogo ya incluyen el 13 % de IVA
    maxCantidadPorLinea: 200   // límite máximo razonable por producto en un solo pedido
};

// Lista de fotografías reales de postres guardadas en la carpeta /img.
// Cuando el administrador entra al panel y quiere crear un postre nuevo,
// el formulario le ofrece este listado para elegir una foto con vista previa sin tener que escribir URLs a mano.
export const IMAGENES_DISPONIBLES = [
    'img/cat_paleo_chocolate-cake.jpg',
    'img/cat_paleo_carrot_cheesecake.jpg',
    'img/cat_keto_lemon_blueBerry_Cheesecake.jpg',
    'img/cat_keto_cheesecake.jpg',
    'img/cat_key_lime_pie.jpg',
    'img/cat__healthy_tiramisu.jpg',
    'img/cat_paleo_brownies.jpg',
    'img/cat_lemon_bars.jpg',
    'img/cat_manjar_de_datil.jpg',
    'img/cat_cake_shooters.jpg',
    'img/cat_shoots_tres_leches.jpg',
    'img/cat_mini_donas.jpg',
    'img/cat_pavlova_lemon_curd.jpg',
    'img/cat_pavlova_chocolate_crema_cafe_fresas.jpg',
    'img/cat_mini_pavlovas.jpg',
    'img/cat_apple_datil_nuez_loaf.jpg',
    'img/cat_healthy_cupcakes.jpg',
    'img/cat_espumillas_sugar_free.jpg',
    'img/cat_choco_chips_lotus.jpg',
    'img/cat_oreo.jpg',
    'img/cat_healthy_chocolate_dubay.jpg',
    'img/cat_healthy_nutella_choco_chip.jpg',
    'img/donas.jpg',
    'img/macarons.jpg',
    'img/pastel.jpg'
];

// Imagen de comodín o respaldo por si un postre no tiene imagen cargada
export const IMAGEN_POR_DEFECTO = 'img/ilustracion-pastel.png';
