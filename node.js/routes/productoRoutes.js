const express = require('express');
const router = express.Router();
const productoController = require('../controllers/productoController');

// El catálogo es público: solamente permite consultar productos.
router.get('/getall', productoController.getAll);
router.get('/:id', productoController.getById);

module.exports = router;
