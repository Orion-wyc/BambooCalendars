import bcrypt
import jwt
from datetime import datetime, timedelta
from flask import current_app
from app.models.user import User
from app import db

def hash_password(password):
    """Hash password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password, password_hash):
    """Verify password against hash"""
    return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))

def generate_token(user_id):
    """Generate JWT token"""
    payload = {
        'user_id': user_id,
        'exp': datetime.utcnow() + current_app.config['JWT_ACCESS_TOKEN_EXPIRES'],
        'iat': datetime.utcnow()
    }
    return jwt.encode(payload, current_app.config['JWT_SECRET_KEY'], algorithm='HS256')

def register_user(username, email, password):
    """Register a new user"""
    # Check if username exists
    if User.query.filter_by(username=username).first():
        return {'success': False, 'error': {'message': 'Username already exists'}}
    
    # Check if email exists
    if User.query.filter_by(email=email).first():
        return {'success': False, 'error': {'message': 'Email already exists'}}
    
    # Create new user
    user = User(
        username=username,
        email=email,
        password_hash=hash_password(password)
    )
    
    try:
        db.session.add(user)
        db.session.commit()
        
        token = generate_token(user.id)
        
        return {
            'success': True,
            'data': {
                'user': user.to_dict(),
                'token': token
            },
            'message': 'User registered successfully'
        }
    except Exception as e:
        db.session.rollback()
        return {'success': False, 'error': {'message': str(e)}}

def login_user(username, password):
    """Login user"""
    # Find user by username or email
    user = User.query.filter_by(username=username).first()
    if not user:
        user = User.query.filter_by(email=username).first()
    
    if not user:
        return {'success': False, 'error': {'message': 'Invalid credentials'}}
    
    if not verify_password(password, user.password_hash):
        return {'success': False, 'error': {'message': 'Invalid credentials'}}
    
    token = generate_token(user.id)
    
    return {
        'success': True,
        'data': {
            'user': user.to_dict(),
            'token': token
        },
        'message': 'Login successful'
    }

def get_user_info(user_id):
    """Get user information"""
    user = User.query.get(user_id)
    if not user:
        return {'success': False, 'error': {'message': 'User not found'}}
    
    return {
        'success': True,
        'data': user.to_dict()
    }