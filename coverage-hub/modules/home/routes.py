from flask import Blueprint
from flask import render_template

from config.modules import MODULES

home_bp = Blueprint(
    "home",
    __name__,
)


@home_bp.route("/")
def index():
    return render_template(
        "home/index.html",
        modules=MODULES,
    )
