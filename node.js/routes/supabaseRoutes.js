const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');

router.get('/conexion', async (req, res) => {
    try {
        const { error } = await supabaseAdmin
            .from('categorias')
            .select('id')
            .limit(1);

        if (error) throw error;

        res.json({
            conectado: true,
            mensaje: 'CalcoShop está conectado a Supabase.'
        });
    } catch (error) {
        console.error('Error de Supabase:', error.message);

        res.status(500).json({
            conectado: false,
            mensaje: 'No se pudo conectar con Supabase.'
        });
    }
});

module.exports = router;