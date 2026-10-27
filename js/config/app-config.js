/* ==========================================================
   CONFIGURACIÓN DE LA PLATAFORMA
   Todo lo que define "cómo" se guardan los datos y las reglas
   generales del negocio vive aquí, para no repetir valores
   en el resto de módulos.
   ========================================================== */

// Prefijo para todas las claves de localStorage (evita choques con otros sitios en localhost)
export const PREFIJO = 'fragola.';

// Claves de cada "colección" guardada en localStorage
export const CLAVES = {
    version: `${PREFIJO}version`,
    postres: `${PREFIJO}postres`,
    transacciones: `${PREFIJO}transacciones`,
    usuarios: `${PREFIJO}usuarios`,
    sesion: `${PREFIJO}sesion`,
    carrito: `${PREFIJO}carrito`,
    contadorFolio: `${PREFIJO}contadorFolio`
};

// Si se cambia la estructura de los datos iniciales, subir este número
// para que el navegador vuelva a cargar la semilla.
export const VERSION_DATOS = 3;

// Simulación de red: localStorage responde al instante, así que agregamos
// una pequeña espera para que los estados de carga sean visibles y el
// código se comporte como lo haría con un servicio remoto.
export const LATENCIA_MS = { min: 250, max: 650 };

// Roles disponibles. Quien se registra siempre queda como CLIENTE.
export const ROLES = {
    ADMIN: 'admin',
    CLIENTE: 'cliente'
};

export const CATEGORIAS = [
    { id: 'tartas', nombre: 'Tartas y Cheesecakes', descripcion: 'Para compartir en casa, en la oficina o en cualquier celebración.' },
    { id: 'individuales', nombre: 'Postres Individuales y Shots', descripcion: 'Porciones perfectas para antojos y mesas dulces.' },
    { id: 'especialidades', nombre: 'Especialidades de la Casa', descripcion: 'Los favoritos de nuestros clientes y piezas para celebrar.' },
    { id: 'galletas', nombre: 'Galletas y Pasteles Listos', descripcion: 'Horneados a diario, listos para llevar.' }
];

// Estados por los que pasa un pedido y a cuáles puede avanzar
export const ESTADOS = {
    pendiente: { etiqueta: 'Pendiente', siguientes: ['en_preparacion', 'cancelada'] },
    en_preparacion: { etiqueta: 'En preparación', siguientes: ['lista', 'cancelada'] },
    lista: { etiqueta: 'Lista para entrega', siguientes: ['entregada', 'cancelada'] },
    entregada: { etiqueta: 'Entregada', siguientes: [] },
    cancelada: { etiqueta: 'Cancelada', siguientes: [] }
};

export const METODOS_PAGO = {
    tarjeta: 'Tarjeta (simulado)',
    transferencia: 'Transferencia bancaria',
    efectivo: 'Efectivo contra entrega'
};

export const TIPOS_ENTREGA = {
    retiro: 'Retiro en sucursal',
    domicilio: 'Entrega a domicilio'
};

export const SUCURSALES = ['La Mascota', 'Epic Plaza'];

// Reglas del negocio
export const NEGOCIO = {
    costoEnvio: 3.50,          // cargo por entrega a domicilio
    horasAnticipacion: 48,     // los encargos se hacen con 48 h de anticipación
    tasaIVA: 0.13,             // los precios ya incluyen IVA (13 %)
    maxCantidadPorLinea: 200   // límite razonable por producto en un pedido
};

// Imágenes disponibles en /img para asignar a un postre desde el panel
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

export const IMAGEN_POR_DEFECTO = 'img/ilustracion-pastel.png';
