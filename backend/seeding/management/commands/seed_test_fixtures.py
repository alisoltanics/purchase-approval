from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from seeding import services

ALLOWED_ENVIRONMENTS = {"dev", "test"}


class Command(BaseCommand):
    help = "Add the empty-list, no-match and pagination scenarios (dev and test only)."

    def handle(self, *args, **options) -> None:
        try:
            if settings.DJANGO_ENV not in ALLOWED_ENVIRONMENTS:
                raise services.SeedError(
                    "seed_test_fixtures only runs when DJANGO_ENV is dev or test.",
                )
            password = services.require_password()
            if not services.demo_data_exists():
                raise services.SeedError("Run seed_demo first: the demo accounts do not exist.")
            summary = services.seed_test_fixtures(password)
        except services.SeedError as exc:
            raise CommandError(str(exc)) from exc
        self.stdout.write(
            f"Created {summary.companies} companies, {summary.users} users "
            f"and {summary.requests} requests.",
        )
