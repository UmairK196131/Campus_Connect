from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'

    id         = db.Column(db.Integer, primary_key=True)
    username   = db.Column(db.String(50), unique=True, nullable=False)
    password   = db.Column(db.String(200), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.now)

    def __repr__(self):
        return f'<User {self.username}>'


class Room(db.Model):
    __tablename__ = 'rooms'

    id          = db.Column(db.Integer, primary_key=True)
    name        = db.Column(db.String(100), unique=True, nullable=False)
    description = db.Column(db.String(255), default='')
    created_by  = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at  = db.Column(db.DateTime, default=datetime.now)

    creator  = db.relationship('User', backref='rooms')
    messages = db.relationship('Message', backref='room', lazy=True, cascade='all, delete-orphan')

    def __repr__(self):
        return f'<Room {self.name}>'


class Message(db.Model):
    __tablename__ = 'messages'

    id          = db.Column(db.Integer, primary_key=True)
    text        = db.Column(db.String(500), nullable=False)
    username    = db.Column(db.String(50), nullable=False)
    room_id     = db.Column(db.Integer, db.ForeignKey('rooms.id'), nullable=False)
    created_at  = db.Column(db.DateTime, default=datetime.now)

    # Self-referential: a message can be a reply to another message in the same room
    reply_to_id = db.Column(db.Integer, db.ForeignKey('messages.id'), nullable=True)
    reply_to    = db.relationship('Message', remote_side=[id])

    reactions = db.relationship('Reaction', backref='message', lazy=True, cascade='all, delete-orphan')

    def __repr__(self):
        return f'<Message {self.username}: {self.text[:20]}>'


class Reaction(db.Model):
    __tablename__ = 'reactions'

    id         = db.Column(db.Integer, primary_key=True)
    message_id = db.Column(db.Integer, db.ForeignKey('messages.id'), nullable=False)
    username   = db.Column(db.String(50), nullable=False)
    emoji      = db.Column(db.String(10), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.now)

    __table_args__ = (
        db.UniqueConstraint('message_id', 'username', 'emoji', name='unique_reaction'),
    )

    def __repr__(self):
        return f'<Reaction {self.emoji} by {self.username}>'