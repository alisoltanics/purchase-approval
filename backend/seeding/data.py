"""The fixed ids, texts and timestamps of docs/seed-spec.md (frozen by T01)."""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from accounts.settings import Role
from approvals.settings import Status


@dataclass(frozen=True)
class CompanySpec:
    id: uuid.UUID
    name: str


@dataclass(frozen=True)
class UserSpec:
    id: uuid.UUID
    email: str
    display_name: str
    role: Role
    company_id: uuid.UUID


@dataclass(frozen=True)
class RequestSpec:
    id: uuid.UUID
    company_id: uuid.UUID
    requester_id: uuid.UUID
    title: str
    vendor: str
    description: str
    amount: Decimal
    status: Status
    submitted_at: datetime
    decided_by_id: uuid.UUID | None = None
    decided_at: datetime | None = None
    rejection_reason: str | None = None


def utc(
    year: int,
    month: int,
    day: int,
    hour: int,
    minute: int,
) -> datetime:
    return datetime(year, month, day, hour, minute, tzinfo=UTC)


NORTHSTAR = CompanySpec(
    id=uuid.UUID("587682aa-b865-4a50-9035-4b5551defd6b"),
    name="Northstar Labs",
)
HARBOR = CompanySpec(
    id=uuid.UUID("7ed2940e-82f6-4e2f-a1a1-624a982276a3"),
    name="Harbor Works",
)
FIXTURE_CO = CompanySpec(
    id=uuid.UUID("93d3e72c-a081-4027-a2bb-090a95679d04"),
    name="Fixture Co",
)

ALEX = UserSpec(
    id=uuid.UUID("2bc1188c-bc4c-4dc3-8536-0b3c667a7977"),
    email="alex@northstar.example",
    display_name="Alex Morgan",
    role=Role.EMPLOYEE,
    company_id=NORTHSTAR.id,
)
SAM = UserSpec(
    id=uuid.UUID("a66ad261-6322-43d0-b2fa-307c87e52f69"),
    email="sam@northstar.example",
    display_name="Sam Rivera",
    role=Role.EMPLOYEE,
    company_id=NORTHSTAR.id,
)
JORDAN = UserSpec(
    id=uuid.UUID("3f78235c-d9b2-4dac-8767-79f4bbe833c2"),
    email="jordan@northstar.example",
    display_name="Jordan Lee",
    role=Role.MANAGER,
    company_id=NORTHSTAR.id,
)
TAYLOR = UserSpec(
    id=uuid.UUID("26a6e77c-e9dd-4256-a564-237acf4fef97"),
    email="taylor@northstar.example",
    display_name="Taylor Chen",
    role=Role.MANAGER,
    company_id=NORTHSTAR.id,
)
CASEY = UserSpec(
    id=uuid.UUID("eb530f0d-6203-4590-9663-61752e919c5b"),
    email="casey@harbor.example",
    display_name="Casey Patel",
    role=Role.EMPLOYEE,
    company_id=HARBOR.id,
)
RILEY = UserSpec(
    id=uuid.UUID("1f8ff934-0277-4387-9b97-e7cf0bcfb6a2"),
    email="riley@harbor.example",
    display_name="Riley Brooks",
    role=Role.MANAGER,
    company_id=HARBOR.id,
)

MIA = UserSpec(
    id=uuid.UUID("ee3a02f0-4859-4943-ae9c-c5c612d32819"),
    email="mia@fixture.example",
    display_name="Mia Fischer",
    role=Role.EMPLOYEE,
    company_id=FIXTURE_CO.id,
)
ELI = UserSpec(
    id=uuid.UUID("d8cc72ba-e377-46d8-ba1c-183d8cf1529c"),
    email="eli@fixture.example",
    display_name="Eli Novak",
    role=Role.EMPLOYEE,
    company_id=FIXTURE_CO.id,
)
OLA = UserSpec(
    id=uuid.UUID("c70dcefb-02f8-4241-ada7-e1e6d4cd3c45"),
    email="ola@fixture.example",
    display_name="Ola Berg",
    role=Role.MANAGER,
    company_id=FIXTURE_CO.id,
)
NOA = UserSpec(
    id=uuid.UUID("c91fb8fb-0574-4902-a5f0-6d94f73fa6d9"),
    email="noa@fixture.example",
    display_name="Noa Weiss",
    role=Role.EMPLOYEE,
    company_id=FIXTURE_CO.id,
)

DEMO_COMPANIES = [
    NORTHSTAR,
    HARBOR,
]
DEMO_USERS = [
    ALEX,
    SAM,
    JORDAN,
    TAYLOR,
    CASEY,
    RILEY,
]
FIXTURE_COMPANIES = [
    FIXTURE_CO,
]
FIXTURE_USERS = [
    MIA,
    ELI,
    OLA,
    NOA,
]

DEMO_REQUESTS = [
    RequestSpec(
        id=uuid.UUID("86935e09-143b-482a-bf3c-f7400bc4b6de"),
        company_id=NORTHSTAR.id,
        requester_id=ALEX.id,
        title="Standing desk for design team",
        vendor="Ergo Office Supply",
        description=(
            "Two sit-stand desks, 160 cm wide.\n"
            "Needed for the new design hires starting next week.\n"
            "Delivery to the 3rd floor."
        ),
        amount=Decimal("649.00"),
        status=Status.PENDING,
        submitted_at=utc(2026, 10, 1, 9, 15),
    ),
    RequestSpec(
        id=uuid.UUID("c24bfa1c-bfe6-4a3e-aa16-94a938408533"),
        company_id=NORTHSTAR.id,
        requester_id=ALEX.id,
        title="Annual design tool licenses",
        vendor="Pixelforge Software",
        description="Renewal of 5 seats for the design team.",
        amount=Decimal("4200.00"),
        status=Status.PENDING,
        submitted_at=utc(2026, 10, 2, 13, 40),
    ),
    RequestSpec(
        id=uuid.UUID("3abb0e19-9e9b-4175-927d-b4267f6b614b"),
        company_id=NORTHSTAR.id,
        requester_id=SAM.id,
        title="Team offsite catering",
        vendor="Green Fork Catering",
        description="Lunch for 24 people at the quarterly offsite.",
        amount=Decimal("1250.50"),
        status=Status.PENDING,
        submitted_at=utc(2026, 10, 3, 8, 5),
    ),
    RequestSpec(
        id=uuid.UUID("5d3c1a76-ac3f-4038-bade-975bf75a06ce"),
        company_id=NORTHSTAR.id,
        requester_id=JORDAN.id,
        title="Conference travel for Q4 summit",
        vendor="Skyway Travel",
        description="Flights and hotel for two people attending the summit.",
        amount=Decimal("2380.75"),
        status=Status.PENDING,
        submitted_at=utc(2026, 10, 4, 16, 20),
    ),
    RequestSpec(
        id=uuid.UUID("d21a4ea9-e5d4-4be4-b55e-10e0c70b37ea"),
        company_id=NORTHSTAR.id,
        requester_id=ALEX.id,
        title="Laptop replacement",
        vendor="Byte Hardware Direct",
        description="Current laptop is out of warranty and failing.",
        amount=Decimal("1899.99"),
        status=Status.APPROVED,
        submitted_at=utc(2026, 9, 28, 10, 0),
        decided_by_id=JORDAN.id,
        decided_at=utc(2026, 9, 29, 11, 30),
    ),
    RequestSpec(
        id=uuid.UUID("35aba7f5-7773-4599-a72d-5403282a3f07"),
        company_id=NORTHSTAR.id,
        requester_id=SAM.id,
        title="Premium coffee machine",
        vendor="Barista Pro Equipment",
        description="Espresso machine for the shared kitchen.",
        amount=Decimal("3299.00"),
        status=Status.REJECTED,
        submitted_at=utc(2026, 9, 26, 14, 10),
        decided_by_id=JORDAN.id,
        decided_at=utc(2026, 9, 27, 9, 45),
        rejection_reason="Budget for office equipment is exhausted this quarter.",
    ),
    RequestSpec(
        id=uuid.UUID("0d02dd1a-0b66-4756-a86d-724d1706d19a"),
        company_id=HARBOR.id,
        requester_id=CASEY.id,
        title="Warehouse safety gloves",
        vendor="SafeGrip Supplies",
        description="Replacement gloves for the loading dock crew.",
        amount=Decimal("312.40"),
        status=Status.PENDING,
        submitted_at=utc(2026, 10, 5, 7, 30),
    ),
    RequestSpec(
        id=uuid.UUID("58cbac00-1ad9-4906-9d31-ce978c20a514"),
        company_id=HARBOR.id,
        requester_id=CASEY.id,
        title="Pallet jack maintenance contract",
        vendor="Dockside Services",
        description="Yearly service contract for two pallet jacks.",
        amount=Decimal("780.00"),
        status=Status.APPROVED,
        submitted_at=utc(2026, 9, 30, 12, 0),
        decided_by_id=RILEY.id,
        decided_at=utc(2026, 10, 1, 8, 20),
    ),
]

FIXTURE_FIRST_SUBMITTED = utc(2026, 9, 1, 8, 0)


def _fixture_request(
    n: int,
    requester: UserSpec,
    status: Status,
) -> RequestSpec:
    decided = status != Status.PENDING
    submitted_at = FIXTURE_FIRST_SUBMITTED + timedelta(minutes=n // 4)
    return RequestSpec(
        id=uuid.uuid5(FIXTURE_CO.id, f"request-{n}"),
        company_id=FIXTURE_CO.id,
        requester_id=requester.id,
        title=f"Fixture request {n}",
        vendor=f"Fixture Vendor {n % 7}",
        description=f"Fixture request {n}.",
        amount=Decimal(f"{n}.50" if n % 5 == 0 else f"{n}.00"),
        status=status,
        submitted_at=submitted_at,
        decided_by_id=OLA.id if decided else None,
        decided_at=submitted_at + timedelta(hours=1) if decided else None,
        rejection_reason=(f"Fixture rejection {n}." if status == Status.REJECTED else None),
    )


def build_fixture_requests() -> list[RequestSpec]:
    """3 + 25 + 17 requests: Eli, Noa and Ola (docs/seed-spec.md section 4)."""
    noa_status_by_remainder = {
        0: Status.PENDING,
        1: Status.APPROVED,
        2: Status.REJECTED,
    }
    requests = [_fixture_request(n, ELI, Status.PENDING) for n in range(1, 4)]
    requests += [_fixture_request(n, NOA, noa_status_by_remainder[n % 3]) for n in range(4, 29)]
    requests += [_fixture_request(n, OLA, Status.PENDING) for n in range(29, 46)]
    return requests
