from flask import Blueprint, request, jsonify
from app.services.auth_service import register_user, login_user, get_user_info
from app.utils.decorators import validate_json, token_required

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['POST'])
@validate_json('username', 'email', 'password')
def register():
    """Register a new user"""
    data = request.get_json()
    
    username = data.get('username', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '')
    
    # Basic validation
    if len(username) < 3:
        return jsonify({
            'success': False,
            'error': {'message': 'Username must be at least 3 characters'}
        }), 400
    
    if len(password) < 6:
        return jsonify({
            'success': False,
            'error': {'message': 'Password must be at least 6 characters'}
        }), 400
    
    result = register_user(username, email, password)
    
    if result['success']:
        return jsonify(result), 201
    else:
        return jsonify(result), 400

@auth_bp.route('/login', methods=['POST'])
@validate_json('username', 'password')
def login():
    """Login user"""
    data = request.get_json()
    
    username = data.get('username', '').strip()
    password = data.get('password', '')
    
    result = login_user(username, password)
    
    if result['success']:
        return jsonify(result), 200
    else:
        return jsonify(result), 401

@auth_bp.route('/me', methods=['GET'])
@token_required
def get_current_user(current_user):
    """Get current user information"""
    result = get_user_info(current_user.id)
    return jsonify(result), 200

@auth_bp.route('/logout', methods=['POST'])
@token_required
def logout(current_user):
    """Logout user (client-side token removal)"""
    return jsonify({
        'success': True,
        'message': 'Logout successful'
    }), 200