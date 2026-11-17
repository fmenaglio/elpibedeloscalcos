
const Pedido = require('../models/pedidoModel');
const { supabaseAdmin } = require('../config/supabase');

exports.crear = async (req, res) => {
    try {
        const { productos } = req.body || {};

        if (
            !Array.isArray(productos) ||
            productos.length < 1 ||
            productos.length > 30
        ) {
            return res.status(400).json({
                mensaje: 'El carrito está vacío o tiene demasiados productos.'
            });
        }

        const cantidades = new Map();

        for (const item of productos) {
            const productoId = Number(item.productoId);
            const cantidad = Number(item.cantidad);

            if (
                !Number.isSafeInteger(productoId) ||
                productoId < 1 ||
                !Number.isSafeInteger(cantidad) ||
                cantidad < 1 ||
                cantidad > 100
            ) {
                return res.status(400).json({
                    mensaje: 'Hay un producto o una cantidad inválidos.'
                });
            }

            const acumulada = (cantidades.get(productoId) || 0) + cantidad;

            if (acumulada > 100) {
                return res.status(400).json({
                    mensaje: 'La cantidad solicitada es demasiado grande.'
                });
            }

            cantidades.set(productoId, acumulada);
        }

        const usuario = req.session?.usuario;
        if (!usuario) return res.status(401).json({ mensaje: 'Iniciá sesión para realizar una compra.' });
        const { data: perfil, error: perfilError } = await supabaseAdmin
            .from('profiles')
            .select('nombre, apellido, domicilio, localidad, telefono')
            .eq('id', usuario.id)
            .maybeSingle();
        if (perfilError) throw perfilError;
        const datos = {
            nombre: String(perfil?.nombre || usuario.nombre || '').trim(),
            apellido: String(perfil?.apellido || usuario.apellido || '').trim(),
            domicilio: String(perfil?.domicilio || usuario.domicilio || '').trim(),
            localidad: String(perfil?.localidad || usuario.localidad || '').trim(),
            telefono: String(perfil?.telefono || usuario.telefono || '').trim()
        };
        if (Object.values(datos).some(valor => !valor)) {
            return res.status(400).json({
                mensaje: 'Antes de comprar, completá nombre, apellido, domicilio, localidad y teléfono en “Mi cuenta”.'
            });
        }
        const pedido = await Pedido.crearPedido({
            usuarioId: usuario.id,
            clienteNombre: `${datos.nombre} ${datos.apellido}`,
            apellido: datos.apellido,
            domicilio: datos.domicilio,
            localidad: datos.localidad,
            telefono: datos.telefono,
            productos: Array.from(
                cantidades,
                ([productoId, cantidad]) => ({
                    productoId,
                    cantidad
                })
            )
        });

        return res.status(201).json({
            mensaje: 'Pedido registrado correctamente.',
            pedido
        });

    } catch (error) {
        console.error('Error al registrar pedido:', error.message);

        if (error.status === 400) {
            return res.status(400).json({ mensaje: error.message });
        }
        if (
            error.message.toLowerCase().includes('stock') ||
            error.message.toLowerCase().includes('no existe')
        ) {
            return res.status(409).json({
                mensaje: error.message
            });
        }

        return res.status(500).json({
            mensaje: 'No se pudo registrar el pedido. Intentá nuevamente.'
        });
    }
};

// Historial exclusivo del usuario que inició sesión.
exports.misPedidos = async (req, res) => {
    try {
        const usuario = req.session?.usuario;

        if (!usuario) {
            return res.status(401).json({
                mensaje: 'Iniciá sesión para consultar tus pedidos.'
            });
        }

        const pedidos = await Pedido.obtenerPedidosPorUsuario(usuario.id);

        return res.json({ pedidos });

    } catch (error) {
        console.error('Error al consultar pedidos:', error.message);

        return res.status(500).json({
            mensaje: 'No se pudo cargar tu historial de pedidos.'
        });
    }
};
