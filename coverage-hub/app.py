from flask import Flask

from modules.home.routes import home_bp
from modules.mobile_access.routes import mobile_access_bp
from modules.b2b_mobile.routes import b2b_mobile_bp


app = Flask(__name__)

# Auto-reload de templates (.html) — pega mudanças sem restart
app.config["TEMPLATES_AUTO_RELOAD"] = True

# Desativa cache de arquivos estáticos (js, css, imgs) em dev
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0

app.register_blueprint(home_bp)
app.register_blueprint(mobile_access_bp)
app.register_blueprint(b2b_mobile_bp)


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True,
        extra_files=[
            "templates/",
            "static/",
        ],
    )