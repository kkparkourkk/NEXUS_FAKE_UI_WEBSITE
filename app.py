import os
import random
import string
from flask import Flask, request, jsonify, session, send_from_directory
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from database import get_db, init_db

app = Flask(__name__, static_folder='static', static_url_path='/static')
app.secret_key = 'nexus_digital_marketplace_premium_secure_key'
CORS(app, supports_credentials=True)

# Ensure folders exist
UPLOAD_FOLDER = os.path.join(app.root_path, 'static', 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024  # 5MB max upload

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Initialize DB on start
init_db()

# Decorators for auth
def login_required(f):
    def wrapper(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({"error": "Unauthorized. Please log in."}), 401
        return f(*args, **kwargs)
    wrapper.__name__ = f.__name__
    return wrapper

def admin_required(f):
    def wrapper(*args, **kwargs):
        if 'user_id' not in session or session.get('role') != 'admin':
            return jsonify({"error": "Forbidden. Admin access required."}), 403
        return f(*args, **kwargs)
    wrapper.__name__ = f.__name__
    return wrapper

# Root Route - Serve index.html
@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

# --- AUTH API ---
@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not name or not email or not password:
        return jsonify({"error": "All fields are required"}), 400

    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters long"}), 400

    conn = get_db()
    cursor = conn.cursor()
    try:
        hashed_pw = generate_password_hash(password)
        cursor.execute(
            "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'customer')",
            (name, email, hashed_pw)
        )
        conn.commit()
        
        # Log them in automatically
        cursor.execute("SELECT id, name, email, role FROM users WHERE email = ?", (email,))
        user = cursor.fetchone()
        session['user_id'] = user['id']
        session['name'] = user['name']
        session['email'] = user['email']
        session['role'] = user['role']
        
        return jsonify({
            "message": "Registration successful",
            "user": {"id": user['id'], "name": user['name'], "email": user['email'], "role": user['role']}
        }), 201
    except sqlite3.IntegrityError:
        return jsonify({"error": "Email is already registered"}), 400
    finally:
        conn.close()

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
    user = cursor.fetchone()
    conn.close()

    if user and check_password_hash(user['password_hash'], password):
        session['user_id'] = user['id']
        session['name'] = user['name']
        session['email'] = user['email']
        session['role'] = user['role']
        return jsonify({
            "message": "Login successful",
            "user": {"id": user['id'], "name": user['name'], "email": user['email'], "role": user['role']}
        })
    else:
        return jsonify({"error": "Invalid email or password"}), 401

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({"message": "Logged out successfully"})

@app.route('/api/auth/me', methods=['GET'])
def me():
    if 'user_id' in session:
        return jsonify({
            "user": {
                "id": session['user_id'],
                "name": session['name'],
                "email": session['email'],
                "role": session['role']
            }
        })
    return jsonify({"user": None})


# --- PRODUCTS API ---
@app.route('/api/products', methods=['GET'])
def get_products():
    game_filter = request.args.get('game', '').strip()
    search_query = request.args.get('search', '').strip()
    sort_by = request.args.get('sort', '').strip()

    conn = get_db()
    cursor = conn.cursor()
    
    query = "SELECT * FROM products WHERE available = 1"
    params = []

    if game_filter and game_filter.lower() != 'all games':
        query += " AND game = ?"
        params.append(game_filter)
        
    if search_query:
        query += " AND (name LIKE ? OR description LIKE ?)"
        params.append(f"%{search_query}%")
        params.append(f"%{search_query}%")

    if sort_by == 'price_asc':
        query += " ORDER BY price ASC"
    elif sort_by == 'price_desc':
        query += " ORDER BY price DESC"
    elif sort_by == 'rating':
        query += " ORDER BY rating DESC"
    else:
        query += " ORDER BY id DESC"  # newest

    cursor.execute(query, params)
    rows = cursor.fetchall()
    
    # Get all products including unavailable for administration if admin requested
    # But for public catalog, keep only available. We can do separate admin product list endpoint.
    products = [dict(row) for row in rows]
    conn.close()
    return jsonify(products)

@app.route('/api/admin/products-all', methods=['GET'])
@admin_required
def get_admin_products():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM products ORDER BY id DESC")
    rows = cursor.fetchall()
    products = [dict(row) for row in rows]
    conn.close()
    return jsonify(products)

@app.route('/api/products/<int:product_id>', methods=['GET'])
def get_product(product_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM products WHERE id = ?", (product_id,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return jsonify(dict(row))
    return jsonify({"error": "Product not found"}), 404

@app.route('/api/products', methods=['POST'])
@admin_required
def create_product():
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    game = data.get('game', '').strip()
    rarity = data.get('rarity', '').strip()
    price = data.get('price')
    image_url = data.get('image_url', '').strip()
    description = data.get('description', '').strip()
    rating = data.get('rating', 5.0)
    featured = int(data.get('featured', 0))
    available = int(data.get('available', 1))

    if not name or not game or not rarity or price is None or not image_url or not description:
        return jsonify({"error": "Missing required fields"}), 400

    try:
        price = float(price)
        rating = float(rating)
    except ValueError:
        return jsonify({"error": "Invalid price or rating values"}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO products (name, game, rarity, price, image_url, description, rating, featured, available)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (name, game, rarity, price, image_url, description, rating, featured, available)
    )
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()

    return jsonify({"message": "Product created successfully", "product_id": new_id}), 201

@app.route('/api/products/<int:product_id>', methods=['PUT'])
@admin_required
def update_product(product_id):
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    game = data.get('game', '').strip()
    rarity = data.get('rarity', '').strip()
    price = data.get('price')
    image_url = data.get('image_url', '').strip()
    description = data.get('description', '').strip()
    rating = data.get('rating')
    featured = data.get('featured')
    available = data.get('available')

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM products WHERE id = ?", (product_id,))
    if not cursor.fetchone():
        conn.close()
        return jsonify({"error": "Product not found"}), 404

    # Build updates dynamically
    updates = []
    params = []
    
    if name:
        updates.append("name = ?")
        params.append(name)
    if game:
        updates.append("game = ?")
        params.append(game)
    if rarity:
        updates.append("rarity = ?")
        params.append(rarity)
    if price is not None:
        updates.append("price = ?")
        params.append(float(price))
    if image_url:
        updates.append("image_url = ?")
        params.append(image_url)
    if description:
        updates.append("description = ?")
        params.append(description)
    if rating is not None:
        updates.append("rating = ?")
        params.append(float(rating))
    if featured is not None:
        updates.append("featured = ?")
        params.append(int(featured))
    if available is not None:
        updates.append("available = ?")
        params.append(int(available))

    if not updates:
        conn.close()
        return jsonify({"error": "No update values provided"}), 400

    params.append(product_id)
    cursor.execute(
        f"UPDATE products SET {', '.join(updates)} WHERE id = ?",
        params
    )
    conn.commit()
    conn.close()

    return jsonify({"message": "Product updated successfully"})

@app.route('/api/products/<int:product_id>', methods=['DELETE'])
@admin_required
def delete_product(product_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM products WHERE id = ?", (product_id,))
    if not cursor.fetchone():
        conn.close()
        return jsonify({"error": "Product not found"}), 404

    cursor.execute("DELETE FROM products WHERE id = ?", (product_id,))
    conn.commit()
    conn.close()

    return jsonify({"message": "Product deleted successfully"})


# --- ORDERS & CHECKOUT ---
def generate_order_id():
    chars = string.ascii_uppercase + string.digits
    return 'NEXUS-' + ''.join(random.choices(chars, k=6))

@app.route('/api/orders', methods=['POST'])
def create_order():
    data = request.get_json() or {}
    items = data.get('items', [])
    customer_name = data.get('customer_name', '').strip()
    customer_email = data.get('customer_email', '').strip().lower()
    customer_phone = data.get('customer_phone', '').strip()
    game = data.get('game', '').strip()
    player_uid = data.get('player_uid', '').strip()
    player_name = data.get('player_name', '').strip()
    region = data.get('region', '').strip()

    if not items or not customer_name or not customer_email or not game or not player_uid or not player_name or not region:
        return jsonify({"error": "Missing order details or Riot ID/game account details."}), 400

    # Calculate total on the backend using database prices (Secure!)
    conn = get_db()
    cursor = conn.cursor()
    total = 0.0
    verified_items = []
    
    for item in items:
        prod_id = item.get('product_id')
        qty = int(item.get('quantity', 1))
        
        cursor.execute("SELECT * FROM products WHERE id = ? AND available = 1", (prod_id,))
        prod = cursor.fetchone()
        
        if not prod:
            conn.close()
            return jsonify({"error": f"Product ID {prod_id} is unavailable or does not exist."}), 400
            
        item_total = prod['price'] * qty
        total += item_total
        verified_items.append({
            "product_id": prod['id'],
            "quantity": qty,
            "price": prod['price']
        })

    order_id = generate_order_id()
    user_id = session.get('user_id') # Can be anonymous checkout too, but tracks user_id if logged in

    cursor.execute(
        """INSERT INTO orders (id, user_id, total, payment_status, order_status, customer_name, customer_email, customer_phone, game, player_uid, player_name, region)
           VALUES (?, ?, ?, 'Pending Payment', 'Pending Payment', ?, ?, ?, ?, ?, ?, ?)""",
        (order_id, user_id, total, customer_name, customer_email, customer_phone, game, player_uid, player_name, region)
    )

    for item in verified_items:
        cursor.execute(
            """INSERT INTO order_items (order_id, product_id, quantity, price)
               VALUES (?, ?, ?, ?)""",
            (order_id, item['product_id'], item['quantity'], item['price'])
        )

    conn.commit()
    conn.close()

    return jsonify({
        "message": "Order created successfully",
        "order_id": order_id,
        "total": total
    }), 201

@app.route('/api/orders/<order_id>', methods=['GET'])
def get_order(order_id):
    conn = get_db()
    cursor = conn.cursor()
    
    # Retrieve order
    cursor.execute("SELECT * FROM orders WHERE id = ?", (order_id,))
    order_row = cursor.fetchone()
    
    if not order_row:
        conn.close()
        return jsonify({"error": "Order not found"}), 404
        
    order = dict(order_row)
    
    # Retrieve items
    cursor.execute(
        """SELECT oi.*, p.name as product_name, p.game as product_game, p.image_url
           FROM order_items oi
           JOIN products p ON oi.product_id = p.id
           WHERE oi.order_id = ?""",
        (order_id,)
    )
    items = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    order['items'] = items
    return jsonify(order)

@app.route('/api/orders/<order_id>/submit-payment', methods=['POST'])
def submit_payment(order_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM orders WHERE id = ?", (order_id,))
    order = cursor.fetchone()
    
    if not order:
        conn.close()
        return jsonify({"error": "Order not found"}), 404

    # Update status to Payment Submitted / Payment verification pending
    cursor.execute(
        "UPDATE orders SET payment_status = 'Payment Submitted', order_status = 'Payment Submitted' WHERE id = ?",
        (order_id,)
    )
    conn.commit()
    conn.close()
    
    return jsonify({"message": "Payment submitted for verification. Order status is now pending review."})


# --- CUSTOMER DASHBOARD ---
@app.route('/api/dashboard/orders', methods=['GET'])
@login_required
def get_customer_orders():
    user_id = session['user_id']
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC",
        (user_id,)
    )
    rows = cursor.fetchall()
    orders = []
    
    for row in rows:
        order = dict(row)
        cursor.execute(
            """SELECT oi.*, p.name as product_name, p.image_url
               FROM order_items oi
               JOIN products p ON oi.product_id = p.id
               WHERE oi.order_id = ?""",
            (order['id'],)
        )
        order['items'] = [dict(item) for item in cursor.fetchall()]
        orders.append(order)
        
    conn.close()
    return jsonify(orders)


# --- ADMIN CONTROL API ---
@app.route('/api/admin/orders', methods=['GET'])
@admin_required
def get_all_orders():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM orders ORDER BY created_at DESC")
    rows = cursor.fetchall()
    orders = []
    
    for row in rows:
        order = dict(row)
        cursor.execute(
            """SELECT oi.*, p.name as product_name, p.game as product_game
               FROM order_items oi
               JOIN products p ON oi.product_id = p.id
               WHERE oi.order_id = ?""",
            (order['id'],)
        )
        order['items'] = [dict(item) for item in cursor.fetchall()]
        orders.append(order)
        
    conn.close()
    return jsonify(orders)

@app.route('/api/admin/orders/<order_id>/status', methods=['PUT'])
@admin_required
def update_order_status(order_id):
    data = request.get_json() or {}
    payment_status = data.get('payment_status')
    order_status = data.get('order_status')

    if not payment_status or not order_status:
        return jsonify({"error": "Payment status and Order status are required"}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM orders WHERE id = ?", (order_id,))
    if not cursor.fetchone():
        conn.close()
        return jsonify({"error": "Order not found"}), 404

    cursor.execute(
        "UPDATE orders SET payment_status = ?, order_status = ? WHERE id = ?",
        (payment_status, order_status, order_id)
    )
    conn.commit()
    conn.close()
    return jsonify({"message": "Order status updated successfully"})


# --- PAYMENT SETTINGS ---
@app.route('/api/payment-settings', methods=['GET'])
def get_payment_settings():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM payment_settings WHERE id = 1")
    row = cursor.fetchone()
    conn.close()
    return jsonify(dict(row))

@app.route('/api/admin/payment-settings', methods=['PUT'])
@admin_required
def update_payment_settings():
    data = request.get_json() or {}
    qr_image_url = data.get('qr_image_url')
    payment_identifier = data.get('payment_identifier')
    instructions = data.get('instructions')

    conn = get_db()
    cursor = conn.cursor()
    
    updates = []
    params = []
    if qr_image_url:
        updates.append("qr_image_url = ?")
        params.append(qr_image_url)
    if payment_identifier:
        updates.append("payment_identifier = ?")
        params.append(payment_identifier)
    if instructions:
        updates.append("instructions = ?")
        params.append(instructions)

    if not updates:
        conn.close()
        return jsonify({"error": "No update values provided"}), 400

    cursor.execute(
        f"UPDATE payment_settings SET {', '.join(updates)} WHERE id = 1",
        params
    )
    conn.commit()
    conn.close()
    return jsonify({"message": "Payment settings updated successfully"})


# --- IMAGE UPLOAD ---
@app.route('/api/admin/upload', methods=['POST'])
@admin_required
def upload_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file part in request"}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400
        
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        # Append unique prefix to prevent overwrite
        unique_prefix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
        unique_filename = f"{unique_prefix}_{filename}"
        
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        file.save(file_path)
        
        web_path = f"/static/uploads/{unique_filename}"
        return jsonify({
            "message": "File uploaded successfully",
            "url": web_path
        })
        
    return jsonify({"error": "Invalid file type. Only image files are allowed."}), 400

if __name__ == '__main__':
    app.run(debug=True, port=5000)
