import os

from flask import Flask, send_from_directory

from modules.core.routes import core_bp
from modules.mobile_access.routes import mobile_access_bp
from modules.network_core.routes import network_core_bp


app = Flask(__name__)

# Desativa cache de arquivos estáticos (js, css, imgs) em dev
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0

app.register_blueprint(core_bp)
app.register_blueprint(mobile_access_bp)
app.register_blueprint(network_core_bp)

DIST_DIR = os.path.join(app.static_folder, "dist")


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def spa(path):
    """
    Toda a UI é React (SPA). Qualquer rota que não seja API ou estático
    devolve o index.html buildado pelo Vite — o roteamento de verdade
    acontece no cliente (react-router).
    """
    return send_from_directory(DIST_DIR, "index.html")


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True,
    )
