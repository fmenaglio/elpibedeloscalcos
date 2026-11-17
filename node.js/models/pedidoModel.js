
const db = require('../config/db');

async function crearPedido({ usuarioId, clienteNombre, apellido, domicilio, localidad, telefono, productos }) {
    const campos = {
        clienteNombre: String(clienteNombre || '').trim(),
        apellido: String(apellido || '').trim(),
        domicilio: String(domicilio || '').trim(),
        localidad: String(localidad || '').trim(),
        telefono: String(telefono || '').trim()
    };
    if (Object.values(campos).some(valor => !valor)) {
        const error = new Error('Faltan datos del cliente para registrar el pedido.');
        error.status = 400;
        throw error;
    }
    const conexion = await db.getConnection();

    try {
        await conexion.beginTransaction();

        let total = 0;
        const detalles = [];
        const cantidades = new Map();

        // Consolidar productos repetidos para evitar duplicados.
        for (const item of productos) {
            const productoId = Number(item.productoId);
            const cantidad = Number(item.cantidad);

            if (
                !Number.isSafeInteger(productoId) || productoId < 1 ||
                !Number.isSafeInteger(cantidad) || cantidad < 1 || cantidad > 100
            ) {
                throw new Error('Producto o cantidad inválidos.');
            }

            const acumulada = (cantidades.get(productoId) || 0) + cantidad;

            if (acumulada > 100) {
                throw new Error('La cantidad solicitada es demasiado grande.');
            }

            cantidades.set(productoId, acumulada);
        }

        // Verificar productos y guardar el precio vigente.
        // El stock se descuenta al confirmar el pedido.
        for (const [productoId, cantidad] of cantidades) {
            const [filas] = await conexion.query(
                `SELECT id, nombre, precio, stock
                 FROM productos
                 WHERE id = ?
                 FOR UPDATE`,
                [productoId]
            );

            if (!filas.length) {
                throw new Error('Uno de los productos no existe.');
            }

            const producto = filas[0];
            const stock = Number(producto.stock);
            const precio = Number(producto.precio);

            if (!Number.isInteger(stock) || stock < cantidad) {
                throw new Error(`No hay stock suficiente para ${producto.nombre}.`);
            }

            if (!Number.isFinite(precio) || precio < 0) {
                throw new Error('El precio de un producto no es válido.');
            }

            const subtotal = Math.round(precio * cantidad * 100) / 100;
            total += subtotal;

            detalles.push({
                productoId: producto.id,
                nombre: producto.nombre,
                cantidad,
                precio,
                subtotal
            });
        }

        total = Math.round(total * 100) / 100;

        const [resultado] = await conexion.query(
            `INSERT INTO pedidos
             (cliente_auth_id, cliente_nombre, apellido, domicilio, localidad, telefono, total, estado, stock_descontado)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'pendiente', FALSE)`,
            [
                usuarioId,
                campos.clienteNombre,
                campos.apellido,
                campos.domicilio,
                campos.localidad,
                campos.telefono,
                total
            ]
        );

        for (const detalle of detalles) {
            await conexion.query(
                `INSERT INTO detalle_pedido
                 (pedido_id, producto_id, nombre_producto,
                  cantidad, precio_unitario, subtotal)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    resultado.insertId,
                    detalle.productoId,
                    detalle.nombre,
                    detalle.cantidad,
                    detalle.precio,
                    detalle.subtotal
                ]
            );
        }

        await conexion.commit();

        return {
            id: resultado.insertId,
            total,
            estado: 'pendiente'
        };
    } catch (error) {
        await conexion.rollback();
        throw error;
    } finally {
        conexion.release();
    }
}

async function obtenerPedidosPorUsuario(usuarioId) {
    const [pedidos] = await db.query(
        `SELECT id, cliente_nombre, apellido, domicilio, localidad, telefono, total, estado, fecha
         FROM pedidos
         WHERE cliente_auth_id = ?
         ORDER BY fecha DESC, id DESC`,
        [usuarioId]
    );

    for (const pedido of pedidos) {
        const [detalles] = await db.query(
            `SELECT nombre_producto, cantidad, precio_unitario, subtotal
             FROM detalle_pedido
             WHERE pedido_id = ?
             ORDER BY id ASC`,
            [pedido.id]
        );

        pedido.productos = detalles;
    }

    return pedidos;
}

/*
 * Cambia el estado y administra el stock en una única transacción.
 * - Pendiente -> Confirmado: descuenta stock una sola vez.
 * - Confirmado -> Cancelado: devuelve stock una sola vez.
 * - Otros cambios no modifican el stock.
 */
async function actualizarEstado(id, nuevoEstado) {
    const conexion = await db.getConnection();

    const transiciones = {
        pendiente: ['confirmado', 'cancelado'],
        confirmado: ['entregado', 'cancelado'],
        entregado: [],
        cancelado: []
    };

    try {
        await conexion.beginTransaction();

        const [filasPedido] = await conexion.query(
            `SELECT id, estado, stock_descontado
             FROM pedidos
             WHERE id = ?
             FOR UPDATE`,
            [id]
        );

        if (!filasPedido.length) {
            const error = new Error('No se encontró el pedido.');
            error.status = 404;
            throw error;
        }

        const pedido = filasPedido[0];
        const estadoActual = pedido.estado;

        if (estadoActual === nuevoEstado) {
            await conexion.commit();
            return { estado: estadoActual, sinCambios: true };
        }

        if (!(transiciones[estadoActual] || []).includes(nuevoEstado)) {
            const error = new Error(
                `No se puede pasar un pedido de "${estadoActual}" a "${nuevoEstado}".`
            );
            error.status = 409;
            throw error;
        }

        // PostgreSQL devuelve BOOLEAN como true/false.
        let stockDescontado = pedido.stock_descontado === true;

        if (nuevoEstado === 'confirmado' && !stockDescontado) {
            const [detalles] = await conexion.query(
                `SELECT producto_id, nombre_producto, cantidad
                 FROM detalle_pedido
                 WHERE pedido_id = ?
                 ORDER BY id ASC`,
                [id]
            );

            for (const item of detalles) {
                const [actualizacion] = await conexion.query(
                    `UPDATE productos
                     SET stock = stock - ?
                     WHERE id = ? AND stock >= ?`,
                    [item.cantidad, item.producto_id, item.cantidad]
                );

                if (actualizacion.affectedRows !== 1) {
                    throw new Error(
                        `No hay stock suficiente para confirmar "${item.nombre_producto}". El pedido sigue pendiente.`
                    );
                }
            }

            stockDescontado = true;
        }

        if (nuevoEstado === 'cancelado' && stockDescontado) {
            const [detalles] = await conexion.query(
                `SELECT producto_id, cantidad
                 FROM detalle_pedido
                 WHERE pedido_id = ?`,
                [id]
            );

            for (const item of detalles) {
                await conexion.query(
                    `UPDATE productos
                     SET stock = stock + ?
                     WHERE id = ?`,
                    [item.cantidad, item.producto_id]
                );
            }

            stockDescontado = false;
        }

        await conexion.query(
            `UPDATE pedidos
             SET estado = ?, stock_descontado = ?
             WHERE id = ?`,
            [nuevoEstado, stockDescontado, id]
        );

        await conexion.commit();

        return {
            estado: nuevoEstado,
            sinCambios: false
        };
    } catch (error) {
        await conexion.rollback();
        throw error;
    } finally {
        conexion.release();
    }
}

module.exports = {
    crearPedido,
    obtenerPedidosPorUsuario,
    actualizarEstado
};
