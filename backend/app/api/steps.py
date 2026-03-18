from flask import Blueprint, request, jsonify
from app.models.step import Step
from app.models.todo import Todo
from app import db
from app.utils.decorators import token_required

steps_bp = Blueprint('steps', __name__)

@steps_bp.route('/todos/<int:todo_id>/steps', methods=['GET'])
@token_required
def get_steps(current_user, todo_id):
    """Get all steps for a specific todo"""
    # Verify todo belongs to current user
    todo = Todo.query.filter_by(id=todo_id, user_id=current_user.id).first()
    if not todo:
        return jsonify({
            'success': False,
            'error': {'message': 'Todo not found'}
        }), 404
    
    steps = Step.query.filter_by(todo_id=todo_id).order_by(Step.order).all()
    
    return jsonify({
        'success': True,
        'data': {
            'steps': [step.to_dict() for step in steps]
        }
    }), 200

@steps_bp.route('/todos/<int:todo_id>/steps', methods=['POST'])
@token_required
def create_step(current_user, todo_id):
    """Create a new step for a specific todo"""
    # Verify todo belongs to current user
    todo = Todo.query.filter_by(id=todo_id, user_id=current_user.id).first()
    if not todo:
        return jsonify({
            'success': False,
            'error': {'message': 'Todo not found'}
        }), 404
    
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
    
    # Get the next order value
    max_order = db.session.query(db.func.max(Step.order)).filter_by(todo_id=todo_id).scalar()
    next_order = (max_order or 0) + 1
    
    # Create step
    step = Step(
        todo_id=todo_id,
        content=data['content'].strip(),
        order=next_order
    )
    
    try:
        db.session.add(step)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': step.to_dict(),
            'message': 'Step created successfully'
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': {'message': str(e)}
        }), 500

@steps_bp.route('/steps/<int:step_id>', methods=['PUT'])
@token_required
def update_step(current_user, step_id):
    """Update a step"""
    step = Step.query.join(Todo).filter(
        Step.id == step_id,
        Todo.user_id == current_user.id
    ).first()
    
    if not step:
        return jsonify({
            'success': False,
            'error': {'message': 'Step not found'}
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
        step.content = data['content'].strip()
    
    if 'order' in data:
        step.order = data['order']
    
    try:
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': step.to_dict(),
            'message': 'Step updated successfully'
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': {'message': str(e)}
        }), 500

@steps_bp.route('/steps/<int:step_id>/complete', methods=['PATCH'])
@token_required
def toggle_complete(current_user, step_id):
    """Toggle step completion status"""
    step = Step.query.join(Todo).filter(
        Step.id == step_id,
        Todo.user_id == current_user.id
    ).first()
    
    if not step:
        return jsonify({
            'success': False,
            'error': {'message': 'Step not found'}
        }), 404
    
    if not request.is_json:
        return jsonify({
            'success': False,
            'error': {'message': 'Content-Type must be application/json'}
        }), 400
    
    data = request.get_json()
    is_completed = data.get('is_completed', not step.is_completed)
    
    step.is_completed = is_completed
    
    try:
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': step.to_dict(),
            'message': 'Step status updated'
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': {'message': str(e)}
        }), 500

@steps_bp.route('/steps/<int:step_id>', methods=['DELETE'])
@token_required
def delete_step(current_user, step_id):
    """Delete a step"""
    step = Step.query.join(Todo).filter(
        Step.id == step_id,
        Todo.user_id == current_user.id
    ).first()
    
    if not step:
        return jsonify({
            'success': False,
            'error': {'message': 'Step not found'}
        }), 404
    
    try:
        db.session.delete(step)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Step deleted successfully'
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': {'message': str(e)}
        }), 500

@steps_bp.route('/steps/reorder', methods=['PUT'])
@token_required
def reorder_steps(current_user):
    """Reorder steps"""
    if not request.is_json:
        return jsonify({
            'success': False,
            'error': {'message': 'Content-Type must be application/json'}
        }), 400
    
    data = request.get_json()
    steps_data = data.get('steps', [])
    
    if not steps_data:
        return jsonify({
            'success': False,
            'error': {'message': 'No steps data provided'}
        }), 400
    
    try:
        for step_data in steps_data:
            step_id = step_data.get('id')
            new_order = step_data.get('order')
            
            if step_id is None or new_order is None:
                continue
            
            step = Step.query.join(Todo).filter(
                Step.id == step_id,
                Todo.user_id == current_user.id
            ).first()
            
            if step:
                step.order = new_order
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Steps reordered successfully'
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': {'message': str(e)}
        }), 500