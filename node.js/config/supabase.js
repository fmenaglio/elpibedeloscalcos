const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const url = process.env.SUPABASE_URL;
const publishableKey = process.env.SUPABASE_ANON_KEY;
const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !publishableKey || !secretKey) {
    throw new Error('Faltan variables de entorno de Supabase.');
}

// Cliente para autenticación de usuarios.
const supabaseAuth = createClient(url, publishableKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
    }
});

// Cliente exclusivo del servidor para operaciones administrativas.
const supabaseAdmin = createClient(url, secretKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
    }
});

module.exports = {
    supabaseAuth,
    supabaseAdmin
};