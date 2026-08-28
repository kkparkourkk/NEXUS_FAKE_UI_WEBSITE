-- NEXUS // Database Schema

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'customer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    game TEXT NOT NULL,
    rarity TEXT NOT NULL,
    price REAL NOT NULL,
    image_url TEXT NOT NULL,
    description TEXT NOT NULL,
    rating REAL DEFAULT 5.0,
    featured INTEGER DEFAULT 0,
    available INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    user_id INTEGER,
    total REAL NOT NULL,
    payment_status TEXT DEFAULT 'Pending Payment',
    order_status TEXT DEFAULT 'Order Created',
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT,
    game TEXT NOT NULL,
    player_uid TEXT NOT NULL,
    player_name TEXT NOT NULL,
    region TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    price REAL NOT NULL,
    FOREIGN KEY(order_id) REFERENCES orders(id),
    FOREIGN KEY(product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS payment_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    qr_image_url TEXT DEFAULT '/static/images/default_qr.png',
    payment_identifier TEXT DEFAULT '9514823854@nyes',
    instructions TEXT DEFAULT 'Scan QR code and pay. Enter your Riot ID / Player ID correctly.'
);
