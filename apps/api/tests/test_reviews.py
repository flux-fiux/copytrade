"""Master reviews — wiring checks (no DB)."""
from app.core.tenant_context import TENANT_SCOPED_MODELS


def test_master_review_is_tenant_scoped():
    assert "MasterReview" in TENANT_SCOPED_MODELS


def test_reviews_router_routes():
    from app.routers import reviews
    methods = {}
    for r in reviews.router.routes:
        methods.setdefault(r.path, set()).update(getattr(r, "methods", set()))
    assert "/{master_id}/reviews" in methods
    m = methods["/{master_id}/reviews"]
    assert {"GET", "POST", "DELETE"}.issubset(m)


def test_review_model_unique_constraint():
    from app.models.master_review import MasterReview
    names = {c.name for c in MasterReview.__table__.constraints}
    assert "uq_review_master_reviewer" in names
