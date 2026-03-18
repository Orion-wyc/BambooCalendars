from flask import Flask
from flask_cors import CORS
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from app.config import config

db = SQLAlchemy()
migrate = Migrate()

def create_app(config_name='default'):
    app = Flask(__name__)
    app.config.from_object(config[config_name])
    
    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    CORS(app, origins=app.config['CORS_ORIGINS'])
    
    # Create upload folder
    import os
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    
    # Register blueprints
    from app.api.auth import auth_bp
    from app.api.todos import todos_bp
    from app.api.attachments import attachments_bp
    from app.api.records import records_bp
    from app.api.steps import steps_bp
    
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(todos_bp, url_prefix='/api/todos')
    app.register_blueprint(attachments_bp, url_prefix='/api/attachments')
    app.register_blueprint(records_bp, url_prefix='/api/records')
    app.register_blueprint(steps_bp, url_prefix='/api')
    
    return app