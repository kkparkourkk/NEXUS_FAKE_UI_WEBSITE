import sqlite3
import os
from werkzeug.security import generate_password_hash

DATABASE_PATH = os.path.join(os.path.dirname(__file__), 'nexus.db')
SCHEMA_PATH = os.path.join(os.path.dirname(__file__), 'schema.sql')

def get_db():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    # Setup tables
    conn = get_db()
    with open(SCHEMA_PATH, 'r') as f:
        schema = f.read()
    
    conn.executescript(schema)
    conn.commit()

    # Seed Admin User if not exists
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE email = 'admin@nexus.gg'")
    admin = cursor.fetchone()
    if not admin:
        hashed_pw = generate_password_hash("AdminPassword123!")
        cursor.execute(
            "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
            ("NEXUS Admin", "admin@nexus.gg", hashed_pw, "admin")
        )
        print("Seeded default admin: admin@nexus.gg / AdminPassword123!")
    
    # Seed Products if empty
    cursor.execute("SELECT COUNT(*) FROM products")
    product_count = cursor.fetchone()[0]
    if product_count == 0:
        default_products = [
            {
                "name": "Neptune Vandal",
                "game": "Valorant",
                "rarity": "Legendary",
                "price": 29.99,
                "image_url": "/static/images/neptune_vandal.jpg",
                "description": "The Neptune Vandal brings an aquatic theme to the battlefield, featuring a miniature aquarium inside the weapon casing, complete with bubbles and swimming fish. Unleash the tides of war with this legendary rifle.",
                "rating": 4.9,
                "featured": 0,
                "available": 1
            },
            {
                "name": "Voidwalker Bundle",
                "game": "Fortnite",
                "rarity": "Legendary",
                "price": 32.00,
                "image_url": "/static/images/voidwalker_bundle.jpg",
                "description": "Embody the dark spatial energy of the rift with the Voidwalker Set. This collection features the cosmic Voidwalker outfit, back bling, and matching harvesting tool with custom ambient particle effects.",
                "rating": 5.0,
                "featured": 1,
                "available": 1
            },
            {
                "name": "Dragon Lore AK",
                "game": "CS2",
                "rarity": "Epic",
                "price": 44.50,
                "image_url": "/static/images/dragon_lore.jpg",
                "description": "Adorned with a custom painting of a fire-breathing dragon, this skin is one of the most iconic and prestigious weapon finishes. Level up your loadout with the legendary dragon.",
                "rating": 4.8,
                "featured": 0,
                "available": 1
            },
            {
                "name": "Hyper Beast AWP",
                "game": "CS2",
                "rarity": "Legendary",
                "price": 39.99,
                "image_url": "/static/images/hyper_beast.jpg",
                "description": "Features a psychedelic, neon monster graphic in vibrant orange, purple, and green. A lethal weapon with a wild, aggressive design that will stand out in any lobby.",
                "rating": 4.9,
                "featured": 0,
                "available": 1
            },
            {
                "name": "Spectrum Phantom",
                "game": "Valorant",
                "rarity": "Epic",
                "price": 24.99,
                "image_url": "/static/images/spectrum_phantom.jpg",
                "description": "Designed in collaboration with Zedd, the Spectrum Phantom features clean white lines, color-shifting glowing accents, and high-fidelity electronic sound effects that sync dynamically with gameplay actions.",
                "rating": 4.7,
                "featured": 0,
                "available": 1
            },
            {
                "name": "Cobra MP40",
                "game": "Free Fire",
                "rarity": "Legendary",
                "price": 18.75,
                "image_url": "/static/images/cobra_mp40.jpg",
                "description": "Unleash the strike of the cobra. This weapon skin features dynamic red and black styling, custom reload animations, and venomous bullet impact particle effects.",
                "rating": 4.6,
                "featured": 0,
                "available": 1
            },
            {
                "name": "Frostbite Set",
                "game": "PUBG",
                "rarity": "Rare",
                "price": 14.00,
                "image_url": "/static/images/frostbite_set.jpg",
                "description": "Chill your opponents to the bone. Includes the Frostbite tactical jacket, thermal pants, and ice-blue combat boots. Perfect for snow-capped operations.",
                "rating": 4.5,
                "featured": 0,
                "available": 1
            },
            {
                "name": "Arcane Vandal",
                "game": "Valorant",
                "rarity": "Rare",
                "price": 11.99,
                "image_url": "/static/images/arcane_vandal.jpg",
                "description": "Inspired by the hit series Arcane, this Vandal skin captures Jinx's chaotic energy with custom graffiti engravings and unique firing sounds. A collector's dream.",
                "rating": 4.8,
                "featured": 0,
                "available": 1
            }
        ]
        
        for prod in default_products:
            cursor.execute(
                """INSERT INTO products (name, game, rarity, price, image_url, description, rating, featured, available)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (prod["name"], prod["game"], prod["rarity"], prod["price"], prod["image_url"], prod["description"], prod["rating"], prod["featured"], prod["available"])
            )
        print("Seeded default products!")
    
    # Seed default payment settings
    cursor.execute("SELECT COUNT(*) FROM payment_settings")
    settings_count = cursor.fetchone()[0]
    if settings_count == 0:
        cursor.execute(
            """INSERT INTO payment_settings (id, qr_image_url, payment_identifier, instructions)
               VALUES (?, ?, ?, ?)""",
            (1, '/static/images/default_qr.png', '9514823854@nyes', 'Scan the QR code using any UPI app (GPay, PhonePe, Paytm, etc.). After making the payment of the displayed INR (₹) amount, click "I\'ve completed payment" to submit your order.')
        )
        print("Seeded default payment settings!")

    conn.commit()
    conn.close()

if __name__ == '__main__':
    init_db()
