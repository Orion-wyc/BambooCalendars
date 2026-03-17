from flask import Blueprint, request, jsonify
from app.models.record import Record
from app import db
from app.utils.decorators import token_required

records_bp = Blueprint('records', __name__)

@records_bp.route('', methods=['GET'])
@token_required
def get_records(current_user):
    """Get all records for current user"""
    # Get query parameters
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    
    # Build query - sort by created_at desc (newest first)
    query = Record.query.filter_by(user_id=current_user.id).order_by(Record.created_at.desc())
    
    # Pagination
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    return jsonify({
        'success': True,
        'data': {
            'records': [record.to_dict() for record in pagination.items],
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page
        }
    }), 200

@records_bp.route('/<int:record_id>', methods=['GET'])
@token_required
def get_record(current_user, record_id):
    """Get a specific record"""
    record = Record.query.filter_by(id=record_id, user_id=current_user.id).first()
    
    if not record:
        return jsonify({
            'success': False,
            'error': {'message': 'Record not found'}
        }), 404
    
    return jsonify({
        'success': True,
        'data': record.to_dict()
    }), 200

@records_bp.route('', methods=['POST'])
@token_required
def create_record(current_user):
    """Create a new record"""
    if not request.is_json:
        return jsonify({
            'success': False,
            'error': {'message': 'Content-Type must be application/json'}
        }), 400
    
    data = request.get_json()
    
    # Validation
    if 'content' not in data or not data['content'].strip():
        return jsonify({
            'success': False,
            'error': {'message': 'Content is required'}
        }), 400
    
    # Create record
    record = Record(
        user_id=current_user.id,
        content=data['content'].strip()
    )
    
    try:
        db.session.add(record)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': record.to_dict(),
            'message': 'Record created successfully'
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': {'message': str(e)}
        }), 500

@records_bp.route('/<int:record_id>', methods=['PUT'])
@token_required
def update_record(current_user, record_id):
    """Update a record"""
    record = Record.query.filter_by(id=record_id, user_id=current_user.id).first()
    
    if not record:
        return jsonify({
            'success': False,
            'error': {'message': 'Record not found'}
        }), 404
    
    if not request.is_json:
        return jsonify({
            'success': False,
            'error': {'message': 'Content-Type must be application/json'}
        }), 400
    
    data = request.get_json()
    
    # Update fields
    if 'content' in data:
        if not data['content'].strip():
            return jsonify({
                'success': False,
                'error': {'message': 'Content cannot be empty'}
            }), 400
        record.content = data['content'].strip()
    
    try:
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': record.to_dict(),
            'message': 'Record updated successfully'
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': {'message': str(e)}
        }), 500

@records_bp.route('/<int:record_id>', methods=['DELETE'])
@token_required
def delete_record(current_user, record_id):
    """Delete a record"""
    record = Record.query.filter_by(id=record_id, user_id=current_user.id).first()
    
    if not record:
        return jsonify({
            'success': False,
            'error': {'message': 'Record not found'}
        }), 404
    
    try:
        db.session.delete(record)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Record deleted successfully'
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': {'message': str(e)}
        }), 500