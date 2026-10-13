import json
from pathlib import Path

import pytest

from common import validators
from common.validators import MISSING, FieldInvalidError

FIXTURE_CANDIDATES = [
    Path("/testdata/validation-cases.json"),
    Path(__file__).resolve().parents[3] / "testdata" / "validation-cases.json",
]
FIXTURE = next(path for path in FIXTURE_CANDIDATES if path.exists())
DATA = json.loads(FIXTURE.read_text(encoding="utf-8"))

VALIDATORS = {
    "title": validators.validate_title,
    "vendor": validators.validate_vendor,
    "description": validators.validate_description,
    "rejection_reason": validators.validate_reason,
    "amount": validators.validate_amount,
    "login_email": validators.validate_login_email,
    "login_password": validators.validate_login_password,
}

CASES = [
    pytest.param(group, case, id=case["id"])
    for group, spec in DATA["groups"].items()
    for case in spec["cases"]
]


def test_every_fixture_group_has_a_validator():
    assert set(DATA["groups"]) == set(VALIDATORS)


def test_limits_match_the_fixture():
    assert DATA["limits"] == {
        "title": validators.TITLE_MAX,
        "vendor": validators.VENDOR_MAX,
        "description": validators.DESCRIPTION_MAX,
        "rejection_reason": validators.REASON_MAX,
    }


@pytest.mark.parametrize(("group", "case"), CASES)
def test_shared_validation_case(group, case):
    value = MISSING if case.get("missing") else case["input"]
    validator = VALIDATORS[group]
    if case["valid"]:
        assert validator(value) == case["normalized"]
    else:
        with pytest.raises(FieldInvalidError) as exc:
            validator(value)
        assert exc.value.code == case["code"]
