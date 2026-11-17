const db = require('../config/db');

exports.getAll = async () => {
    const [rows] = await db.query(
        `SELECT p.*, c.nombre AS categoria_nombre
         FROM productos p
         LEFT JOIN categorias c ON c.id = p.categoria_id
         ORDER BY p.id DESC`
    );
    return rows;
};

exports.getById = async (id) => {
    const [rows] = await db.query(
        `SELECT p.*, c.nombre AS categoria_nombre
         FROM productos p
         LEFT JOIN categorias c ON c.id = p.categoria_id
         WHERE p.id = ?`,
        [id]
    );
    return rows[0];
};

exports.create = async (producto) => {
    const { nombre, descripcion, precio, imagen, stock, categoria_id } = producto;

    const [resultado] = await db.query(
        `INSERT INTO productos
        (nombre, descripcion, precio, imagen, stock, categoria_id)
        VALUES (?, ?, ?, ?, ?, ?)`,
        [nombre, descripcion, precio, imagen, stock, categoria_id || null]
    );

    return resultado.insertId;
};

exports.update = async (id, producto) => {
    const { nombre, descripcion, precio, imagen, stock, categoria_id } = producto;

    const [resultado] = await db.query(
        `UPDATE productos
         SET nombre = ?, descripcion = ?, precio = ?, imagen = ?, stock = ?, categoria_id = ?
         WHERE id = ?`,
        [nombre, descripcion, precio, imagen, stock, categoria_id || null, id]
    );

    return resultado.affectedRows;
};

exports.delete = async (id) => {
    const [resultado] = await db.query(
        'DELETE FROM productos WHERE id = ?',
        [id]
    );

    return resultado.affectedRows;
};
