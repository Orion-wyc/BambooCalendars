import os
from app import create_app, db
from app.models import User, Todo, Attachment

app = create_app(os.getenv('FLASK_CONFIG', 'default'))

@app.shell_context_processor
def make_shell_context():
    return {'db': db, 'User': User, 'Todo': Todo, 'Attachment': Attachment}

@app.cli.command()
def init_db():
    """Initialize the database."""
    db.create_all()
    print('Database initialized.')

@app.cli.command()
def drop_db():
    """Drop the database."""
    db.drop_all()
    print('Database dropped.')

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)