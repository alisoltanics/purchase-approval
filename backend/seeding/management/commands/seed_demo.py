from django.conf import settings
from django.core.management.base import BaseCommand, CommandError, CommandParser

from seeding import services


class Command(BaseCommand):
    help = "Create the demo companies, accounts and requests (docs/seed-spec.md). Idempotent."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument(
            "--reset",
            action="store_true",
            help=(
                "Delete all application data first. "
                "Needs --yes-i-am-sure and ALLOW_SEED_RESET=true."
            ),
        )
        parser.add_argument(
            "--yes-i-am-sure",
            action="store_true",
            dest="confirmed",
            help="Confirms --reset.",
        )

    def handle(self, *args, **options) -> None:
        try:
            password = services.require_password()
            if options["reset"]:
                if not (options["confirmed"] and settings.ALLOW_SEED_RESET):
                    raise services.SeedError(
                        "--reset needs --yes-i-am-sure and the environment variable "
                        "ALLOW_SEED_RESET=true.",
                    )
                services.reset_application_data()
                self.stdout.write("Removed all application data.")
            summary = services.seed_demo(password)
        except services.SeedError as exc:
            raise CommandError(str(exc)) from exc
        self.stdout.write(
            f"Created {summary.companies} companies, {summary.users} users "
            f"and {summary.requests} requests.",
        )
