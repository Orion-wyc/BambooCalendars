import os
from flask import Blueprint, request, jsonify, send_file, send_from_directory, current_app
from werkzeug.utils import secure_filename
from app.models.todo import Todo
from app.models.attachment import Attachment
from app import db
from app.utils.decorators import token_required
from app.utils.helpers import (
    allowed_file, get_file_type, generate_unique_filename,
    get_upload_path, create_thumbnail, compress_image
)

attachments_bp = Blueprint('attachments', __name__)

@attachments_bp.route('/todo/<int:todo_id>', methods=['GET'])
@token_required
def get_todo_attachments(current_user, todo_id):
    """Get all attachments for a todo"""
    todo = Todo.query.filter_by(id=todo_id, user_id=current_user.id).first()
    
    if not todo:
        return jsonify({
            'success': False,
            'error': {'message': 'Todo not found'}
        }), 404
    
    attachments = Attachment.query.filter_by(todo_id=todo_id).all()
    
    return jsonify({
        'success': True,
        'data': [att.to_dict() for att in attachments]
    }), 200

@attachments_bp.route('/todo/<int:todo_id>', methods=['POST'])
@token_required
def upload_attachment(current_user, todo_id):
    """Upload an attachment to a todo"""
    todo = Todo.query.filter_by(id=todo_id, user_id=current_user.id).first()
    
    if not todo:
        return jsonify({
            'success': False,
            'error': {'message': 'Todo not found'}
        }), 404
    
    if 'file' not in request.files:
        return jsonify({
            'success': False,
            'error': {'message': 'No file provided'}
        }), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({
            'success': False,
            'error': {'message': 'No file selected'}
        }), 400
    
    # 移除文件格式限制，支持所有格式
    # if not allowed_file(file.filename):
    #     return jsonify({
    #         'success': False,
    #         'error': {'message': 'File type not allowed'}
    #     }), 400
    
    # Check file size
    file.seek(0, os.SEEK_END)
    file_size = file.tell()
    file.seek(0)
    
    if file_size > current_app.config['MAX_CONTENT_LENGTH']:
        return jsonify({
            'success': False,
            'error': {'message': f'File too large, maximum size is {current_app.config["MAX_CONTENT_LENGTH"] / (1024*1024):.0f}MB'}
        }), 400
    
    # Generate unique filename
    original_filename = secure_filename(file.filename)
    filename = generate_unique_filename(original_filename)
    
    # Create upload directory
    upload_path = get_upload_path(current_user.id)
    os.makedirs(upload_path, exist_ok=True)
    
    file_path = os.path.join(upload_path, filename)
    
    # Save file
    file.save(file_path)
    
    # Determine file type
    mime_type = file.mimetype or 'application/octet-stream'
    file_type = get_file_type(filename, mime_type)
    
    # Process image
    thumbnail_path = None
    if file_type == 'image':
        # Compress if needed
        compress_image(file_path, current_app.config['MAX_IMAGE_SIZE'], 
                      current_app.config['IMAGE_QUALITY'])
        
        # Create thumbnail
        thumbnail_filename = f'thumb_{filename}'
        thumbnail_path = os.path.join(upload_path, thumbnail_filename)
        create_thumbnail(file_path, thumbnail_path, current_app.config['THUMBNAIL_SIZE'])
    
    # Create attachment record
    attachment = Attachment(
        todo_id=todo_id,
        filename=filename,
        original_filename=original_filename,
        file_path=file_path,
        thumbnail_path=thumbnail_path,
        file_size=file_size,
        mime_type=mime_type,
        file_type=file_type
    )
    
    try:
        db.session.add(attachment)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': attachment.to_dict(),
            'message': 'File uploaded successfully'
        }), 201
    except Exception as e:
        db.session.rollback()
        # Clean up file
        if os.path.exists(file_path):
            os.remove(file_path)
        if thumbnail_path and os.path.exists(thumbnail_path):
            os.remove(thumbnail_path)
        
        return jsonify({
            'success': False,
            'error': {'message': str(e)}
        }), 500

@attachments_bp.route('/<int:attachment_id>', methods=['GET'])
@token_required
def get_attachment(current_user, attachment_id):
    """Get attachment details"""
    attachment = Attachment.query.get(attachment_id)
    
    if not attachment:
        return jsonify({
            'success': False,
            'error': {'message': 'Attachment not found'}
        }), 404
    
    # Verify ownership
    todo = Todo.query.get(attachment.todo_id)
    if not todo or todo.user_id != current_user.id:
        return jsonify({
            'success': False,
            'error': {'message': 'Access denied'}
        }), 403
    
    return jsonify({
        'success': True,
        'data': attachment.to_dict()
    }), 200

@attachments_bp.route('/<int:attachment_id>/download', methods=['GET'])
@token_required
def download_attachment(current_user, attachment_id):
    """Download an attachment"""
    attachment = Attachment.query.get(attachment_id)
    
    if not attachment:
        return jsonify({
            'success': False,
            'error': {'message': 'Attachment not found'}
        }), 404
    
    # Verify ownership
    todo = Todo.query.get(attachment.todo_id)
    if not todo or todo.user_id != current_user.id:
        return jsonify({
            'success': False,
            'error': {'message': 'Access denied'}
        }), 403
    
    # Convert relative path to absolute path
    file_path = attachment.file_path
    if file_path.startswith('./'):
        # Get the backend directory (parent of app directory)
        backend_dir = os.path.dirname(current_app.root_path)
        file_path = os.path.join(backend_dir, file_path[2:])
    
    if not os.path.exists(file_path):
        return jsonify({
            'success': False,
            'error': {'message': 'File not found'}
        }), 404
    
    try:
        directory = os.path.dirname(file_path)
        filename = os.path.basename(file_path)
        return send_from_directory(
            directory,
            filename,
            as_attachment=True,
            download_name=attachment.original_filename
        )
    except Exception as e:
        current_app.logger.error(f"Download error: {e}")
        return jsonify({
            'success': False,
            'error': {'message': 'Download failed'}
        }), 500

@attachments_bp.route('/<int:attachment_id>/preview', methods=['GET'])
@token_required
def preview_attachment(current_user, attachment_id):
    """Preview an attachment (for images)"""
    attachment = Attachment.query.get(attachment_id)
    
    if not attachment:
        return jsonify({
            'success': False,
            'error': {'message': 'Attachment not found'}
        }), 404
    
    # Verify ownership
    todo = Todo.query.get(attachment.todo_id)
    if not todo or todo.user_id != current_user.id:
        return jsonify({
            'success': False,
            'error': {'message': 'Access denied'}
        }), 403
    
    if attachment.file_type != 'image':
        return jsonify({
            'success': False,
            'error': {'message': 'File is not an image'}
        }), 400
    
    # Use thumbnail if available
    preview_path = attachment.thumbnail_path if attachment.thumbnail_path else attachment.file_path
    
    # Convert relative path to absolute path
    if preview_path.startswith('./'):
        backend_dir = os.path.dirname(current_app.root_path)
        preview_path = os.path.join(backend_dir, preview_path[2:])
    
    if not os.path.exists(preview_path):
        return jsonify({
            'success': False,
            'error': {'message': 'File not found'}
        }), 404
    
    try:
        directory = os.path.dirname(preview_path)
        filename = os.path.basename(preview_path)
        return send_from_directory(directory, filename)
    except Exception as e:
        current_app.logger.error(f"Preview error: {e}")
        return jsonify({
            'success': False,
            'error': {'message': 'Preview failed'}
        }), 500

@attachments_bp.route('/<int:attachment_id>', methods=['DELETE'])
@token_required
def delete_attachment(current_user, attachment_id):
    """Delete an attachment"""
    attachment = Attachment.query.get(attachment_id)
    
    if not attachment:
        return jsonify({
            'success': False,
            'error': {'message': 'Attachment not found'}
        }), 404
    
    # Verify ownership
    todo = Todo.query.get(attachment.todo_id)
    if not todo or todo.user_id != current_user.id:
        return jsonify({
            'success': False,
            'error': {'message': 'Access denied'}
        }), 403
    
    try:
        # Delete files
        if os.path.exists(attachment.file_path):
            os.remove(attachment.file_path)
        
        if attachment.thumbnail_path and os.path.exists(attachment.thumbnail_path):
            os.remove(attachment.thumbnail_path)
        
        # Delete database record
        db.session.delete(attachment)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Attachment deleted successfully'
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': {'message': str(e)}
        }), 500