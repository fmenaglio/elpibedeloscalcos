const crypto = require('crypto');

function compararSeguro(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;

    const bufferA = Buffer.from(a);
    const bufferB = Buffer.from(b);

    if (bufferA.length !== bufferB.length) return false;
    return crypto.timingSafeEqual(bufferA, bufferB);
}

exports.protegerCSRF = (req, res, next) => {
    const metodo = req.method.toUpperCase();

    if (['GET', 'HEAD', 'OPTIONS'].includes(metodo)) {
        return next();
    }

    const tokenSesion = req.session?.csrfToken;
    const tokenPeticion = req.get('X-CSRF-Token');

    if (!compararSeguro(tokenSesion, tokenPeticion)) {
        return res.status(403).json({
            mensaje: 'La solicitud venció o no es válida. Actualizá la página e intentá nuevamente.'
        });
    }

    next();
};
