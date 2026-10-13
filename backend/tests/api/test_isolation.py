"""AC-22 matrix: every endpoint x cross-company user x known id (reads and writes)."""

import uuid

import pytest

from approvals.models import PurchaseRequest

from .conftest import World, make_request
from .helpers import (
    LIST_URL,
    MSG_UNAVAILABLE,
    approve_url,
    assert_unavailable,
    detail_url,
    reject_url,
)

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize("outsider", ["casey", "riley"])
def test_cross_company_matrix_is_identical_to_random_id(
    world: World, login_as, outsider: str
) -> None:
    pending = make_request(world.alex, title="Northstar secret")
    api = login_as(getattr(world, outsider))
    random_id = uuid.uuid4()
    before = PurchaseRequest.objects.values().get(id=pending.id)
    cases = [
        ("GET", detail_url, None),
        ("POST", approve_url, None),
        ("POST", reject_url, {"reason": "nope"}),
    ]
    for method, url_for, body in cases:
        known = api.send(method, url_for(pending.id), body)
        unknown = api.send(method, url_for(random_id), body)
        assert_unavailable(known)
        assert (known.status_code, known.content) == (unknown.status_code, unknown.content)
        assert b"Northstar" not in known.content
        assert MSG_UNAVAILABLE.encode() in known.content
    assert PurchaseRequest.objects.values().get(id=pending.id) == before


def test_cross_company_manager_cannot_reject_with_invalid_body_either(
    world: World, login_as
) -> None:
    pending = make_request(world.alex)
    for reason in ("", "   ", "x" * 1001):
        assert_unavailable(login_as(world.riley).reject(pending.id, reason))
    assert PurchaseRequest.objects.get(id=pending.id).status == "pending"


def test_list_and_counts_never_include_other_company(world: World, login_as) -> None:
    for _ in range(3):
        make_request(world.alex)
    for _ in range(25):
        make_request(world.casey)
    north = login_as(world.jordan).get(LIST_URL).json()
    harbor = login_as(world.riley).get(LIST_URL).json()
    assert (north["count"], north["page_count"]) == (3, 1)
    assert (harbor["count"], harbor["page_count"]) == (25, 2)
    northstar_ids = {str(r.id) for r in PurchaseRequest.objects.filter(company=world.north)}
    assert {i["id"] for i in north["results"]} == northstar_ids
    harbor_ids = {str(r.id) for r in PurchaseRequest.objects.filter(company=world.harbor)}
    page1 = login_as(world.riley).get(LIST_URL, {"page": "1"}).json()["results"]
    page2 = login_as(world.riley).get(LIST_URL, {"page": "2"}).json()["results"]
    assert {i["id"] for i in page1 + page2} == harbor_ids


def test_employee_list_excludes_colleagues_and_counts(world: World, login_as) -> None:
    make_request(world.alex)
    for _ in range(30):
        make_request(world.sam)
    make_request(world.jordan)
    data = login_as(world.alex).get(LIST_URL).json()
    assert (data["count"], data["page_count"], len(data["results"])) == (1, 1, 1)
    assert login_as(world.alex).get(LIST_URL, {"page": "2"}).json()["page"] == 1


def test_employee_cannot_decide_colleagues_request(world: World, login_as) -> None:
    row = make_request(world.sam)
    api = login_as(world.alex)
    unknown = api.approve(uuid.uuid4())
    assert_unavailable(api.approve(row.id))
    assert api.approve(row.id).content == unknown.content
    assert_unavailable(api.reject(row.id, "no"))
    assert PurchaseRequest.objects.get(id=row.id).status == "pending"
