import os
import uuid
from datetime import datetime
from werkzeug.utils import secure_filename
from PIL import Image as PILImage
from flask import current_app

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in current_app.config['ALLOWED_EXTENSIONS']

def get_file_type(filename, mime_type):
    """Determine file type based on extension and mime type"""
    ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
    
    image_extensions = {'jpg', 'jpeg', 'png', 'gif', 'webp'}
    document_extensions = {'pdf', 'doc', 'docx', 'txt', 'md'}
    
    if ext in image_extensions or mime_type.startswith('image/'):
        return 'image'
    elif ext in document_extensions or mime_type.startswith('application/'):
        return 'document'
    else:
        return 'other'

def generate_unique_filename(original_filename):
    """Generate unique filename using timestamp and UUID"""
    ext = original_filename.rsplit('.', 1)[1].lower() if '.' in original_filename else ''
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    unique_id = str(uuid.uuid4())[:8]
    return f"{timestamp}_{unique_id}.{ext}" if ext else f"{timestamp}_{unique_id}"

def get_upload_path(user_id, year_month=None):
    """Get upload path for a user"""
    if year_month is None:
        year_month = datetime.now().strftime('%Y/%m')
    return os.path.join(current_app.config['UPLOAD_FOLDER'], year_month, str(user_id))

def create_thumbnail(image_path, thumbnail_path, size=(200, 200)):
    """Create thumbnail for image"""
    try:
        with PILImage.open(image_path) as img:
            img.thumbnail(size, PILImage.Resampling.LANCZOS)
            img.save(thumbnail_path, 'WEBP', quality=85)
        return True
    except Exception as e:
        current_app.logger.error(f"Error creating thumbnail: {e}")
        return False

def compress_image(image_path, max_size=2*1024*1024, quality=85):
    """Compress image if it's too large"""
    try:
        file_size = os.path.getsize(image_path)
        if file_size <= max_size:
            return False
        
        with PILImage.open(image_path) as img:
            # Convert to RGB if necessary
            if img.mode in ('RGBA', 'P'):
                img = img.convert('RGB')
            
            # Save with compression
            img.save(image_path, 'JPEG', quality=quality, optimize=True)
        
        return True
    except Exception as e:
        current_app.logger.error(f"Error compressing image: {e}")
        return False

def format_file_size(size_bytes):
    """Format file size in human readable format"""
    if size_bytes is None:
        return 'Unknown'
    
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.2f} TB"