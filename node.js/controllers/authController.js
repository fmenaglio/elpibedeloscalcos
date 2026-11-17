const { supabaseAuth, supabaseAdmin } = require('../config/supabase');
const crypto = require('crypto');

const emailValido = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 190;
const texto = (v, max = 120) => typeof v === 'string' ? v.trim().slice(0, max) : '';

function guardarSesion(req, res, user, perfil, accessToken) {
    req.session.regenerate((err) => {
        if (err) return res.status(500).json({ mensaje: 'No se pudo iniciar la sesión.' });
        req.session.usuario = { id: user.id, nombre: perfil.nombre || '', apellido: perfil.apellido || '', email: user.email, domicilio: perfil.domicilio || '', localidad: perfil.localidad || '', telefono: perfil.telefono || '', rol: perfil.rol || 'cliente' };
        req.session.supabaseAccessToken = accessToken;
        req.session.save((e) => e ? res.status(500).json({ mensaje: 'No se pudo guardar la sesión.' }) : res.json({ mensaje: 'Sesión iniciada correctamente.', usuario: req.session.usuario }));
    });
}

exports.registrar = async (req, res) => {
    try {
        const { email, password } = req.body || {};
        const perfil = {
            nombre: texto(req.body.nombre, 80),
            apellido: texto(req.body.apellido, 80),
            domicilio: texto(req.body.domicilio, 180),
            localidad: texto(req.body.localidad, 100),
            telefono: texto(req.body.telefono, 25)
        };
        const correo = String(email || '').trim().toLowerCase();

        if (!emailValido(correo) || typeof password !== 'string' ||
            password.length < 10 || password.length > 72 ||
            !Object.values(perfil).every(Boolean)) {
            return res.status(400).json({
                mensaje: 'Completá todos los datos y usá una contraseña de al menos 10 caracteres.'
            });
        }
        if (!/^[0-9+()\s-]{8,25}$/.test(perfil.telefono)) {
            return res.status(400).json({ mensaje: 'Ingresá un teléfono válido.' });
        }

        // Creación administrativa: la cuenta queda confirmada sin enviar códigos.
        // La clave de servicio solo se utiliza en el servidor.
        const { data: creado, error: crearError } = await supabaseAdmin.auth.admin.createUser({
            email: correo,
            password,
            email_confirm: true,
            user_metadata: perfil
        });

        if (crearError || !creado.user) {
            const mensaje = crearError?.message || 'Supabase no devolvió el usuario.';
            console.error('Supabase registro:', {
                message: mensaje,
                code: crearError?.code,
                status: crearError?.status
            });
            const lower = mensaje.toLowerCase();
            if (lower.includes('already') || lower.includes('exists') || lower.includes('registered')) {
                return res.status(409).json({ mensaje: 'Ese correo ya está registrado. Iniciá sesión o recuperá la contraseña.' });
            }
            return res.status(400).json({ mensaje: `No se pudo crear la cuenta: ${mensaje}` });
        }

        const perfilCompleto = { id: creado.user.id, ...perfil, rol: 'cliente' };
        const { error: perfilError } = await supabaseAdmin
            .from('profiles')
            .upsert(perfilCompleto, { onConflict: 'id' });

        if (perfilError) {
            console.error('Perfil registro Supabase:', {
                message: perfilError.message,
                code: perfilError.code,
                details: perfilError.details,
                hint: perfilError.hint
            });
            return res.status(500).json({
                mensaje: 'La cuenta se creó, pero no se pudieron guardar tus datos. Contactá al administrador.'
            });
        }

        const { data: sesion, error: loginError } = await supabaseAuth.auth.signInWithPassword({
            email: correo,
            password
        });
        if (loginError || !sesion.user || !sesion.session) {
            console.error('Inicio de sesión luego del registro:', loginError?.message);
            return res.status(500).json({
                mensaje: 'La cuenta se creó, pero no se pudo iniciar la sesión. Probá iniciar sesión manualmente.'
            });
        }

        guardarSesion(req, res, sesion.user, perfilCompleto, sesion.session.access_token);
    } catch (e) {
        console.error('Registro:', e.message);
        res.status(500).json({ mensaje: 'Ocurrió un error al registrar la cuenta.' });
    }
};

exports.verificarRegistro = async (req, res) => {
    try {
        const email = String(req.body.email || '').trim().toLowerCase(); const token = String(req.body.codigo || '').trim();
        if (!emailValido(email) || !/^\d{6}$/.test(token)) return res.status(400).json({ mensaje: 'Ingresá un correo y el código de 6 dígitos.' });
        const { data, error } = await supabaseAuth.auth.verifyOtp({ email, token, type: 'signup' });
        if (error || !data.user || !data.session) return res.status(400).json({ mensaje: 'El código es incorrecto o venció.' });
        const meta = data.user.user_metadata || {};
        const perfil = { id: data.user.id, nombre: texto(meta.nombre,80), apellido: texto(meta.apellido,80), domicilio: texto(meta.domicilio,180), localidad: texto(meta.localidad,100), telefono: texto(meta.telefono,25), rol: 'cliente' };
        const { error: perfilError } = await supabaseAdmin.from('profiles').upsert(perfil, { onConflict: 'id' });
        if (perfilError) { console.error('Perfil:', perfilError.message); return res.status(500).json({ mensaje: 'La cuenta se verificó, pero no se pudo guardar el perfil. Contactá al administrador.' }); }
        guardarSesion(req, res, data.user, perfil, data.session.access_token);
    } catch (e) { console.error('Verificación:', e.message); res.status(500).json({ mensaje: 'No se pudo verificar el correo.' }); }
};

exports.login = async (req, res) => {
    try {
        const email = String(req.body.email || '').trim().toLowerCase(); const password = req.body.password;
        if (!emailValido(email) || typeof password !== 'string') return res.status(400).json({ mensaje: 'Ingresá tu email y contraseña.' });
        const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password });
        if (error || !data.user || !data.session) return res.status(401).json({ mensaje: 'Email o contraseña incorrectos. Si todavía no verificaste el correo, revisá tu bandeja de entrada.' });
        const { data: perfil, error: pe } = await supabaseAdmin.from('profiles').select('nombre, apellido, domicilio, localidad, telefono, rol').eq('id', data.user.id).single();
        if (pe || !perfil) return res.status(403).json({ mensaje: 'No se encontró el perfil de esta cuenta.' });
        guardarSesion(req, res, data.user, perfil, data.session.access_token);
    } catch (e) { console.error('Login:', e.message); res.status(500).json({ mensaje: 'Ocurrió un error interno.' }); }
};

exports.actual = async (req, res) => {
    try {
        if (!req.session?.usuario || !req.session?.supabaseAccessToken) return res.status(401).json({ mensaje: 'No hay una sesión iniciada.' });
        const { data, error } = await supabaseAuth.auth.getUser(req.session.supabaseAccessToken);
        if (error || !data.user) return req.session.destroy(() => res.status(401).json({ mensaje: 'La sesión expiró. Iniciá sesión nuevamente.' }));
        const { data: perfil } = await supabaseAdmin.from('profiles').select('nombre, apellido, domicilio, localidad, telefono, rol').eq('id', data.user.id).single();
        res.json({ usuario: { ...req.session.usuario, ...(perfil || {}) } });
    } catch (e) { res.status(500).json({ mensaje: 'Ocurrió un error interno.' }); }
};

exports.actualizarPerfil = async (req, res) => {
    try {
        const user = req.session?.usuario; if (!user) return res.status(401).json({ mensaje: 'Iniciá sesión.' });
        const perfil = { nombre: texto(req.body.nombre,80), apellido: texto(req.body.apellido,80), domicilio: texto(req.body.domicilio,180), localidad: texto(req.body.localidad,100), telefono: texto(req.body.telefono,25) };
        if (!Object.values(perfil).every(Boolean) || !/^[0-9+()\s-]{8,25}$/.test(perfil.telefono)) return res.status(400).json({ mensaje: 'Revisá los datos ingresados.' });
        const { error } = await supabaseAdmin.from('profiles').upsert(
            { id: user.id, ...perfil, rol: user.rol || 'cliente' },
            { onConflict: 'id' }
        );
        if (error) throw error;
        Object.assign(req.session.usuario, perfil);
        req.session.save((saveError) => {
            if (saveError) return res.status(500).json({ mensaje: 'Los datos se guardaron, pero no se pudo actualizar la sesión.' });
            res.json({ mensaje: 'Datos actualizados correctamente.', usuario: req.session.usuario });
        });
    } catch (e) { console.error('Perfil:', e.message); res.status(500).json({ mensaje: 'No se pudieron actualizar tus datos.' }); }
};

exports.solicitarRecuperacion = async (req, res) => {
    try {
        const email = String(req.body.email || '').trim().toLowerCase();
        if (!emailValido(email)) {
            return res.status(400).json({ mensaje: 'Ingresá un correo válido.' });
        }

        const appUrl = String(process.env.URL_DE_LA_APLICACION || '').trim().replace(/\/$/, '');
        const smtpHost = process.env.SMTP_HOST;
        const smtpPort = Number(process.env.SMTP_PORT || 465);
        const smtpUser = process.env.SMTP_USER;
        const smtpPass = process.env.SMTP_PASS;
        const mailFrom = process.env.MAIL_FROM || smtpUser;

        if (!appUrl || !smtpHost || !smtpUser || !smtpPass || !mailFrom) {
            return res.status(500).json({
                mensaje: 'Falta configurar URL_DE_LA_APLICACION y las variables SMTP en Vercel.'
            });
        }

        // Genera un enlace oficial de recuperación de Supabase, pero el correo
        // se envía desde nuestro backend mediante Nodemailer.
        const { data, error } = await supabaseAdmin.auth.admin.generateLink({
            type: 'recovery',
            email,
            options: { redirectTo: appUrl }
        });

        if (error || !data?.properties?.action_link) {
            console.error('Generación de enlace de recuperación:', error?.message || 'No se recibió action_link');
            return res.status(500).json({
                mensaje: 'No se pudo generar el enlace de recuperación. Revisá el correo de la cuenta.'
            });
        }

        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: String(process.env.SMTP_SECURE || (smtpPort === 465)).toLowerCase() === 'true',
            auth: { user: smtpUser, pass: smtpPass },
            connectionTimeout: 15000,
            greetingTimeout: 15000,
            socketTimeout: 20000
        });

        await transporter.sendMail({
            from: { name: process.env.MAIL_FROM_NAME || 'Elpibedeloscalcos', address: mailFrom },
            to: email,
            subject: 'Recuperá tu contraseña - Elpibedeloscalcos',
            text: `Para crear una contraseña nueva, abrí este enlace: ${data.properties.action_link}\n\nSi no solicitaste este cambio, ignorá este correo.`,
            html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#222"><h2>Recuperá tu contraseña</h2><p>Recibimos una solicitud para cambiar la contraseña de tu cuenta de Elpibedeloscalcos.</p><p><a href="${data.properties.action_link}" style="display:inline-block;padding:13px 20px;background:#ed2939;color:#fff;text-decoration:none;border-radius:6px">Crear contraseña nueva</a></p><p>Si no solicitaste este cambio, ignorá este correo.</p></div>`
        });

        res.json({ mensaje: 'Te enviamos un enlace para crear una contraseña nueva. Revisá tu correo y la carpeta de spam.' });
    } catch (e) {
        console.error('Recuperación por email:', e.message);
        res.status(500).json({
            mensaje: 'No se pudo enviar el correo. Revisá las credenciales SMTP de Gmail configuradas en Vercel.'
        });
    }
};

// Supabase vuelve a la tienda con access_token en el fragmento de la URL.
// El navegador lo entrega a este endpoint y queda asociado a la sesión segura del servidor.
exports.iniciarCambioPassword = async (req, res) => {
    try {
        const accessToken = String(req.body.access_token || '');
        if (!accessToken || accessToken.length > 4096) return res.status(400).json({ mensaje: 'El enlace de recuperación no es válido.' });
        const { data, error } = await supabaseAuth.auth.getUser(accessToken);
        if (error || !data.user) return res.status(401).json({ mensaje: 'El enlace venció o ya fue utilizado. Solicitá uno nuevo.' });
        req.session.recoveryToken = accessToken;
        req.session.recoveryEmail = data.user.email;
        req.session.save((e) => e ? res.status(500).json({ mensaje: 'No se pudo preparar el cambio de contraseña.' }) : res.json({ mensaje: 'Enlace verificado. Elegí tu nueva contraseña.' }));
    } catch (e) {
        console.error('Inicio cambio contraseña:', e.message);
        res.status(500).json({ mensaje: 'No se pudo validar el enlace de recuperación.' });
    }
};

exports.cambiarPassword = async (req, res) => {
    try {
        const password = req.body.password; if (typeof password !== 'string' || password.length < 10 || password.length > 72) return res.status(400).json({ mensaje: 'La contraseña debe tener entre 10 y 72 caracteres.' });
        if (password !== req.body.confirmarPassword) return res.status(400).json({ mensaje: 'Las contraseñas no coinciden.' });
        if (!req.session?.recoveryToken) return res.status(401).json({ mensaje: 'Primero abrí el enlace de recuperación que te enviamos por correo.' });
        const client = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${req.session.recoveryToken}` } }, auth: { persistSession: false, autoRefreshToken: false } });
        const { error } = await client.auth.updateUser({ password }); if (error) return res.status(400).json({ mensaje: 'No se pudo cambiar la contraseña.' });
        delete req.session.recoveryToken; delete req.session.recoveryEmail;
        req.session.save(() => res.json({ mensaje: 'Contraseña actualizada. Ya podés iniciar sesión.' }));
    } catch (e) { res.status(500).json({ mensaje: 'No se pudo cambiar la contraseña.' }); }
};

exports.logout = (req, res) => req.session.destroy((e) => { if (e) return res.status(500).json({ mensaje: 'No se pudo cerrar la sesión.' }); res.clearCookie('calcoshop.sid'); res.json({ mensaje: 'Sesión cerrada correctamente.' }); });
