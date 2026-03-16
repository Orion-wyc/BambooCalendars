from flask import Blueprint, request, jsonify
from datetime import datetime
from app.models.todo import Todo
from app.models.attachment import Attachment
from app import db
from app.utils.decorators import token_required

todos_bp = Blueprint('todos', __name__)

@todos_bp.route('', methods=['GET'])
@token_required
def get_todos(current_user):
    """Get all todos for current user"""
    # Get query parameters
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    search = request.args.get('search', '')
    status = request.args.get('status', '')
    priority = request.args.get('priority', '')
    sort_by = request.args.get('sort_by', 'created_at')
    order = request.args.get('order', 'desc')
    
    # Build query
    query = Todo.query.filter_by(user_id=current_user.id)
    
    # Search filter
    if search:
        query = query.filter(
            Todo.title.contains(search) | Todo.description.contains(search)
        )
    
    # Status filter
    if status == 'completed':
        query = query.filter(Todo.is_completed == True)
    elif status == 'active':
        query = query.filter(Todo.is_completed == False)
    
    # Priority filter
    if priority:
        query = query.filter(Todo.priority == priority)
    
    # Sorting
    if sort_by == 'created_at':
        order_column = Todo.created_at
    elif sort_by == 'due_date':
        order_column = Todo.due_date
    elif sort_by == 'priority':
        # 为优先级定义排序权重
        order_column = db.case(
            (Todo.priority == 'high', 1),
            (Todo.priority == 'medium', 2),
            (Todo.priority == 'low', 3),
            else_=4
        )
    else:
        order_column = Todo.created_at
    
    if order == 'asc':
        # 对于可能为NULL的字段，使用NULLS_LAST
        if sort_by in ['due_date']:
            query = query.order_by(db.nulls_last(order_column.asc()))
        else:
            query = query.order_by(order_column.asc())
    else:
        # 对于可能为NULL的字段，使用NULLS_LAST
        if sort_by in ['due_date']:
            query = query.order_by(db.nulls_last(order_column.desc()))
        else:
            query = query.order_by(order_column.desc())
    
    # Pagination
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    return jsonify({
        'success': True,
        'data': {
            'todos': [todo.to_dict() for todo in pagination.items],
            'total': pagination.total,
            'pages': pagination.pages,
            'current_page': page
        }
    }), 200

@todos_bp.route('/<int:todo_id>', methods=['GET'])
@token_required
def get_todo(current_user, todo_id):
    """Get a specific todo"""
    todo = Todo.query.filter_by(id=todo_id, user_id=current_user.id).first()
    
    if not todo:
        return jsonify({
            'success': False,
            'error': {'message': 'Todo not found'}
        }), 404
    
    return jsonify({
        'success': True,
        'data': todo.to_dict()
    }), 200

@todos_bp.route('', methods=['POST'])
@token_required
def create_todo(current_user):
    """Create a new todo"""
    if not request.is_json:
        return jsonify({
            'success': False,
            'error': {'message': 'Content-Type must be application/json'}
        }), 400
    
    data = request.get_json()
    
    # Validation
    if 'title' not in data or not data['title'].strip():
        return jsonify({
            'success': False,
            'error': {'message': 'Title is required'}
        }), 400
    
    # Parse due date
    due_date = None
    if data.get('due_date'):
        try:
            due_date = datetime.fromisoformat(data['due_date'].replace('Z', '+00:00'))
        except ValueError:
            return jsonify({
                'success': False,
                'error': {'message': 'Invalid due date format'}
            }), 400
    
    # Create todo
    todo = Todo(
        user_id=current_user.id,
        title=data['title'].strip(),
        description=data.get('description', '').strip(),
        priority=data.get('priority', 'medium'),
        due_date=due_date
    )
    
    try:
        db.session.add(todo)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': todo.to_dict(),
            'message': 'Todo created successfully'
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': {'message': str(e)}
        }), 500

@todos_bp.route('/<int:todo_id>', methods=['PUT'])
@token_required
def update_todo(current_user, todo_id):
    """Update a todo"""
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
    
    # Update fields
    if 'title' in data:
        if not data['title'].strip():
            return jsonify({
                'success': False,
                'error': {'message': 'Title cannot be empty'}
            }), 400
        todo.title = data['title'].strip()
    
    if 'description' in data:
        todo.description = data['description'].strip()
    
    if 'priority' in data:
        todo.priority = data['priority']
    
    if 'due_date' in data:
        if data['due_date']:
            try:
                todo.due_date = datetime.fromisoformat(data['due_date'].replace('Z', '+00:00'))
            except ValueError:
                return jsonify({
                    'success': False,
                    'error': {'message': 'Invalid due date format'}
                }), 400
        else:
            todo.due_date = None
    
    try:
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': todo.to_dict(),
            'message': 'Todo updated successfully'
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': {'message': str(e)}
        }), 500

@todos_bp.route('/<int:todo_id>', methods=['DELETE'])
@token_required
def delete_todo(current_user, todo_id):
    """Delete a todo"""
    todo = Todo.query.filter_by(id=todo_id, user_id=current_user.id).first()
    
    if not todo:
        return jsonify({
            'success': False,
            'error': {'message': 'Todo not found'}
        }), 404
    
    try:
        db.session.delete(todo)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Todo deleted successfully'
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': {'message': str(e)}
        }), 500

@todos_bp.route('/<int:todo_id>/complete', methods=['PATCH'])
@token_required
def toggle_complete(current_user, todo_id):
    """Toggle todo completion status"""
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
    is_completed = data.get('is_completed', not todo.is_completed)
    
    todo.is_completed = is_completed
    
    try:
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': todo.to_dict(),
            'message': 'Todo status updated'
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': {'message': str(e)}
        }), 500