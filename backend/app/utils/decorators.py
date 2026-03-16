import functools
from flask import jsonify, request
from app import db
import jwt

def token_required(f):
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(' ')[1]
            except IndexError:
                return jsonify({'success': False, 'error': {'message': 'Invalid token format'}}), 401
        
        if not token:
            return jsonify({'success': False, 'error': {'message': 'Token is missing'}}), 401
        
        try:
            from flask import current_app
            data = jwt.decode(token, current_app.config['JWT_SECRET_KEY'], algorithms=['HS256'])
            from app.models.user import User
            current_user = User.query.get(data['user_id'])
            
            if not current_user:
                return jsonify({'success': False, 'error': {'message': 'User not found'}}), 401
                
        except jwt.ExpiredSignatureError:
            return jsonify({'success': False, 'error': {'message': 'Token has expired'}}), 401
        except jwt.InvalidTokenError:
            return jsonify({'success': False, 'error': {'message': 'Invalid token'}}), 401
        
        return f(current_user, *args, **kwargs)
    
    return decorated

def handle_error(error):
    response = {
        'success': False,
        'error': {
            'message': str(error)
        }
    }
    return jsonify(response), 500

def validate_json(*required_fields):
    def decorator(f):
        @functools.wraps(f)
        def decorated(*args, **kwargs):
            if not request.is_json:
                return jsonify({'success': False, 'error': {'message': 'Content-Type must be application/json'}}), 400
            
            data = request.get_json()
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                return jsonify({
                    'success': False,
                    'error': {
                        'message': 'Missing required fields',
                        'fields': missing_fields
                    }
                }), 400
            
            return f(*args, **kwargs)
        
        return decorated
    return decorator