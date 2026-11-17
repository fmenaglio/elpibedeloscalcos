
const express = require('express');
const router = express.Router();
const pedidoController = require('../controllers/pedidoController');

// Historial de compras del cliente.
router.get('/mis-pedidos', pedidoController.misPedidos);

// Crear un pedido: el controlador exige sesión iniciada.
router.post('/', pedidoController.crear);

module.exports = router;
