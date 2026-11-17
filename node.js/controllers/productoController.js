
const Producto = require('../models/productoModel');

exports.getAll = async (req, res) => {
    try {
        const productos = await Producto.getAll();
        res.json(productos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getById = async (req, res) => {
    try {
        const producto = await Producto.getById(req.params.id);

        if (!producto) {
            return res.status(404).json({ mensaje: 'Producto no encontrado' });
        }

        res.json(producto);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.create = async (req, res) => {
    try {
        const { nombre, precio } = req.body;

        if (!nombre || precio === undefined || precio === '' || !Number.isFinite(Number(precio)) || Number(precio) < 0) {
            return res.status(400).json({
                mensaje: 'El nombre y un precio válido son obligatorios'
            });
        }

        const id = await Producto.create({
            nombre,
            descripcion: req.body.descripcion || '',
            precio: Number(precio),
            imagen: req.body.imagen || '',
            stock: Number(req.body.stock ?? 0),
            categoria_id: req.body.categoria_id ? Number(req.body.categoria_id) : null
        });

        res.status(201).json({
            mensaje: 'Producto creado correctamente',
            id
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.update = async (req, res) => {
    try {
        const { nombre, precio } = req.body;

        if (!nombre || precio === undefined || precio === '' || !Number.isFinite(Number(precio)) || Number(precio) < 0) {
            return res.status(400).json({
                mensaje: 'El nombre y un precio válido son obligatorios'
            });
        }

        const cantidad = await Producto.update(req.params.id, {
            nombre,
            descripcion: req.body.descripcion || '',
            precio: Number(precio),
            imagen: req.body.imagen || '',
            stock: Number(req.body.stock ?? 0),
            categoria_id: req.body.categoria_id ? Number(req.body.categoria_id) : null
        });

        if (!cantidad) {
            return res.status(404).json({ mensaje: 'Producto no encontrado' });
        }

        res.json({ mensaje: 'Producto actualizado correctamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.delete = async (req, res) => {
    try {
        const cantidad = await Producto.delete(req.params.id);

        if (!cantidad) {
            return res.status(404).json({ mensaje: 'Producto no encontrado' });
        }

        res.json({ mensaje: 'Producto eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
