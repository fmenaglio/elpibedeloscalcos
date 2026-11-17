
const express = require('express');
const router = express.Router();

const Producto = require('../models/productoModel');
const Categoria = require('../models/categoriaModel');
const Pedido = require('../models/pedidoModel');
const db = require('../config/db');
const { soloAdmin } = require('../middlewares/authMiddleware');

const estadosPermitidos = [
    'pendiente',
    'confirmado',
    'entregado',
    'cancelado'
];


router.use(soloAdmin);

async function validarCategoria(categoriaId) {
    if (categoriaId === null) return true;
    if (!Number.isSafeInteger(categoriaId) || categoriaId < 1) return false;

    const [filas] = await db.query(
        'SELECT id FROM categorias WHERE id = ? LIMIT 1',
        [categoriaId]
    );
    return filas.length === 1;
}

// ---------------- CATEGORÍAS ----------------

router.get('/categorias', async (req, res) => {
    try {
        res.json(await Categoria.getAll());
    } catch (error) {
        console.error('Error al listar categorías:', error.message);
        res.status(500).json({ mensaje: 'No se pudieron cargar las categorías.' });
    }
});

router.post('/categorias', async (req, res) => {
    try {
        const nombre = typeof req.body.nombre === 'string' ? req.body.nombre.trim() : '';
        if (!nombre || nombre.length > 60) {
            return res.status(400).json({ mensaje: 'Ingresá un nombre de categoría de hasta 60 caracteres.' });
        }

        const id = await Categoria.create(nombre);
        res.status(201).json({ mensaje: 'Categoría creada correctamente.', id });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ mensaje: 'Ya existe una categoría con ese nombre.' });
        }
        console.error('Error al crear categoría:', error.message);
        res.status(500).json({ mensaje: 'No se pudo crear la categoría.' });
    }
});

router.put('/categorias/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        const nombre = typeof req.body.nombre === 'string' ? req.body.nombre.trim() : '';
        if (!Number.isSafeInteger(id) || id < 1 || !nombre || nombre.length > 60) {
            return res.status(400).json({ mensaje: 'Revisá el identificador y el nombre de la categoría.' });
        }

        const cantidad = await Categoria.update(id, nombre);
        if (!cantidad) return res.status(404).json({ mensaje: 'No se encontró la categoría.' });
        res.json({ mensaje: 'Categoría actualizada correctamente.' });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ mensaje: 'Ya existe una categoría con ese nombre.' });
        }
        console.error('Error al editar categoría:', error.message);
        res.status(500).json({ mensaje: 'No se pudo actualizar la categoría.' });
    }
});

router.delete('/categorias/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isSafeInteger(id) || id < 1) {
            return res.status(400).json({ mensaje: 'El identificador no es válido.' });
        }

        const cantidad = await Categoria.delete(id);
        if (!cantidad) return res.status(404).json({ mensaje: 'No se encontró la categoría.' });
        res.json({ mensaje: 'Categoría eliminada. Los productos asociados quedaron sin categoría.' });
    } catch (error) {
        console.error('Error al eliminar categoría:', error.message);
        res.status(500).json({ mensaje: 'No se pudo eliminar la categoría.' });
    }
});


// ---------------- PRODUCTOS ----------------

// Listar productos
router.get('/productos', async (req, res) => {
    try {
        const productos = await Producto.getAll();
        res.json(productos);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            mensaje: 'Error al cargar los productos.'
        });
    }
});

// Crear producto
router.post('/productos', async (req, res) => {
    try {
        const { nombre, precio } = req.body;
        const stock = Number(req.body.stock ?? 0);

        if (
            typeof nombre !== 'string' ||
            !nombre.trim() ||
            nombre.trim().length > 100 ||
            req.body.precio === '' ||
            !Number.isFinite(Number(precio)) ||
            Number(precio) < 0 ||
            !Number.isInteger(stock) ||
            stock < 0
        ) {
            return res.status(400).json({
                mensaje: 'Revisá el nombre, precio y stock.'
            });
        }

        const descripcion = String(req.body.descripcion || '').trim();
        const imagen = String(req.body.imagen || '').trim();
        const categoria_id = req.body.categoria_id === '' || req.body.categoria_id === undefined || req.body.categoria_id === null
            ? null
            : Number(req.body.categoria_id);

        if (!(await validarCategoria(categoria_id))) {
            return res.status(400).json({ mensaje: 'La categoría seleccionada no existe.' });
        }

        if (descripcion.length > 255 || imagen.length > 255) {
            return res.status(400).json({
                mensaje: 'La descripción o la imagen son demasiado largas.'
            });
        }

        const id = await Producto.create({
            nombre: nombre.trim(),
            descripcion,
            precio: Number(precio),
            imagen,
            stock,
            categoria_id
        });

        res.status(201).json({
            mensaje: 'Producto creado correctamente.',
            id
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            mensaje: 'No se pudo crear el producto.'
        });
    }
});

// Editar producto
router.put('/productos/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { nombre, precio } = req.body;
        const stock = Number(req.body.stock ?? 0);

        if (
            !Number.isInteger(id) || id < 1 ||
            typeof nombre !== 'string' ||
            !nombre.trim() ||
            nombre.trim().length > 100 ||
            req.body.precio === '' ||
            !Number.isFinite(Number(precio)) ||
            Number(precio) < 0 ||
            !Number.isInteger(stock) ||
            stock < 0
        ) {
            return res.status(400).json({
                mensaje: 'Revisá los datos del producto.'
            });
        }

        const descripcion = String(req.body.descripcion || '').trim();
        const imagen = String(req.body.imagen || '').trim();
        const categoria_id = req.body.categoria_id === '' || req.body.categoria_id === undefined || req.body.categoria_id === null
            ? null
            : Number(req.body.categoria_id);

        if (!(await validarCategoria(categoria_id))) {
            return res.status(400).json({ mensaje: 'La categoría seleccionada no existe.' });
        }

        if (descripcion.length > 255 || imagen.length > 255) {
            return res.status(400).json({
                mensaje: 'La descripción o la imagen son demasiado largas.'
            });
        }

        const cantidad = await Producto.update(id, {
            nombre: nombre.trim(),
            descripcion,
            precio: Number(precio),
            imagen,
            stock,
            categoria_id
        });

        if (!cantidad) {
            return res.status(404).json({
                mensaje: 'No se encontró el producto.'
            });
        }

        res.json({
            mensaje: 'Producto actualizado correctamente.'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            mensaje: 'No se pudo actualizar el producto.'
        });
    }
});

// Eliminar producto
router.delete('/productos/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id < 1) {
            return res.status(400).json({
                mensaje: 'El identificador no es válido.'
            });
        }

        const cantidad = await Producto.delete(id);

        if (!cantidad) {
            return res.status(404).json({
                mensaje: 'No se encontró el producto.'
            });
        }

        res.json({
            mensaje: 'Producto eliminado correctamente.'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            mensaje: 'No se pudo eliminar el producto.'
        });
    }
});

// ---------------- PEDIDOS ----------------

// Listar todos los pedidos
router.get('/pedidos', async (req, res) => {
    try {
        const [pedidos] = await db.query(
            `SELECT id, cliente_nombre, apellido, dni, domicilio, localidad, telefono, total, estado, fecha
             FROM pedidos
             ORDER BY fecha DESC, id DESC`
        );

        res.json(pedidos);
    } catch (error) {
        console.error('Error al cargar pedidos:', error);
        res.status(500).json({
            mensaje: 'No se pudieron cargar los pedidos.'
        });
    }
});

// Consultar un pedido y sus productos
router.get('/pedidos/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isSafeInteger(id) || id < 1) {
            return res.status(400).json({
                mensaje: 'El número de pedido no es válido.'
            });
        }

        const [pedidos] = await db.query(
            `SELECT id, cliente_nombre, apellido, dni, domicilio, localidad, telefono, total, estado, fecha
             FROM pedidos
             WHERE id = ?
             LIMIT 1`,
            [id]
        );

        if (!pedidos.length) {
            return res.status(404).json({
                mensaje: 'No se encontró el pedido.'
            });
        }

        const [productos] = await db.query(
            `SELECT producto_id, nombre_producto, cantidad,
                    precio_unitario, subtotal
             FROM detalle_pedido
             WHERE pedido_id = ?
             ORDER BY id ASC`,
            [id]
        );

        res.json({
            pedido: pedidos[0],
            productos
        });
    } catch (error) {
        console.error('Error al consultar detalle del pedido:', error);
        res.status(500).json({
            mensaje: 'No se pudo cargar el detalle del pedido.'
        });
    }
});

// Cambiar el estado de un pedido y actualizar stock de forma segura.
router.put('/pedidos/:id/estado', async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { estado } = req.body;

        if (!Number.isSafeInteger(id) || id < 1) {
            return res.status(400).json({
                mensaje: 'El número de pedido no es válido.'
            });
        }

        if (!estadosPermitidos.includes(estado)) {
            return res.status(400).json({
                mensaje: 'El estado seleccionado no es válido.'
            });
        }

        const resultado = await Pedido.actualizarEstado(id, estado);

        return res.json({
            mensaje: resultado.sinCambios
                ? `El pedido #${id} ya estaba "${estado}".`
                : `El pedido #${id} ahora está "${estado}".`,
            estado: resultado.estado
        });
    } catch (error) {
        console.error('Error al actualizar estado del pedido:', error);

        const status = error.status || (
            error.message.includes('stock suficiente') ? 409 : 500
        );

        return res.status(status).json({
            mensaje: status === 500
                ? 'No se pudo actualizar el estado del pedido.'
                : error.message
        });
    }
});

module.exports = router;
