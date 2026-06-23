from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    id         = db.Column(db.Integer, primary_key=True)
    username   = db.Column(db.String(50), unique=True, nullable=False)
    password   = db.Column(db.String(200), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Room(db.Model):
    __tablename__ = 'rooms'
    id          = db.Column(db.Integer, primary_key=True)
    name        = db.Column(db.String(100), unique=True, nullable=False)
    description = db.Column(db.String(255), default='')
    created_by  = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)
    creator     = db.relationship('User', backref='rooms')
    messages    = db.relationship('Message', backref='room', lazy=True, cascade='all, delete-orphan')

class Message(db.Model):
    __tablename__ = 'messages'
    id         = db.Column(db.Integer, primary_key=True)
    text       = db.Column(db.String(500), nullable=False)
    username   = db.Column(db.String(50), nullable=False)
    room_id    = db.Column(db.Integer, db.ForeignKey('rooms.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)