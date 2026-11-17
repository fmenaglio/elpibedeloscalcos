
exports.soloAdmin = (req, res, next) => {
    if (!req.session || !req.session.usuario) {
        return res.status(401).json({
            mensaje: 'Tenés que iniciar sesión.'
        });
    }

    if (req.session.usuario.rol !== 'admin') {
        return res.status(403).json({
            mensaje: 'No tenés permisos para acceder.'
        });
    }

    next();
};
