from flask import Flask, render_template, request, redirect, url_for, session, flash
from flask_socketio import SocketIO, join_room, leave_room, send, emit
from werkzeug.security import generate_password_hash, check_password_hash
from models import db, User, Room, Message
from datetime import datetime
import os

# ─── App Setup ────────────────────────────────────────────────────────────────
app = Flask(__name__)
app.config['SECRET_KEY']         = 'campus-connect-secret-key-2024'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)
socketio = SocketIO(app, cors_allowed_origins='*', async_mode='gevent')

# ─── Create Tables ────────────────────────────────────────────────────────────
with app.app_context():
    db.create_all()

# ─── Helpers ──────────────────────────────────────────────────────────────────
def login_required(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            flash('Please log in first.', 'warning')
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated


def format_message_time(dt):
    """Returns '3:45 PM' for today's messages, or 'Jun 20, 3:45 PM' for older ones."""
    hour = dt.strftime('%I').lstrip('0') or '12'
    minute = dt.strftime('%M')
    ampm = dt.strftime('%p')
    time_str = f"{hour}:{minute} {ampm}"

    if dt.date() == datetime.now().date():
        return time_str

    date_str = dt.strftime('%b %d')
    return f"{date_str}, {time_str}"


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    if 'user_id' in session:
        return redirect(url_for('home'))
    return redirect(url_for('login'))


@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '').strip()

        if not username or not password:
            flash('Username and password are required.', 'error')
            return redirect(url_for('register'))

        if len(username) < 3:
            flash('Username must be at least 3 characters.', 'error')
            return redirect(url_for('register'))

        if len(password) < 4:
            flash('Password must be at least 4 characters.', 'error')
            return redirect(url_for('register'))

        existing = User.query.filter_by(username=username).first()
        if existing:
            flash('Username already taken. Try another.', 'error')
            return redirect(url_for('register'))

        hashed_pw = generate_password_hash(password)
        new_user  = User(username=username, password=hashed_pw)
        db.session.add(new_user)
        db.session.commit()

        flash('Account created! Please log in.', 'success')
        return redirect(url_for('login'))

    return render_template('register.html')


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '').strip()

        user = User.query.filter_by(username=username).first()
        if not user or not check_password_hash(user.password, password):
            flash('Invalid username or password.', 'error')
            return redirect(url_for('login'))

        session['user_id']   = user.id
        session['username']  = user.username
        return redirect(url_for('home'))

    return render_template('login.html')


@app.route('/logout')
def logout():
    session.clear()
    flash('You have been logged out.', 'success')
    return redirect(url_for('login'))


@app.route('/home', methods=['GET', 'POST'])
@login_required
def home():
    if request.method == 'POST':
        room_name   = request.form.get('room_name', '').strip()
        description = request.form.get('description', '').strip()

        if not room_name:
            flash('Room name is required.', 'error')
            return redirect(url_for('home'))

        if len(room_name) < 2:
            flash('Room name must be at least 2 characters.', 'error')
            return redirect(url_for('home'))

        existing = Room.query.filter_by(name=room_name).first()
        if existing:
            flash('A room with that name already exists.', 'error')
            return redirect(url_for('home'))

        new_room = Room(
            name=room_name,
            description=description,
            created_by=session['user_id']
        )
        db.session.add(new_room)
        db.session.commit()
        flash(f'Room "{room_name}" created!', 'success')
        return redirect(url_for('home'))

    rooms = Room.query.order_by(Room.created_at.desc()).all()
    return render_template('home.html', rooms=rooms, username=session['username'])


@app.route('/room/<int:room_id>')
@login_required
def room(room_id):
    chat_room = Room.query.get_or_404(room_id)
    raw_messages = Message.query.filter_by(room_id=room_id).order_by(Message.created_at.asc()).limit(100).all()

    history = [{
        'username': m.username,
        'text': m.text,
        'time': format_message_time(m.created_at)
    } for m in raw_messages]

    return render_template('room.html', room=chat_room, username=session['username'], history=history)


# ─── Socket.IO Events ─────────────────────────────────────────────────────────

@socketio.on('join')
def handle_join(data):
    room_id  = str(data.get('room_id'))
    username = data.get('username')
    join_room(room_id)
    emit('message', {
        'username': 'System',
        'text': f'{username} joined the chat.',
        'time': format_message_time(datetime.now()),
        'is_system': True
    }, to=room_id)


@socketio.on('send_message')
def handle_message(data):
    room_id  = str(data.get('room_id'))
    username = data.get('username')
    text     = data.get('text', '').strip()

    if not text:
        return

    new_msg = Message(text=text, username=username, room_id=int(room_id))
    db.session.add(new_msg)
    db.session.commit()

    emit('message', {
        'username': username,
        'text': text,
        'time': format_message_time(new_msg.created_at),
        'is_system': False
    }, to=room_id)


@socketio.on('leave')
def handle_leave(data):
    room_id  = str(data.get('room_id'))
    username = data.get('username')
    leave_room(room_id)
    emit('message', {
        'username': 'System',
        'text': f'{username} left the chat.',
        'time': format_message_time(datetime.now()),
        'is_system': True
    }, to=room_id)


@socketio.on('typing')
def handle_typing(data):
    room_id  = str(data.get('room_id'))
    username = data.get('username')
    emit('user_typing', {'username': username}, to=room_id, include_self=False)


@socketio.on('stop_typing')
def handle_stop_typing(data):
    room_id  = str(data.get('room_id'))
    username = data.get('username')
    emit('user_stopped_typing', {'username': username}, to=room_id, include_self=False)


# ─── Run ──────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000, allow_unsafe_werkzeug=True)