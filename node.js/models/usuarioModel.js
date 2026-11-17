
const db = require('../config/db');

exports.buscarPorEmail = async (email) => {
    const [filas] = await db.query(
        'SELECT * FROM usuarios WHERE email = ? LIMIT 1',
        [email]
    );

    return filas[0];
};

exports.crear = async ({ nombre, email, passwordHash }) => {
    const [resultado] = await db.query(
        `INSERT INTO usuarios (nombre, email, password_hash, rol)
         VALUES (?, ?, ?, 'cliente')`,
        [nombre, email, passwordHash]
    );

    return resultado.insertId;
};
