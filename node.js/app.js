const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const db = require('./config/db');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const productoRoutes = require('./routes/productoRoutes');
const categoriaRoutes = require('./routes/categoriaRoutes');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const pedidoRoutes = require('./routes/pedidoRoutes');
const { protegerCSRF } = require('./middlewares/csrfMiddleware.js');
const supabaseRoutes = require('./routes/supabaseRoutes');

const app = express();
const enProduccion = process.env.NODE_ENV === 'production';
app.use('/api/supabase', supabaseRoutes);

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    throw new Error('SESSION_SECRET debe existir y tener al menos 32 caracteres.');
}

if (enProduccion) {
    // Necesario cuando el hosting está detrás de un proxy HTTPS.
    app.set('trust proxy', 1);
}

const sessionStore = new PgSession({
    pool: db.pool,
    tableName: 'user_sessions',
    createTableIfMissing: true
});

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

app.use(session({
    name: 'calcoshop.sid',
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    proxy: enProduccion,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: enProduccion,
        maxAge: 1000 * 60 * 60 * 2
    }
}));

// Las rutas API que modifican datos deben enviar X-CSRF-Token.
app.use('/api', protegerCSRF);

const limiteLogin = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { mensaje: 'Demasiados intentos. Esperá unos minutos y volvé a intentar.' }
});

app.use('/api/auth/login', limiteLogin);
app.use('/api/auth/registro', limiteLogin);
app.use('/api/auth/verificar-registro', limiteLogin);
app.use('/api/auth/recuperar', limiteLogin);
app.use('/api/auth/verificar-recuperacion', limiteLogin);

app.use('/api/productos', productoRoutes);
app.use('/api/categorias', categoriaRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/pedidos', pedidoRoutes);

app.use(express.static(path.join(__dirname, 'public')));

module.exports = app;
