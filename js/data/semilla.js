/* ARCHIVO: js/data/semilla.js
   DATOS INICIALES Y SEMILLA (Capa de Datos / Inicialización)

   ÍNDICE:
   - FECHA_BASE  (línea 24)
   - postre()  (línea 26)
   - export POSTRES_INICIALES  (línea 41)
   - export USUARIOS_INICIALES  (línea 113)
   - linea()  (línea 143)
   - transaccion()  (línea 157)
   - crearTransaccionesIniciales()  (línea 181)
   - export asegurarDatosIniciales()  (línea 221)
   - export restablecerDatos()  (línea 225)
   - export cargarSemillaFirebase()  (línea 229)
   - export restablecerDatosFirestore()  (línea 239)
*/

import { CLAVES, VERSION_DATOS, NEGOCIO, ROLES } from '../config/app-config.js';

import { leerSync, escribirSync } from './almacenamiento.js';

import { db, doc, setDoc } from '../config/firebase.js';

const FECHA_BASE = '2026-09-01T10:00:00.000Z';

function postre(id, categoria, nombre, imagen, variantes, descripcion, minimo = 1, disponible = true) {
    return {
        id,
        categoria,
        nombre,
        descripcion,
        imagen: `img/${imagen}`,
        variantes: variantes.map(([nombre, precio]) => ({ nombre, precio })),
        minimo,
        disponible,
        creadoEn: FECHA_BASE,
        actualizadoEn: FECHA_BASE
    };
}

export const POSTRES_INICIALES = [
    postre('pst_paleo_choco', 'tartas', 'Paleo Chocolate Cheesecake', 'cat_paleo_chocolate-cake.jpg',
        [['Porción', 4.75], ['Entero', 38.00]],
        'El mismo paleo chocolate cake, pero con una suave capa de cheesecake endulzado con monkfruit y sin gluten.'),
    postre('pst_paleo_carrot', 'tartas', 'Paleo Carrot Cheesecake', 'cat_paleo_carrot_cheesecake.jpg',
        [['Porción', 5.25], ['Entero', 42.00]],
        'Torta de zanahoria sin gluten y sin azúcar, con una capa de cheesecake y turrón flameado sin azúcar.'),
    postre('pst_keto_lemon', 'tartas', 'Keto Lemon Blueberry Cheesecake', 'cat_keto_lemon_blueBerry_Cheesecake.jpg',
        [['Porción', 5.50], ['Entero', 42.00]],
        'Cheesecake sugar free con blueberries sobre base de almendra, decorado con lemon curd y fresas.'),
    postre('pst_keto_cheese', 'tartas', 'Keto Cheesecake', 'cat_keto_cheesecake.jpg',
        [['Porción', 5.50], ['Entero', 42.00]],
        'Base gluten free de almendra con relleno cremoso de queso, endulzado con monkfruit. Con lemon curd o jalea de fresa.'),
    postre('pst_key_lime', 'tartas', 'Key Lime Pie', 'cat_key_lime_pie.jpg',
        [['Unidad', 1.50]],
        'Tarta cremosa tradicional con base crocante y toque cítrico de limón.', 12),

    postre('pst_tiramisu', 'individuales', 'Healthy Tiramisú', 'cat__healthy_tiramisu.jpg',
        [['Individual', 8.00]],
        'Capas de suspiro sin gluten ni azúcar remojado en café, con crema y topping de pistacho o cocoa.'),
    postre('pst_brownies', 'individuales', 'Paleo Brownies', 'cat_paleo_brownies.jpg',
        [['Unidad', 3.00]],
        'Chewy brownies sin gluten, endulzados con monkfruit.'),
    postre('pst_lemon_bars', 'individuales', 'Lemon Bars', 'cat_lemon_bars.jpg',
        [['Unidad', 3.00]],
        'Barras de limón endulzadas con monkfruit sobre una base de avena.'),
    postre('pst_alfajor', 'individuales', 'Alfajor con Manjar de Dátil', 'cat_manjar_de_datil.jpg',
        [['Unidad', 1.95]],
        'Alfajor de harina de almendras con relleno de caramelo de dátiles.'),
    postre('pst_shooters', 'individuales', 'Cake Shooters', 'cat_cake_shooters.jpg',
        [['Unidad', 1.95]],
        'Postres en vaso: Chocolate-Maracuyá, Blueberry-Limón, Chocolate Blanco-Fresas, Birthday Cake o Red Velvet.', 12),
    postre('pst_tres_leches', 'individuales', 'Shots de Tres Leches', 'cat_shoots_tres_leches.jpg',
        [['Unidad', 1.75]],
        'Shot de pastel empapado en tres leches y decorado con merengue.', 20),
    postre('pst_mini_donas', 'individuales', 'Mini Donas', 'cat_mini_donas.jpg',
        [['Unidad', 1.50]],
        'Mini donas horneadas con coberturas glaseadas de colores personalizadas.', 1, false),

    postre('pst_pavlova_lemon', 'especialidades', 'Pavlova de Lemon Curd, Fresas y Blueberries', 'cat_pavlova_lemon_curd.jpg',
        [['Entera (10-12 personas)', 30.00]],
        'Espumilla crujiente por fuera y chewy por dentro, sin azúcar, con lemon curd, crema, fresas y blueberries.'),
    postre('pst_pavlova_choco', 'especialidades', 'Pavlova de Chocolate con Crema de Café y Fresas', 'cat_pavlova_chocolate_crema_cafe_fresas.jpg',
        [['Entera (10-12 personas)', 30.00]],
        'Espumilla de chocolate sin azúcar con crema de café sin lácteos y fresas frescas.'),
    postre('pst_mini_pavlovas', 'especialidades', 'Mini Pavlovas', 'cat_mini_pavlovas.jpg',
        [['Unidad', 2.50], ['Formato evento', 1.50]],
        'Espumillas individuales sugar free con rellenos de fresa, caramelo, blueberry o limón.'),
    postre('pst_loaf', 'especialidades', 'Apple Dátil y Nuez Loaf', 'cat_apple_datil_nuez_loaf.jpg',
        [['Entero', 30.00]],
        'Torta de fruta natural endulzada con monkfruit y sin gluten, decorada con nueces y rodajas cítricas.'),
    postre('pst_cupcakes', 'especialidades', 'Healthy Cupcakes', 'cat_healthy_cupcakes.jpg',
        [['Caja de 12', 30.00]],
        'Cupcakes saludables decorados con flores artesanales y betún ligero.'),
    postre('pst_espumillas', 'especialidades', 'Espumillas Sugar Free', 'cat_espumillas_sugar_free.jpg',
        [['Bolsita 40 g', 3.75]],
        'Espumillas sin azúcar: original, fresa, chocolate, matcha, especias, café o de temporada.'),

    postre('pst_lotus', 'galletas', 'Choco Chip Lotus Cookie', 'cat_choco_chips_lotus.jpg',
        [['Individual', 3.50], ['Caja de 6', 18.00]],
        'Galleta chunky crujiente por fuera y suave por dentro, con chispas y galleta Lotus Biscoff.'),
    postre('pst_oreo', 'galletas', 'Choco Chip Oreo Cookie', 'cat_oreo.jpg',
        [['Individual', 3.50], ['Caja de 6', 18.00]],
        'Galleta chunky artesanal horneada a diario con galleta Oreo y chispas de chocolate.'),
    postre('pst_dubai', 'galletas', 'Healthy Dubai Chocolate Chip', 'cat_healthy_chocolate_dubay.jpg',
        [['Individual', 3.75]],
        'Galleta de chocolate con topping de pistacho, de harina de almendras, aceite de coco y monkfruit.'),
    postre('pst_nutella', 'galletas', 'Healthy Nutella Choco Chip', 'cat_healthy_nutella_choco_chip.jpg',
        [['Individual', 4.25]],
        'Rellena de nutella saludable, con harina de almendra y aceite de coco, endulzada con monkfruit.')
];

export const USUARIOS_INICIALES = [
    {
        id: 'usr_admin',
        nombre: 'Administración Fragola',
        email: 'admin@fragola.com',
        rol: ROLES.ADMIN,
        sal: 'a7f3c91e',
        hash: 'efe47e4a847ed6c3a2fccdb90cc09b976c676985e5c2f0bf419f667e30991b82',
        creadoEn: FECHA_BASE
    },
    {
        id: 'usr_maria',
        nombre: 'María López',
        email: 'maria@correo.com',
        rol: ROLES.CLIENTE,
        sal: '5b2d8e40',
        hash: '1ce12eb3d6fe935970c05ea86a0c4ee43f88d4898e6a23ac987d0a094aa5fae5',
        creadoEn: FECHA_BASE
    },
    {
        id: 'usr_jose',
        nombre: 'José Martínez',
        email: 'jose@correo.com',
        rol: ROLES.CLIENTE,
        sal: 'c19e6f27',
        hash: 'bd28b7d48b959b8ea8f91d7b3f192a0a8ad00e3d5b8e61d0992cb96bee6b03aa',
        creadoEn: FECHA_BASE
    }
];

function linea(postreId, varianteIndice, cantidad) {
    const p = POSTRES_INICIALES.find((x) => x.id === postreId);
    const v = p.variantes[varianteIndice];
    return {
        postreId,
        nombre: p.nombre,
        categoria: p.categoria,
        variante: v.nombre,
        precioUnitario: v.precio,
        cantidad,
        subtotal: Math.round(v.precio * cantidad * 100) / 100
    };
}

function transaccion(numero, usuario, fecha, items, opciones) {
    const subtotal = Math.round(items.reduce((s, i) => s + i.subtotal, 0) * 100) / 100;
    const envio = opciones.entrega.tipo === 'domicilio' ? NEGOCIO.costoEnvio : 0;
    return {
        id: `trx_semilla_${numero}`,
        folio: `FRG-${String(numero).padStart(5, '0')}`,
        clienteId: usuario.id,
        clienteNombre: usuario.nombre,
        clienteEmail: usuario.email,
        items,
        subtotal,
        envio,
        total: Math.round((subtotal + envio) * 100) / 100,
        metodoPago: opciones.metodoPago,
        pagado: opciones.metodoPago !== 'efectivo' || opciones.estado === 'entregada',
        estado: opciones.estado,
        entrega: opciones.entrega,
        notas: opciones.notas || '',
        historial: [{ fecha, estado: 'pendiente', por: usuario.nombre }],
        creadaEn: fecha,
        actualizadaEn: fecha
    };
}

function crearTransaccionesIniciales() {
    const gabriel = {
        id: 'wnDdcH4P2aW7hhUy9BSHDeGlt0R2',
        nombre: 'Gabriel Méndez',
        email: 'gabrielmendez@gmail.com'
    };
    const maria = { id: 'usr_maria', nombre: 'María López', email: 'maria@correo.com' };
    const jose = { id: 'usr_jose', nombre: 'José Martínez', email: 'jose@correo.com' };

    return [
        transaccion(1, gabriel, '2026-10-02T15:20:00.000Z',
            [linea('pst_keto_lemon', 1, 1), linea('pst_brownies', 0, 6)],
            { metodoPago: 'tarjeta', estado: 'entregada', entrega: { tipo: 'retiro', sucursal: 'La Mascota', fecha: '2026-10-04', direccion: '' }, notas: 'Cumpleaños de mamá' }),
        transaccion(2, jose, '2026-10-05T18:05:00.000Z',
            [linea('pst_shooters', 0, 24), linea('pst_tres_leches', 0, 20)],
            { metodoPago: 'transferencia', estado: 'entregada', entrega: { tipo: 'domicilio', sucursal: 'Epic Plaza', fecha: '2026-10-08', direccion: 'Col. Escalón, Calle La Mascota #45, San Salvador' }, notas: 'Mesa dulce de oficina' }),
        transaccion(3, maria, '2026-10-09T14:40:00.000Z',
            [linea('pst_lotus', 1, 2), linea('pst_oreo', 1, 1)],
            { metodoPago: 'efectivo', estado: 'entregada', entrega: { tipo: 'retiro', sucursal: 'Epic Plaza', fecha: '2026-10-11', direccion: '' } }),
        transaccion(4, gabriel, '2026-10-13T16:10:00.000Z',
            [linea('pst_pavlova_lemon', 0, 1)],
            { metodoPago: 'tarjeta', estado: 'cancelada', entrega: { tipo: 'retiro', sucursal: 'La Mascota', fecha: '2026-10-15', direccion: '' }, notas: 'Cliente canceló por cambio de fecha' }),
        transaccion(5, maria, '2026-10-16T19:30:00.000Z',
            [linea('pst_paleo_choco', 1, 1), linea('pst_alfajor', 0, 12)],
            { metodoPago: 'tarjeta', estado: 'entregada', entrega: { tipo: 'domicilio', sucursal: 'La Mascota', fecha: '2026-10-18', direccion: 'Res. Los Héroes, pasaje 3 #12, San Salvador' } }),
        transaccion(6, gabriel, '2026-10-20T13:15:00.000Z',
            [linea('pst_key_lime', 0, 24), linea('pst_mini_pavlovas', 1, 30)],
            { metodoPago: 'transferencia', estado: 'lista', entrega: { tipo: 'domicilio', sucursal: 'Epic Plaza', fecha: '2026-10-29', direccion: 'Torre Futura, nivel 9, San Salvador' }, notas: 'Evento corporativo' }),
        transaccion(7, jose, '2026-10-23T17:45:00.000Z',
            [linea('pst_cupcakes', 0, 1), linea('pst_espumillas', 0, 4)],
            { metodoPago: 'tarjeta', estado: 'en_preparacion', entrega: { tipo: 'retiro', sucursal: 'La Mascota', fecha: '2026-10-30', direccion: '' } }),
        transaccion(8, gabriel, '2026-10-25T20:00:00.000Z',
            [linea('pst_tiramisu', 0, 4), linea('pst_dubai', 0, 6)],
            { metodoPago: 'efectivo', estado: 'pendiente', entrega: { tipo: 'retiro', sucursal: 'Epic Plaza', fecha: '2026-11-02', direccion: '' } }),
        transaccion(9, maria, '2026-10-26T15:00:00.000Z',
            [linea('pst_keto_cheese', 0, 4), linea('pst_lemon_bars', 0, 6)],
            { metodoPago: 'transferencia', estado: 'pendiente', entrega: { tipo: 'domicilio', sucursal: 'La Mascota', fecha: '2026-11-03', direccion: 'Col. San Benito, Av. Las Magnolias #120' }, notas: 'Llamar al llegar' })
    ];
}

export function asegurarDatosIniciales() {
    return true;
}

export function restablecerDatos() {
    return restablecerDatosFirestore();
}

export async function cargarSemillaFirebase() {
    console.log('Iniciando subida del catálogo a Cloud Firestore...');
    for (const p of POSTRES_INICIALES) {
        const { id, ...datos } = p;
        await setDoc(doc(db, 'postres', id), datos);
        console.log(`✓ Postre subido: ${datos.nombre}`);
    }
    console.log('Catálogo cargado con éxito en Firebase.');
}

export async function restablecerDatosFirestore() {
    console.log('Restableciendo catálogo y transacciones en Cloud Firestore...');

    for (const p of POSTRES_INICIALES) {
        const { id, ...datos } = p;
        await setDoc(doc(db, 'postres', id), datos);
    }

    const transacciones = crearTransaccionesIniciales();
    for (const t of transacciones) {
        const { id, ...datos } = t;
        await setDoc(doc(db, 'transacciones', id), datos);
    }

    localStorage.removeItem(CLAVES.carrito);
    document.dispatchEvent(new CustomEvent('carrito:cambio', { detail: [] }));
    console.log('Catálogo y transacciones cargados con éxito en Firebase.');
}

if (typeof window !== 'undefined') {
    window.cargarSemillaFirebase = cargarSemillaFirebase;
    window.restablecerDatosFirestore = restablecerDatosFirestore;
}
