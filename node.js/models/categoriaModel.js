const db = require('../config/db');

exports.getAll = async () => {
    const [rows] = await db.query(
        `SELECT c.id, c.nombre, COUNT(p.id) AS cantidad_productos
         FROM categorias c
         LEFT JOIN productos p ON p.categoria_id = c.id
         GROUP BY c.id, c.nombre
         ORDER BY c.nombre ASC`
    );
    return rows;
};

exports.create = async (nombre) => {
    const [resultado] = await db.query(
        'INSERT INTO categorias (nombre) VALUES (?)',
        [nombre]
    );
    return resultado.insertId;
};

exports.update = async (id, nombre) => {
    const [resultado] = await db.query(
        'UPDATE categorias SET nombre = ? WHERE id = ?',
        [nombre, id]
    );
    return resultado.affectedRows;
};

exports.delete = async (id) => {
    // La FK usa ON DELETE SET NULL: los productos no se eliminan.
    const [resultado] = await db.query(
        'DELETE FROM categorias WHERE id = ?',
        [id]
    );
    return resultado.affectedRows;
};
