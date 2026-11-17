const express = require('express');
const router = express.Router();
const Categoria = require('../models/categoriaModel');

// Las categorías son públicas para que la tienda pueda mostrarlas.
router.get('/', async (req, res) => {
    try {
        const categorias = await Categoria.getAll();
        res.json(categorias);
    } catch (error) {
        console.error('Error al cargar categorías:', error);
        res.status(500).json({ mensaje: 'No se pudieron cargar las categorías.' });
    }
});

module.exports = router;
